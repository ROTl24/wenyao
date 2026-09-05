import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebProvider, discoverWebModels, secureJsonRequest } from './provider';
import type { AIConnection } from '../../types/desktop';

describe('网页自定义 AI 模型发现', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it('recognizes a provider quota rejection returned as HTTP 400 without exposing secrets', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'request_limit_exceeded', message: 'limit reached for sk-dangerous-secret' },
    }), {
      status: 400,
      headers: {
        'modelscope-ratelimit-model-requests-remaining': '0',
        'x-request-id': 'web-request-400',
      },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await secureJsonRequest('https://api.example.com/v1/embeddings', 'secret', {
      model: 'embed-model', input: ['测试'],
    }).catch((value) => value);
    expect(error).toMatchObject({
      detail: {
        code: 'WEB_AI_RATE_LIMITED',
        technicalDetails: expect.stringContaining('web-request-400'),
      },
    });
    expect(error.detail.technicalDetails).not.toContain('sk-dangerous-secret');
  });

  it('keeps a continuously active chat stream alive without a total deadline', async () => {
    vi.useFakeTimers();
    const usageRecords: unknown[] = [];
    const encoder = new TextEncoder();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const chunks = [
            'data: {"choices":[{"delta":{"reasoning_content":"分析中"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_content":"继续分析"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"持"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"续"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"reasoning_content":"核对中"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"输"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"出"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"完"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"整"},"finish_reason":"stop"}],"usage":{"prompt_tokens":120,"completion_tokens":80,"total_tokens":200}}\n\n',
            'data: [DONE]\n\n',
          ];
          chunks.forEach((chunk, index) => {
            setTimeout(() => {
              if (!init?.signal?.aborted) controller.enqueue(encoder.encode(chunk));
            }, 80_000 * (index + 1));
          });
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
        },
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } },
      createdAt: '', updatedAt: '',
    };
    const pending = createWebProvider(connection, 'secret', (item) => usageRecords.push(item)).chat({
      messages: [{ role: 'user', content: '生成完整解读' }],
    });
    const captured = pending.catch((error) => error);

    await vi.advanceTimersByTimeAsync(800_000);

    await expect(captured).resolves.toMatchObject({ content: '持续输出完整' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: 'chat-model',
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(usageRecords).toEqual([expect.objectContaining({
      capability: 'generation', model: 'chat-model', totalTokens: 200,
    })]);
  });

  it('allows a complex analysis stream to take two minutes before its first chunk', async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const chunks = [
            'data: {"choices":[{"delta":{"content":"完整"},"finish_reason":null}]}\n\n',
            'data: {"choices":[{"delta":{"content":"解读"},"finish_reason":"stop"}]}\n\n',
            'data: [DONE]\n\n',
          ];
          chunks.forEach((chunk, index) => {
            setTimeout(() => {
              if (!init?.signal?.aborted) controller.enqueue(encoder.encode(chunk));
            }, 120_000 + (index * 10_000));
          });
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
        },
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } },
      createdAt: '', updatedAt: '',
    };
    const pending = createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '生成完整解读' }],
    });
    const captured = pending.catch((error) => error);

    await vi.advanceTimersByTimeAsync(140_000);

    await expect(captured).resolves.toMatchObject({ content: '完整解读' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a completed analysis when stream disposal rejects after DONE', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode([
          'data: {"choices":[{"delta":{"content":"完整解读"},"finish_reason":"stop"}]}',
          'data: [DONE]',
          '',
        ].join('\n\n')));
      },
      cancel() {
        return Promise.reject(new TypeError('transport already closed'));
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } },
      createdAt: '', updatedAt: '',
    };

    await expect(createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '生成完整解读' }],
    })).resolves.toMatchObject({ content: '完整解读' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts OpenAI-compatible text content blocks and omits unspecified generation limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: 'stop',
        message: { content: [{ type: 'text', text: '连接' }, { type: 'output_text', text: '成功' }] },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'any-chat-model' } },
      createdAt: '', updatedAt: '',
    };

    await expect(createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '测试' }],
    })).resolves.toMatchObject({ content: '连接成功' });
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).not.toHaveProperty('temperature');
    expect(JSON.parse(String(request.body))).not.toHaveProperty('max_tokens');
    expect(JSON.parse(String(request.body))).not.toHaveProperty('max_completion_tokens');
  });

  it('distinguishes a reasoning-only length stop without retrying the billable request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      'data: {"choices":[{"delta":{"reasoning_content":"正在检查如何作答"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"length"}],"usage":{"completion_tokens":512,"completion_tokens_details":{"reasoning_tokens":512}}}',
      'data: [DONE]',
      '',
    ].join('\n\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'reasoning-model' } },
      createdAt: '', updatedAt: '',
    };

    await expect(createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '测试' }], maxTokens: 512,
    })).rejects.toMatchObject({
      detail: {
        code: 'WEB_AI_OUTPUT_LIMIT',
        message: expect.stringContaining('输出额度'),
        nextAction: expect.stringContaining('问爻不会自动重试'),
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an incomplete chat stream without retrying the billable request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      'data: {"choices":[{"delta":{"content":"未完成"},"finish_reason":null}]}\n\n',
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } },
      createdAt: '', updatedAt: '',
    };

    await expect(createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '生成完整解读' }],
    })).rejects.toMatchObject({
      detail: {
        code: 'WEB_AI_STREAM_INCOMPLETE',
        nextAction: expect.stringContaining('问爻不会自动重试'),
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out a stalled chat stream without retrying the billable request', async () => {
    vi.useFakeTimers();
    const encoder = new TextEncoder();
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"开始"},"finish_reason":null}]}\n\n'));
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), { once: true });
        },
      });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = {
      id: 'custom', providerId: 'custom', presetId: null, label: '自定义', region: '',
      baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true,
      capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } },
      createdAt: '', updatedAt: '',
    };
    const pending = createWebProvider(connection, 'secret').chat({
      messages: [{ role: 'user', content: '生成完整解读' }],
    });
    const captured = pending.catch((error) => error);

    await vi.advanceTimersByTimeAsync(90_000);

    await expect(captured).resolves.toMatchObject({ name: 'TimeoutError' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('streams visible deltas before completion and rejects a provider-truncated draft without retry', async () => {
    let stream: ReadableStreamDefaultController<Uint8Array>;
    const encoder = new TextEncoder();
    const events: Array<{ stage: string; delta?: string }> = [];
    const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start(controller) { stream = controller; } }), { headers: { 'content-type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetchMock);
    const connection: AIConnection = { id: 'custom', providerId: 'custom', presetId: null, label: '测试', region: '', baseUrl: 'https://api.example.com/v1', fields: {}, hasApiKey: true, capabilities: { generation: { protocol: 'openai-chat', model: 'chat-model' } }, createdAt: '', updatedAt: '' };
    const pending = createWebProvider(connection, 'secret').chat({ messages: [], onProgress: (event) => events.push(event) }).catch((error) => error);
    await vi.waitFor(() => expect(events).toContainEqual({ stage: 'connected' }));
    stream!.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"PRIVATE REASONING"}}]}\n\ndata: {"choices":[{"delta":{"content":"尚未完成的正文"}}]}\n\n'));
    await vi.waitFor(() => expect(events.some((event) => event.delta === '尚未完成的正文')).toBe(true));
    expect(JSON.stringify(events)).not.toContain('PRIVATE REASONING');
    stream!.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'));
    await expect(pending).resolves.toMatchObject({ detail: { code: 'WEB_AI_OUTPUT_LIMIT' } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

});
