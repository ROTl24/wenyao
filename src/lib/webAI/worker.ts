/// <reference lib="webworker" />

import corpus from '../../../resources/corpus.json';
import vectorMetadata from '../../../resources/corpus-vectors.json';
import corpusManifest from '../../../resources/corpus-manifest.json';
import aiCore from '../../../electron/services/ai.cjs';
import retrievalCore from '../../../shared/retrieval-core.cjs';
import setupCore from '../../../shared/ai-setup-core.cjs';
import type { AICapability, AIConfigStatus, AIConnection, AIPipeline, DesktopApi, DesktopError } from '../../types/desktop';
import type { EvidenceEntry } from '../retrieval';
import { createWebProvider, discoverWebModels } from './provider';
import type { TestCapabilityPayload, WebAIRequest, WebAIResponse, WebAIStatusEvent } from './protocol';
import { assertConfirmedOrigins, toDesktopError, usesBundledVectorPack, validateWebConnection, type WebSecurityConfirmation, WebAIError } from './security';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const capabilities = ['generation', 'embedding', 'rerank'] as const;
const { capabilityConnection, filterModels, generationProbeOptions, normalizeCapabilityLocation } = setupCore as {
  capabilityConnection(input: { capability: AICapability; apiUrl: string; model: string; id?: string; createdAt?: string; dimensions?: number }): AIConnection;
  filterModels(capability: AICapability, models: string[]): string[];
  generationProbeOptions(connection: AIConnection): { maxTokens: number; thinking?: boolean };
  normalizeCapabilityLocation(capability: AICapability, apiUrl: string): { baseUrl: string };
};
const bundledVectorsUrl = new URL('../../../resources/corpus-vectors.f32', import.meta.url).href;
const keys = new Map<string, string>();
const confirmedOrigins = new Map<string, string[]>();
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
  workerScope.postMessage({ event: 'status', status: structuredClone(status) } satisfies WebAIStatusEvent);
}

function response(id: string, ok: boolean, value?: unknown, error?: DesktopError): void {
  workerScope.postMessage({ id, ok, ...(value === undefined ? {} : { value }), ...(error ? { error } : {}) } satisfies WebAIResponse);
}

function emptyPipeline(): AIPipeline {
  return { generation: null, embedding: null, rerank: null };
}

function allConnections(): AIConnection[] {
  return [...status.connections, ...(status.draft?.connections || [])];
}

function connectionFor(pipeline: AIPipeline | null, capability: AICapability): AIConnection | null {
  const id = pipeline?.[capability]?.connectionId;
  return id ? allConnections().find((connection) => connection.id === id) || null : null;
}

function pipelineConnections(pipeline: AIPipeline): Partial<Record<AICapability, AIConnection>> & { generation: AIConnection } {
  if (!pipeline.generation) throw new WebAIError({ code: 'WEB_AI_GENERATION_REQUIRED', message: '尚未配置 AI 解读主模型。', dataSafe: true, nextAction: '请先完成主模型最小测试。' });
  if (pipeline.rerank && !pipeline.embedding) throw new WebAIError({ code: 'WEB_AI_PIPELINE_INVALID', message: '重排模型不能脱离向量模型使用。', dataSafe: true, nextAction: '请先配置向量模型，或跳过重排模型。' });
  const resolved: Partial<Record<AICapability, AIConnection>> = {};
  for (const capability of capabilities) {
    if (!pipeline[capability]) continue;
    const connection = connectionFor(pipeline, capability);
    if (!connection?.capabilities[capability]) throw new WebAIError({ code: 'WEB_AI_CAPABILITY_MISSING', message: 'AI 能力配置已失效。', dataSafe: true, nextAction: '请重新完成该项设置。' });
    if (!keys.get(connection.id)) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: `${connection.label} 的访问密钥已不在当前页面会话中。`, dataSafe: true, nextAction: '请重新输入该连接的访问密钥。' });
    resolved[capability] = connection;
  }
  return resolved as Partial<Record<AICapability, AIConnection>> & { generation: AIConnection };
}

function recordUsage(connection: AIConnection, capability: AICapability, item: { model: string; promptTokens: number; completionTokens: number; totalTokens: number }): void {
  status.usage = [...status.usage, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), providerId: connection.providerId, capability, ...item }].slice(-200);
  emitStatus();
}

function provider(connection: AIConnection) {
  const apiKey = keys.get(connection.id);
  if (!apiKey) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: `${connection.label} 的访问密钥已失效。`, dataSafe: true, nextAction: '刷新或关闭页面会清除密钥，请重新输入。' });
  return createWebProvider(connection, apiKey, (item) => recordUsage(connection, item.capability, item));
}

function activePipeline(): { pipeline: AIPipeline; connections: ReturnType<typeof pipelineConnections> } {
  if (!status.activePipeline) throw new WebAIError({ code: 'WEB_AI_NOT_READY', message: '网页版 AI 尚未准备完成。', dataSafe: true, nextAction: '请先完成主模型设置。' });
  const connections = pipelineConnections(status.activePipeline);
  if (connections.embedding && !vectors) throw new WebAIError({ code: 'WEB_AI_INDEX_REQUIRED', message: '向量索引尚未准备完成。', dataSafe: true, nextAction: '请继续当前向导中的索引准备。' });
  return { pipeline: status.activePipeline, connections };
}

async function withPaidOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  if (paidOperation) throw new WebAIError({ code: 'WEB_AI_OPERATION_BUSY', message: `另一项 AI 操作正在进行（${paidOperation}）。`, dataSafe: true, nextAction: '请等待当前操作完成，避免重复请求和重复计费。' });
  paidOperation = name;
  try { return await operation(); } finally { paidOperation = ''; }
}

function ensureDraft() {
  if (status.draft) return status.draft;
  const pipeline = status.activePipeline ? structuredClone(status.activePipeline) : emptyPipeline();
  status.draft = {
    id: crypto.randomUUID(),
    connections: [],
    pipeline,
    tests: Object.fromEntries(capabilities.filter((capability) => pipeline[capability]).map((capability) => [capability, { status: 'passed', checkedAt: new Date().toISOString() }])),
    indexTask: null,
  };
  return status.draft;
}

function keyForCapability(capability: AICapability): string {
  const connection = connectionFor(status.draft?.pipeline || status.activePipeline, capability) || connectionFor(status.activePipeline, capability);
  const key = connection && keys.get(connection.id);
  if (!key) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: '无法沿用该连接的访问密钥。', dataSafe: true, nextAction: '请重新填写 API Key。' });
  return key;
}

async function listModels(payload: Parameters<DesktopApi['aiConfig']['listModels']>[0]) {
  const location = normalizeCapabilityLocation(payload.capability, payload.apiUrl);
  const temporary = capabilityConnection({ capability: payload.capability, apiUrl: payload.apiUrl, model: 'model-list' });
  const validated = validateWebConnection(temporary);
  assertConfirmedOrigins(validated.origins, payload.webSecurity as WebSecurityConfirmation | undefined);
  const apiKey = String(payload.apiKey || '').trim() || (payload.credentialSource ? keyForCapability(payload.credentialSource) : '');
  if (!apiKey) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: '请填写 API Key。', dataSafe: true, nextAction: '密钥只会保留在当前页面的隔离 Worker 内存。' });
  const discovered = await discoverWebModels(location.baseUrl, apiKey, payload.capability);
  const modelIds = filterModels(payload.capability, discovered);
  return { ok: true, modelIds, ...(modelIds.length ? {} : { warning: '模型目录未标注该类能力，请手动填写模型名称。' }) };
}

async function testCapability(payload: TestCapabilityPayload): Promise<{ ok: boolean; status: AIConfigStatus; error?: DesktopError }> {
  return withPaidOperation('最小连接测试', async () => {
    const draft = ensureDraft();
    if (payload.capability === 'rerank' && !draft.pipeline.embedding) throw new WebAIError({ code: 'WEB_AI_EMBEDDING_REQUIRED', message: '请先配置向量模型。', dataSafe: true, nextAction: '重排模型只能在向量检索之后使用。' });
    const previous = connectionFor(draft.pipeline, payload.capability);
    const shared = previous && capabilities.some((other) => other !== payload.capability && draft.pipeline[other]?.connectionId === previous.id);
    const activeOnly = previous && !draft.connections.some((connection) => connection.id === previous.id);
    const requested = capabilityConnection({
      capability: payload.capability,
      apiUrl: payload.apiUrl,
      model: payload.model,
      id: shared || activeOnly ? undefined : previous?.id,
      createdAt: shared || activeOnly ? undefined : previous?.createdAt,
      dimensions: previous?.capabilities.embedding?.dimensions,
    });
    const validated = validateWebConnection(requested);
    assertConfirmedOrigins(validated.origins, payload.webSecurity as WebSecurityConfirmation | undefined);
    const apiKey = String(payload.apiKey || '').trim()
      || (payload.credentialSource ? keyForCapability(payload.credentialSource) : '')
      || (previous ? keys.get(previous.id) : '')
      || (connectionFor(status.activePipeline, payload.capability) ? keyForCapability(payload.capability) : '');
    if (!apiKey) throw new WebAIError({ code: 'WEB_AI_KEY_REQUIRED', message: '请填写 API Key。', dataSafe: true, nextAction: '密钥只会保留在当前页面的隔离 Worker 内存。' });
    keys.set(validated.connection.id, apiKey);
    confirmedOrigins.set(validated.connection.id, validated.origins);
    draft.connections = [...draft.connections.filter((connection) => connection.id !== validated.connection.id), validated.connection];
    draft.pipeline[payload.capability] = { connectionId: validated.connection.id };
    draft.tests[payload.capability] = { status: 'testing' };
    status.consentAcceptedAt = payload.consentAccepted ? new Date().toISOString() : status.consentAcceptedAt;
    status.status = 'testing'; status.message = '正在执行一次最小连接测试。'; emitStatus();
    try {
      const client = provider(validated.connection);
      if (payload.capability === 'generation') {
        await client.chat({
          messages: [{ role: 'user', content: '只回复：连接成功' }],
          ...generationProbeOptions(validated.connection),
        });
      }
      else if (payload.capability === 'embedding') {
        const result = await client.embed('六爻模型连接测试');
        const dimensions = result[0]?.length;
        if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 8192) throw new Error('向量模型没有返回有效维度。');
        validated.connection.capabilities.embedding!.dimensions = dimensions;
        const saved = draft.connections.find((connection) => connection.id === validated.connection.id);
        if (saved?.capabilities.embedding) saved.capabilities.embedding.dimensions = dimensions;
      } else await client.rerank('事业', ['官鬼为事业用神', '妻财为求财用神'], { topN: 1 });
      draft.tests[payload.capability] = { status: 'passed', checkedAt: new Date().toISOString() };
      status.status = status.activePipeline ? 'ready' : 'needs-setup'; status.message = '本项最小测试通过。'; emitStatus();
      return { ok: true, status: structuredClone(status) };
    } catch (error) {
      const detail = toDesktopError(error, 'WEB_AI_TEST_FAILED');
      draft.tests[payload.capability] = { status: 'failed', checkedAt: new Date().toISOString(), error: detail };
      status.status = 'error'; status.message = detail.message; emitStatus();
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
  try { database = await openVectorDatabase(); } catch { return null; }
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
  try { database = await openVectorDatabase(); } catch { return false; }
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('indexes', 'readwrite');
      transaction.objectStore('indexes').put({ fingerprint: value.fingerprint, dimensions: value.dimensions, ids: value.ids, buffer: value.values.buffer });
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
    });
    return true;
  } catch { return false; } finally { database.close(); }
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

function activateDraft(targetFingerprint: string, nextVectors: typeof vectors): void {
  const draft = status.draft!;
  const draftIds = new Set(draft.connections.map((connection) => connection.id));
  status.connections = [...status.connections.filter((connection) => !draftIds.has(connection.id)), ...draft.connections];
  status.activePipeline = structuredClone(draft.pipeline);
  status.activeFingerprint = targetFingerprint;
  vectors = nextVectors;
  const resolved = pipelineConnections(status.activePipeline);
  status.activeCapabilities = Object.fromEntries(capabilities.filter((capability) => resolved[capability]).map((capability) => {
    const connection = resolved[capability]!;
    return [capability, { connectionId: connection.id, providerId: connection.providerId, label: connection.label, model: connection.capabilities[capability]!.model }];
  }));
  status.draft = null; status.status = 'ready';
  status.message = resolved.rerank ? '关键词、向量与重排检索均已就绪；密钥将在刷新或关闭页面时清除。' : resolved.embedding ? '关键词与向量检索均已就绪；密钥将在刷新或关闭页面时清除。' : '主模型与本地关键词检索已就绪；密钥将在刷新或关闭页面时清除。';
  emitStatus();
}

async function completeSetup(payload: Parameters<DesktopApi['aiConfig']['completeSetup']>[0]): Promise<{ ok: boolean; status: AIConfigStatus; error?: DesktopError }> {
  return withPaidOperation('配置完成', async () => {
    const draft = status.draft;
    if (!draft || !payload.capabilities.includes('generation')) throw new WebAIError({ code: 'WEB_AI_GENERATION_REQUIRED', message: '主模型尚未配置。', dataSafe: true, nextAction: '请先完成主模型最小测试。' });
    if (payload.capabilities.includes('rerank') && !payload.capabilities.includes('embedding')) throw new WebAIError({ code: 'WEB_AI_PIPELINE_INVALID', message: '重排模型不能脱离向量模型使用。', dataSafe: true, nextAction: '请保留向量模型，或同时跳过向量和重排。' });
    for (const capability of capabilities) if (!payload.capabilities.includes(capability)) draft.pipeline[capability] = null;
    for (const capability of payload.capabilities) {
      if (!draft.pipeline[capability] || draft.tests[capability]?.status !== 'passed') throw new WebAIError({ code: 'WEB_AI_TEST_REQUIRED', message: '所选能力尚未通过最小测试。', dataSafe: true, nextAction: '请返回对应页面完成测试。' });
    }
    if (!status.consentAcceptedAt) throw new WebAIError({ code: 'WEB_AI_CONSENT_REQUIRED', message: '尚未确认第三方数据发送范围。', dataSafe: true, nextAction: '请阅读并勾选确认后继续。' });
    if (!payload.capabilities.includes('embedding')) {
      activateDraft('', null);
      return { ok: true, status: structuredClone(status) };
    }
    const resolved = pipelineConnections(draft.pipeline);
    const embeddingConnection = resolved.embedding!;
    const dimensions = embeddingConnection.capabilities.embedding!.dimensions!;
    const targetFingerprint = fingerprint(embeddingConnection);
    let nextVectors = await loadStoredVectors(targetFingerprint);
    if (!nextVectors && usesBundledVectorPack(embeddingConnection)) nextVectors = await bundledVectorIndex(targetFingerprint);
    if (nextVectors) {
      activateDraft(targetFingerprint, nextVectors);
      return { ok: true, status: structuredClone(status) };
    }
    if (!payload.bulkEmbeddingAccepted) throw new WebAIError({ code: 'WEB_AI_BULK_CONSENT_REQUIRED', message: '该向量模型没有匹配的本地索引。', dataSafe: true, nextAction: '请确认批量发送古籍片段和可能产生的服务商费用。' });
    draft.bulkEmbeddingAccepted = true;
    buildControl = { paused: false, canceled: false };
    status.status = 'building'; status.message = '正在本机准备向量索引。';
    draft.indexTask = { stage: 'building', completed: 0, total: corpus.length, progress: 0, error: null }; emitStatus();
    try {
      let persistenceWarning = false;
      const definition = embeddingConnection.capabilities.embedding!;
      const batchSize = Math.max(1, Math.min(50, Number(definition.batchSize || 10)));
      const values = new Float32Array(corpus.length * dimensions);
      const embedder = provider(embeddingConnection);
      for (let offset = 0; offset < corpus.length; offset += batchSize) {
        await waitIfPaused();
        if (buildControl?.canceled) throw new WebAIError({ code: 'WEB_AI_BUILD_CANCELED', message: '向量索引构建已取消。', dataSafe: true, nextAction: '需要使用向量检索时可重新开始。' });
        const batch = corpus.slice(offset, offset + batchSize);
        const embedded = await embedder.embed(batch.map((entry) => `${entry.source} ${entry.title} ${entry.location}\n${entry.text}`));
        embedded.forEach((vector, index) => values.set(vector, (offset + index) * dimensions));
        const completed = Math.min(corpus.length, offset + batch.length);
        draft.indexTask = { stage: 'building', completed, total: corpus.length, progress: completed / corpus.length * 100, error: null }; emitStatus();
      }
      nextVectors = { fingerprint: targetFingerprint, dimensions, ids: corpus.map((entry) => entry.id), values };
      persistenceWarning = !(await storeVectors(nextVectors));
      activateDraft(targetFingerprint, nextVectors);
      if (persistenceWarning) status.message = 'AI 服务已就绪，但浏览器未能保存自定义向量索引；刷新后需要重新构建。';
      emitStatus();
      return { ok: true, status: structuredClone(status) };
    } catch (error) {
      const detail = toDesktopError(error, 'WEB_AI_INDEX_FAILED');
      status.status = 'error'; status.message = detail.message;
      if (status.draft?.indexTask) status.draft.indexTask = { ...status.draft.indexTask, stage: 'error', error: detail };
      emitStatus();
      return { ok: false, status: structuredClone(status), error: detail };
    } finally { buildControl = null; }
  });
}

function cosine(values: Float32Array, offset: number, query: number[]): number {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < query.length; index += 1) {
    const left = values[offset + index]; const right = query[index];
    dot += left * right; leftNorm += left * left; rightNorm += right * right;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1);
}

async function search(payload: Parameters<DesktopApi['retrieval']['search']>[0]) {
  return withPaidOperation('古籍检索', async () => {
    const active = activePipeline();
    const embedding = active.connections.embedding;
    const rerank = active.connections.rerank;
    const result = await retrievalCore.hybridSearch({
      corpus: corpus as EvidenceEntry[], query: payload.query, domainTerms: payload.domainTerms,
      vectorSearch: embedding ? async (query: string) => {
        const queryVector = (await provider(embedding).embed(query))[0];
        if (!vectors || queryVector.length !== vectors.dimensions) throw new Error('查询向量与本地索引维度不一致。');
        return vectors.ids.map((id, index) => ({ id, score: cosine(vectors!.values, index * vectors!.dimensions, queryVector) })).sort((left, right) => right.score - left.score).slice(0, 40);
      } : undefined,
      rerank: rerank ? (query: string, documents: string[]) => provider(rerank).rerank(query, documents, { topN: 16 }) : undefined,
    });
    result.diagnostics.corpusVersion = corpusManifest.corpusVersion;
    return result;
  });
}

function providerSnapshot(active: ReturnType<typeof activePipeline>) {
  return Object.fromEntries(capabilities.filter((capability) => active.connections[capability]).map((capability) => {
    const connection = active.connections[capability]!;
    return [capability, { providerId: connection.providerId, connectionLabel: connection.label, model: connection.capabilities[capability]!.model }];
  }));
}

async function analyze(payload: Parameters<DesktopApi['ai']['analyze']>[0]) {
  return withPaidOperation('AI 解读', async () => {
    try {
      const active = activePipeline();
      const report = await aiCore.analyzeCloud({ ...payload, chat: provider(active.connections.generation).chat });
      report.provider = providerSnapshot(active);
      return { ok: true, report };
    } catch (error) { return { ok: false, error: toDesktopError(error, 'WEB_AI_ANALYSIS_FAILED') }; }
  });
}

async function followUp(payload: Parameters<DesktopApi['ai']['followUp']>[0]) {
  return withPaidOperation('AI 追问', async () => {
    try {
      const active = activePipeline();
      const answer = await aiCore.followUpCloud({ ...payload, chat: provider(active.connections.generation).chat });
      answer.provider = providerSnapshot(active);
      return { ok: true, answer };
    } catch (error) { return { ok: false, error: toDesktopError(error, 'WEB_AI_FOLLOW_UP_FAILED') }; }
  });
}

function pauseBuild(): AIConfigStatus {
  if (buildControl) {
    buildControl.paused = true; status.status = 'paused'; status.message = '向量索引构建已暂停。';
    if (status.draft?.indexTask) status.draft.indexTask.stage = 'paused'; emitStatus();
  }
  return structuredClone(status);
}

async function resumeBuild(): Promise<AIConfigStatus> {
  if (buildControl) {
    buildControl.paused = false; status.status = 'building'; status.message = '正在继续准备本地向量索引。';
    if (status.draft?.indexTask) status.draft.indexTask.stage = 'building';
    buildControl.resume?.(); delete buildControl.resume; emitStatus();
  } else if (status.draft?.pipeline.embedding) {
    const selected = capabilities.filter((capability) => status.draft?.pipeline[capability]);
    return (await completeSetup({ capabilities: [...selected], bulkEmbeddingAccepted: Boolean(status.draft.bulkEmbeddingAccepted) })).status;
  }
  return structuredClone(status);
}

function cancelBuild(): AIConfigStatus {
  if (buildControl) { buildControl.canceled = true; buildControl.resume?.(); }
  return structuredClone(status);
}

function cancelSetup(): AIConfigStatus {
  for (const connection of status.draft?.connections || []) {
    if (!status.connections.some((active) => active.id === connection.id)) { keys.delete(connection.id); confirmedOrigins.delete(connection.id); }
  }
  status.draft = null;
  if (status.activePipeline) {
    const active = activePipeline();
    status.status = 'ready';
    status.message = active.connections.rerank ? '关键词、向量与重排检索均已就绪。' : active.connections.embedding ? '关键词与向量检索均已就绪。' : '主模型与本地关键词检索已就绪。';
  } else { status.status = 'unconfigured'; status.message = initialStatus.message; }
  emitStatus();
  return structuredClone(status);
}

function clear(): void {
  keys.clear(); confirmedOrigins.clear(); vectors = null; status = structuredClone(initialStatus); buildControl = null; emitStatus();
}

workerScope.addEventListener('message', (event: MessageEvent<WebAIRequest>) => {
  const { id, command, payload } = event.data;
  void (async () => {
    try {
      let value: unknown;
      switch (command) {
        case 'getStatus': value = structuredClone(status); break;
        case 'listModels': value = await listModels(payload as Parameters<DesktopApi['aiConfig']['listModels']>[0]); break;
        case 'testCapability': value = await testCapability(payload as TestCapabilityPayload); break;
        case 'completeSetup': value = await completeSetup(payload as Parameters<DesktopApi['aiConfig']['completeSetup']>[0]); break;
        case 'cancelSetup': value = cancelSetup(); break;
        case 'pauseBuild': value = pauseBuild(); break;
        case 'resumeBuild': value = await resumeBuild(); break;
        case 'cancelBuild': value = cancelBuild(); break;
        case 'search': value = await search(payload as Parameters<DesktopApi['retrieval']['search']>[0]); break;
        case 'analyze': value = await analyze(payload as Parameters<DesktopApi['ai']['analyze']>[0]); break;
        case 'followUp': value = await followUp(payload as Parameters<DesktopApi['ai']['followUp']>[0]); break;
        case 'clear': clear(); value = true; break;
        default: throw new Error('未知的网页 AI 命令。');
      }
      response(id, true, value);
    } catch (error) { response(id, false, undefined, toDesktopError(error)); }
  })();
});
