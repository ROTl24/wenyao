// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebAICommand, WebAIResponse } from './protocol';

const posted: Array<WebAIResponse | { event: 'status'; status: unknown }> = [];
const calls = { generation: 0, embedding: 0, rerank: 0, bundled: 0 };
const generationBodies: Array<Record<string, unknown>> = [];
let sequence = 0;

function providerResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function call<T>(command: WebAICommand, payload?: unknown): Promise<T> {
  const id = `request-${sequence += 1}`;
  window.dispatchEvent(new MessageEvent('message', { data: { id, command, payload } }));
  await vi.waitFor(() => expect(posted.some((message) => 'id' in message && message.id === id)).toBe(true));
  const message = posted.find((item): item is WebAIResponse => 'id' in item && item.id === id)!;
  if (!message.ok) throw message.error;
  return message.value as T;
}

async function testCapability(capability: 'generation' | 'embedding' | 'rerank', credentialSource?: 'generation' | 'embedding') {
  const model = capability === 'generation' ? 'chat-test' : capability === 'embedding' ? 'text-embedding-v4' : 'rerank-test';
  const value = await call<{ ok: boolean }>('testCapability', {
    capability,
    apiUrl: 'https://api.example.com/v1',
    model,
    ...(credentialSource ? { credentialSource } : { apiKey: 'session-key' }),
    consentAccepted: true,
    webSecurity: { confirmedOrigins: ['https://api.example.com'] },
  });
  expect(value.ok).toBe(true);
}

describe('PWA 隔离 Worker 的可选能力链路', () => {
  beforeAll(async () => {
    vi.spyOn(window, 'postMessage').mockImplementation((message) => { posted.push(message as typeof posted[number]); });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('corpus-vectors')) {
        calls.bundled += 1;
        return new Response(new Uint8Array(1263 * 1024 * 4));
      }
      const body = JSON.parse(String(init?.body || '{}'));
      if (url.endsWith('/chat/completions')) {
        calls.generation += 1;
        generationBodies.push(body);
        const deepSeek = new URL(url).hostname === 'api.deepseek.com';
        const thinkingDisabled = (body.thinking as { type?: string } | undefined)?.type === 'disabled';
        return providerResponse({
          choices: [{
            finish_reason: deepSeek && !thinkingDisabled ? 'length' : 'stop',
            message: deepSeek && !thinkingDisabled
              ? { content: '', reasoning_content: '正在思考如何回答' }
              : { content: '## 模拟解读' },
          }],
        });
      }
      if (url.endsWith('/embeddings')) {
        calls.embedding += 1;
        const inputValues = Array.isArray(body.input) ? body.input : [body.input];
        return providerResponse({ data: inputValues.map((_: string, index: number) => ({ index, embedding: Array(1024).fill(index ? 0.5 : 1) })) });
      }
      calls.rerank += 1;
      return providerResponse({ results: body.documents.map((_: string, index: number) => ({ index, relevance_score: 1 - index * 0.01 })) });
    }));
    await import('./worker');
  });

  beforeEach(async () => {
    posted.length = 0;
    calls.generation = 0; calls.embedding = 0; calls.rerank = 0; calls.bundled = 0;
    generationBodies.length = 0;
    await call('clear');
    posted.length = 0;
  });

  it('仅主模型、向量融合和完整重排三种模式都按实际能力发请求', async () => {
    await testCapability('generation');
    const mainOnly = await call<{ ok: boolean; status: { activeCapabilities: Record<string, unknown> } }>('completeSetup', { capabilities: ['generation'] });
    expect(mainOnly.ok).toBe(true);
    expect(Object.keys(mainOnly.status.activeCapabilities)).toEqual(['generation']);
    const lexical = await call<{ diagnostics: { vectorUsed: boolean; rerankUsed: boolean } }>('search', { query: '事业', domainTerms: ['官鬼'] });
    expect(lexical.diagnostics).toMatchObject({ vectorUsed: false, rerankUsed: false });
    expect(calls).toMatchObject({ generation: 1, embedding: 0, rerank: 0 });

    await call('clear');
    calls.generation = 0; calls.embedding = 0; calls.rerank = 0;
    await testCapability('generation');
    await testCapability('embedding', 'generation');
    const vector = await call<{ ok: boolean }>('completeSetup', { capabilities: ['generation', 'embedding'] });
    expect(vector.ok).toBe(true);
    const fused = await call<{ diagnostics: { vectorUsed: boolean; rerankUsed: boolean } }>('search', { query: '事业', domainTerms: ['官鬼'] });
    expect(fused.diagnostics).toMatchObject({ vectorUsed: true, rerankUsed: false });
    expect(calls.rerank).toBe(0);

    await call('clear');
    calls.generation = 0; calls.embedding = 0; calls.rerank = 0;
    await testCapability('generation');
    await testCapability('embedding', 'generation');
    await testCapability('rerank', 'embedding');
    const full = await call<{ ok: boolean }>('completeSetup', { capabilities: ['generation', 'embedding', 'rerank'] });
    expect(full.ok).toBe(true);
    const reranked = await call<{ diagnostics: { vectorUsed: boolean; rerankUsed: boolean } }>('search', { query: '事业', domainTerms: ['官鬼'] });
    expect(reranked.diagnostics).toMatchObject({ vectorUsed: true, rerankUsed: true });
    expect(calls.rerank).toBe(2);
  });

  it('DeepSeek 最小测试关闭默认思考模式并且只发一次请求', async () => {
    const result = await call<{ ok: boolean }>('testCapability', {
      capability: 'generation',
      apiUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      apiKey: 'session-key',
      consentAccepted: true,
      webSecurity: { confirmedOrigins: ['https://api.deepseek.com'] },
    });

    expect(result.ok).toBe(true);
    expect(calls.generation).toBe(1);
    expect(generationBodies[0]).toMatchObject({
      max_tokens: 16,
      thinking: { type: 'disabled' },
    });
  });
});
