const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeCloud, followUpCloud } = require('./ai.cjs');
const {
  CAPABILITIES,
  embeddingFingerprint,
  expandPreset,
  getProviderCatalog,
  pipelineFingerprint,
} = require('./ai-config.cjs');
const {
  capabilityConnection,
  filterModels,
  generationProbeOptions,
  normalizeCapabilityLocation,
} = require('../../shared/ai-setup-core.cjs');
const {
  createProviderClient,
  discoverModels,
  structuredProviderError,
  validateBaseUrl,
} = require('./ai-provider.cjs');
const { hybridSearch } = require('./retrieval.cjs');
const { CorpusIndexCoordinator } = require('./corpus-index.cjs');

function runtimeError(message, code, nextAction) {
  const error = new Error(message);
  error.publicCode = code;
  error.publicNextAction = nextAction;
  return error;
}

function isLocalUrl(value) {
  try { return ['localhost', '127.0.0.1'].includes(new URL(value).hostname); }
  catch { return false; }
}

function hasConfiguredEndpoint(definition) {
  return [definition?.url, definition?.path]
    .some((value) => typeof value === 'string' && value.trim());
}

function uniqueConnections(resolved) {
  return [...new Map(Object.values(resolved).filter(Boolean).map((item) => [item.connection.id, item.connection])).values()];
}

function emptyPipeline() {
  return { generation: null, embedding: null, rerank: null };
}

function configuredCapabilities(pipeline) {
  return CAPABILITIES.filter((capability) => pipeline?.[capability]?.connectionId);
}

function staticCorpusLibrary(corpus, corpusHash) {
  const entries = Array.isArray(corpus) ? corpus : [];
  const shard = {
    id: 'builtin',
    origin: 'builtin',
    title: '内置古籍',
    contentHash: corpusHash,
    entries,
    enabledEntryIds: new Set(entries.map((entry) => entry.id)),
  };
  return {
    getOverview: () => ({ chunkCount: entries.length }),
    getShardDescriptors: () => [shard],
    lexicalSearch: ({ query, domainTerms, limit }) => require('./retrieval.cjs').lexicalSearch(entries, query, domainTerms, limit),
    hydrateEntries: (ids) => {
      const wanted = new Set(ids);
      return entries.filter((entry) => wanted.has(entry.id));
    },
    listBooks: () => ({ items: [], total: 0 }),
    markIndexState: () => null,
  };
}

class AIRuntime {
  constructor({
    store,
    secretStore,
    corpus = [],
    corpusHash = '',
    corpusLibrary = null,
    corpusIndex = null,
    indexRoot,
    legacyIndexBases = [],
    fetchImpl = fetch,
    onStatus = () => {},
  }) {
    this.store = store;
    this.secretStore = secretStore;
    this.corpusLibrary = corpusLibrary || staticCorpusLibrary(corpus, corpusHash);
    this.corpusHash = corpusHash;
    this.indexRoot = indexRoot;
    this.corpusIndex = corpusIndex || new CorpusIndexCoordinator({ indexRoot });
    this.legacyIndexBases = legacyIndexBases;
    this.fetchImpl = fetchImpl;
    this.onStatus = onStatus;
    this.activeFingerprint = '';
    this.vectorBuildPromise = null;
    this.vectorBuildControl = null;
    this.libraryBuildPromise = null;
    this.libraryBuildControl = null;
    this.libraryBuildQueue = new Set();
  }

  initialize() {
    fs.mkdirSync(this.indexRoot, { recursive: true });
    const state = this.store.getRawAIState();
    if (state.draft?.indexTask?.stage === 'building') {
      state.draft.indexTask = {
        ...state.draft.indexTask,
        stage: 'paused',
        error: null,
        updatedAt: new Date().toISOString(),
      };
      this.store.saveAIState(state);
    }
    this.#loadActiveIndex();
    for (const book of this.#allLibraryBooks()) {
      if (book.origin === 'user' && book.indexState === 'building') this.corpusLibrary.markIndexState(book.id, 'paused', { progress: book.indexProgress });
    }
    return this.getStatus();
  }

  getCatalog() {
    return getProviderCatalog();
  }

  #allLibraryBooks() {
    const books = [];
    for (let offset = 0; ; offset += 100) {
      const page = this.corpusLibrary.listBooks({ offset, limit: 100 });
      books.push(...(page?.items || []));
      if (books.length >= Number(page?.total || 0) || !(page?.items || []).length) return books;
    }
  }

  #emit() {
    try { this.onStatus(this.getStatus()); } catch {}
  }

  #encryptSecret(secret) {
    return this.secretStore.encrypt(secret);
  }

  #decryptSecret(connection) {
    return this.secretStore.decrypt(connection?.encryptedApiKey);
  }

  #connectionsFor(state, draftConnections = []) {
    const connections = new Map(state.connections.map((connection) => [connection.id, connection]));
    for (const connection of Array.isArray(draftConnections) ? draftConnections : []) {
      connections.set(connection.id, connection);
    }
    return connections;
  }

  #resolvePipeline(state, pipeline, draftConnections = []) {
    if (!pipeline?.generation?.connectionId) {
      throw runtimeError('尚未配置 AI 解读主模型', 'AI_NOT_CONFIGURED', '请先连接主模型并完成最小测试。');
    }
    if (pipeline.rerank && !pipeline.embedding) {
      throw runtimeError('重排模型不能脱离向量模型单独使用', 'AI_PIPELINE_INVALID', '请先配置向量模型，或跳过重排模型。');
    }
    const connections = this.#connectionsFor(state, draftConnections);
    const resolved = { generation: null, embedding: null, rerank: null };
    for (const capability of CAPABILITIES) {
      const connectionId = pipeline[capability]?.connectionId;
      if (!connectionId) continue;
      const connection = connections.get(connectionId);
      const definition = connection?.capabilities?.[capability];
      if (!connection || !definition) {
        throw runtimeError(
          `${capability === 'generation' ? '解读' : capability === 'embedding' ? '向量' : '重排'}配置已失效`,
          'AI_CAPABILITY_MISSING',
          '请重新打开 AI 能力与连接向导完成该项设置。',
        );
      }
      validateBaseUrl(connection.baseUrl);
      if (capability === 'rerank' && definition.protocol === 'alibaba-rerank' && !hasConfiguredEndpoint(definition)) {
        throw runtimeError('阿里云重排缺少业务空间接口', 'AI_RERANK_ENDPOINT_REQUIRED', '请填写北京地域业务空间 ID 后重新检测。');
      }
      const apiKey = this.#decryptSecret(connection);
      if (!apiKey && !isLocalUrl(connection.baseUrl)) {
        throw runtimeError(`${connection.label}尚未保存访问密钥`, 'AI_KEY_REQUIRED', '请重新粘贴访问密钥。');
      }
      resolved[capability] = { connection, definition, apiKey };
    }
    return resolved;
  }

  #ensureDraft(state) {
    if (state.draft) return state.draft;
    const pipeline = state.activePipeline ? structuredClone(state.activePipeline) : emptyPipeline();
    const tests = Object.fromEntries(configuredCapabilities(pipeline).map((capability) => [capability, {
      status: 'passed',
      checkedAt: new Date().toISOString(),
    }]));
    state.draft = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connections: [],
      pipeline,
      tests,
      indexTask: null,
    };
    return state.draft;
  }

  #draftConnectionFor(state, capability) {
    const id = state.draft?.pipeline?.[capability]?.connectionId;
    if (!id) return null;
    return this.#connectionsFor(state, state.draft.connections).get(id) || null;
  }

  #credentialFor(state, capability) {
    const connection = this.#draftConnectionFor(state, capability)
      || this.#connectionsFor(state).get(state.activePipeline?.[capability]?.connectionId);
    if (!connection) throw runtimeError('无法沿用上一项连接', 'AI_CREDENTIAL_SOURCE_MISSING', '请重新填写 API Key。');
    const apiKey = this.#decryptSecret(connection);
    if (!apiKey && !isLocalUrl(connection.baseUrl)) {
      throw runtimeError(`${connection.label}尚未保存访问密钥`, 'AI_KEY_REQUIRED', '请重新填写 API Key。');
    }
    return apiKey;
  }

  #client(connection, apiKey) {
    return createProviderClient({
      connection,
      apiKey,
      fetchImpl: this.fetchImpl,
      usageSink: (entry) => this.store.appendAIUsage(entry),
    });
  }

  #embeddingIdentity(embedding) {
    return {
      fingerprint: embeddingFingerprint({ connection: embedding.connection, capability: 'embedding' }),
      providerId: embedding.connection.providerId,
      baseUrl: embedding.connection.baseUrl,
      model: embedding.definition.model,
      dimensions: embedding.definition.dimensions,
      batchSize: embedding.definition.batchSize,
    };
  }

  #loadActiveIndex() {
    this.activeFingerprint = '';
    const state = this.store.getRawAIState();
    let resolved;
    try { resolved = this.#resolvePipeline(state, state.activePipeline); }
    catch { return; }
    const embedding = resolved.embedding;
    if (!embedding) return;
    const identity = this.#prepareExistingIndex(embedding);
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    if (this.corpusIndex.readyShards(identity, shards).length > 0) this.activeFingerprint = identity.fingerprint;
  }

  #prepareExistingIndex(embedding) {
    const identity = this.#embeddingIdentity(embedding);
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    const builtIn = shards.find((shard) => shard.id === 'builtin');
    if (builtIn && !this.corpusIndex.hasShard(identity, builtIn)) {
      const legacyFingerprint = pipelineFingerprint({ connection: embedding.connection, capability: 'embedding', corpusHash: builtIn.contentHash });
      this.corpusIndex.migrateLegacyBuiltIn({
        identity,
        shard: builtIn,
        legacyBases: [path.join(this.indexRoot, legacyFingerprint, 'corpus-vectors'), ...this.legacyIndexBases],
      });
    }
    return identity;
  }

  getStatus() {
    const state = this.store.getPublicAIState();
    const raw = this.store.getRawAIState();
    let status = 'unconfigured';
    let message = '尚未连接 AI 服务';
    let activeCapabilities = null;
    try {
      const resolved = this.#resolvePipeline(raw, raw.activePipeline);
      activeCapabilities = Object.fromEntries(CAPABILITIES.filter((capability) => resolved[capability]).map((capability) => [capability, {
        connectionId: resolved[capability].connection.id,
        providerId: resolved[capability].connection.providerId,
        label: resolved[capability].connection.label,
        model: resolved[capability].definition.model,
      }]));
      if (!raw.consentAcceptedAt) {
        status = 'needs-consent';
        message = '需要确认 AI 数据发送范围';
      } else if (resolved.embedding && (!this.activeFingerprint
        || this.#embeddingIdentity(resolved.embedding).fingerprint !== this.activeFingerprint
        || this.corpusIndex.readyShards(
          this.#embeddingIdentity(resolved.embedding),
          this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true }),
        ).length === 0)) {
        status = 'index-required';
        message = '需要构建向量索引';
      } else {
        status = 'ready';
        message = resolved.rerank
          ? '关键词、向量与重排检索均已就绪'
          : resolved.embedding
            ? '关键词与向量检索均已就绪'
            : '主模型与本地关键词检索已就绪';
      }
    } catch (error) {
      if (raw.activePipeline) {
        status = 'needs-setup';
        message = error.message;
      }
    }
    const task = raw.draft?.indexTask;
    if (task?.stage === 'building' || this.vectorBuildPromise) {
      status = 'building';
      message = `正在构建向量索引 ${Number(task?.progress || 0).toFixed(1)}%`;
    } else if (task?.stage === 'paused') {
      status = 'paused';
      message = `向量索引已暂停在 ${Number(task.progress || 0).toFixed(1)}%`;
    } else if (task?.stage === 'error') {
      status = 'error';
      message = task.error?.message || '向量索引构建失败';
    } else if (Object.values(raw.draft?.tests || {}).some((test) => test?.status === 'testing')) {
      status = 'testing';
      message = '正在执行最小连接测试';
    } else if (Object.values(raw.draft?.tests || {}).some((test) => test?.status === 'failed')) {
      status = 'error';
      message = Object.values(raw.draft.tests).find((test) => test?.status === 'failed')?.error?.message || 'AI 能力测试失败';
    }
    return {
      status,
      message,
      activeCapabilities,
      activeFingerprint: this.activeFingerprint,
      corpusCount: Number(this.corpusLibrary.getOverview()?.chunkCount || 0),
      consentAcceptedAt: state.consentAcceptedAt,
      connections: state.connections,
      activePipeline: state.activePipeline,
      draft: state.draft,
      usage: state.usage,
    };
  }

  async listModels(payload) {
    const capability = String(payload?.capability || '');
    if (!CAPABILITIES.includes(capability)) throw new Error('未知的 AI 能力');
    const location = normalizeCapabilityLocation(capability, payload?.apiUrl);
    const baseUrl = validateBaseUrl(location.baseUrl);
    const state = this.store.getRawAIState();
    const apiKey = String(payload?.apiKey || '').trim()
      || (payload?.credentialSource ? this.#credentialFor(state, payload.credentialSource) : '');
    if (!apiKey && !isLocalUrl(baseUrl)) {
      throw runtimeError('请粘贴 API Key', 'AI_KEY_REQUIRED', 'API Key 可在服务商控制台的 API Keys 或密钥管理页面创建。');
    }
    const discovered = await discoverModels({
      baseUrl,
      apiKey,
      capability,
      signal: AbortSignal.timeout(30000),
      fetchImpl: this.fetchImpl,
    });
    const modelIds = filterModels(capability, discovered);
    return {
      modelIds,
      ...(modelIds.length ? {} : { warning: '模型目录未标注该类能力，请手动填写服务商文档中的模型名称。' }),
    };
  }

  async testCapability(payload) {
    let state = this.store.getRawAIState();
    const capability = String(payload?.capability || '');
    if (!CAPABILITIES.includes(capability)) throw new Error('未知的 AI 能力');
    const draft = this.#ensureDraft(state);
    if (capability === 'rerank' && !draft.pipeline.embedding) {
      throw runtimeError('请先配置向量模型', 'AI_EMBEDDING_REQUIRED', '重排模型只能在向量检索之后使用。');
    }
    const previous = this.#draftConnectionFor(state, capability);
    const previousIsShared = previous && CAPABILITIES.some((other) => (
      other !== capability && draft.pipeline[other]?.connectionId === previous.id
    ));
    const connection = capabilityConnection({
      capability,
      apiUrl: payload?.apiUrl,
      model: payload?.model,
      id: previousIsShared ? undefined : previous?.id,
      createdAt: previousIsShared ? undefined : previous?.createdAt,
      dimensions: previous?.capabilities?.embedding?.dimensions,
    });
    validateBaseUrl(connection.baseUrl);
    const submitted = String(payload?.apiKey || '').trim();
    let apiKey = submitted
      || (payload?.credentialSource ? this.#credentialFor(state, payload.credentialSource) : '')
      || (previous ? this.#decryptSecret(previous) : '');
    if (!apiKey && state.activePipeline?.[capability]) {
      apiKey = this.#credentialFor({ ...state, draft: null }, capability);
    }
    connection.encryptedApiKey = apiKey ? this.#encryptSecret(apiKey) : '';
    if (!connection.encryptedApiKey && !isLocalUrl(connection.baseUrl)) {
      throw runtimeError('请填写 API Key', 'AI_KEY_REQUIRED', 'API Key 可在服务商控制台的密钥管理页面创建。');
    }
    draft.connections = [...draft.connections.filter((item) => item.id !== connection.id), connection];
    draft.pipeline[capability] = { connectionId: connection.id };
    draft.tests[capability] = { status: 'testing' };
    draft.updatedAt = new Date().toISOString();
    if (payload?.consentAccepted) state.consentAcceptedAt = new Date().toISOString();
    this.store.saveAIState(state);
    this.#emit();
    try {
      const client = this.#client(connection, apiKey);
      if (capability === 'generation') {
        await client.chat({
          messages: [{ role: 'user', content: '只回复：连接成功' }],
          ...generationProbeOptions(connection),
          signal: AbortSignal.timeout(60000),
        });
      } else if (capability === 'embedding') {
        const embeddings = await client.embed(['六爻模型连接测试'], { signal: AbortSignal.timeout(30000) });
        const dimensions = embeddings[0]?.length;
        if (!Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 8192) {
          throw runtimeError('向量模型没有返回有效维度', 'AI_EMBEDDING_DIMENSION_MISSING', '请核对向量模型和接口地址。');
        }
        state = this.store.getRawAIState();
        const saved = state.draft?.connections.find((item) => item.id === connection.id);
        if (saved?.capabilities.embedding) saved.capabilities.embedding.dimensions = dimensions;
        this.store.saveAIState(state);
      } else {
        await client.rerank('事业', ['官鬼为事业用神', '妻财为求财用神'], { topN: 1, signal: AbortSignal.timeout(30000) });
      }
      state = this.store.getRawAIState();
      state.draft.tests[capability] = { status: 'passed', checkedAt: new Date().toISOString() };
      this.store.saveAIState(state);
      this.#emit();
      return { ok: true, status: this.getStatus() };
    } catch (error) {
      state = this.store.getRawAIState();
      if (state.draft) {
        state.draft.tests[capability] = {
          status: 'failed',
          checkedAt: new Date().toISOString(),
          error: structuredProviderError(error, 'AI_CONNECTION_FAILED'),
        };
        this.store.saveAIState(state);
      }
      this.#emit();
      return { ok: false, error: structuredProviderError(error, 'AI_CONNECTION_FAILED'), status: this.getStatus() };
    }
  }

  cancelSetup() {
    const state = this.store.getRawAIState();
    state.draft = null;
    this.store.saveAIState(state);
    this.#emit();
    return this.getStatus();
  }

  stagePreset(presetId, apiKey, consentAccepted = false) {
    const state = this.store.getRawAIState();
    const expanded = expandPreset(presetId);
    const encryptedApiKey = this.#encryptSecret(String(apiKey || '').trim());
    const connections = [];
    const pipeline = emptyPipeline();
    for (const capability of CAPABILITIES) {
      const definition = expanded.connection.capabilities[capability];
      if (!definition) continue;
      const connection = capabilityConnection({
        capability,
        apiUrl: definition.url || `${expanded.connection.baseUrl}${definition.path || ''}`,
        model: definition.model,
        dimensions: definition.dimensions,
      });
      connection.providerId = expanded.connection.providerId;
      connection.label = expanded.connection.label;
      connection.presetId = expanded.connection.presetId;
      connection.encryptedApiKey = encryptedApiKey;
      connections.push(connection);
      pipeline[capability] = { connectionId: connection.id };
    }
    state.draft = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connections,
      pipeline,
      tests: {},
      indexTask: null,
    };
    if (consentAccepted) state.consentAcceptedAt = new Date().toISOString();
    this.store.saveAIState(state);
    this.#emit();
    return this.getStatus();
  }

  async testDraftCapabilities() {
    let state = this.store.getRawAIState();
    const capabilities = configuredCapabilities(state.draft?.pipeline);
    for (const capability of capabilities) {
      state = this.store.getRawAIState();
      const connection = this.#draftConnectionFor(state, capability);
      const definition = connection?.capabilities?.[capability];
      const result = await this.testCapability({
        capability,
        apiUrl: definition?.url || `${connection?.baseUrl || ''}${definition?.path || ''}`,
        model: definition?.model,
      });
      if (!result.ok) return result;
    }
    return { ok: true, status: this.getStatus() };
  }

  rebuildActiveIndex() {
    const state = this.store.getRawAIState();
    const capabilities = configuredCapabilities(state.activePipeline);
    if (!capabilities.includes('embedding')) {
      throw runtimeError('当前方案未启用向量模型', 'AI_EMBEDDING_REQUIRED', '关键词检索不需要重建向量。');
    }
    state.draft = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connections: [],
      pipeline: structuredClone(state.activePipeline),
      tests: Object.fromEntries(capabilities.map((capability) => [capability, { status: 'passed', checkedAt: new Date().toISOString() }])),
      indexTask: null,
      bulkEmbeddingAccepted: true,
    };
    this.store.saveAIState(state);
    return this.completeSetup({ capabilities, bulkEmbeddingAccepted: true });
  }

  #updateDraftTask(update) {
    const state = this.store.getRawAIState();
    if (!state.draft) return;
    state.draft.indexTask = { ...(state.draft.indexTask || {}), ...update, updatedAt: new Date().toISOString() };
    this.store.saveAIState(state);
    this.#emit();
  }

  async completeSetup(payload = {}) {
    if (this.vectorBuildPromise) {
      if (this.vectorBuildControl?.paused) {
        this.vectorBuildControl.paused = false;
        this.#updateDraftTask({ stage: 'building' });
      }
      return this.vectorBuildPromise;
    }
    const initial = this.store.getRawAIState();
    const draft = this.#ensureDraft(initial);
    const requested = [...new Set(Array.isArray(payload.capabilities) ? payload.capabilities : [])]
      .filter((capability) => CAPABILITIES.includes(capability));
    if (!requested.includes('generation')) throw runtimeError('主模型尚未配置', 'AI_GENERATION_REQUIRED', '请先完成主模型最小测试。');
    if (requested.includes('rerank') && !requested.includes('embedding')) {
      throw runtimeError('重排模型不能脱离向量模型使用', 'AI_PIPELINE_INVALID', '请保留向量模型，或同时跳过向量和重排。');
    }
    for (const capability of CAPABILITIES) {
      if (!requested.includes(capability)) draft.pipeline[capability] = null;
    }
    for (const capability of requested) {
      if (!draft.pipeline[capability] || draft.tests[capability]?.status !== 'passed') {
        throw runtimeError(`请先完成${capability === 'generation' ? '主模型' : capability === 'embedding' ? '向量模型' : '重排模型'}最小测试`, 'AI_TEST_REQUIRED', '返回对应页面完成测试后再继续。');
      }
    }
    if (!initial.consentAcceptedAt) {
      throw runtimeError('请先确认 AI 数据发送范围', 'AI_CONSENT_REQUIRED', '阅读并确认数据边界后再继续。');
    }
    draft.updatedAt = new Date().toISOString();
    if (!requested.includes('embedding')) {
      this.#activateDraft(initial, '');
      return { ok: true, status: this.getStatus() };
    }
    const resolved = this.#resolvePipeline(initial, draft.pipeline, draft.connections);
    const embedding = resolved.embedding;
    const identity = this.#prepareExistingIndex(embedding);
    const requestedShards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    if (requestedShards.length && this.corpusIndex.readyShards(identity, requestedShards).length === requestedShards.length) {
      this.#activateDraft(initial, identity.fingerprint);
      return { ok: true, status: this.getStatus() };
    }
    const bundled = embedding.definition.model === 'text-embedding-v4' && embedding.definition.dimensions === 1024;
    if (!bundled && !payload.bulkEmbeddingAccepted) {
      throw runtimeError('尚未确认批量向量建库', 'AI_BULK_CONSENT_REQUIRED', '请确认古籍分批发送数量与服务商费用后再继续。');
    }
    draft.bulkEmbeddingAccepted = Boolean(payload.bulkEmbeddingAccepted);
    this.store.saveAIState(initial);
    const control = { paused: false, cancelled: false };
    this.vectorBuildControl = control;
    const operation = this.#buildAndActivate(initial, control)
      .finally(() => {
        if (this.vectorBuildPromise === operation) this.vectorBuildPromise = null;
        if (this.vectorBuildControl === control) this.vectorBuildControl = null;
        this.#emit();
      })
      .then((result) => ({ ...result, status: this.getStatus() }));
    this.vectorBuildPromise = operation;
    this.#emit();
    return operation;
  }

  async #buildAndActivate(initial, control) {
    const resolved = this.#resolvePipeline(initial, initial.draft.pipeline, initial.draft.connections);
    const embedding = resolved.embedding;
    const identity = this.#embeddingIdentity(embedding);
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    if (!shards.length) throw runtimeError('没有已启用的古籍可建立索引', 'CORPUS_EMPTY', '请先启用至少一本古籍。');
    const client = this.#client(embedding.connection, embedding.apiKey);
    this.#updateDraftTask({ stage: 'building', fingerprint: identity.fingerprint, completed: 0, total: shards.reduce((sum, shard) => sum + shard.entries.length, 0), progress: 0, failedRange: null, error: null });
    try {
      const result = await this.corpusIndex.buildShards({
        identity,
        shards,
        control,
        embed: (batch) => client.embed(batch, { signal: AbortSignal.timeout(60000) }),
        onProgress: (progress) => this.#updateDraftTask({
          stage: progress.paused ? 'paused' : 'building',
          fingerprint: identity.fingerprint,
          completed: progress.completed,
          total: progress.total,
          progress: Math.round(progress.progress * 10) / 10,
          failedRange: null,
          error: null,
        }),
      });
      if (!result.ok) {
        this.#updateDraftTask({ stage: 'paused', completed: result.completed, total: result.total, progress: result.total ? result.completed / result.total * 100 : 0 });
        return { ok: false, error: structuredProviderError(runtimeError('向量构建已暂停', 'AI_INDEX_PAUSED', '可稍后从当前进度继续。')) };
      }
      for (const shard of shards) {
        if (shard.origin === 'user') this.corpusLibrary.markIndexState(shard.id, 'ready', { progress: 100 });
      }
      this.#activateDraft(this.store.getRawAIState(), identity.fingerprint);
      return { ok: true, status: this.getStatus() };
    } catch (error) {
      const detail = structuredProviderError(error, 'VECTOR_INDEX_FAILED');
      const state = this.store.getRawAIState();
      if (state.draft) {
        state.draft.tests.embedding = { status: 'failed', checkedAt: new Date().toISOString(), error: detail };
        state.draft.indexTask = {
          ...(state.draft.indexTask || {}),
          stage: 'error',
          fingerprint: identity.fingerprint,
          failedRange: error?.indexFailure || null,
          error: detail,
          updatedAt: new Date().toISOString(),
        };
        this.store.saveAIState(state);
        this.#emit();
      }
      return { ok: false, error: detail, status: this.getStatus() };
    }
  }

  #activateDraft(state, fingerprint) {
    if (!state.draft) throw new Error('AI 配置草稿已不存在');
    const draftIds = new Set(state.draft.connections.map((connection) => connection.id));
    state.connections = [
      ...state.connections.filter((connection) => !draftIds.has(connection.id)),
      ...state.draft.connections,
    ];
    state.activePipeline = state.draft.pipeline;
    state.draft = null;
    this.store.saveAIState(state);
    this.activeFingerprint = fingerprint;
    this.#emit();
  }

  pauseBuild() {
    if (!this.vectorBuildControl) return this.getStatus();
    this.vectorBuildControl.paused = true;
    this.#emit();
    return this.getStatus();
  }

  resumeBuild() {
    const state = this.store.getRawAIState();
    if (state.draft?.indexTask?.stage === 'error') return this.getStatus();
    if (this.vectorBuildControl) {
      this.vectorBuildControl.paused = false;
      this.#updateDraftTask({ stage: 'building' });
      return this.getStatus();
    }
    const capabilities = configuredCapabilities(state.draft?.pipeline);
    void this.completeSetup({
      capabilities,
      bulkEmbeddingAccepted: Boolean(state.draft?.bulkEmbeddingAccepted),
    }).catch((error) => {
      this.#updateDraftTask({ stage: 'error', error: structuredProviderError(error, 'VECTOR_INDEX_FAILED') });
    });
    return this.getStatus();
  }

  cancelBuild() {
    if (this.vectorBuildControl) this.vectorBuildControl.cancelled = true;
    return this.getStatus();
  }

  async indexBooks(bookIds) {
    if (this.vectorBuildPromise) throw runtimeError('正在切换 AI 向量方案', 'AI_INDEX_BUSY', '请等待当前完整索引任务结束。');
    const { state, resolved } = this.#activeRuntime();
    if (!resolved.embedding) throw runtimeError('当前方案未启用向量模型', 'AI_EMBEDDING_REQUIRED', '关键词检索无需远程建库；如需向量检索，请先配置向量模型。');
    for (const id of Array.isArray(bookIds) ? bookIds : []) this.libraryBuildQueue.add(String(id));
    if (this.libraryBuildPromise) {
      return this.libraryBuildPromise;
    }
    if (!state.consentAcceptedAt) throw runtimeError('尚未确认 AI 数据发送范围', 'AI_CONSENT_REQUIRED', '请先确认后再建立用户古籍索引。');
    if (!this.libraryBuildQueue.size) {
      for (const book of this.#allLibraryBooks()) {
        if (book.origin === 'user' && book.enabled && ['pending', 'paused', 'error'].includes(book.indexState)) this.libraryBuildQueue.add(book.id);
      }
    }
    if (!this.libraryBuildQueue.size) return { ok: true, indexedBookIds: [], status: this.getStatus() };
    const control = { paused: false, cancelled: false };
    this.libraryBuildControl = control;
    const operation = this.#drainLibraryQueue(control)
      .finally(() => {
        if (this.libraryBuildPromise === operation) this.libraryBuildPromise = null;
        if (this.libraryBuildControl === control) this.libraryBuildControl = null;
        this.#emit();
      });
    this.libraryBuildPromise = operation;
    this.#emit();
    return operation;
  }

  async #drainLibraryQueue(control) {
    const indexedBookIds = [];
    while (this.libraryBuildQueue.size && !control.cancelled) {
      const wanted = new Set(this.libraryBuildQueue);
      this.libraryBuildQueue.clear();
      const { resolved } = this.#activeRuntime();
      if (!resolved.embedding) break;
      const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true })
        .filter((shard) => shard.origin === 'user' && wanted.has(shard.id));
      if (!shards.length) continue;
      for (const shard of shards) this.corpusLibrary.markIndexState(shard.id, 'building', { progress: 0 });
      const result = await this.#buildLibraryShards({ resolved, shards, control });
      indexedBookIds.push(...(result.indexedBookIds || []));
      if (!result.ok) return { ...result, indexedBookIds, status: this.getStatus() };
    }
    return { ok: !control.cancelled, paused: control.cancelled, indexedBookIds, status: this.getStatus() };
  }

  async #buildLibraryShards({ resolved, shards, control }) {
    const embedding = resolved.embedding;
    const identity = this.#embeddingIdentity(embedding);
    if (identity.fingerprint !== this.activeFingerprint) {
      throw runtimeError('当前向量方案已变化', 'AI_INDEX_STALE', '请刷新书库状态后重新建立索引。');
    }
    const client = this.#client(embedding.connection, embedding.apiKey);
    let currentShardId = shards[0]?.id || '';
    try {
      const result = await this.corpusIndex.buildShards({
        identity,
        shards,
        control,
        embed: (batch) => client.embed(batch, { signal: AbortSignal.timeout(60000) }),
        onProgress: (progress) => {
          currentShardId = progress.shardId;
          this.corpusLibrary.markIndexState(
            progress.shardId,
            progress.paused ? 'paused' : 'building',
            { progress: progress.shardProgress },
          );
          this.#emit();
        },
      });
      if (!result.ok) {
        for (const shard of shards) {
          const book = this.corpusLibrary.getBook(shard.id);
          if (book?.indexState === 'building') this.corpusLibrary.markIndexState(shard.id, 'paused', { progress: book.indexProgress });
        }
        return { ok: false, paused: true, indexedBookIds: [], status: this.getStatus() };
      }
      for (const shard of shards) this.corpusLibrary.markIndexState(shard.id, 'ready', { progress: 100 });
      return { ok: true, indexedBookIds: shards.map((shard) => shard.id), status: this.getStatus() };
    } catch (error) {
      const indexedBookIds = [];
      const structuredError = structuredProviderError(error, 'VECTOR_INDEX_FAILED');
      for (const shard of shards) {
        if (this.corpusIndex.hasShard(identity, shard)) {
          this.corpusLibrary.markIndexState(shard.id, 'ready', { progress: 100 });
          indexedBookIds.push(shard.id);
        } else if (shard.id === currentShardId) {
          this.corpusLibrary.markIndexState(shard.id, 'error', { progress: this.corpusLibrary.getBook(shard.id)?.indexProgress || 0, error: structuredError });
        } else if (this.corpusLibrary.getBook(shard.id)?.indexState === 'building') {
          this.corpusLibrary.markIndexState(shard.id, 'pending', { progress: 0 });
        }
      }
      return { ok: false, indexedBookIds, error: structuredError, status: this.getStatus() };
    }
  }

  pauseLibraryBuild() {
    if (this.libraryBuildControl) this.libraryBuildControl.paused = true;
    return this.getCorpusStatus();
  }

  resumeLibraryBuild() {
    if (this.libraryBuildControl) {
      this.libraryBuildControl.paused = false;
      return this.getCorpusStatus();
    }
    const ids = this.#allLibraryBooks()
      .filter((book) => book.origin === 'user' && book.enabled && ['pending', 'paused', 'error'].includes(book.indexState))
      .map((book) => book.id);
    if (ids.length) void this.indexBooks(ids);
    return this.getCorpusStatus();
  }

  cancelLibraryBuild() {
    if (this.libraryBuildControl) this.libraryBuildControl.cancelled = true;
    return this.getCorpusStatus();
  }

  getCorpusStatus() {
    const overview = this.corpusLibrary.getOverview();
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: false, indexRequestedOnly: false });
    const entries = shards.flatMap((shard) => shard.entries);
    let readyShardIds = [];
    let vectorModel = '';
    try {
      const { resolved } = this.#activeRuntime();
      if (resolved.embedding) {
        const identity = this.#embeddingIdentity(resolved.embedding);
        readyShardIds = this.corpusIndex.readyShards(identity, shards).map((shard) => shard.id);
        vectorModel = identity.model;
      }
    } catch {}
    return {
      ...overview,
      count: entries.length,
      originalCount: entries.filter((entry) => entry.sourceType === 'original').length,
      summaryCount: entries.filter((entry) => entry.sourceType === 'summary').length,
      ruleCount: entries.filter((entry) => entry.knowledgeKind === 'rule').length,
      caseCount: entries.filter((entry) => entry.knowledgeKind === 'case').length,
      doctrineCount: entries.filter((entry) => entry.knowledgeKind === 'doctrine').length,
      vectorReady: Boolean(vectorModel && this.activeFingerprint),
      vectorModel,
      readyShardIds,
      ready: entries.length > 0,
    };
  }

  #activeRuntime() {
    const state = this.store.getRawAIState();
    const resolved = this.#resolvePipeline(state, state.activePipeline);
    if (!state.consentAcceptedAt) throw runtimeError('尚未确认 AI 数据发送范围', 'AI_CONSENT_REQUIRED', '请在设置中确认后继续。');
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: false });
    if (!shards.length) throw runtimeError('没有已启用的古籍', 'AI_CORPUS_REQUIRED', '请至少启用一本古籍后重试。');
    let identity = null;
    let vectorShards = [];
    if (resolved.embedding) {
      if (!this.activeFingerprint) throw runtimeError('向量索引尚未就绪', 'AI_INDEX_REQUIRED', '请先完成向量索引构建。');
      identity = this.#embeddingIdentity(resolved.embedding);
      if (identity.fingerprint !== this.activeFingerprint) throw runtimeError('当前向量索引与 AI 配置不一致', 'AI_INDEX_REQUIRED', '请重新建立向量索引。');
      const requestedShards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
      vectorShards = this.corpusIndex.readyShards(identity, requestedShards);
      if (!vectorShards.length) throw runtimeError('没有可用的向量检索分片', 'AI_INDEX_REQUIRED', '请至少完成一本已启用古籍的向量索引。');
    }
    return { state, resolved, identity, shards, vectorShards };
  }

  async search(payload) {
    const { resolved, identity, shards, vectorShards } = this.#activeRuntime();
    const embeddingClient = resolved.embedding ? this.#client(resolved.embedding.connection, resolved.embedding.apiKey) : null;
    const rerankClient = resolved.rerank ? this.#client(resolved.rerank.connection, resolved.rerank.apiKey) : null;
    const result = await hybridSearch({
      lexicalSearch: (query, domainTerms, limit) => this.corpusLibrary.lexicalSearch({ shards, query, domainTerms, limit }),
      hydrate: (ids) => this.corpusLibrary.hydrateEntries(ids, shards),
      query: String(payload.query || ''),
      domainTerms: Array.isArray(payload.domainTerms) ? payload.domainTerms : [],
      vectorSearch: embeddingClient ? async (query) => {
        const [vector] = await embeddingClient.embed([query], { signal: AbortSignal.timeout(30000) });
        return this.corpusIndex.search(identity, vectorShards, vector, 40);
      } : undefined,
      rerank: rerankClient
        ? (query, documents) => rerankClient.rerank(query, documents, { topN: 16, signal: AbortSignal.timeout(60000) })
        : undefined,
    });
    result.diagnostics.corpusVersion = crypto.createHash('sha256')
      .update(shards.map((shard) => `${shard.id}:${shard.contentHash}`).sort().join('|'))
      .digest('hex');
    return result;
  }

  filterEvidence(items) {
    const { shards } = this.#activeRuntime();
    const allowed = new Set(shards.flatMap((shard) => [...shard.enabledEntryIds]));
    return (Array.isArray(items) ? items : []).filter((item) => allowed.has(item?.id));
  }

  async analyze(payload) {
    const { resolved } = this.#activeRuntime();
    const generationClient = this.#client(resolved.generation.connection, resolved.generation.apiKey);
    const report = await analyzeCloud({
      ...payload,
      chat: (request) => generationClient.chat(request),
    });
    report.provider = Object.fromEntries(CAPABILITIES.filter((capability) => resolved[capability]).map((capability) => [capability, {
      providerId: resolved[capability].connection.providerId,
      connectionLabel: resolved[capability].connection.label,
      model: resolved[capability].definition.model,
    }]));
    return report;
  }

  async followUp(payload) {
    const { resolved } = this.#activeRuntime();
    const generationClient = this.#client(resolved.generation.connection, resolved.generation.apiKey);
    const answer = await followUpCloud({
      ...payload,
      chat: (request) => generationClient.chat(request),
    });
    answer.provider = Object.fromEntries(CAPABILITIES.filter((capability) => resolved[capability]).map((capability) => [capability, {
      providerId: resolved[capability].connection.providerId,
      connectionLabel: resolved[capability].connection.label,
      model: resolved[capability].definition.model,
    }]));
    return answer;
  }
}

module.exports = { AIRuntime, isLocalUrl, runtimeError };
