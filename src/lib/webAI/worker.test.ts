// @vitest-environment jsdom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebAICommand, WebAIResponse } from './protocol';

const posted: Array<WebAIResponse | { event: 'status'; status: unknown }> = [];
const calls = { generation: 0, embedding: 0, rerank: 0, bundled: 0 };
const generationBodies: Array<Record<string, unknown>> = [];
const embeddingBodies: Array<Record<string, unknown>> = [];
let embeddingFailureAt = 0;
let sequence = 0;

function providerResponse(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

async function call<T>(command: WebAICommand, payload?: unknown): Promise<T> {
  const id = `request-${sequence += 1}`;
  window.dispatchEvent(new MessageEvent('message', { data: { id, command, payload } }));
  await vi.waitFor(() => expect(posted.some((message) => 'id' in message && message.id === id)).toBe(true));
  const message = posted.find((item): item is WebAIResponse => 'id' in item && item.id === id)!;
  if (!message.ok) throw message.error;
  return message.value as T;
}

async function testCapability(capability: 'generation' | 'embedding' | 'rerank', credentialSource?: 'generation' | 'embedding', modelOverride?: string) {
  const model = modelOverride || (capability === 'generation' ? 'chat-test' : capability === 'embedding' ? 'text-embedding-v4' : 'rerank-test');
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
      if (url.endsWith('/models')) {
        return providerResponse({ data: [{ id: 'chat-test' }] });
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
        embeddingBodies.push(body);
        if (calls.embedding === embeddingFailureAt) {
          return providerResponse({ error: { code: 'request_limit_exceeded', message: 'request limit exceeded' } }, 400, {
            'modelscope-ratelimit-model-requests-remaining': '0',
            'x-request-id': 'worker-request-400',
          });
        }
        const inputValues = Array.isArray(body.input) ? body.input : [body.input];
        const dimensions = body.model === 'custom-embedding' ? 2 : 1024;
        return providerResponse({ data: inputValues.map((_: string, index: number) => ({ index, embedding: Array(dimensions).fill(index ? 0.5 : 1) })) });
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
    embeddingBodies.length = 0;
    embeddingFailureAt = 0;
    await call('clear');
    posted.length = 0;
  });

  it('模型目录确认不依赖预先填写模型名称', async () => {
    const result = await call<{ ok: boolean; modelIds: string[] }>('listModels', {
      capability: 'generation',
      apiUrl: 'https://api.example.com/v1',
      apiKey: 'session-key',
      webSecurity: { confirmedOrigins: ['https://api.example.com'] },
    });

    expect(result).toEqual({ ok: true, modelIds: ['chat-test'] });
  });

  it('完整接口与任意模型通过测试后按相同目标正式调用，密钥只清理一次 Bearer', async () => {
    const url = 'https://gateway.example.com/tenant/invoke?api-version=2026-01';
    const request = vi.mocked(fetch);
    request.mockResolvedValueOnce(providerResponse({ choices: [{ message: { content: '连接成功' } }] }));
    const tested = await call<{ ok: boolean }>('testCapability', { capability: 'generation', apiUrl: url, addressMode: 'exact', model: 'private-alias', apiKey: ' Bearer arbitrary-key ', consentAccepted: true, webSecurity: { confirmedOrigins: ['https://gateway.example.com'] } });
    expect(tested.ok).toBe(true);
    const [target, options] = request.mock.calls.at(-1)!;
    expect(target).toBe(url);
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer arbitrary-key');
    expect(JSON.parse(String(options?.body)).model).toBe('private-alias');
    expect((await call<{ ok: boolean }>('completeSetup', { capabilities: ['generation'] })).ok).toBe(true);
    request.mockResolvedValueOnce(providerResponse({ choices: [{ message: { content: '完整解读' } }] }));
    await call('analyze', { question: '事业', category: '事业工作', plate: {}, evidence: [] });
    expect(request.mock.calls.at(-1)![0]).toBe(url);
    expect(JSON.parse(String(request.mock.calls.at(-1)![1]?.body)).model).toBe('private-alias');
  });

  it('服务切换不自动取用旧密钥，显式密钥引用也不能跨域', async () => {
    await testCapability('generation');
    await call('completeSetup', { capabilities: ['generation'] });
    const count = vi.mocked(fetch).mock.calls.length;
    const payload = { capability: 'generation', apiUrl: 'https://other.example.com/v1', model: 'private-alias', consentAccepted: true, webSecurity: { confirmedOrigins: ['https://other.example.com'] } };
    await expect(call('testCapability', payload)).rejects.toMatchObject({ code: 'WEB_AI_KEY_REQUIRED' });
    await expect(call('testCapability', { ...payload, credentialSource: 'generation' })).rejects.toMatchObject({ code: 'WEB_AI_CREDENTIAL_ORIGIN_CHANGED' });
    expect(vi.mocked(fetch).mock.calls.length).toBe(count);
  });

  it('向量模型更换后不沿用原模型维度', async () => {
    await testCapability('generation');
    await testCapability('embedding', 'generation');
    await testCapability('embedding', 'generation', 'custom-embedding');
    expect(embeddingBodies.at(-1)).not.toHaveProperty('dimensions');
  });

  it('同一域名下不同向量接口分别识别缓存', async () => {
    await testCapability('generation');
    await testCapability('embedding', 'generation');
    const first = await call<{ status: { activeFingerprint: string } }>('completeSetup', { capabilities: ['generation', 'embedding'] });
    await call('testCapability', { capability: 'embedding', apiUrl: 'https://api.example.com/tenant/embeddings', addressMode: 'exact', model: 'text-embedding-v4', credentialSource: 'embedding', consentAccepted: true, webSecurity: { confirmedOrigins: ['https://api.example.com'] } });
    const second = await call<{ status: { activeFingerprint: string } }>('completeSetup', { capabilities: ['generation', 'embedding'] });
    expect(first.status.activeFingerprint).not.toBe(second.status.activeFingerprint);
  });

  it('仅主模型、向量融合和完整重排三种模式都按实际能力发请求', async () => {
    await testCapability('generation');
    const mainOnly = await call<{ ok: boolean; status: { activeCapabilities: Record<string, unknown> } }>('completeSetup', { capabilities: ['generation'] });
    expect(mainOnly.ok).toBe(true);
    expect(Object.keys(mainOnly.status.activeCapabilities)).toEqual(['generation']);
    const lexical = await call<{ evidence: Array<{ id: string; knowledgeKind?: string }>; diagnostics: { vectorUsed: boolean; rerankUsed: boolean } }>('search', { query: '事业', domainTerms: ['官鬼'] });
    expect(lexical.diagnostics).toMatchObject({ vectorUsed: false, rerankUsed: false });
    expect(lexical.evidence.length).toBeGreaterThan(0);
    expect(lexical.evidence.every((entry) => ['rule', 'case', 'doctrine'].includes(entry.knowledgeKind || ''))).toBe(true);
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

  it('生成模型最小测试统一使用短推理预算，DeepSeek 官方适配仍只发一次请求', async () => {
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
      max_tokens: 512,
      thinking: { type: 'disabled' },
    });
  });

  it('自定义向量建库失败后阻止直接续发，重新测试后从内存断点恢复', async () => {
    await testCapability('generation');
    await testCapability('embedding', 'generation', 'custom-embedding');
    embeddingFailureAt = 3;

    const failed = await call<{ ok: boolean; status: { draft: { indexTask: { completed: number; failedRange: { start: number; end: number } }; tests: { embedding: { status: string } } } }; error: { code: string } }>('completeSetup', {
      capabilities: ['generation', 'embedding'],
      bulkEmbeddingAccepted: true,
    });

    expect(failed.ok).toBe(false);
    expect(failed.error.code).toBe('WEB_AI_RATE_LIMITED');
    expect(failed.status.draft.indexTask).toMatchObject({ completed: 10, failedRange: { start: 10, end: 20 } });
    expect(failed.status.draft.tests.embedding.status).toBe('failed');
    const failedBatchFirstDocument = (embeddingBodies.at(-1)?.input as string[])[0];
    const requestsBeforeResume = calls.embedding;
    const blocked = await call<{ status: string }>('resumeBuild');
    expect(blocked.status).toBe('error');
    expect(calls.embedding).toBe(requestsBeforeResume);

    embeddingFailureAt = 0;
    await testCapability('embedding', 'generation', 'custom-embedding');
    embeddingBodies.length = 0;
    const recovered = await call<{ ok: boolean }>('completeSetup', {
      capabilities: ['generation', 'embedding'],
      bulkEmbeddingAccepted: true,
    });

    expect(recovered.ok).toBe(true);
    expect((embeddingBodies[0].input as string[])[0]).toBe(failedBatchFirstDocument);
  });
});
