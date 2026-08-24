import { describe, expect, it, vi } from 'vitest';
import {
  connectionFromKnownPreset,
  inferCustomConnection,
  parseCustomApiUrl,
  presetForApiLocation,
} from './customAIConnection';
import catalog from '../../config/ai-providers.json';
import type { AIProviderCatalog } from '../types/desktop';
import { validateWebConnection } from './webAI/security';

describe('自定义 API 两字段解析', () => {
  it('accepts both a base URL and a complete chat-completions URL', () => {
    expect(parseCustomApiUrl('https://api.example.com/v1/')).toEqual({
      baseUrl: 'https://api.example.com/v1',
      generationPath: '/chat/completions',
      displayUrl: 'https://api.example.com/v1/chat/completions',
    });
    expect(parseCustomApiUrl('https://api.example.com/v1/chat/completions?api-version=2026-01-01')).toEqual({
      baseUrl: 'https://api.example.com/v1',
      generationPath: '/chat/completions?api-version=2026-01-01',
      displayUrl: 'https://api.example.com/v1/chat/completions?api-version=2026-01-01',
    });
  });

  it('rejects public HTTP and unsafe URL forms', () => {
    expect(() => parseCustomApiUrl('http://api.example.com/v1')).toThrow(/HTTPS/);
    expect(() => parseCustomApiUrl('https://user:pass@api.example.com/v1')).toThrow(/账号/);
    expect(() => parseCustomApiUrl('https://api.example.com/v1?api-version=2026-01-01')).toThrow(/查询参数/);
    expect(() => parseCustomApiUrl('https://api.example.com/v1/chat/completions?api_key=secret')).toThrow(/密钥参数/);
  });

  it('maps a known complete provider without guessing model names', () => {
    const providerCatalog = catalog as unknown as AIProviderCatalog;
    const location = parseCustomApiUrl('https://api.siliconflow.cn/v1');
    const preset = presetForApiLocation(location, providerCatalog.presets);
    expect(preset?.id).toBe('siliconflow-cn-quality');
    const inferred = connectionFromKnownPreset(preset!, location, 'known-id');
    expect(inferred.missing).toEqual([]);
    expect(inferred.connection.capabilities.embedding?.model).toBe('Qwen/Qwen3-Embedding-4B');
  });

  it('maps an Alibaba Beijing workspace URL to browser-compatible generation, embedding, and rerank endpoints', () => {
    const providerCatalog = catalog as unknown as AIProviderCatalog;
    const location = parseCustomApiUrl('https://llm-example123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1');
    const preset = presetForApiLocation(location, providerCatalog.presets);
    expect(preset?.id).toBe('alibaba-cn-quality');

    const inferred = connectionFromKnownPreset(preset!, location, 'alibaba-id');

    expect(inferred.missing).toEqual([]);
    expect(inferred.connection).toMatchObject({
      id: 'alibaba-id',
      providerId: 'alibaba',
      presetId: 'alibaba-cn-quality',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      fields: { workspaceId: 'llm-example123' },
      capabilities: {
        generation: { protocol: 'openai-chat', model: 'qwen3.7-plus' },
        embedding: { protocol: 'openai-embeddings', model: 'text-embedding-v4' },
        rerank: {
          protocol: 'alibaba-rerank',
          model: 'qwen3-rerank',
          url: 'https://llm-example123.cn-beijing.maas.aliyuncs.com/compatible-api/v1/reranks',
        },
      },
    });
    expect(inferred.connection.capabilities.rerank?.urlTemplate).toBeUndefined();
    expect(validateWebConnection(inferred.connection).endpoints).toEqual({
      generation: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      embedding: 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
      rerank: 'https://llm-example123.cn-beijing.maas.aliyuncs.com/compatible-api/v1/reranks',
    });
    expect(presetForApiLocation(
      parseCustomApiUrl('https://llm-example123.cn-beijing.maas.aliyuncs.com.evil.example/compatible-mode/v1'),
      providerCatalog.presets,
    )).toBeNull();
  });

  it('classifies a generic model catalog into the three required capabilities', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-id' });
    const inferred = inferCustomConnection(parseCustomApiUrl('https://relay.example.com/v1'), [
      'black-forest-labs/FLUX.1',
      'deepseek-ai/DeepSeek-V4-Pro',
      'Qwen/Qwen3-Embedding-4B',
      'Qwen/Qwen3-Reranker-8B',
    ]);
    expect(inferred.missing).toEqual([]);
    expect(inferred.detected).toEqual({
      generation: 'deepseek-ai/DeepSeek-V4-Pro',
      embedding: 'Qwen/Qwen3-Embedding-4B',
      rerank: 'Qwen/Qwen3-Reranker-8B',
    });
    expect(inferred.connection.capabilities.generation?.path).toBe('/chat/completions');
    vi.unstubAllGlobals();
  });

  it('reports missing capabilities instead of inventing models', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-id' });
    const inferred = inferCustomConnection(parseCustomApiUrl('https://chat.example.com/v1'), ['chat-model']);
    expect(inferred.missing).toEqual(['embedding', 'rerank']);
    expect(inferred.connection.capabilities.generation?.model).toBe('chat-model');
    vi.unstubAllGlobals();
  });
});
