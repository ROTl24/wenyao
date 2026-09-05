const assert = require('node:assert/strict');
const test = require('node:test');
const { generationProbeOptions, normalizeCapabilityLocation, normalizeApiKey, rankModels } = require('../../shared/ai-setup-core.cjs');

test('完整地址模式保留非标准路径、根路径、尾斜线及安全查询参数', () => {
  for (const url of ['https://gateway.example.com/tenant/invoke?api-version=2026-01', 'https://gateway.example.com/', 'http://[::1]:11434/v1/chat/completions/']) {
    const location = normalizeCapabilityLocation('generation', url, 'exact');
    assert.equal(location.displayUrl, url);
    assert.equal(`${location.baseUrl}${location.path}`, url);
  }
  assert.throws(() => normalizeCapabilityLocation('generation', 'https://gateway.example.com/invoke?api_key=secret', 'exact'), /密钥参数/);
});

test('模型目录按名称提示能力但保留私有别名及非典型命名', () => {
  assert.deepEqual(rankModels('embedding', ['private-vector', 'text-embedding-v4', 'private-vector']), ['text-embedding-v4', 'private-vector']);
  assert.deepEqual(rankModels('generation', ['audio-chat', 'chat-test']), ['chat-test', 'audio-chat']);
});

test('密钥支持任意前缀和 Bearer 粘贴，内部空白给出可操作错误', () => {
  assert.equal(normalizeApiKey('  Bearer arbitrary-token_123  '), 'arbitrary-token_123');
  assert.equal(normalizeApiKey('no-required-sk-prefix'), 'no-required-sk-prefix');
  assert.throws(() => normalizeApiKey('broken\nkey'), /空格或换行/);
});

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
