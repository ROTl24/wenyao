const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createProviderClient,
  discoverModels,
  providerError,
  requestJson,
  validateBaseUrl,
} = require('./ai-provider.cjs');

function response(status, value) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(value) };
}

test('provider client supports chat, embedding, rerank, exact model listing and usage metadata', async () => {
  const requests = [];
  const usage = [];
  const connection = {
    id: 'siliconflow-test',
    providerId: 'siliconflow',
    label: 'SiliconFlow 测试',
    baseUrl: 'https://api.siliconflow.cn/v1',
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-model' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-model', dimensions: 2 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-model', path: '/rerank' },
    },
  };
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes('/models')) return response(200, { data: [{ id: 'chat-model' }] });
    const body = JSON.parse(options.body);
    if (String(url).endsWith('/chat/completions')) return response(200, { choices: [{ message: { content: '连接成功' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } });
    if (String(url).endsWith('/embeddings')) return response(200, { data: body.input.map((_, index) => ({ index, embedding: index ? [0, 1] : [1, 0] })) });
    return response(200, { results: [{ index: 1, relevance_score: 0.9 }] });
  };
  const client = createProviderClient({ connection, apiKey: 'secret', fetchImpl, usageSink: (entry) => usage.push(entry) });

  assert.deepEqual(await client.listModels('generation'), ['chat-model']);
  assert.equal((await client.chat({ messages: [{ role: 'user', content: '测试' }] })).content, '连接成功');
  assert.deepEqual(await client.embed(['甲', '乙']), [[1, 0], [0, 1]]);
  assert.deepEqual(await client.rerank('问题', ['甲', '乙']), [{ index: 1, score: 0.9 }]);
  assert.equal(usage[0].totalTokens, 3);
  assert.equal(requests.every((item) => item.options.headers.authorization === 'Bearer secret'), true);
});

test('custom model discovery reads a generic OpenAI-compatible catalog with an authenticated GET', async () => {
  let request;
  const modelIds = await discoverModels({
    baseUrl: 'https://relay.example.com/v1',
    apiKey: 'secret-key',
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return response(200, { data: [{ id: 'chat-model' }, { model: 'embed-model' }, 'rerank-model', { id: 'chat-model' }] });
    },
  });
  assert.deepEqual(modelIds, ['chat-model', 'embed-model', 'rerank-model']);
  assert.equal(request.url, 'https://relay.example.com/v1/models');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.authorization, 'Bearer secret-key');
});

test('chat accepts OpenAI-compatible text content blocks and omits unspecified generation limits', async () => {
  let requestBody;
  const client = createProviderClient({
    connection: {
      id: 'custom', label: '自定义', providerId: 'custom', baseUrl: 'https://relay.example.com/v1',
      capabilities: { generation: { protocol: 'openai-chat', model: 'any-chat-model' } },
    },
    apiKey: 'secret',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response(200, {
        choices: [{
          finish_reason: 'stop',
          message: { content: [{ type: 'text', text: '连接' }, { type: 'output_text', text: '成功' }] },
        }],
      });
    },
  });

  await assert.doesNotReject(async () => {
    assert.equal((await client.chat({ messages: [{ role: 'user', content: '测试' }] })).content, '连接成功');
  });
  assert.equal(Object.hasOwn(requestBody, 'temperature'), false);
  assert.equal(Object.hasOwn(requestBody, 'max_tokens'), false);
  assert.equal(Object.hasOwn(requestBody, 'max_completion_tokens'), false);
  assert.equal(Object.hasOwn(requestBody, 'stream'), false);
});

test('official chat consumes one observable SSE request and records its final usage', async () => {
  const usage = [];
  const progress = [];
  let requests = 0;
  let requestBody;
  const encoder = new TextEncoder();
  const client = createProviderClient({
    connection: {
      id: 'deepseek-official', label: 'DeepSeek 官方', providerId: 'deepseek', baseUrl: 'https://api.deepseek.com',
      capabilities: { generation: { protocol: 'openai-chat', model: 'deepseek-v4-pro' } },
    },
    apiKey: 'secret',
    usageSink: (entry) => usage.push(entry),
    fetchImpl: async (_url, options) => {
      requests += 1;
      requestBody = JSON.parse(options.body);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"分析中"},"finish_reason":null}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"完整解读"},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":8,"total_tokens":20}}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
  });

  const result = await client.chat({
    messages: [{ role: 'user', content: '测试' }],
    onProgress: (event) => progress.push(event),
  });

  assert.equal(result.content, '完整解读');
  assert.equal(requests, 1);
  assert.equal(requestBody.stream, true);
  assert.deepEqual(requestBody.stream_options, { include_usage: true });
  assert.equal(Object.hasOwn(requestBody, 'max_tokens'), false);
  assert.deepEqual(progress.map((event) => event.stage), ['connected', 'reasoning', 'writing']);
  assert.equal(usage[0].totalTokens, 20);
});

test('official chat keeps an active stream alive beyond the connection deadline', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const encoder = new TextEncoder();
  const client = createProviderClient({
    connection: {
      id: 'deepseek-official', label: 'DeepSeek 官方', providerId: 'deepseek', baseUrl: 'https://api.deepseek.com',
      capabilities: { generation: { protocol: 'openai-chat', model: 'deepseek-v4-pro' } },
    },
    apiKey: 'secret',
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"仍在分析"},"finish_reason":null}]}\n\n')), 120_000);
        setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"长"},"finish_reason":null}]}\n\n')), 200_000);
        setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"解读"},"finish_reason":"stop"}]}\n\n')), 280_000);
        setTimeout(() => {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }, 360_000);
      },
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } }),
  });

  const pending = client.chat({ messages: [{ role: 'user', content: '生成长解读' }] });
  const flush = async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  };
  await flush();
  context.mock.timers.tick(120_000);
  await flush();
  context.mock.timers.tick(80_000);
  await flush();
  context.mock.timers.tick(80_000);
  await flush();
  context.mock.timers.tick(80_000);
  await flush();

  assert.equal((await pending).content, '长解读');
});

test('official chat rejects an incomplete stream without retrying the paid request', async () => {
  let requests = 0;
  const encoder = new TextEncoder();
  const client = createProviderClient({
    connection: {
      id: 'deepseek-official', label: 'DeepSeek 官方', providerId: 'deepseek', baseUrl: 'https://api.deepseek.com',
      capabilities: { generation: { protocol: 'openai-chat', model: 'deepseek-v4-pro' } },
    },
    apiKey: 'secret',
    fetchImpl: async () => {
      requests += 1;
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"尚未完成"},"finish_reason":null}]}\n\n'));
          controller.close();
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
  });

  await assert.rejects(
    () => client.chat({ messages: [{ role: 'user', content: '测试' }] }),
    (error) => error.publicCode === 'AI_STREAM_INCOMPLETE' && /不会自动重试/.test(error.publicNextAction),
  );
  assert.equal(requests, 1);
});

test('official chat stops one stream after ninety seconds without response activity', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  const encoder = new TextEncoder();
  const client = createProviderClient({
    connection: {
      id: 'deepseek-official', label: 'DeepSeek 官方', providerId: 'deepseek', baseUrl: 'https://api.deepseek.com',
      capabilities: { generation: { protocol: 'openai-chat', model: 'deepseek-v4-pro' } },
    },
    apiKey: 'secret',
    fetchImpl: async (_url, options) => {
      requests += 1;
      return new Response(new ReadableStream({
        start(controller) {
          setTimeout(() => controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"开始分析"},"finish_reason":null}]}\n\n')), 1_000);
          options.signal.addEventListener('abort', () => controller.error(options.signal.reason), { once: true });
        },
      }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
    },
  });

  const captured = client.chat({ messages: [{ role: 'user', content: '测试停滞流' }] }).catch((error) => error);
  const flush = async () => {
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
  };
  await flush();
  context.mock.timers.tick(1_000);
  await flush();
  context.mock.timers.tick(90_000);
  await flush();

  assert.equal((await captured).publicCode, 'AI_TIMEOUT');
  assert.equal(requests, 1);
});

test('chat distinguishes reasoning budget exhaustion from an incompatible response', async () => {
  const client = createProviderClient({
    connection: {
      id: 'custom', label: '自定义', providerId: 'custom', baseUrl: 'https://relay.example.com/v1',
      capabilities: { generation: { protocol: 'openai-chat', model: 'reasoning-model' } },
    },
    apiKey: 'secret',
    fetchImpl: async () => response(200, {
      choices: [{
        finish_reason: 'length',
        message: { content: '', reasoning_content: '正在检查如何作答' },
      }],
      usage: { completion_tokens: 512, completion_tokens_details: { reasoning_tokens: 512 } },
    }),
  });

  await assert.rejects(
    () => client.chat({ messages: [{ role: 'user', content: '测试' }], maxTokens: 512 }),
    (error) => error.publicCode === 'AI_OUTPUT_LIMIT'
      && /输出额度/.test(error.message)
      && /不会自动重试/.test(error.publicNextAction),
  );
});

test('SiliconFlow model discovery requests the selected capability category', async () => {
  let requestUrl = '';
  await discoverModels({
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: 'secret-key',
    capability: 'rerank',
    fetchImpl: async (url) => {
      requestUrl = String(url);
      return response(200, { data: [{ id: 'Qwen/Qwen3-Reranker-8B' }] });
    },
  });
  const parsed = new URL(requestUrl);
  assert.equal(parsed.pathname, '/v1/models');
  assert.equal(parsed.searchParams.get('type'), 'text');
  assert.equal(parsed.searchParams.get('sub_type'), 'reranker');
});

test('embedding dimension can be discovered from the first response', async () => {
  let body;
  const client = createProviderClient({
    connection: {
      id: 'custom', label: '自定义', providerId: 'custom', baseUrl: 'https://relay.example.com/v1',
      capabilities: { embedding: { protocol: 'openai-embeddings', model: 'embed-auto' } },
    },
    apiKey: 'secret',
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return response(200, { data: [{ index: 0, embedding: [0, 1, 0] }] });
    },
  });
  const vectors = await client.embed('测试');
  assert.equal(Object.hasOwn(body, 'dimensions'), false);
  assert.equal(vectors[0].length, 3);
});

test('provider errors are categorized without any automatic retry helper', () => {
  const unavailable = providerError({ status: 503 }, 'maintenance', '测试服务');
  const auth = providerError({ status: 401 }, 'invalid key', '测试服务');
  assert.equal(unavailable.publicCode, 'AI_PROVIDER_UNAVAILABLE');
  assert.equal(auth.publicCode, 'AI_AUTH_FAILED');
});

test('response body timeout is localized and never retried automatically', async () => {
  let requests = 0;
  await assert.rejects(
    () => requestJson({
      url: 'https://api.deepseek.com/chat/completions',
      label: 'DeepSeek 官方',
      fetchImpl: async () => {
        requests += 1;
        return {
          ok: true,
          status: 200,
          text: async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); },
        };
      },
    }),
    (error) => error.publicCode === 'AI_TIMEOUT'
      && error.message === 'DeepSeek 官方请求超时'
      && /确认本次用量/.test(error.publicNextAction)
      && /不会自动重试/.test(error.publicNextAction),
  );
  assert.equal(requests, 1);
});

test('custom provider URL requires HTTPS except localhost', () => {
  assert.equal(validateBaseUrl('https://api.example.com/v1'), 'https://api.example.com/v1');
  assert.equal(validateBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.throws(() => validateBaseUrl('http://api.example.com/v1'), /必须使用 HTTPS/);
  assert.throws(() => validateBaseUrl('https://user:pass@api.example.com/v1'), /不能包含账号/);
});

test('visible deltas arrive before completion while truncated output stays unsuccessful', async () => {
  let stream;
  const events = [];
  let requests = 0;
  const encoder = new TextEncoder();
  const client = createProviderClient({ connection: { id: 'deepseek', providerId: 'deepseek', label: '测试', baseUrl: 'https://api.deepseek.com', capabilities: { generation: { protocol: 'openai-chat', model: 'test' } } }, apiKey: 'test', fetchImpl: async () => {
    requests += 1;
    return new Response(new ReadableStream({ start(controller) { stream = controller; } }), { headers: { 'content-type': 'text/event-stream' } });
  } });
  const pending = client.chat({ messages: [], onProgress: (event) => events.push(event) });
  const rejected = assert.rejects(pending, { publicCode: 'AI_OUTPUT_LIMIT' });
  await new Promise((resolve) => setImmediate(resolve));
  stream.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"PRIVATE REASONING"}}]}\n\ndata: {"choices":[{"delta":{"content":"尚未完成"}}]}\n\n'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.filter((event) => event.delta).map((event) => event.delta).join(''), '尚未完成');
  assert.equal(JSON.stringify(events).includes('PRIVATE REASONING'), false);
  stream.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: [DONE]\n\n'));
  await rejected;
  assert.equal(requests, 1);
});
