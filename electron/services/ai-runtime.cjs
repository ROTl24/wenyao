const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeCloud, followUpCloud } = require('./ai.cjs');
const {
  CAPABILITIES,
  embeddingFingerprint,
  expandPreset,
  getProviderCatalog,
  normalizeConnection,
  normalizePipeline,
  pipelineFingerprint,
} = require('./ai-config.cjs');
const {
  createProviderClient,
  structuredProviderError,
  validateBaseUrl,
  withTransientRetry,
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

function uniqueConnections(resolved) {
  return [...new Map(Object.values(resolved).map((item) => [item.connection.id, item.connection])).values()];
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
    safeStorage,
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
    this.safeStorage = safeStorage;
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
    const normalized = String(secret || '').trim();
    if (!normalized) return '';
    if (!this.safeStorage?.isEncryptionAvailable()) {
      throw runtimeError(
        '当前 Windows 环境无法启用 DPAPI 密钥保护',
        'SECRET_STORAGE_UNAVAILABLE',
        '请在当前 Windows 用户的正常桌面会话中运行问爻。',
      );
    }
    return this.safeStorage.encryptString(normalized).toString('base64');
  }

  #decryptSecret(connection) {
    const encrypted = String(connection?.encryptedApiKey || '');
    if (!encrypted) return '';
    if (!this.safeStorage?.isEncryptionAvailable()) return '';
    try { return this.safeStorage.decryptString(Buffer.from(encrypted, 'base64')); }
    catch { return ''; }
  }

  #connectionsFor(state, draftConnection = null) {
    const connections = new Map(state.connections.map((connection) => [connection.id, connection]));
    if (draftConnection) connections.set(draftConnection.id, draftConnection);
    return connections;
  }

  #resolvePipeline(state, pipeline, draftConnection = null) {
    if (!pipeline) {
      throw runtimeError('尚未选择完整 AI 能力组合', 'AI_NOT_CONFIGURED', '请连接 AI 服务并完成设置。');
    }
    const connections = this.#connectionsFor(state, draftConnection);
    const resolved = {};
    for (const capability of CAPABILITIES) {
      const connectionId = pipeline[capability]?.connectionId;
      const connection = connections.get(connectionId);
      const definition = connection?.capabilities?.[capability];
      if (!connection || !definition) {
        throw runtimeError(
          `尚未配置${capability === 'generation' ? '解读' : capability === 'embedding' ? '向量' : '重排'}能力`,
          'AI_CAPABILITY_MISSING',
          '请在 AI 高级设置中补齐三项必选能力。',
        );
      }
      validateBaseUrl(connection.baseUrl);
      if (capability === 'rerank' && definition.protocol === 'alibaba-rerank' && !definition.url) {
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
    if (this.corpusIndex.readyShards(identity, shards).length > 0) this.activeFingerprint = identity.fingerprint;
  }

  getStatus() {
    const state = this.store.getPublicAIState();
    const raw = this.store.getRawAIState();
    let status = 'unconfigured';
    let message = '尚未连接 AI 服务';
    let activeCapabilities = null;
    try {
      const resolved = this.#resolvePipeline(raw, raw.activePipeline);
      activeCapabilities = Object.fromEntries(CAPABILITIES.map((capability) => [capability, {
        connectionId: resolved[capability].connection.id,
        providerId: resolved[capability].connection.providerId,
        label: resolved[capability].connection.label,
        model: resolved[capability].definition.model,
      }]));
      if (!raw.consentAcceptedAt) {
        status = 'needs-consent';
        message = '需要确认 AI 数据发送范围';
      } else if (!this.activeFingerprint
        || this.#embeddingIdentity(resolved.embedding).fingerprint !== this.activeFingerprint
        || this.corpusIndex.readyShards(
          this.#embeddingIdentity(resolved.embedding),
          this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true }),
        ).length === 0) {
        status = 'index-required';
        message = '需要构建向量索引';
      } else {
        status = 'ready';
        message = '解读、向量与重排均已就绪';
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
    } else if (raw.draft?.testResult?.status === 'testing') {
      status = 'testing';
      message = '正在检测三项 AI 能力';
    } else if (raw.draft?.testResult?.status === 'failed') {
      status = 'error';
      message = raw.draft.testResult.error?.message || 'AI 能力检测失败';
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

  saveDraft(payload) {
    const state = this.store.getRawAIState();
    let connection;
    let pipeline;
    if (payload?.presetId) {
      ({ connection, pipeline } = expandPreset(payload.presetId, payload.fields || {}));
    } else {
      connection = normalizeConnection({
        ...(payload?.connection || {}),
        id: payload?.connection?.id || `custom-${crypto.randomUUID()}`,
      });
      pipeline = normalizePipeline(payload?.pipeline);
      if (!connection || !pipeline) throw new Error('自定义 AI 草稿不完整');
    }
    const existing = state.connections.find((item) => item.id === connection.id);
    const apiKey = String(payload?.apiKey || '').trim();
    connection.encryptedApiKey = apiKey ? this.#encryptSecret(apiKey) : existing?.encryptedApiKey || '';
    if (!connection.encryptedApiKey && !isLocalUrl(connection.baseUrl)) {
      throw runtimeError('请粘贴访问密钥', 'AI_KEY_REQUIRED', '访问密钥相当于 AI 服务的专用密码，可在服务商官方控制台创建。');
    }
    const draft = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      connection,
      pipeline,
      testResult: null,
      indexTask: null,
    };
    state.draft = draft;
    if (payload?.consentAccepted) state.consentAcceptedAt = new Date().toISOString();
    this.store.saveAIState(state);
    this.#emit();
    return this.getStatus();
  }

  async testDraft() {
    let state = this.store.getRawAIState();
    if (!state.draft) throw new Error('没有待检测的 AI 配置草稿');
    state.draft.testResult = { status: 'testing', startedAt: new Date().toISOString(), capabilities: {} };
    this.store.saveAIState(state);
    this.#emit();
    try {
      const resolved = this.#resolvePipeline(state, state.draft.pipeline, state.draft.connection);
      const clients = new Map(uniqueConnections(resolved).map((connection) => {
        const item = Object.values(resolved).find((candidate) => candidate.connection.id === connection.id);
        return [connection.id, this.#client(connection, item.apiKey)];
      }));
      for (const capability of CAPABILITIES) {
        const item = resolved[capability];
        const client = clients.get(item.connection.id);
        const models = await client.listModels(capability, AbortSignal.timeout(30000));
        if (models && !models.includes(item.definition.model)) {
          throw runtimeError(
            `${item.connection.label}当前账号不可用模型：${item.definition.model}`,
            'AI_MODEL_UNAVAILABLE',
            '请检查账号权限；问爻不会静默替换为其他模型。',
          );
        }
        if (capability === 'generation') {
          await client.chat({
            messages: [{ role: 'user', content: '只回复：连接成功' }],
            maxTokens: 16,
            signal: AbortSignal.timeout(60000),
          });
        } else if (capability === 'embedding') {
          await withTransientRetry(
            () => client.embed(['六爻模型连接测试'], { signal: AbortSignal.timeout(30000) }),
            { retries: 2 },
          );
        } else {
          await withTransientRetry(
            () => client.rerank('事业', ['官鬼为事业用神', '妻财为求财用神'], { topN: 1, signal: AbortSignal.timeout(30000) }),
            { retries: 2 },
          );
        }
        state = this.store.getRawAIState();
        state.draft.testResult.capabilities[capability] = { ok: true, checkedAt: new Date().toISOString() };
        this.store.saveAIState(state);
        this.#emit();
      }
      state = this.store.getRawAIState();
      state.draft.testResult = {
        ...state.draft.testResult,
        status: 'passed',
        completedAt: new Date().toISOString(),
      };
      this.store.saveAIState(state);
      this.#emit();
      return { ok: true, status: this.getStatus() };
    } catch (error) {
      state = this.store.getRawAIState();
      if (state.draft) {
        state.draft.testResult = {
          ...state.draft.testResult,
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: structuredProviderError(error, 'AI_CONNECTION_FAILED'),
        };
        this.store.saveAIState(state);
      }
      this.#emit();
      return { ok: false, error: structuredProviderError(error, 'AI_CONNECTION_FAILED'), status: this.getStatus() };
    }
  }

  #updateDraftTask(update) {
    const state = this.store.getRawAIState();
    if (!state.draft) return;
    state.draft.indexTask = { ...(state.draft.indexTask || {}), ...update, updatedAt: new Date().toISOString() };
    this.store.saveAIState(state);
    this.#emit();
  }

  async buildAndActivate() {
    if (this.vectorBuildPromise) {
      if (this.vectorBuildControl?.paused) {
        this.vectorBuildControl.paused = false;
        this.#updateDraftTask({ stage: 'building' });
      }
      return this.vectorBuildPromise;
    }
    const initial = this.store.getRawAIState();
    if (!initial.draft || initial.draft.testResult?.status !== 'passed') {
      throw runtimeError('请先完成三项 AI 能力检测', 'AI_TEST_REQUIRED', '检测通过后才能构建向量索引。');
    }
    if (!initial.consentAcceptedAt) {
      throw runtimeError('请先确认 AI 数据发送范围', 'AI_CONSENT_REQUIRED', '阅读并确认数据边界后再继续。');
    }
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
    const resolved = this.#resolvePipeline(initial, initial.draft.pipeline, initial.draft.connection);
    const embedding = resolved.embedding;
    const identity = this.#embeddingIdentity(embedding);
    const shards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    if (!shards.length) throw runtimeError('没有已启用的古籍可建立索引', 'CORPUS_EMPTY', '请先启用至少一本古籍。');
    const client = this.#client(embedding.connection, embedding.apiKey);
    this.#updateDraftTask({ stage: 'building', fingerprint: identity.fingerprint, completed: 0, total: shards.reduce((sum, shard) => sum + shard.entries.length, 0), progress: 0, error: null });
    try {
      const result = await this.corpusIndex.buildShards({
        identity,
        shards,
        control,
        embed: (batch) => withTransientRetry(
          () => client.embed(batch, { signal: AbortSignal.timeout(60000) }),
          { retries: 2 },
        ),
        onProgress: (progress) => this.#updateDraftTask({
          stage: progress.paused ? 'paused' : 'building',
          fingerprint: identity.fingerprint,
          completed: progress.completed,
          total: progress.total,
          progress: Math.round(progress.progress * 10) / 10,
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
      this.#updateDraftTask({ stage: 'error', fingerprint: identity.fingerprint, error: structuredProviderError(error, 'VECTOR_INDEX_FAILED') });
      return { ok: false, error: structuredProviderError(error, 'VECTOR_INDEX_FAILED'), status: this.getStatus() };
    }
  }

  #activateDraft(state, fingerprint) {
    if (!state.draft) throw new Error('AI 配置草稿已不存在');
    const draftConnection = state.draft.connection;
    state.connections = [
      ...state.connections.filter((connection) => connection.id !== draftConnection.id),
      draftConnection,
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
    if (this.vectorBuildControl) {
      this.vectorBuildControl.paused = false;
      this.#updateDraftTask({ stage: 'building' });
      return this.getStatus();
    }
    void this.buildAndActivate().catch((error) => {
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
    for (const id of Array.isArray(bookIds) ? bookIds : []) this.libraryBuildQueue.add(String(id));
    if (this.libraryBuildPromise) {
      return this.libraryBuildPromise;
    }
    const { state } = this.#activeRuntime();
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
        embed: (batch) => withTransientRetry(
          () => client.embed(batch, { signal: AbortSignal.timeout(60000) }),
          { retries: 2 },
        ),
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
      const identity = this.#embeddingIdentity(resolved.embedding);
      readyShardIds = this.corpusIndex.readyShards(identity, shards).map((shard) => shard.id);
      vectorModel = identity.model;
    } catch {}
    return {
      ...overview,
      count: entries.length,
      originalCount: entries.filter((entry) => entry.sourceType === 'original').length,
      summaryCount: entries.filter((entry) => entry.sourceType === 'summary').length,
      ruleCount: entries.filter((entry) => entry.knowledgeKind === 'rule').length,
      caseCount: entries.filter((entry) => entry.knowledgeKind === 'case').length,
      doctrineCount: entries.filter((entry) => entry.knowledgeKind === 'doctrine').length,
      vectorReady: Boolean(this.activeFingerprint),
      vectorModel,
      readyShardIds,
      ready: entries.length > 0,
    };
  }

  removeConnection(id) {
    const state = this.store.getRawAIState();
    if (CAPABILITIES.some((capability) => state.activePipeline?.[capability]?.connectionId === id)) {
      throw runtimeError('不能删除当前正在使用的 AI 连接', 'AI_CONNECTION_ACTIVE', '请先启用其他完整能力组合。');
    }
    state.connections = state.connections.filter((connection) => connection.id !== id);
    if (state.draft?.connection?.id === id) state.draft = null;
    this.store.saveAIState(state);
    this.#emit();
    return this.getStatus();
  }

  #activeRuntime() {
    const state = this.store.getRawAIState();
    const resolved = this.#resolvePipeline(state, state.activePipeline);
    if (!state.consentAcceptedAt) throw runtimeError('尚未确认 AI 数据发送范围', 'AI_CONSENT_REQUIRED', '请在设置中确认后继续。');
    if (!this.activeFingerprint) throw runtimeError('向量索引尚未就绪', 'AI_INDEX_REQUIRED', '请先完成向量索引构建。');
    const identity = this.#embeddingIdentity(resolved.embedding);
    if (identity.fingerprint !== this.activeFingerprint) throw runtimeError('当前向量索引与 AI 配置不一致', 'AI_INDEX_REQUIRED', '请重新建立向量索引。');
    const requestedShards = this.corpusLibrary.getShardDescriptors({ enabledOnly: true, indexRequestedOnly: true });
    const shards = this.corpusIndex.readyShards(identity, requestedShards);
    if (!shards.length) throw runtimeError('没有可用的严格检索分片', 'AI_INDEX_REQUIRED', '请至少完成一本已启用古籍的向量索引。');
    return { state, resolved, identity, shards };
  }

  async search(payload) {
    const { resolved, identity, shards } = this.#activeRuntime();
    const embeddingClient = this.#client(resolved.embedding.connection, resolved.embedding.apiKey);
    const rerankClient = this.#client(resolved.rerank.connection, resolved.rerank.apiKey);
    const result = await hybridSearch({
      lexicalSearch: (query, domainTerms, limit) => this.corpusLibrary.lexicalSearch({ shards, query, domainTerms, limit }),
      hydrate: (ids) => this.corpusLibrary.hydrateEntries(ids, shards),
      query: String(payload.query || ''),
      domainTerms: Array.isArray(payload.domainTerms) ? payload.domainTerms : [],
      limit: Math.min(12, Math.max(1, Number(payload.limit) || 8)),
      vectorSearch: async (query) => {
        const [vector] = await withTransientRetry(
          () => embeddingClient.embed([query], { signal: AbortSignal.timeout(30000) }),
          { retries: 2 },
        );
        return this.corpusIndex.search(identity, shards, vector, 40);
      },
      rerank: (query, documents) => withTransientRetry(
        () => rerankClient.rerank(query, documents, { topN: 12, signal: AbortSignal.timeout(60000) }),
        { retries: 2 },
      ),
    });
    if (!result.diagnostics.vectorUsed || !result.diagnostics.rerankUsed) {
      const reason = result.diagnostics.warnings.join(' ');
      throw runtimeError(
        `本次检索未完成必选的向量召回与重排。${reason ? ` ${reason}` : ''}`,
        'AI_RETRIEVAL_REQUIRED',
        '请检查向量与重排服务后重试；问爻不会降级生成报告。',
      );
    }
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
      signal: AbortSignal.timeout(180000),
    });
    report.provider = Object.fromEntries(CAPABILITIES.map((capability) => [capability, {
      providerId: resolved[capability].connection.providerId,
      connectionLabel: resolved[capability].connection.label,
      model: resolved[capability].definition.model,
    }]));
    return report;
  }

  async followUp(payload) {
    const { resolved } = this.#activeRuntime();
    const generationClient = this.#client(resolved.generation.connection, resolved.generation.apiKey);
    return followUpCloud({
      ...payload,
      chat: (request) => generationClient.chat(request),
      signal: AbortSignal.timeout(180000),
    });
  }
}

module.exports = { AIRuntime, isLocalUrl, runtimeError };
