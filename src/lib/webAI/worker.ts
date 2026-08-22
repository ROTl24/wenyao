/// <reference lib="webworker" />

import corpus from '../../../resources/corpus.json';
import vectorMetadata from '../../../resources/corpus-vectors.json';
import aiCore from '../../../electron/services/ai.cjs';
import providerCatalog from '../../../config/ai-providers.json';
import type {
  AICapability,
  AIConfigStatus,
  AIConnection,
  AIPipeline,
  AIProviderCatalog,
  DesktopApi,
  DesktopError,
} from '../../types/desktop';
import type { EvidenceEntry, RetrievalDiagnostics } from '../retrieval';
import { searchEvidence } from '../retrieval';
import { createWebProvider } from './provider';
import type { SaveDraftPayload, WebAIRequest, WebAIResponse, WebAIStatusEvent } from './protocol';
import {
  assertConfirmedOrigins,
  connectionFromPreset,
  toDesktopError,
  usesBundledVectorPack,
  validateWebConnection,
  type WebSecurityConfirmation,
  WebAIError,
} from './security';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const catalog = providerCatalog as AIProviderCatalog;
const bundledVectorsUrl = new URL('../../../resources/corpus-vectors.f32', import.meta.url).href;
const keys = new Map<string, string>();
const confirmedOrigins = new Map<string, string[]>();
const bulkApprovals = new Map<string, boolean>();
let vectors: { fingerprint: string; dimensions: number; ids: string[]; values: Float32Array } | null = null;
let buildControl: { paused: boolean; canceled: boolean; resume?: () => void } | null = null;
let paidOperation = '';

const initialStatus: AIConfigStatus = {
  status: 'unconfigured',
  message: '尚未连接 AI 服务；访问密钥只在当前页面会话的隔离 Worker 中使用。',
  activeCapabilities: null,
  activeFingerprint: '',
  corpusCount: corpus.length,
  consentAcceptedAt: '',
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};
let status = structuredClone(initialStatus);

function emitStatus(): void {
  const event: WebAIStatusEvent = { event: 'status', status: structuredClone(status) };
  workerScope.postMessage(event);
}

function response(id: string, ok: boolean, value?: unknown, error?: DesktopError): void {
  const message: WebAIResponse = { id, ok, ...(value === undefined ? {} : { value }), ...(error ? { error } : {}) };
  workerScope.postMessage(message);
}

function pipelineConnections(pipeline: AIPipeline, connections: AIConnection[]): Record<AICapability, AIConnection> {
  return Object.fromEntries((['generation', 'embedding', 'rerank'] as const).map((capability) => {
    const connectionId = pipeline[capability]?.connectionId;
    const connection = connections.find((item) => item.id === connectionId);
    if (!connection || !connection.capabilities[capability]) {
      throw new WebAIError({ code: 'WEB_AI_PIPELINE_INCOMPLETE', message: '解读、向量和重排能力必须全部配置。', dataSafe: true, nextAction: '请在高级设置中为三项能力分别选择有效连接。' });
    }
    if (!keys.get(connection.id)) {
      throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: `${connection.label} 的访问密钥已不在当前页面会话中。`, dataSafe: true, nextAction: '请重新输入该连接的访问密钥。' });
    }
    return [capability, connection];
  })) as Record<AICapability, AIConnection>;
}

function recordUsage(connection: AIConnection, capability: AICapability, item: { model: string; promptTokens: number; completionTokens: number; totalTokens: number }): void {
  status.usage = [...status.usage, {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    providerId: connection.providerId,
    capability,
    ...item,
  }].slice(-200);
  emitStatus();
}

function provider(connection: AIConnection) {
  const apiKey = keys.get(connection.id);
  if (!apiKey) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: `${connection.label} 的访问密钥已失效。`, dataSafe: true, nextAction: '刷新或关闭页面会清除密钥，请重新输入。' });
  return createWebProvider(connection, apiKey, (item) => recordUsage(connection, item.capability, item));
}

function activePipeline(): { pipeline: AIPipeline; connections: Record<AICapability, AIConnection> } {
  if (status.status !== 'ready' || !status.activePipeline || !vectors) {
    throw new WebAIError({ code: 'WEB_AI_NOT_READY', message: '网页版 AI 尚未准备完成。', dataSafe: true, nextAction: '请先完成连接检测和向量索引准备。' });
  }
  return { pipeline: status.activePipeline, connections: pipelineConnections(status.activePipeline, status.connections) };
}

async function withPaidOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (paidOperation) {
    throw new WebAIError({ code: 'WEB_AI_OPERATION_BUSY', message: `另一项 AI 操作正在进行（${paidOperation}）。`, dataSafe: true, nextAction: '请等待当前操作完成，避免重复请求和重复计费。' });
  }
  paidOperation = name;
  try { return await operation(); }
  finally { paidOperation = ''; }
}

function makeConnection(payload: SaveDraftPayload): AIConnection {
  if (payload.presetId) {
    const preset = catalog.presets.find((item) => item.id === payload.presetId);
    if (!preset) throw new WebAIError({ code: 'WEB_AI_PRESET_UNKNOWN', message: '未找到所选服务商预设。', dataSafe: true, nextAction: '请重新选择服务商。' });
    const existing = status.connections.find((item) => item.presetId === preset.id);
    return connectionFromPreset(preset, payload.fields || {}, existing?.id || `web-${preset.providerId}`);
  }
  if (!payload.connection) throw new WebAIError({ code: 'WEB_AI_CONNECTION_REQUIRED', message: '缺少 AI 连接配置。', dataSafe: true, nextAction: '请填写自定义服务地址和三项模型。' });
  const previous = status.connections.find((item) => item.id === payload.connection?.id);
  return {
    id: String(payload.connection.id || crypto.randomUUID()),
    providerId: String(payload.connection.providerId || 'custom'),
    presetId: payload.connection.presetId || null,
    label: String(payload.connection.label || '自定义服务'),
    region: String(payload.connection.region || ''),
    baseUrl: String(payload.connection.baseUrl || ''),
    fields: payload.connection.fields || {},
    capabilities: payload.connection.capabilities || {},
    hasApiKey: Boolean(payload.apiKey || keys.has(String(payload.connection.id || ''))),
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function saveDraft(payload: SaveDraftPayload): { ok: true; status: AIConfigStatus } {
  if (!payload.consentAccepted) throw new WebAIError({ code: 'WEB_AI_CONSENT_REQUIRED', message: '尚未确认第三方数据发送和费用边界。', dataSafe: true, nextAction: '阅读说明并勾选确认后再继续。' });
  const requested = makeConnection(payload);
  const validated = validateWebConnection(requested);
  const security = payload.webSecurity as WebSecurityConfirmation | undefined;
  if (security) {
    assertConfirmedOrigins(validated.origins, security);
  } else {
    const prior = confirmedOrigins.get(validated.connection.id) || [];
    if (prior.length !== validated.origins.length || prior.some((value, index) => value !== validated.origins[index])) {
      assertConfirmedOrigins(validated.origins, security);
    }
  }
  const priorKey = keys.get(validated.connection.id);
  const apiKey = String(payload.apiKey || priorKey || '').trim();
  if (!apiKey) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: '当前页面会话中没有可用访问密钥。', dataSafe: true, nextAction: '请重新输入访问密钥。' });
  keys.set(validated.connection.id, apiKey);
  confirmedOrigins.set(validated.connection.id, validated.origins);
  if (security) bulkApprovals.set(validated.connection.id, Boolean(security.bulkEmbeddingAccepted));
  const connections = [...status.connections.filter((item) => item.id !== validated.connection.id), validated.connection];
  const pipeline = payload.pipeline || {
    generation: { connectionId: validated.connection.id },
    embedding: { connectionId: validated.connection.id },
    rerank: { connectionId: validated.connection.id },
  };
  pipelineConnections(pipeline, connections);
  status = {
    ...status,
    status: 'needs-setup',
    message: '连接配置仅在当前页面会话中，等待三项能力检测。',
    consentAcceptedAt: new Date().toISOString(),
    connections,
    draft: {
      id: crypto.randomUUID(),
      connection: validated.connection,
      pipeline,
      testResult: null,
      indexTask: null,
      webSecurity: {
        confirmedOrigins: validated.origins,
        bulkEmbeddingAccepted: Boolean(security?.bulkEmbeddingAccepted ?? bulkApprovals.get(validated.connection.id)),
      },
    },
  };
  emitStatus();
  return { ok: true, status: structuredClone(status) };
}

async function testDraft(): Promise<{ ok: boolean; status: AIConfigStatus; error?: DesktopError }> {
  return withPaidOperation('连接检测', async () => {
    if (!status.draft) throw new WebAIError({ code: 'WEB_AI_DRAFT_REQUIRED', message: '没有待检测的连接。', dataSafe: true, nextAction: '请先保存连接配置。' });
    const connections = pipelineConnections(status.draft.pipeline, status.connections);
    status.status = 'testing';
    status.message = '正在依次检测解读、向量和重排能力；每项只请求一次。';
    status.draft.testResult = { status: 'testing', capabilities: {} };
    emitStatus();
    try {
      await provider(connections.generation).chat({ messages: [{ role: 'user', content: '仅回复：问爻连接正常' }], maxTokens: 20 });
      status.draft.testResult.capabilities.generation = { ok: true, checkedAt: new Date().toISOString() };
      emitStatus();
      await provider(connections.embedding).embed('六爻向量连接检测');
      status.draft.testResult.capabilities.embedding = { ok: true, checkedAt: new Date().toISOString() };
      emitStatus();
      await provider(connections.rerank).rerank('六爻重排连接检测', ['世爻为自己', '用神按占问选择'], { topN: 1 });
      status.draft.testResult.capabilities.rerank = { ok: true, checkedAt: new Date().toISOString() };
      status.draft.testResult.status = 'passed';
      status.status = 'index-required';
      status.message = '三项能力检测通过，等待准备本地向量索引。';
      emitStatus();
      return { ok: true, status: structuredClone(status) };
    } catch (error) {
      const detail = toDesktopError(error, 'WEB_AI_TEST_FAILED');
      status.status = 'error';
      status.message = detail.message;
      status.draft.testResult = { ...status.draft.testResult, status: 'failed', error: detail };
      emitStatus();
      return { ok: false, status: structuredClone(status), error: detail };
    }
  });
}

function fingerprint(connection: AIConnection): string {
  const embedding = connection.capabilities.embedding!;
  return [new URL(connection.baseUrl).origin, embedding.model, embedding.dimensions, vectorMetadata.corpusHash].join('|');
}

function openVectorDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wenyao-web-ai-vectors', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('indexes', { keyPath: 'fingerprint' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadStoredVectors(targetFingerprint: string): Promise<typeof vectors> {
  let database: IDBDatabase;
  try { database = await openVectorDatabase(); }
  catch { return null; }
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction('indexes', 'readonly').objectStore('indexes').get(targetFingerprint);
      request.onsuccess = () => {
        const value = request.result as { fingerprint: string; dimensions: number; ids: string[]; buffer: ArrayBuffer } | undefined;
        resolve(value ? { fingerprint: value.fingerprint, dimensions: value.dimensions, ids: value.ids, values: new Float32Array(value.buffer) } : null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally { database.close(); }
}

async function storeVectors(value: NonNullable<typeof vectors>): Promise<boolean> {
  let database: IDBDatabase;
  try { database = await openVectorDatabase(); }
  catch { return false; }
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('indexes', 'readwrite');
      transaction.objectStore('indexes').put({ fingerprint: value.fingerprint, dimensions: value.dimensions, ids: value.ids, buffer: value.values.buffer });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch {
    return false;
  } finally { database.close(); }
}

async function bundledVectorIndex(targetFingerprint: string): Promise<NonNullable<typeof vectors>> {
  const response = await fetch(bundledVectorsUrl, { cache: 'force-cache', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('内置向量索引加载失败。');
  const values = new Float32Array(await response.arrayBuffer());
  const dimensions = 1024;
  if (values.length !== vectorMetadata.ids.length * dimensions) throw new Error('内置向量索引尺寸不正确。');
  return { fingerprint: targetFingerprint, dimensions, ids: vectorMetadata.ids, values };
}

async function waitIfPaused(): Promise<void> {
  if (!buildControl?.paused) return;
  await new Promise<void>((resolve) => { if (buildControl) buildControl.resume = resolve; else resolve(); });
}

async function buildAndActivate(): Promise<{ ok: boolean; status: AIConfigStatus; error?: DesktopError }> {
  return withPaidOperation('向量索引准备', async () => {
    if (!status.draft || status.draft.testResult?.status !== 'passed') {
      throw new WebAIError({ code: 'WEB_AI_TEST_REQUIRED', message: '三项能力尚未全部检测通过。', dataSafe: true, nextAction: '请先完成连接检测。' });
    }
    const draft = status.draft;
    const connections = pipelineConnections(draft.pipeline, status.connections);
    const embeddingConnection = connections.embedding;
    const dimensions = embeddingConnection.capabilities.embedding!.dimensions!;
    const targetFingerprint = fingerprint(embeddingConnection);
    buildControl = { paused: false, canceled: false };
    status.status = 'building';
    status.message = '正在本机准备向量索引。';
    status.draft.indexTask = { stage: 'building', completed: 0, total: corpus.length, progress: 0, error: null };
    emitStatus();
    try {
      let nextVectors = await loadStoredVectors(targetFingerprint);
      if (!nextVectors && usesBundledVectorPack(embeddingConnection)) {
        nextVectors = await bundledVectorIndex(targetFingerprint);
      }
      let persistenceWarning = false;
      if (!nextVectors) {
        if (!draft.webSecurity?.bulkEmbeddingAccepted) {
          throw new WebAIError({ code: 'WEB_AI_BULK_CONSENT_REQUIRED', message: '该向量模型没有匹配的内置索引。', dataSafe: true, nextAction: '请返回配置页，确认批量发送古籍片段和可能产生的服务商费用。' });
        }
        const definition = embeddingConnection.capabilities.embedding!;
        const batchSize = Math.max(1, Math.min(50, Number(definition.batchSize || 10)));
        const values = new Float32Array(corpus.length * dimensions);
        const embedder = provider(embeddingConnection);
        for (let offset = 0; offset < corpus.length; offset += batchSize) {
          await waitIfPaused();
          if (buildControl?.canceled) throw new WebAIError({ code: 'WEB_AI_BUILD_CANCELED', message: '向量索引构建已取消。', dataSafe: true, nextAction: '需要使用 AI 时可重新开始。' });
          const batch = corpus.slice(offset, offset + batchSize);
          const embedded = await embedder.embed(batch.map((entry) => `${entry.source} ${entry.title} ${entry.location}\n${entry.text}`));
          embedded.forEach((vector, index) => values.set(vector, (offset + index) * dimensions));
          const completed = Math.min(corpus.length, offset + batch.length);
          status.draft!.indexTask = { stage: 'building', completed, total: corpus.length, progress: completed / corpus.length * 100, error: null };
          emitStatus();
        }
        nextVectors = { fingerprint: targetFingerprint, dimensions, ids: corpus.map((entry) => entry.id), values };
        persistenceWarning = !(await storeVectors(nextVectors));
      }
      vectors = nextVectors;
      status.activePipeline = structuredClone(draft.pipeline);
      status.activeFingerprint = targetFingerprint;
      status.activeCapabilities = Object.fromEntries((['generation', 'embedding', 'rerank'] as const).map((capability) => {
        const connection = connections[capability];
        return [capability, { connectionId: connection.id, providerId: connection.providerId, label: connection.label, model: connection.capabilities[capability]!.model }];
      })) as AIConfigStatus['activeCapabilities'];
      status.draft = null;
      status.status = 'ready';
      status.message = persistenceWarning
        ? 'AI 服务已就绪，但浏览器未能保存自定义向量索引；刷新后需要重新构建。密钥仍会立即清除。'
        : 'AI 服务已就绪；密钥将在刷新或关闭页面时清除。';
      emitStatus();
      return { ok: true, status: structuredClone(status) };
    } catch (error) {
      const detail = toDesktopError(error, 'WEB_AI_INDEX_FAILED');
      status.status = 'error';
      status.message = detail.message;
      if (status.draft?.indexTask) status.draft.indexTask = { ...status.draft.indexTask, stage: 'error', error: detail };
      emitStatus();
      return { ok: false, status: structuredClone(status), error: detail };
    } finally { buildControl = null; }
  });
}

function cosine(values: Float32Array, offset: number, query: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < query.length; index += 1) {
    const left = values[offset + index];
    const right = query[index];
    dot += left * right;
    leftNorm += left * left;
    rightNorm += right * right;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1);
}

async function search(payload: Parameters<DesktopApi['retrieval']['search']>[0]) {
  return withPaidOperation('古籍检索', async () => {
    const active = activePipeline();
    const lexical = searchEvidence(corpus as EvidenceEntry[], payload.query, payload.domainTerms, 40);
    const queryVector = (await provider(active.connections.embedding).embed(payload.query))[0];
    if (!vectors || queryVector.length !== vectors.dimensions) throw new Error('查询向量与本地索引维度不一致。');
    const vectorRank = vectors.ids.map((id, index) => ({ id, score: cosine(vectors!.values, index * vectors!.dimensions, queryVector) }))
      .sort((left, right) => right.score - left.score).slice(0, 40);
    const fused = new Map<string, number>();
    lexical.forEach((item, index) => fused.set(item.id, (fused.get(item.id) || 0) + 1 / (61 + index)));
    vectorRank.forEach((item, index) => fused.set(item.id, (fused.get(item.id) || 0) + 1 / (61 + index)));
    const candidates = [...fused.entries()].sort((left, right) => right[1] - left[1]).slice(0, 24)
      .map(([id, score]) => ({ entry: corpus.find((item) => item.id === id) as EvidenceEntry, score }))
      .filter((item) => item.entry);
    const ranked = await provider(active.connections.rerank).rerank(payload.query, candidates.map((item) => `${item.entry.source} ${item.entry.location}\n${item.entry.text}`), { topN: payload.limit || 8 });
    const evidence = ranked.slice(0, payload.limit || 8).map((item) => {
      const candidate = candidates[item.index];
      const lexicalItem = lexical.find((entry) => entry.id === candidate.entry.id);
      const vectorItem = vectorRank.find((entry) => entry.id === candidate.entry.id);
      return {
        ...candidate.entry,
        retrieval: {
          lexicalScore: lexicalItem?.score || 0,
          vectorScore: vectorItem?.score || 0,
          fusionScore: candidate.score,
          rerankScore: item.score,
        },
      };
    });
    const diagnostics: RetrievalDiagnostics = {
      mode: 'hybrid-reranked',
      lexicalCandidates: lexical.length,
      vectorCandidates: vectorRank.length,
      fusedCandidates: candidates.length,
      vectorUsed: true,
      rerankUsed: true,
      warnings: [],
    };
    return { evidence, diagnostics };
  });
}

async function analyze(payload: Parameters<DesktopApi['ai']['analyze']>[0]) {
  return withPaidOperation('AI 解读', async () => {
    try {
      const active = activePipeline();
      const report = await aiCore.analyzeCloud({ ...payload, chat: provider(active.connections.generation).chat });
      report.provider = Object.fromEntries((['generation', 'embedding', 'rerank'] as const).map((capability) => {
        const connection = active.connections[capability];
        return [capability, { providerId: connection.providerId, connectionLabel: connection.label, model: connection.capabilities[capability]!.model }];
      })) as NonNullable<typeof report.provider>;
      return { ok: true, report };
    } catch (error) { return { ok: false, error: toDesktopError(error, 'WEB_AI_ANALYSIS_FAILED') }; }
  });
}

async function followUp(payload: Parameters<DesktopApi['ai']['followUp']>[0]) {
  return withPaidOperation('AI 追问', async () => {
    try {
      const active = activePipeline();
      const answer = await aiCore.followUpCloud({ ...payload, chat: provider(active.connections.generation).chat });
      return { ok: true, answer };
    } catch (error) { return { ok: false, error: toDesktopError(error, 'WEB_AI_FOLLOW_UP_FAILED') }; }
  });
}

function pauseBuild(): AIConfigStatus {
  if (buildControl) {
    buildControl.paused = true;
    status.status = 'paused';
    status.message = '向量索引构建已暂停。';
    if (status.draft?.indexTask) status.draft.indexTask.stage = 'paused';
    emitStatus();
  }
  return structuredClone(status);
}

function resumeBuild(): AIConfigStatus {
  if (buildControl) {
    buildControl.paused = false;
    status.status = 'building';
    status.message = '正在继续准备本地向量索引。';
    if (status.draft?.indexTask) status.draft.indexTask.stage = 'building';
    buildControl.resume?.();
    delete buildControl.resume;
    emitStatus();
  }
  return structuredClone(status);
}

function cancelBuild(): AIConfigStatus {
  if (buildControl) {
    buildControl.canceled = true;
    buildControl.resume?.();
  }
  return structuredClone(status);
}

function removeConnection(id: string) {
  keys.delete(id);
  confirmedOrigins.delete(id);
  bulkApprovals.delete(id);
  const active = status.activePipeline && Object.values(status.activePipeline).some((item) => item?.connectionId === id);
  status.connections = status.connections.filter((item) => item.id !== id);
  if (active) {
    vectors = null;
    status = { ...status, status: 'unconfigured', message: '当前 AI 连接已移除。', activeCapabilities: null, activeFingerprint: '', activePipeline: null, draft: null };
  }
  emitStatus();
  return { ok: true, status: structuredClone(status) };
}

function clear(): void {
  keys.clear();
  confirmedOrigins.clear();
  bulkApprovals.clear();
  vectors = null;
  status = structuredClone(initialStatus);
  buildControl = null;
  emitStatus();
}

workerScope.addEventListener('message', (event: MessageEvent<WebAIRequest>) => {
  const { id, command, payload } = event.data;
  void (async () => {
    try {
      let value: unknown;
      switch (command) {
        case 'getStatus': value = structuredClone(status); break;
        case 'saveDraft': value = saveDraft(payload as SaveDraftPayload); break;
        case 'testDraft': value = await testDraft(); break;
        case 'buildAndActivate': value = await buildAndActivate(); break;
        case 'pauseBuild': value = pauseBuild(); break;
        case 'resumeBuild': value = resumeBuild(); break;
        case 'cancelBuild': value = cancelBuild(); break;
        case 'removeConnection': value = removeConnection(String(payload)); break;
        case 'search': value = await search(payload as Parameters<DesktopApi['retrieval']['search']>[0]); break;
        case 'analyze': value = await analyze(payload as Parameters<DesktopApi['ai']['analyze']>[0]); break;
        case 'followUp': value = await followUp(payload as Parameters<DesktopApi['ai']['followUp']>[0]); break;
        case 'clear': clear(); value = true; break;
        default: throw new Error('未知的网页 AI 命令。');
      }
      response(id, true, value);
    } catch (error) {
      response(id, false, undefined, toDesktopError(error));
    }
  })();
});
