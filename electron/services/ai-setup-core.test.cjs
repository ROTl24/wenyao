const assert = require('node:assert/strict');
const test = require('node:test');
const { generationProbeOptions, normalizeCapabilityLocation } = require('../../shared/ai-setup-core.cjs');

test('自定义 OpenAI 兼容服务的裸域名默认补全 v1', () => {
  const generation = normalizeCapabilityLocation('generation', 'https://api.shuaiapi.com/');
  assert.equal(generation.baseUrl, 'https://api.shuaiapi.com/v1');
  assert.equal(generation.path, '/chat/completions');
  assert.equal(generation.displayUrl, 'https://api.shuaiapi.com/v1/chat/completions');
  assert.equal(generation.canonicalUrl, 'https://api.shuaiapi.com/v1');

  assert.equal(
    normalizeCapabilityLocation('embedding', 'https://api.example.com').displayUrl,
    'https://api.example.com/v1/embeddings',
  );
  assert.equal(
    normalizeCapabilityLocation('rerank', 'https://api.example.com').displayUrl,
    'https://api.example.com/v1/rerank',
  );
});

test('明确版本路径或完整能力地址保持调用语义', () => {
  assert.equal(
    normalizeCapabilityLocation('generation', 'https://api.example.com/v1').canonicalUrl,
    'https://api.example.com/v1',
  );
  const rootEndpoint = normalizeCapabilityLocation('generation', 'https://api.example.com/chat/completions');
  assert.equal(rootEndpoint.baseUrl, 'https://api.example.com');
  assert.equal(rootEndpoint.canonicalUrl, 'https://api.example.com/chat/completions');
});

test('具有根路径协议的官方服务不补全 v1', () => {
  const deepSeek = normalizeCapabilityLocation('generation', 'https://api.deepseek.com/');
  assert.equal(deepSeek.baseUrl, 'https://api.deepseek.com');
  assert.equal(deepSeek.displayUrl, 'https://api.deepseek.com/chat/completions');
  assert.equal(deepSeek.canonicalUrl, 'https://api.deepseek.com');
});

test('所有 OpenAI Chat 模型共用可容纳短推理的单次探测预算', () => {
  assert.deepEqual(generationProbeOptions({ providerId: 'custom' }), { maxTokens: 512 });
  assert.deepEqual(generationProbeOptions({ providerId: 'siliconflow' }), { maxTokens: 512 });
  assert.deepEqual(generationProbeOptions({ providerId: 'deepseek' }), {
    maxTokens: 512,
    thinking: false,
  });
});
