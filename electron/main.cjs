const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { JsonStore } = require('./services/store.cjs');
const { analyzeCloud, createLocalReport, followUpCloud } = require('./services/ai.cjs');
const { createAlibabaClient } = require('./services/alibaba.cjs');
const { createDeepSeekClient } = require('./services/deepseek.cjs');
const { LocalVectorIndex } = require('./services/vector-index.cjs');
const { hybridSearch } = require('./services/retrieval.cjs');
const alibabaConfig = require('../config/alibaba.json');
const deepseekConfig = require('../config/deepseek.json');

const oneTimeSetupKeys = process.argv.includes('--configure-api-keys-env') ? {
  alibaba: String(process.env.WENYAO_ALIBABA_KEY || ''),
  deepseek: String(process.env.WENYAO_DEEPSEEK_KEY || ''),
} : null;
delete process.env.WENYAO_ALIBABA_KEY;
delete process.env.WENYAO_DEEPSEEK_KEY;

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
  const client = createAlibabaClient({ apiKey, baseUrl: validateBaseUrl(settings.alibabaBaseUrl) });
  const vectors = [];
  for (let offset = 0; offset < corpus.length; offset += 10) {
    const batch = corpus.slice(offset, offset + 10).map((entry) => `${entry.title}\n${entry.text}`);
    vectors.push(...await client.embed(batch, { model: settings.embeddingModel, dimensions: settings.embeddingDimensions, signal: AbortSignal.timeout(60000) }));
    onProgress(Math.min(corpus.length, offset + batch.length), corpus.length);
  }
  const base = app.isPackaged ? path.join(app.getPath('userData'), 'corpus-vectors') : path.join(app.getAppPath(), 'resources', 'corpus-vectors');
  const index = new LocalVectorIndex(base);
  index.write({ model: settings.embeddingModel, corpusHash, ids: corpus.map((entry) => entry.id), vectors });
  vectorIndex = index;
  return { count: corpus.length, model: settings.embeddingModel, dimensions: vectors[0]?.length || settings.embeddingDimensions };
}

function createWindow() {
  const packagedEntryPath = path.join(app.getAppPath(), 'dist', 'index.html');
  const trustedEntryUrl = app.isPackaged ? pathToFileURL(packagedEntryPath).href : 'http://127.0.0.1:5173/';
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url).catch((error) => console.error('无法打开外部链接', error));
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const trusted = new URL(trustedEntryUrl);
      if (target.origin === trusted.origin && target.pathname === trusted.pathname) return;
    } catch {
      // Invalid or non-standard URLs must never replace the application document.
    }
    event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (app.isPackaged) mainWindow.loadFile(packagedEntryPath);
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

function getApiKey(provider) {
  const settings = store.getRawSettings();
  const encrypted = provider === 'alibaba' ? settings.encryptedAlibabaApiKey : settings.encryptedDeepSeekApiKey;
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

async function verifyModelStack() {
  const settings = store.getRawSettings();
  const alibabaApiKey = getApiKey('alibaba');
  const deepseekApiKey = getApiKey('deepseek');
  if (!alibabaApiKey) throw new Error('尚未配置阿里云 API 密钥。');
  if (!deepseekApiKey) throw new Error('尚未配置 DeepSeek API 密钥。');

  const alibaba = createAlibabaClient({ apiKey: alibabaApiKey, baseUrl: validateBaseUrl(settings.alibabaBaseUrl), rerankUrl: settings.rerankUrl });
  const deepseek = createDeepSeekClient({ apiKey: deepseekApiKey, baseUrl: validateBaseUrl(settings.deepseekBaseUrl) });
  const [vector] = await alibaba.embed(['六爻模型连接测试'], { model: settings.embeddingModel, dimensions: settings.embeddingDimensions, signal: AbortSignal.timeout(30000) });
  await alibaba.chat({ model: settings.alibabaModel, messages: [{ role: 'user', content: '只回复：连接成功' }], signal: AbortSignal.timeout(60000) });
  const deepseekResponse = await deepseek.chat({ model: settings.deepseekModel, messages: [{ role: 'system', content: '只输出合法 JSON。' }, { role: 'user', content: '输出 {"ok":true}' }], thinkingType: 'disabled', signal: AbortSignal.timeout(60000) });
  JSON.parse(deepseekResponse.content);
  let rerankReady = false;
  if (settings.rerankUrl) {
    const ranked = await alibaba.rerank('事业', ['官鬼为事业用神', '妻财为求财用神'], { model: settings.rerankModel, topN: 1, signal: AbortSignal.timeout(30000) });
    rerankReady = ranked.length > 0;
  }
  return { alibabaChatReady: true, deepseekChatReady: true, embeddingReady: vector.length === settings.embeddingDimensions, rerankReady, rerankConfigured: Boolean(settings.rerankUrl) };
}

async function searchCorpus(payload) {
  const settings = store.getRawSettings();
  const apiKey = getApiKey('alibaba');
  const client = apiKey ? createAlibabaClient({ apiKey, baseUrl: validateBaseUrl(settings.alibabaBaseUrl), rerankUrl: settings.rerankUrl }) : null;
  return hybridSearch({
    corpus,
    query: String(payload.query || ''),
    domainTerms: Array.isArray(payload.domainTerms) ? payload.domainTerms : [],
    limit: Math.min(12, Math.max(1, Number(payload.limit) || 8)),
    vectorSearch: client && vectorIndex?.vectors ? async (query) => vectorIndex.search((await client.embed([query], { model: settings.embeddingModel, dimensions: settings.embeddingDimensions, signal: AbortSignal.timeout(30000) }))[0], 40) : undefined,
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
    const next = {
      alibabaBaseUrl: validateBaseUrl(payload.alibabaBaseUrl || alibabaConfig.baseUrl),
      alibabaModel: String(payload.alibabaModel || alibabaConfig.model).trim(),
      embeddingModel: String(payload.embeddingModel || alibabaConfig.embeddingModel).trim(),
      embeddingDimensions: Number(payload.embeddingDimensions) || alibabaConfig.embeddingDimensions,
      rerankModel: String(payload.rerankModel || alibabaConfig.rerankModel).trim(),
      rerankUrl: payload.rerankUrl ? validateBaseUrl(payload.rerankUrl) : '',
      deepseekBaseUrl: validateBaseUrl(payload.deepseekBaseUrl || deepseekConfig.baseUrl),
      deepseekModel: String(payload.deepseekModel || deepseekConfig.model).trim(),
    };
    if (typeof payload.alibabaApiKey === 'string' && payload.alibabaApiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw structuredError(new Error('当前 Windows 环境无法启用 DPAPI 密钥保护。'), 'SECRET_STORAGE_UNAVAILABLE');
      next.encryptedAlibabaApiKey = safeStorage.encryptString(payload.alibabaApiKey.trim()).toString('base64');
    }
    if (typeof payload.deepseekApiKey === 'string' && payload.deepseekApiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw structuredError(new Error('当前 Windows 环境无法启用 DPAPI 密钥保护。'), 'SECRET_STORAGE_UNAVAILABLE');
      next.encryptedDeepSeekApiKey = safeStorage.encryptString(payload.deepseekApiKey.trim()).toString('base64');
    }
    const saved = store.saveSettings(next);
    vectorIndex = loadVectorIndex(next.embeddingModel);
    return saved;
  });
  ipcMain.handle('settings:clear-key', () => store.saveSettings({ encryptedAlibabaApiKey: '', encryptedDeepSeekApiKey: '' }));
  ipcMain.handle('settings:test', async () => {
    try {
      const result = await verifyModelStack();
      const rerankMessage = result.rerankConfigured ? '，重排也已连接' : '；未配置阿里云业务空间重排地址，当前使用融合排序';
      return { ok: true, message: `阿里云千问向量与聊天、DeepSeek 解读均连接成功${rerankMessage}。` };
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
      const apiKey = getApiKey('alibaba');
      if (!apiKey) throw new Error('请先保存阿里云 API 密钥。');
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
      const apiKey = getApiKey('deepseek');
      if (!apiKey || !settings.deepseekModel) return { ok: true, report: createLocalReport({ ...payload, evidence }) };
      const report = await analyzeCloud({ ...payload, evidence, baseUrl: validateBaseUrl(settings.deepseekBaseUrl), model: settings.deepseekModel, apiKey, provider: 'deepseek', signal: AbortSignal.timeout(180000) });
      return { ok: true, report };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_ANALYSIS_FAILED') }; }
  });

  ipcMain.handle('ai:follow-up', async (_event, payload) => {
    const allowed = new Set(corpus.map((item) => item.id));
    const evidence = (payload.evidence || []).filter((item) => allowed.has(item.id));
    try {
      const settings = store.getRawSettings();
      const apiKey = getApiKey('deepseek');
      if (!apiKey || !settings.deepseekModel) {
        return { ok: true, answer: { content: '当前未配置云端 AI。排盘和历史已安全保存；配置模型后可继续围绕同一卦象追问。' } };
      }
      const answer = await followUpCloud({ ...payload, evidence, baseUrl: validateBaseUrl(settings.deepseekBaseUrl), model: settings.deepseekModel, apiKey, provider: 'deepseek', signal: AbortSignal.timeout(180000) });
      return { ok: true, answer };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_FOLLOW_UP_FAILED') }; }
  });
}

app.whenReady().then(() => {
  store = new JsonStore(dataPath());
  corpus = loadCorpus();
  corpusHash = hashCorpus(corpus);
  vectorIndex = loadVectorIndex(store.getRawSettings().embeddingModel);
  if (process.argv.includes('--configure-api-keys-env')) {
    try {
      if (!oneTimeSetupKeys || (!oneTimeSetupKeys.alibaba && !oneTimeSetupKeys.deepseek)) throw new Error('未收到 API 密钥');
      if (!safeStorage.isEncryptionAvailable()) throw new Error('当前 Windows 环境无法启用 DPAPI 密钥保护');
      const settings = {
        alibabaBaseUrl: alibabaConfig.baseUrl,
        alibabaModel: alibabaConfig.model,
        embeddingModel: alibabaConfig.embeddingModel,
        embeddingDimensions: alibabaConfig.embeddingDimensions,
        rerankModel: alibabaConfig.rerankModel,
        rerankUrl: alibabaConfig.rerankUrl,
        deepseekBaseUrl: deepseekConfig.baseUrl,
        deepseekModel: deepseekConfig.model,
      };
      const configuredProviders = [];
      if (oneTimeSetupKeys.alibaba) {
        settings.encryptedAlibabaApiKey = safeStorage.encryptString(oneTimeSetupKeys.alibaba).toString('base64');
        configuredProviders.push('阿里云');
      }
      if (oneTimeSetupKeys.deepseek) {
        settings.encryptedDeepSeekApiKey = safeStorage.encryptString(oneTimeSetupKeys.deepseek).toString('base64');
        configuredProviders.push('DeepSeek');
      }
      store.saveSettings(settings);
      process.stdout.write(`${configuredProviders.join('、')} API 密钥已由 Windows DPAPI 加密保存。\n`);
      app.quit();
    } catch (error) { process.stderr.write(`${error.message}\n`); app.exit(1); }
    return;
  }
  if (process.argv.includes('--build-vector-index')) {
    const apiKey = getApiKey('alibaba');
    if (!apiKey) { process.stderr.write('尚未配置阿里云 API 密钥。\n'); app.exit(1); return; }
    void buildVectorIndex({ apiKey, onProgress: (done, total) => process.stdout.write(`向量索引 ${done}/${total}\n`) })
      .then(() => { process.stdout.write('向量索引构建完成。\n'); app.quit(); })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  if (process.argv.includes('--verify-model-stack')) {
    void verifyModelStack()
      .then((result) => { process.stdout.write(`${JSON.stringify(result)}\n`); if (result.alibabaChatReady && result.deepseekChatReady && result.embeddingReady) app.quit(); else app.exit(1); })
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
    const apiKey = getApiKey('deepseek');
    const settings = store.getRawSettings();
    const plate = {
      baseHexagram: { name: '泽雷随', shortName: '随', palace: '震', palaceElement: '木', shiLine: 3, yingLine: 6 },
      changedHexagram: { name: '泽雷随', shortName: '随', palace: '震', palaceElement: '木', shiLine: 3, yingLine: 6 },
      movingLines: [], monthGanZhi: '乙未', monthBranch: '未', dayGanZhi: '戊子', voidBranches: ['午', '未'],
      lines: [
        { index: 1, ganZhi: '庚子', branch: '子', element: '水', relation: '父母', role: null, moving: false, void: false, monthBreak: false, dayClash: false },
        { index: 2, ganZhi: '庚寅', branch: '寅', element: '木', relation: '兄弟', role: null, moving: false, void: false, monthBreak: false, dayClash: false },
        { index: 3, ganZhi: '庚辰', branch: '辰', element: '土', relation: '妻财', role: '世', moving: false, void: false, monthBreak: false, dayClash: false },
        { index: 4, ganZhi: '丁亥', branch: '亥', element: '水', relation: '父母', role: null, moving: false, void: false, monthBreak: false, dayClash: false },
        { index: 5, ganZhi: '丁酉', branch: '酉', element: '金', relation: '官鬼', role: null, moving: false, void: false, monthBreak: false, dayClash: false },
        { index: 6, ganZhi: '丁未', branch: '未', element: '土', relation: '妻财', role: '应', moving: false, void: true, monthBreak: false, dayClash: false },
      ],
      fuShen: [{ lineIndex: 4, relation: '子孙', ganZhi: '庚午', branch: '午', element: '火', flyRelation: '父母', flyGanZhi: '丁亥', flyElement: '水', flyEffect: '飞克伏', status: '受制倾向', void: true, monthBreak: false, dayClash: true }],
    };
    void searchCorpus({ query: '学业会好吗', domainTerms: ['学业', '父母', '官鬼', '用神两现'], limit: 8 })
      .then(async ({ evidence, diagnostics }) => {
        const report = await analyzeCloud({ baseUrl: validateBaseUrl(settings.deepseekBaseUrl), model: settings.deepseekModel, apiKey, provider: 'deepseek', question: '学业会好吗？', category: 'study', plate, evidence, retrievalDiagnostics: diagnostics, signal: AbortSignal.timeout(180000) });
        const answer = await followUpCloud({
          baseUrl: validateBaseUrl(settings.deepseekBaseUrl),
          model: settings.deepseekModel,
          apiKey,
          provider: 'deepseek',
          question: '应期能否判断？',
          session: { question: '学业会好吗？', category: 'study', plate, analysis: report, messages: [] },
          evidence,
          signal: AbortSignal.timeout(180000),
        });
        return { report, answer };
      })
      .then(({ report, answer }) => {
        const basisCount = (report.markdown.match(/\*\*依据：\*\*/g) || []).length;
        const followUpBasisCount = (answer.content.match(/\*\*依据：\*\*/g) || []).length;
        const result = {
          mode: report.mode,
          markdownLength: report.markdown.length,
          hasMarkdownHeading: /^#{1,6}\s+/m.test(report.markdown),
          basisCount,
          hasJsonEnvelope: /^\s*\{/.test(report.markdown),
          followUpMarkdownLength: answer.content.length,
          followUpBasisCount,
          followUpHasJsonEnvelope: /^\s*\{/.test(answer.content),
          pipeline: report.pipeline,
        };
        process.stdout.write(`${JSON.stringify(result)}\n`);
        if (result.markdownLength > 0
          && basisCount > 0
          && !result.hasJsonEnvelope
          && result.followUpMarkdownLength > 0
          && followUpBasisCount > 0
          && !result.followUpHasJsonEnvelope) app.quit(); else app.exit(1);
      })
      .catch((error) => { process.stderr.write(`${error.message}\n`); app.exit(1); });
    return;
  }
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
