const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createProviderClient,
  providerError,
  validateBaseUrl,
  withTransientRetry,
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

test('provider errors are categorized and transient operations retry without retrying auth failures', async () => {
  const unavailable = providerError({ status: 503 }, 'maintenance', '测试服务');
  let attempts = 0;
  const value = await withTransientRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw unavailable;
    return 'ok';
  }, { retries: 2, delayImpl: async () => {} });
  assert.equal(value, 'ok');
  assert.equal(attempts, 3);

  const auth = providerError({ status: 401 }, 'invalid key', '测试服务');
  attempts = 0;
  await assert.rejects(() => withTransientRetry(async () => { attempts += 1; throw auth; }, { retries: 2, delayImpl: async () => {} }), /访问密钥无效/);
  assert.equal(attempts, 1);
});

test('custom provider URL requires HTTPS except localhost', () => {
  assert.equal(validateBaseUrl('https://api.example.com/v1'), 'https://api.example.com/v1');
  assert.equal(validateBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.throws(() => validateBaseUrl('http://api.example.com/v1'), /必须使用 HTTPS/);
  assert.throws(() => validateBaseUrl('https://user:pass@api.example.com/v1'), /不能包含账号/);
});
