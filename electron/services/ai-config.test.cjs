const assert = require('node:assert/strict');
const test = require('node:test');
const {
  embeddingFingerprint,
  expandPreset,
  getProviderCatalog,
  migrateLegacySettings,
  normalizeAIState,
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

test('schema v2 active stack and unfinished draft migrate to per-capability test state', () => {
  const connection = {
    id: 'legacy-full', providerId: 'siliconflow', presetId: null, label: '旧连接', region: '',
    baseUrl: 'https://api.siliconflow.cn/v1', fields: {}, encryptedApiKey: 'ciphertext',
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-old' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-old', dimensions: 1024 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-old' },
    },
  };
  const pipeline = Object.fromEntries(['generation', 'embedding', 'rerank'].map((capability) => [capability, { connectionId: connection.id }]));
  const migrated = normalizeAIState({
    schemaVersion: 2,
    consentAcceptedAt: '2026-08-26T00:00:00.000Z',
    connections: [connection],
    activePipeline: pipeline,
    draft: {
      id: 'legacy-draft', connection, pipeline,
      testResult: { status: 'failed', capabilities: { generation: { ok: true, checkedAt: '2026-08-26T00:00:00.000Z' }, embedding: { ok: true }, rerank: { ok: false } } },
      indexTask: null,
    },
  });
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.activePipeline, pipeline);
  assert.equal(migrated.connections[0].encryptedApiKey, 'ciphertext');
  assert.equal(migrated.draft.connections[0].id, connection.id);
  assert.equal(migrated.draft.tests.generation.status, 'passed');
  assert.equal(migrated.draft.tests.embedding.status, 'passed');
  assert.equal(migrated.draft.tests.rerank, undefined);

  const referenceOnlyDraft = normalizeAIState({
    connections: [connection],
    activePipeline: pipeline,
    draft: { id: 'rebuild', connections: [], pipeline, tests: { generation: { status: 'passed' } } },
  });
  assert.equal(referenceOnlyDraft.draft.connections.length, 0);
  assert.deepEqual(referenceOnlyDraft.draft.pipeline, pipeline);
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
