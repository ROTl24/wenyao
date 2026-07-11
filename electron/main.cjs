const { app, BrowserWindow, ipcMain, net, protocol, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JsonStore } = require('./services/store.cjs');
const { analyzeCloud, createLocalReport, followUpCloud } = require('./services/ai.cjs');
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

function loadCorpus() {
  const found = resourcePath('corpus.json');
  if (!found) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(found, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    let knowledge = new Map();
    try {
      const index = JSON.parse(fs.readFileSync(resourcePath('knowledge-index.json'), 'utf8'));
      knowledge = new Map((index.units || []).map((unit) => [unit.id, unit]));
    } catch {}
    return parsed.map((entry) => ({ ...entry, knowledgeKind: knowledge.get(entry.id)?.kind || 'doctrine', topics: knowledge.get(entry.id)?.topics || entry.tags || [] }));
  } catch {
    return [];
  }
}

function hashCorpus(entries) {
  return crypto.createHash('sha256').update(entries.map((entry) => `${entry.id}:${entry.title}:${entry.text}`).join('\n')).digest('hex');
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
    limit: Math.min(12, Math.max(1, Number(payload.limit) || 8)),
    vectorSearch: client && vectorIndex?.vectors ? async (query) => vectorIndex.search((await client.embed([query], { model: settings.embeddingModel, dimensions: 1024, signal: AbortSignal.timeout(30000) }))[0], 40) : undefined,
    rerank: client && settings.rerankUrl ? async (query, documents) => client.rerank(query, documents, { model: settings.rerankModel, topN: 12, signal: AbortSignal.timeout(60000) }) : undefined,
  });
}

function registerIpc() {
  ipcMain.handle('sessions:list', () => store.listSessions());
  ipcMain.handle('sessions:get', (_event, id) => store.getSession(id));
  ipcMain.handle('sessions:save', (_event, session) => store.saveSession(session));
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

  ipcMain.handle('retrieval:search', (_event, payload) => searchCorpus(payload));

  ipcMain.handle('ai:analyze', async (_event, payload) => {
    const allowed = new Set(corpus.map((item) => item.id));
    const evidence = (payload.evidence || []).filter((item) => allowed.has(item.id));
    try {
      const settings = store.getRawSettings();
      const apiKey = getApiKey();
      if (!apiKey || !settings.model) return { ok: true, report: createLocalReport({ ...payload, evidence }) };
      const report = await analyzeCloud({ ...payload, evidence, baseUrl: validateBaseUrl(settings.baseUrl), model: settings.model, apiKey, signal: AbortSignal.timeout(180000) });
      return { ok: true, report };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_ANALYSIS_FAILED') }; }
  });

  ipcMain.handle('ai:follow-up', async (_event, payload) => {
    const allowed = new Set(corpus.map((item) => item.id));
    const evidence = (payload.evidence || []).filter((item) => allowed.has(item.id));
    try {
      const settings = store.getRawSettings();
      const apiKey = getApiKey();
      if (!apiKey || !settings.model) {
        return { ok: true, answer: { content: '当前未配置云端 AI。排盘和历史已安全保存；配置模型后可继续围绕同一卦象追问。', evidenceIds: evidence.slice(0, 2).map((item) => item.id) } };
      }
      const answer = await followUpCloud({ ...payload, evidence, baseUrl: validateBaseUrl(settings.baseUrl), model: settings.model, apiKey, signal: AbortSignal.timeout(180000) });
      return { ok: true, answer };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_FOLLOW_UP_FAILED') }; }
  });
}

app.whenReady().then(() => {
  registerAppProtocol();
  store = new JsonStore(dataPath());
  corpus = loadCorpus();
  corpusHash = hashCorpus(corpus);
  vectorIndex = loadVectorIndex(store.getRawSettings().embeddingModel);
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
    const settings = store.getRawSettings();
    const plate = {
      baseHexagram: { name: '乾为天', shortName: '乾', palace: '乾', palaceElement: '金', shiLine: 6, yingLine: 3 },
      changedHexagram: { name: '天风姤', shortName: '姤', palace: '乾', palaceElement: '金', shiLine: 1, yingLine: 4 },
      movingLines: [1], monthGanZhi: '乙未', monthBranch: '未', dayGanZhi: '丙戌', voidBranches: ['午', '未'],
      lines: [
        { index: 1, ganZhi: '甲子', branch: '子', element: '水', relation: '子孙', role: null, moving: true, changedGanZhi: '辛丑', changedBranch: '丑', changedElement: '土', changedRelation: '父母' },
        { index: 2, ganZhi: '甲寅', branch: '寅', element: '木', relation: '妻财', role: null, moving: false, changedGanZhi: '辛亥', changedBranch: '亥', changedElement: '水', changedRelation: '子孙' },
        { index: 3, ganZhi: '甲辰', branch: '辰', element: '土', relation: '父母', role: '应', moving: false, changedGanZhi: '辛酉', changedBranch: '酉', changedElement: '金', changedRelation: '兄弟' },
        { index: 4, ganZhi: '壬午', branch: '午', element: '火', relation: '官鬼', role: null, moving: false, changedGanZhi: '壬午', changedBranch: '午', changedElement: '火', changedRelation: '官鬼' },
        { index: 5, ganZhi: '壬申', branch: '申', element: '金', relation: '兄弟', role: null, moving: false, changedGanZhi: '壬申', changedBranch: '申', changedElement: '金', changedRelation: '兄弟' },
        { index: 6, ganZhi: '壬戌', branch: '戌', element: '土', relation: '父母', role: '世', moving: false, changedGanZhi: '壬戌', changedBranch: '戌', changedElement: '土', changedRelation: '父母' },
      ],
    };
    void searchCorpus({ query: '近期事业升迁是否有机会', domainTerms: ['事业', '功名', '官鬼', '世爻'], limit: 8 })
      .then(async ({ evidence, diagnostics }) => analyzeCloud({ baseUrl: validateBaseUrl(settings.baseUrl), model: settings.model, apiKey, question: '近期事业升迁是否有机会？', category: 'career', plate, evidence, retrievalDiagnostics: diagnostics, signal: AbortSignal.timeout(180000) }))
      .then((report) => { process.stdout.write(`${JSON.stringify({ mode: report.mode, claims: report.claims.length, pipeline: report.pipeline, summary: report.summary })}\n`); app.quit(); })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
