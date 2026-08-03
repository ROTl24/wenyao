const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { analyzeCloud, followUpCloud } = require('./ai.cjs');
const {
  CAPABILITIES,
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
const { LocalVectorIndex, ResumableVectorBuilder } = require('./vector-index.cjs');

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

class AIRuntime {
  constructor({
    store,
    safeStorage,
    corpus,
    corpusHash,
    indexRoot,
    legacyIndexBases = [],
    fetchImpl = fetch,
    onStatus = () => {},
  }) {
    this.store = store;
    this.safeStorage = safeStorage;
    this.corpus = corpus;
    this.corpusHash = corpusHash;
    this.indexRoot = indexRoot;
    this.legacyIndexBases = legacyIndexBases;
    this.fetchImpl = fetchImpl;
    this.onStatus = onStatus;
    this.activeIndex = null;
    this.activeFingerprint = '';
    this.vectorBuildPromise = null;
    this.vectorBuildControl = null;
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
    return this.getStatus();
  }

  getCatalog() {
    return getProviderCatalog();
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

  #indexBase(fingerprint) {
    return path.join(this.indexRoot, fingerprint, 'corpus-vectors');
  }

  #loadActiveIndex() {
    this.activeIndex = null;
    this.activeFingerprint = '';
    const state = this.store.getRawAIState();
    let resolved;
    try { resolved = this.#resolvePipeline(state, state.activePipeline); }
    catch { return; }
    const embedding = resolved.embedding;
    const fingerprint = pipelineFingerprint({
      connection: embedding.connection,
      capability: 'embedding',
      corpusHash: this.corpusHash,
    });
    const targetBase = this.#indexBase(fingerprint);
    const index = new LocalVectorIndex(targetBase);
    if (index.load({
      model: embedding.definition.model,
      corpusHash: this.corpusHash,
      fingerprint,
    })) {
      this.activeIndex = index;
      this.activeFingerprint = fingerprint;
      return;
    }
    const migrated = this.#migrateLegacyIndex(embedding, fingerprint, targetBase);
    if (migrated) {
      this.activeIndex = migrated;
      this.activeFingerprint = fingerprint;
    }
  }

  #migrateLegacyIndex(embedding, fingerprint, targetBase) {
    if (embedding.connection.providerId !== 'alibaba') return null;
    for (const legacyBase of this.legacyIndexBases) {
      const legacy = new LocalVectorIndex(legacyBase);
      if (!legacy.load({ model: embedding.definition.model, corpusHash: this.corpusHash })) continue;
      if (legacy.dimensions !== embedding.definition.dimensions) continue;
      fs.mkdirSync(path.dirname(targetBase), { recursive: true });
      const dataTemp = `${targetBase}.f32.tmp`;
      const metaTemp = `${targetBase}.json.tmp`;
      fs.copyFileSync(legacy.dataPath, dataTemp);
      fs.writeFileSync(metaTemp, JSON.stringify({
        version: 2,
        fingerprint,
        providerId: embedding.connection.providerId,
        baseUrl: embedding.connection.baseUrl,
        model: embedding.definition.model,
        corpusHash: this.corpusHash,
        dimensions: legacy.dimensions,
        ids: legacy.ids,
        completedAt: new Date().toISOString(),
        migratedFromLegacy: true,
      }, null, 2));
      for (const target of [`${targetBase}.f32`, `${targetBase}.json`]) {
        try { fs.unlinkSync(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      fs.renameSync(dataTemp, `${targetBase}.f32`);
      fs.renameSync(metaTemp, `${targetBase}.json`);
      const migrated = new LocalVectorIndex(targetBase);
      if (migrated.load({ model: embedding.definition.model, corpusHash: this.corpusHash, fingerprint })) return migrated;
    }
    return null;
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
      } else if (!this.activeIndex) {
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
      corpusCount: this.corpus.length,
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
    const fingerprint = pipelineFingerprint({ connection: embedding.connection, capability: 'embedding', corpusHash: this.corpusHash });
    const basePath = this.#indexBase(fingerprint);
    const existingIndex = new LocalVectorIndex(basePath);
    if (existingIndex.load({ model: embedding.definition.model, corpusHash: this.corpusHash, fingerprint })) {
      this.#activateDraft(initial, existingIndex, fingerprint);
      return { ok: true, status: this.getStatus() };
    }
    const builder = new ResumableVectorBuilder(basePath, {
      fingerprint,
      providerId: embedding.connection.providerId,
      baseUrl: embedding.connection.baseUrl,
      model: embedding.definition.model,
      corpusHash: this.corpusHash,
      dimensions: embedding.definition.dimensions,
      ids: this.corpus.map((entry) => entry.id),
    });
    const client = this.#client(embedding.connection, embedding.apiKey);
    const batchSize = Math.min(32, Math.max(1, Number(embedding.definition.batchSize) || 10));
    this.#updateDraftTask({ stage: 'building', fingerprint, ...builder.status(), error: null });
    try {
      while (builder.completed < this.corpus.length) {
        if (control.cancelled) {
          this.#updateDraftTask({ stage: 'paused', ...builder.status() });
          return { ok: false, error: structuredProviderError(runtimeError('向量构建已暂停', 'AI_INDEX_PAUSED', '可稍后从当前进度继续。')) };
        }
        if (control.paused) this.#updateDraftTask({ stage: 'paused', ...builder.status() });
        while (control.paused) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          if (control.cancelled) break;
        }
        if (control.cancelled) continue;
        const batch = this.corpus.slice(builder.completed, builder.completed + batchSize)
          .map((entry) => `${entry.title}\n${entry.text}`);
        const vectors = await withTransientRetry(
          () => client.embed(batch, { signal: AbortSignal.timeout(60000) }),
          { retries: 2 },
        );
        builder.append(vectors);
        this.#updateDraftTask({ stage: 'building', fingerprint, ...builder.status(), error: null });
      }
      const index = builder.finalize();
      this.#activateDraft(this.store.getRawAIState(), index, fingerprint);
      return { ok: true, status: this.getStatus() };
    } catch (error) {
      this.#updateDraftTask({ stage: 'error', fingerprint, ...builder.status(), error: structuredProviderError(error, 'VECTOR_INDEX_FAILED') });
      return { ok: false, error: structuredProviderError(error, 'VECTOR_INDEX_FAILED'), status: this.getStatus() };
    }
  }

  #activateDraft(state, index, fingerprint) {
    if (!state.draft) throw new Error('AI 配置草稿已不存在');
    const draftConnection = state.draft.connection;
    state.connections = [
      ...state.connections.filter((connection) => connection.id !== draftConnection.id),
      draftConnection,
    ];
    state.activePipeline = state.draft.pipeline;
    state.draft = null;
    this.store.saveAIState(state);
    this.activeIndex = index;
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
    if (!this.activeIndex) throw runtimeError('向量索引尚未就绪', 'AI_INDEX_REQUIRED', '请先完成向量索引构建。');
    return { state, resolved };
  }

  async search(payload) {
    const { resolved } = this.#activeRuntime();
    const embeddingClient = this.#client(resolved.embedding.connection, resolved.embedding.apiKey);
    const rerankClient = this.#client(resolved.rerank.connection, resolved.rerank.apiKey);
    const result = await hybridSearch({
      corpus: this.corpus,
      query: String(payload.query || ''),
      domainTerms: Array.isArray(payload.domainTerms) ? payload.domainTerms : [],
      limit: Math.min(12, Math.max(1, Number(payload.limit) || 8)),
      vectorSearch: async (query) => {
        const [vector] = await withTransientRetry(
          () => embeddingClient.embed([query], { signal: AbortSignal.timeout(30000) }),
          { retries: 2 },
        );
        return this.activeIndex.search(vector, 40);
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
