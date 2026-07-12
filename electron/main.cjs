const { app, BrowserWindow, ipcMain, net, protocol, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JsonStore } = require('./services/store.cjs');
const { migrateDataFile } = require('./services/migration.cjs');
const { createReadingService } = require('./services/reading-service.cjs');
const { registerReadingIpc } = require('./services/reading-ipc.cjs');
const { sanitizeRendererSession } = require('./services/ipc-payload.cjs');
const { analyzeCloudV2: analyzeCloudRawV2, followUpCloudV2: followUpCloudRawV2 } = require('./services/ai.cjs');
const { loadEvidenceCatalog } = require('./services/evidence-catalog.cjs');
const { createAlibabaClient } = require('./services/alibaba.cjs');
const { LocalVectorIndex } = require('./services/vector-index.cjs');
const { hybridSearch } = require('./services/retrieval.cjs');
const {
  APP_PROTOCOL_ENTRY_URL,
  APP_PROTOCOL_PRIVILEGES,
  APP_PROTOCOL_SCHEME,
  createAppProtocolHandler,
} = require('./services/app-protocol.cjs');

protocol.registerSchemesAsPrivileged([{
  scheme: APP_PROTOCOL_SCHEME,
  privileges: APP_PROTOCOL_PRIVILEGES,
}]);

const oneTimeSetupKey = process.argv.includes('--configure-api-key-env') ? String(process.env.WENYAO_SETUP_KEY || '') : '';
delete process.env.WENYAO_SETUP_KEY;

let mainWindow;
let store;
let corpus = [];
let corpusHash = '';
let vectorIndex;
let vectorBuildPromise = null;
let readingService;
let evidenceCatalog;
let domainRuntime;

function resourcePath(name) {
  const candidates = [path.join(app.getAppPath(), 'resources', name), path.join(process.resourcesPath, 'resources', name)];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function dataPath() {
  return path.join(app.getPath('userData'), 'app-data.json');
}

function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL_SCHEME, createAppProtocolHandler({
    distRoot: path.join(app.getAppPath(), 'dist'),
    fetchFile: (url, options) => net.fetch(url, options),
  }));
}

function loadVectorIndex(model) {
  const bases = [
    path.join(app.getPath('userData'), 'corpus-vectors'),
    resourcePath('corpus-vectors.f32').replace(/\.f32$/, ''),
  ];
  for (const base of bases) {
    const candidate = new LocalVectorIndex(base);
    if (candidate.load({ model, corpusHash })) return candidate;
  }
  return new LocalVectorIndex(bases[0]);
}

async function buildVectorIndex({ apiKey, onProgress = () => {} }) {
  const settings = store.getRawSettings();
  const client = createAlibabaClient({ apiKey, baseUrl: validateBaseUrl(settings.baseUrl) });
  const vectors = [];
  for (let offset = 0; offset < corpus.length; offset += 10) {
    const batch = corpus.slice(offset, offset + 10).map((entry) => `${entry.title}\n${entry.text}`);
    vectors.push(...await client.embed(batch, { model: settings.embeddingModel, dimensions: 1024, signal: AbortSignal.timeout(60000) }));
    onProgress(Math.min(corpus.length, offset + batch.length), corpus.length);
  }
  const base = app.isPackaged ? path.join(app.getPath('userData'), 'corpus-vectors') : path.join(app.getAppPath(), 'resources', 'corpus-vectors');
  const index = new LocalVectorIndex(base);
  index.write({ model: settings.embeddingModel, corpusHash, ids: corpus.map((entry) => entry.id), vectors });
  vectorIndex = index;
  return { count: corpus.length, model: settings.embeddingModel, dimensions: 1024 };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: '#d8d2c5',
    title: '问爻',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#232421', symbolColor: '#e8dfcf', height: 42 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (app.isPackaged) mainWindow.loadURL(APP_PROTOCOL_ENTRY_URL);
  else mainWindow.loadURL('http://127.0.0.1:5173');
}

function structuredError(error, fallbackCode = 'UNEXPECTED_ERROR') {
  const status = Number(error?.status || 0);
  return {
    code: status === 401 || status === 403 ? 'AI_AUTH_FAILED' : fallbackCode,
    message: error instanceof Error ? error.message : '操作失败',
    dataSafe: true,
    nextAction: status === 401 || status === 403 ? '请在设置中检查 API 密钥和模型权限。' : '已保存的起卦与排盘不会丢失，可以稍后重试。',
  };
}

function getApiKey() {
  const encrypted = store.getRawSettings().encryptedApiKey;
  if (!encrypted || !safeStorage.isEncryptionAvailable()) return '';
  try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); }
  catch { return ''; }
}

function validateBaseUrl(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('API 地址必须使用 HTTPS；本机地址可以使用 HTTP。');
  return url.toString().replace(/\/$/, '');
}

async function verifyModelStack(apiKey) {
  const settings = store.getRawSettings();
  const baseUrl = validateBaseUrl(settings.baseUrl);
  const client = createAlibabaClient({ apiKey, baseUrl, rerankUrl: settings.rerankUrl });
  const [vector] = await client.embed(['六爻模型连接测试'], { model: settings.embeddingModel, dimensions: 1024, signal: AbortSignal.timeout(30000) });
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: settings.model, enable_thinking: false, max_tokens: 16, messages: [{ role: 'user', content: '只回复：连接成功' }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403 ? '阿里云百炼密钥无效或没有解卦模型权限。' : `解卦模型连接失败（${response.status}）`);
    error.status = response.status;
    throw error;
  }
  const body = await response.json();
  if (!body?.choices?.[0]?.message?.content) throw new Error('解卦模型没有返回有效内容。');
  let rerankReady = false;
  if (settings.rerankUrl) {
    const ranked = await client.rerank('事业', ['官鬼为事业用神', '妻财为求财用神'], { model: settings.rerankModel, topN: 1, signal: AbortSignal.timeout(30000) });
    rerankReady = ranked.length > 0;
  }
  return { chatReady: true, embeddingReady: vector.length === 1024, rerankReady, rerankConfigured: Boolean(settings.rerankUrl) };
}

async function searchCorpus(payload) {
  const settings = store.getRawSettings();
  const apiKey = getApiKey();
  const client = apiKey ? createAlibabaClient({ apiKey, baseUrl: validateBaseUrl(settings.baseUrl), rerankUrl: settings.rerankUrl }) : null;
  return hybridSearch({
    corpus,
    query: String(payload.query || ''),
    domainTerms: Array.isArray(payload.domainTerms) ? payload.domainTerms : [],
    ruleIds: Array.isArray(payload.ruleIds) ? payload.ruleIds : [],
    limit: Math.min(12, Math.max(1, Number(payload.limit) || 8)),
    vectorSearch: client && vectorIndex?.vectors ? async (query) => vectorIndex.search((await client.embed([query], { model: settings.embeddingModel, dimensions: 1024, signal: AbortSignal.timeout(30000) }))[0], 40) : undefined,
    rerank: client && settings.rerankUrl ? async (query, documents) => client.rerank(query, documents, { model: settings.rerankModel, topN: 12, signal: AbortSignal.timeout(60000) }) : undefined,
  });
}

function cloudProviderConfigured() {
  const settings = store.getRawSettings();
  const apiKey = getApiKey();
  return Boolean(apiKey && settings.model);
}

async function analyzeReadingV2(payload) {
  const settings = store.getRawSettings();
  const apiKey = getApiKey();
  if (!apiKey || !settings.model) throw new Error('云端解卦服务尚未配置');
  return analyzeCloudRawV2({
    baseUrl: validateBaseUrl(settings.baseUrl),
    model: settings.model,
    apiKey,
    signal: AbortSignal.timeout(180000),
    ...payload,
  });
}

async function followUpReadingV2(payload) {
  const settings = store.getRawSettings();
  const apiKey = getApiKey();
  if (!apiKey || !settings.model) throw new Error('云端追问服务尚未配置');
  return followUpCloudRawV2({
    baseUrl: validateBaseUrl(settings.baseUrl),
    model: settings.model,
    apiKey,
    signal: AbortSignal.timeout(180000),
    ...payload,
  });
}

function registerIpc() {
  ipcMain.handle('sessions:list', () => store.listSessions());
  ipcMain.handle('sessions:get', (_event, id) => store.getSession(id));
  ipcMain.handle('sessions:save', (_event, session) => store.saveRendererSession(sanitizeRendererSession(session)));
  ipcMain.handle('sessions:delete', (_event, id) => store.deleteSession(id));

  ipcMain.handle('settings:get', () => store.getPublicSettings());
  ipcMain.handle('settings:save', (_event, payload) => {
    const baseUrl = validateBaseUrl(payload.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    const rerankUrl = payload.rerankUrl ? validateBaseUrl(payload.rerankUrl) : '';
    const next = {
      baseUrl,
      model: String(payload.model || 'qwen3.7-plus').trim(),
      embeddingModel: String(payload.embeddingModel || 'text-embedding-v4').trim(),
      rerankModel: String(payload.rerankModel || 'qwen3-rerank').trim(),
      rerankUrl,
    };
    if (typeof payload.apiKey === 'string' && payload.apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw structuredError(new Error('当前 Windows 环境无法启用 DPAPI 密钥保护。'), 'SECRET_STORAGE_UNAVAILABLE');
      next.encryptedApiKey = safeStorage.encryptString(payload.apiKey.trim()).toString('base64');
    }
    const saved = store.saveSettings(next);
    vectorIndex = loadVectorIndex(next.embeddingModel);
    return saved;
  });
  ipcMain.handle('settings:clear-key', () => store.saveSettings({ encryptedApiKey: '' }));
  ipcMain.handle('settings:test', async () => {
    try {
      const settings = store.getRawSettings();
      const apiKey = getApiKey();
      if (!apiKey || !settings.model) throw new Error('请先填写模型名称并保存 API 密钥。');
      const result = await verifyModelStack(apiKey);
      return { ok: true, message: result.rerankConfigured ? '解卦、向量与重排模型均连接成功。' : '解卦与向量模型连接成功；重排需补充百炼业务空间 API 地址。' };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_CONNECTION_FAILED') }; }
  });

  ipcMain.handle('corpus:list', () => structuredClone(corpus));
  ipcMain.handle('corpus:status', () => ({
    count: corpus.length,
    bookCount: new Set(corpus.map((item) => item.source)).size,
    originalCount: corpus.filter((item) => item.sourceType === 'original').length,
    summaryCount: corpus.filter((item) => item.sourceType === 'summary').length,
    ruleCount: corpus.filter((item) => item.knowledgeKind === 'rule').length,
    caseCount: corpus.filter((item) => item.knowledgeKind === 'case').length,
    doctrineCount: corpus.filter((item) => item.knowledgeKind === 'doctrine').length,
    vectorReady: Boolean(vectorIndex?.vectors),
    vectorModel: vectorIndex?.meta?.model || '',
    ready: corpus.length > 0,
  }));
  ipcMain.handle('corpus:rebuild-vectors', async (event) => {
    if (vectorBuildPromise) return { ok: false, error: structuredError(new Error('向量索引正在构建，请勿重复提交。'), 'VECTOR_INDEX_IN_PROGRESS') };
    let buildTask = null;
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('请先保存阿里云百炼 API 密钥。');
      buildTask = buildVectorIndex({ apiKey, onProgress: (done, total) => event.sender.send('corpus:index-progress', { done, total }) });
      vectorBuildPromise = buildTask;
      const result = await buildTask;
      return { ok: true, result };
    } catch (error) { return { ok: false, error: structuredError(error, 'VECTOR_INDEX_FAILED') }; }
    finally { if (vectorBuildPromise === buildTask) vectorBuildPromise = null; }
  });

  registerReadingIpc({ ipcMain, service: readingService });
}

app.whenReady().then(async () => {
  registerAppProtocol();
  domainRuntime = await import('./generated/domain/index.js');
  evidenceCatalog = await loadEvidenceCatalog({
    resourcesDir: path.dirname(resourcePath('corpus.json')),
    domain: domainRuntime,
  });
  await migrateDataFile(dataPath());
  store = new JsonStore(dataPath(), {
    normalizeValidatedAnalysisReportV2: domainRuntime.normalizeValidatedAnalysisReportV2,
    normalizeValidatedFollowUpV2: domainRuntime.normalizeValidatedFollowUpV2,
    deriveFollowUpContentV2: domainRuntime.deriveFollowUpContentV2,
  });
  corpus = evidenceCatalog.entries;
  corpusHash = evidenceCatalog.corpusRef.hash;
  vectorIndex = loadVectorIndex(store.getRawSettings().embeddingModel);
  readingService = createReadingService({
    store,
    domain: domainRuntime,
    reportV2: domainRuntime,
    evidenceCatalog,
    searchCorpus,
    cloudProviderConfigured,
    analyzeCloudV2: analyzeReadingV2,
    followUpCloudV2: followUpReadingV2,
  });
  if (process.argv.includes('--configure-api-key-env')) {
    try {
      if (!oneTimeSetupKey) throw new Error('未收到 API 密钥');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('当前 Windows 环境无法启用 DPAPI 密钥保护');
      store.saveSettings({ encryptedApiKey: safeStorage.encryptString(oneTimeSetupKey).toString('base64') });
      process.stdout.write('API 密钥已由 Windows DPAPI 加密保存。\n');
      app.quit();
    } catch (error) { process.stderr.write(`${error.message}\n`); app.exit(1); }
    return;
  }
  if (process.argv.includes('--build-vector-index')) {
    const apiKey = getApiKey();
    if (!apiKey) { process.stderr.write('尚未配置 API 密钥。\n'); app.exit(1); return; }
    void buildVectorIndex({ apiKey, onProgress: (done, total) => process.stdout.write(`向量索引 ${done}/${total}\n`) })
      .then(() => { process.stdout.write('向量索引构建完成。\n'); app.quit(); })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  if (process.argv.includes('--verify-model-stack')) {
    const apiKey = getApiKey();
    if (!apiKey) { process.stderr.write('尚未配置 API 密钥。\n'); app.exit(1); return; }
    void verifyModelStack(apiKey)
      .then((result) => { process.stdout.write(`${JSON.stringify(result)}\n`); app.quit(); })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  if (process.argv.includes('--verify-hybrid-retrieval')) {
    void searchCorpus({ query: '近期事业升迁是否有机会', domainTerms: ['事业', '功名', '官鬼', '世爻'], limit: 8 })
      .then((result) => {
        process.stdout.write(`${JSON.stringify({ diagnostics: result.diagnostics, evidence: result.evidence.map((item) => ({ id: item.id, source: item.source, kind: item.knowledgeKind })) })}\n`);
        app.quit();
      })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  if (process.argv.includes('--verify-analysis')) {
    const apiKey = getApiKey();
    if (!apiKey) { process.stderr.write('尚未配置 API 密钥。\n'); app.exit(1); return; }
    const question = '近期事业升迁是否有机会？';
    const builtAt = new Date().toISOString();
    const caseSnapshot = domainRuntime.buildDivinationCase({
      sessionId: 'verify-analysis-v2',
      plateId: 'plate:verify-analysis-v2:v2',
      question,
      category: 'career',
      explicitIntentId: 'career.rank-or-office',
      castAt: '2026-07-12T00:00:00.000Z',
      builtAt,
      tossValues: [9, 7, 8, 7, 8, 7],
      ruleContext: domainRuntime.DEFAULT_RULE_CONTEXT,
    }, {
      sha256: (value) => crypto.createHash('sha256').update(value).digest('hex'),
    });
    const contract = domainRuntime.createFactContractV2(caseSnapshot);
    const retrievalContext = domainRuntime.createAnalysisRetrievalContextV2(contract.modelContract);
    void searchCorpus({
      query: question,
      domainTerms: [...retrievalContext.queryTerms],
      ruleIds: [...retrievalContext.ruleIds],
      limit: 8,
    })
      .then(async (found) => {
        const hydrated = evidenceCatalog.hydrate(found.candidateRefs, 8);
        const provided = await analyzeReadingV2({
          modelContract: contract.modelContract,
          canonicalEvidence: hydrated.evidence,
          responseSchema: domainRuntime.REPORT_V2_SCHEMA,
        });
        return domainRuntime.validateAnalysisReportV2(
          provided.raw,
          contract,
          hydrated.evidence,
          new Date().toISOString(),
        );
      })
      .then((report) => {
        process.stdout.write(`${JSON.stringify({
          schemaVersion: report.schemaVersion,
          caseHash: report.caseHash,
          claims: report.claims.length,
          validatedAt: report.validation.validatedAt,
        })}\n`);
        app.quit();
      })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : '应用启动失败'}\n`);
  app.exit(1);
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
