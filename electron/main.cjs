const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { JsonStore } = require('./services/store.cjs');
const { analyzeCloud, createLocalReport, followUpCloud } = require('./services/ai.cjs');

let mainWindow;
let store;
let corpus = [];

function dataPath() {
  return path.join(app.getPath('userData'), 'app-data.json');
}

function loadCorpus() {
  const candidates = [
    path.join(app.getAppPath(), 'resources', 'corpus.json'),
    path.join(process.resourcesPath, 'resources', 'corpus.json'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(found, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  if (app.isPackaged) mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
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

function registerIpc() {
  ipcMain.handle('sessions:list', () => store.listSessions());
  ipcMain.handle('sessions:get', (_event, id) => store.getSession(id));
  ipcMain.handle('sessions:save', (_event, session) => store.saveSession(session));
  ipcMain.handle('sessions:delete', (_event, id) => store.deleteSession(id));

  ipcMain.handle('settings:get', () => store.getPublicSettings());
  ipcMain.handle('settings:save', (_event, payload) => {
    const baseUrl = validateBaseUrl(payload.baseUrl || 'https://api.openai.com/v1');
    const next = { baseUrl, model: String(payload.model || '').trim() };
    if (typeof payload.apiKey === 'string' && payload.apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) throw structuredError(new Error('当前 Windows 环境无法启用 DPAPI 密钥保护。'), 'SECRET_STORAGE_UNAVAILABLE');
      next.encryptedApiKey = safeStorage.encryptString(payload.apiKey.trim()).toString('base64');
    }
    return store.saveSettings(next);
  });
  ipcMain.handle('settings:clear-key', () => store.saveSettings({ encryptedApiKey: '' }));
  ipcMain.handle('settings:test', async () => {
    try {
      const settings = store.getRawSettings();
      const apiKey = getApiKey();
      if (!apiKey || !settings.model) throw new Error('请先填写模型名称并保存 API 密钥。');
      const response = await fetch(`${validateBaseUrl(settings.baseUrl)}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const error = new Error(response.status === 401 || response.status === 403 ? 'AI 密钥无效或没有访问权限。' : `连接测试失败（${response.status}）`);
        error.status = response.status;
        throw error;
      }
      return { ok: true, message: '连接成功，密钥已由 Windows 加密保存。' };
    } catch (error) { return { ok: false, error: structuredError(error, 'AI_CONNECTION_FAILED') }; }
  });

  ipcMain.handle('corpus:list', () => structuredClone(corpus));
  ipcMain.handle('corpus:status', () => ({
    count: corpus.length,
    bookCount: new Set(corpus.map((item) => item.source)).size,
    originalCount: corpus.filter((item) => item.sourceType === 'original').length,
    summaryCount: corpus.filter((item) => item.sourceType === 'summary').length,
    ready: corpus.length > 0,
  }));

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
  store = new JsonStore(dataPath());
  corpus = loadCorpus();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
