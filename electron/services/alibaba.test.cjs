const assert = require('node:assert/strict');
const test = require('node:test');
const { createAlibabaClient } = require('./alibaba.cjs');

test('Alibaba embedding uses the OpenAI-compatible endpoint and preserves response order', async () => {
  let request;
  const client = createAlibabaClient({
    apiKey: 'secret',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }) };
    },
  });
  const vectors = await client.embed(['甲', '乙'], { model: 'text-embedding-v4', dimensions: 1024 });
  assert.equal(request.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings');
  assert.equal(JSON.parse(request.options.body).dimensions, 1024);
  assert.deepEqual(vectors, [[1, 0], [0, 1]]);
});

test('Alibaba reranker uses the dedicated compatible rerank endpoint', async () => {
  let body;
  const client = createAlibabaClient({
    apiKey: 'secret', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', rerankUrl: 'https://workspace.example/compatible-api/v1/reranks',
    fetchImpl: async (_url, options) => { body = JSON.parse(options.body); return { ok: true, json: async () => ({ results: [{ index: 1, relevance_score: 0.9 }] }) }; },
  });
  const ranked = await client.rerank('事业', ['甲', '乙'], { model: 'qwen3-rerank', topN: 1 });
  assert.equal(body.query, '事业');
  assert.equal(body.instruct.includes('divination'), true);
  assert.deepEqual(ranked, [{ index: 1, score: 0.9 }]);
});
