const assert = require('node:assert/strict');
const test = require('node:test');
const {
  embeddingFingerprint,
  expandPreset,
  getProviderCatalog,
  migrateLegacySettings,
  pipelineFingerprint,
  publicAIState,
} = require('./ai-config.cjs');

test('provider catalog exposes a complete recommended mainland-China stack', () => {
  const catalog = getProviderCatalog();
  const preset = catalog.presets.find((item) => item.id === catalog.defaultPresetId);
  assert.equal(preset.providerId, 'siliconflow');
  assert.equal(preset.capabilities.generation.model, 'deepseek-ai/DeepSeek-V4-Pro');
  assert.equal(preset.capabilities.embedding.dimensions, 1024);
  assert.equal(preset.capabilities.rerank.protocol, 'cohere-rerank');

  const expanded = expandPreset(preset.id);
  assert.equal(new Set(Object.values(expanded.pipeline).map((item) => item.connectionId)).size, 1);
});

test('legacy Alibaba and DeepSeek settings migrate without exposing ciphertext', () => {
  const legacy = {
    theme: 'ink',
    alibabaBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    embeddingModel: 'text-embedding-v4',
    embeddingDimensions: 1024,
    rerankModel: 'qwen3-rerank',
    rerankUrl: 'https://workspace.example.com/reranks',
    encryptedAlibabaApiKey: 'alibaba-ciphertext',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-pro',
    encryptedDeepSeekApiKey: 'deepseek-ciphertext',
  };
  const migration = migrateLegacySettings(legacy);
  assert.equal(migration.migrated, true);
  assert.equal(migration.settings.theme, 'ink');
  assert.equal(Object.hasOwn(migration.settings, 'encryptedAlibabaApiKey'), false);
  assert.equal(migration.settings.ai.activePipeline.generation.connectionId, 'legacy-deepseek');
  assert.equal(migration.settings.ai.activePipeline.embedding.connectionId, 'legacy-alibaba');
  assert.equal(migration.settings.ai.activePipeline.rerank.connectionId, 'legacy-alibaba');
  assert.equal(migration.settings.ai.connections[0].encryptedApiKey, 'alibaba-ciphertext');

  const publicState = publicAIState(migration.settings.ai);
  assert.equal(publicState.connections.every((connection) => connection.hasApiKey), true);
  assert.equal(JSON.stringify(publicState).includes('ciphertext'), false);
});

test('vector fingerprint changes for provider, endpoint, model, dimensions or corpus', () => {
  const connection = {
    providerId: 'custom',
    baseUrl: 'https://api.example.com/v1',
    capabilities: { embedding: { protocol: 'openai-embeddings', model: 'embed-a', dimensions: 1024 } },
  };
  const baseline = pipelineFingerprint({ connection, corpusHash: 'corpus-a' });
  for (const changed of [
    { ...connection, providerId: 'other' },
    { ...connection, baseUrl: 'https://api.other.com/v1' },
    { ...connection, capabilities: { embedding: { ...connection.capabilities.embedding, model: 'embed-b' } } },
    { ...connection, capabilities: { embedding: { ...connection.capabilities.embedding, dimensions: 768 } } },
  ]) {
    assert.notEqual(pipelineFingerprint({ connection: changed, corpusHash: 'corpus-a' }), baseline);
  }
  assert.notEqual(pipelineFingerprint({ connection, corpusHash: 'corpus-b' }), baseline);
});

test('embedding fingerprint is stable across corpus shards', () => {
  const connection = {
    providerId: 'custom',
    baseUrl: 'https://api.example.com/v1',
    capabilities: { embedding: { protocol: 'openai-embeddings', model: 'embed-a', dimensions: 1024 } },
  };
  assert.equal(
    embeddingFingerprint({ connection, corpusHash: 'ignored-a' }),
    embeddingFingerprint({ connection, corpusHash: 'ignored-b' }),
  );
  assert.notEqual(
    embeddingFingerprint({ connection }),
    embeddingFingerprint({ connection: { ...connection, baseUrl: 'https://api.other.com/v1' } }),
  );
});
