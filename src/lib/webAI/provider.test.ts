import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProvider, discoverWebModels } from './provider';
import type { AIConnection } from '../../types/desktop';

describe('网页自定义 AI 模型发现', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads model IDs through a credentialed GET request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'chat-model' }, { model: 'embed-model' }, { name: 'rerank-model' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(discoverWebModels('https://api.example.com/v1', 'secret')).resolves.toEqual([
      'chat-model', 'embed-model', 'rerank-model',
    ]);
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/v1/models', expect.objectContaining({
      method: 'GET',
      credentials: 'omit',
      headers: expect.objectContaining({ authorization: 'Bearer secret' }),
    }));
  });

  it('omits dimensions until the embedding probe reveals the response size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ index: 0, embedding: [1, 0, 0] }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { embedding: { protocol: 'openai-embeddings', model: 'embed-model' } },
      createdAt: '', updatedAt: '',
    };

    await expect(createWebProvider(connection, 'secret').embed('测试')).resolves.toEqual([[1, 0, 0]]);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      model: 'embed-model', input: ['测试'], encoding_format: 'float',
    });
  });
});
