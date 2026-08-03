const crypto = require('node:crypto');
const catalog = require('../../config/ai-providers.json');

const AI_SCHEMA_VERSION = 2;
const CAPABILITIES = Object.freeze(['generation', 'embedding', 'rerank']);
const LEGACY_AI_FIELDS = Object.freeze([
  'alibabaBaseUrl',
  'alibabaModel',
  'embeddingModel',
  'embeddingDimensions',
  'rerankModel',
  'rerankUrl',
  'deepseekBaseUrl',
  'deepseekModel',
  'encryptedAlibabaApiKey',
  'encryptedDeepSeekApiKey',
]);

function ownedClone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function safeId(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function connectionId(providerId) {
  return `${safeId(providerId, 'provider')}-${crypto.randomUUID()}`;
}

function assertCatalog(input = catalog) {
  if (!input || input.version !== 1 || !Array.isArray(input.presets) || input.presets.length === 0) {
    throw new Error('AI 服务预设目录格式无效');
  }
  const ids = new Set();
  for (const preset of input.presets) {
    if (!preset.id || ids.has(preset.id)) throw new Error(`AI 服务预设 ID 无效或重复：${preset.id || '(empty)'}`);
    ids.add(preset.id);
    if (!preset.providerId || !preset.name || !preset.baseUrl || !preset.capabilities) {
      throw new Error(`AI 服务预设不完整：${preset.id}`);
    }
    for (const [capability, definition] of Object.entries(preset.capabilities)) {
      if (!CAPABILITIES.includes(capability) || !definition?.protocol || !definition?.model) {
        throw new Error(`AI 服务预设能力无效：${preset.id}/${capability}`);
      }
      if (capability === 'embedding' && (!Number.isInteger(definition.dimensions) || definition.dimensions <= 0)) {
        throw new Error(`AI 向量维度无效：${preset.id}`);
      }
    }
  }
  if (!ids.has(input.defaultPresetId)) throw new Error('默认 AI 服务预设不存在');
  return input;
}

function getProviderCatalog() {
  return ownedClone(assertCatalog());
}

function getPreset(presetId) {
  const preset = assertCatalog().presets.find((item) => item.id === presetId);
  if (!preset) throw new Error(`未知 AI 服务预设：${presetId}`);
  return ownedClone(preset);
}

function expandPreset(presetId, fields = {}) {
  const preset = getPreset(presetId);
  const missing = (preset.requiredFields || []).filter((field) => !String(fields[field.id] || '').trim());
  if (missing.length) throw new Error(`请填写${missing.map((field) => field.label).join('、')}`);
  const id = connectionId(preset.providerId);
  const capabilities = ownedClone(preset.capabilities);
  if (capabilities.rerank?.urlTemplate) {
    capabilities.rerank.url = capabilities.rerank.urlTemplate.replace(
      '{workspaceId}',
      encodeURIComponent(String(fields.workspaceId || '').trim()),
    );
    delete capabilities.rerank.urlTemplate;
  }
  return {
    connection: {
      id,
      providerId: preset.providerId,
      presetId: preset.id,
      label: preset.name,
      region: preset.region,
      baseUrl: preset.baseUrl,
      fields: ownedClone(fields),
      capabilities,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    pipeline: Object.fromEntries(
      CAPABILITIES
        .filter((capability) => capabilities[capability])
        .map((capability) => [capability, { connectionId: id }]),
    ),
  };
}

function emptyAIState() {
  return {
    schemaVersion: AI_SCHEMA_VERSION,
    consentAcceptedAt: '',
    connections: [],
    activePipeline: null,
    draft: null,
    usage: [],
    migration: null,
  };
}

function normalizedCapabilityRef(value) {
  if (!value || typeof value !== 'object' || !String(value.connectionId || '').trim()) return null;
  return { connectionId: String(value.connectionId).trim() };
}

function normalizePipeline(value) {
  if (!value || typeof value !== 'object') return null;
  const normalized = Object.fromEntries(
    CAPABILITIES.map((capability) => [capability, normalizedCapabilityRef(value[capability])]),
  );
  return CAPABILITIES.some((capability) => normalized[capability]) ? normalized : null;
}

function normalizeConnection(value) {
  if (!value || typeof value !== 'object') return null;
  const id = String(value.id || '').trim();
  const baseUrl = String(value.baseUrl || '').trim();
  if (!id || !baseUrl) return null;
  const capabilities = {};
  for (const capability of CAPABILITIES) {
    const definition = value.capabilities?.[capability];
    if (!definition || !definition.protocol || !definition.model) continue;
    capabilities[capability] = ownedClone(definition);
  }
  return {
    id,
    providerId: safeId(value.providerId, 'custom'),
    presetId: value.presetId ? String(value.presetId) : null,
    label: String(value.label || value.providerId || '自定义服务').trim(),
    region: String(value.region || '').trim(),
    baseUrl,
    fields: value.fields && typeof value.fields === 'object' ? ownedClone(value.fields) : {},
    capabilities,
    encryptedApiKey: String(value.encryptedApiKey || ''),
    createdAt: String(value.createdAt || nowIso()),
    updatedAt: String(value.updatedAt || nowIso()),
  };
}

function normalizeAIState(value) {
  const source = value && typeof value === 'object' ? value : {};
  const connections = Array.isArray(source.connections)
    ? source.connections.map(normalizeConnection).filter(Boolean)
    : [];
  const connectionIds = new Set(connections.map((connection) => connection.id));
  const normalizeKnownPipeline = (pipeline) => {
    const normalized = normalizePipeline(pipeline);
    if (!normalized) return null;
    for (const capability of CAPABILITIES) {
      if (normalized[capability] && !connectionIds.has(normalized[capability].connectionId)) normalized[capability] = null;
    }
    return CAPABILITIES.some((capability) => normalized[capability]) ? normalized : null;
  };
  const usage = Array.isArray(source.usage) ? source.usage.slice(-1000).map(ownedClone) : [];
  const draft = source.draft && typeof source.draft === 'object'
    ? {
        id: String(source.draft.id || crypto.randomUUID()),
        createdAt: String(source.draft.createdAt || nowIso()),
        updatedAt: String(source.draft.updatedAt || nowIso()),
        connection: normalizeConnection(source.draft.connection),
        pipeline: normalizePipeline(source.draft.pipeline),
        testResult: source.draft.testResult ? ownedClone(source.draft.testResult) : null,
        indexTask: source.draft.indexTask ? ownedClone(source.draft.indexTask) : null,
      }
    : null;
  return {
    schemaVersion: AI_SCHEMA_VERSION,
    consentAcceptedAt: String(source.consentAcceptedAt || ''),
    connections,
    activePipeline: normalizeKnownPipeline(source.activePipeline),
    draft: draft?.connection && draft?.pipeline ? draft : null,
    usage,
    migration: source.migration ? ownedClone(source.migration) : null,
  };
}

function pickLegacySettings(settings) {
  return Object.fromEntries(LEGACY_AI_FIELDS.filter((field) => Object.hasOwn(settings, field)).map((field) => [field, ownedClone(settings[field])]));
}

function hasLegacySettings(settings) {
  return Boolean(settings && typeof settings === 'object' && LEGACY_AI_FIELDS.some((field) => Object.hasOwn(settings, field)));
}

function migrateLegacySettings(settings) {
  const source = settings && typeof settings === 'object' ? ownedClone(settings) : {};
  if (source.ai) return { settings: { ...source, ai: normalizeAIState(source.ai) }, migrated: false, legacyBackup: null };
  if (!hasLegacySettings(source)) return { settings: { ...source, ai: emptyAIState() }, migrated: false, legacyBackup: null };

  const legacyBackup = pickLegacySettings(source);
  const ai = emptyAIState();
  const alibabaId = 'legacy-alibaba';
  const deepseekId = 'legacy-deepseek';
  const alibabaConnection = normalizeConnection({
    id: alibabaId,
    providerId: 'alibaba',
    presetId: 'alibaba-cn-quality',
    label: '阿里云百炼（旧配置）',
    region: '华北2（北京）',
    baseUrl: source.alibabaBaseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    capabilities: {
      generation: { protocol: 'openai-chat', model: source.alibabaModel || 'qwen3.7-plus' },
      embedding: { protocol: 'openai-embeddings', model: source.embeddingModel || 'text-embedding-v4', dimensions: Number(source.embeddingDimensions) || 1024, batchSize: 10 },
      rerank: { protocol: 'alibaba-rerank', model: source.rerankModel || 'qwen3-rerank', url: source.rerankUrl || '' },
    },
    encryptedApiKey: source.encryptedAlibabaApiKey || '',
  });
  const deepseekConnection = normalizeConnection({
    id: deepseekId,
    providerId: 'deepseek',
    presetId: 'deepseek-cn-generation',
    label: 'DeepSeek 官方（旧配置）',
    region: '中国大陆',
    baseUrl: source.deepseekBaseUrl || 'https://api.deepseek.com',
    capabilities: {
      generation: { protocol: 'openai-chat', model: source.deepseekModel || 'deepseek-v4-pro' },
    },
    encryptedApiKey: source.encryptedDeepSeekApiKey || '',
  });
  ai.connections = [alibabaConnection, deepseekConnection].filter(Boolean);
  ai.activePipeline = {
    generation: { connectionId: deepseekId },
    embedding: { connectionId: alibabaId },
    rerank: { connectionId: alibabaId },
  };
  ai.migration = {
    fromSchema: 1,
    migratedAt: nowIso(),
    legacyBackup,
  };
  ai.consentAcceptedAt = ai.migration.migratedAt;
  for (const field of LEGACY_AI_FIELDS) delete source[field];
  source.ai = ai;
  return { settings: source, migrated: true, legacyBackup };
}

function publicConnection(connection) {
  const { encryptedApiKey: _encryptedApiKey, ...safe } = ownedClone(connection);
  return { ...safe, hasApiKey: Boolean(connection.encryptedApiKey) };
}

function publicAIState(value) {
  const state = normalizeAIState(value);
  return {
    ...state,
    migration: state.migration
      ? { fromSchema: state.migration.fromSchema, migratedAt: state.migration.migratedAt }
      : null,
    connections: state.connections.map(publicConnection),
    draft: state.draft
      ? { ...state.draft, connection: publicConnection(state.draft.connection) }
      : null,
  };
}

function pipelineFingerprint({ connection, capability = 'embedding', corpusHash = '' }) {
  const definition = connection?.capabilities?.[capability];
  if (!connection || !definition) throw new Error(`缺少 ${capability} 能力配置`);
  const identity = JSON.stringify({
    providerId: connection.providerId,
    baseUrl: connection.baseUrl,
    protocol: definition.protocol,
    model: definition.model,
    dimensions: definition.dimensions || null,
    corpusHash,
  });
  return crypto.createHash('sha256').update(identity).digest('hex');
}

module.exports = {
  AI_SCHEMA_VERSION,
  CAPABILITIES,
  LEGACY_AI_FIELDS,
  assertCatalog,
  emptyAIState,
  expandPreset,
  getPreset,
  getProviderCatalog,
  hasLegacySettings,
  migrateLegacySettings,
  normalizeAIState,
  normalizeConnection,
  normalizePipeline,
  pipelineFingerprint,
  publicAIState,
};
