const { app, BrowserWindow, dialog, ipcMain, Menu, safeStorage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { AIRuntime } = require('./services/ai-runtime.cjs');
const { CAPABILITIES } = require('./services/ai-config.cjs');
const { structuredProviderError } = require('./services/ai-provider.cjs');
const { configureApplicationPaths } = require('./services/app-paths.cjs');
const { CorpusIndexCoordinator } = require('./services/corpus-index.cjs');
const { CorpusLibrary } = require('./services/corpus-library.cjs');
const { sanitizeRendererSession } = require('./services/ipc-payload.cjs');
const { prepareApplicationStartup } = require('./services/app-startup.cjs');
const { JsonStore } = require('./services/store.cjs');
const { createUpdateManager } = require('./services/update-manager.cjs');
const { sanitizeUpdateState } = require('./services/update-state.cjs');
const { allowedExternalUrl, openPublicLink } = require('./services/external-links.cjs');
const { installApplicationMenu } = require('./services/application-menu.cjs');
const { createRuntimeProfile, runtimeProfileArgument } = require('./services/runtime-profile.cjs');
const { createSecretStore } = require('./services/secret-store.cjs');
const { createWindowOptions } = require('./services/window-options.cjs');
const { FeedbackService } = require('./services/feedback.cjs');
const feedbackConfig = require('../config/feedback.json');

const runtimeProfile = createRuntimeProfile({
  platform: process.platform,
  arch: process.arch,
  isPackaged: app.isPackaged,
});
const rendererRuntimeArgument = runtimeProfileArgument(runtimeProfile);

const oneTimeSiliconFlowKey = process.argv.includes('--configure-api-keys-env')
  ? String(process.env.WENYAO_SILICONFLOW_KEY || '')
  : '';
delete process.env.WENYAO_SILICONFLOW_KEY;
delete process.env.WENYAO_ALIBABA_KEY;
delete process.env.WENYAO_DEEPSEEK_KEY;

let startup = { shouldStart: false, commandMode: false };
try {
  startup = prepareApplicationStartup({
    app,
    argv: process.argv,
    configureDataPaths: configureApplicationPaths,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : '无法初始化本机数据目录。';
  process.stderr.write(`${message}\n`);
  dialog.showErrorBox('问爻无法启动', `${message}\n\n请确认当前用户的数据目录可写，然后重新启动问爻。`);
  app.exit(1);
}

let mainWindow;
let store;
let corpus = [];
let corpusLibrary;
let corpusIndex;
let aiRuntime;
let updateManager;
let secretStore;
let feedbackService;

function resourcePath(name) {
  const candidates = [
    path.join(app.getAppPath(), 'resources', name),
    path.join(process.resourcesPath, 'resources', name),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function dataPath() {
  return path.join(app.getPath('userData'), 'app-data.json');
}

function loadCorpus() {
  try {
    const parsed = JSON.parse(fs.readFileSync(resourcePath('corpus.json'), 'utf8'));
    if (!Array.isArray(parsed)) return [];
    let knowledge = new Map();
    try {
      const index = JSON.parse(fs.readFileSync(resourcePath('knowledge-index.json'), 'utf8'));
      knowledge = new Map((index.units || []).map((unit) => [unit.id, unit]));
    } catch {}
    return parsed.map((entry) => ({
      ...entry,
      knowledgeKind: knowledge.get(entry.id)?.kind || 'doctrine',
      topics: knowledge.get(entry.id)?.topics || entry.tags || [],
    }));
  } catch {
    return [];
  }
}

function loadCorpusManifest() {
  try {
    const parsed = JSON.parse(fs.readFileSync(resourcePath('corpus-manifest.json'), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function hashCorpus(entries) {
  return crypto.createHash('sha256')
    .update(entries.map((entry) => `${entry.id}:${entry.title}:${entry.text}`).join('\n'))
    .digest('hex');
}

function broadcastUpdateState(state) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('updates:state', sanitizeUpdateState(state));
}

function broadcastAIStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('ai-config:status', status);
}

function broadcastCorpusState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed() || !aiRuntime) return;
  mainWindow.webContents.send('corpus:state', aiRuntime.getCorpusStatus());
}

function corpusFailure(error, fallbackCode = 'CORPUS_ACTION_FAILED') {
  return { ok: false, error: {
    code: error?.publicCode || error?.code || fallbackCode,
    message: error instanceof Error ? error.message : '古籍书库操作失败。',
    dataSafe: true,
    nextAction: error?.publicNextAction || error?.nextAction || '本地书库数据未被修改，请检查后重试。',
  } };
}

function createWindow() {
  const packagedEntryPath = path.join(app.getAppPath(), 'dist', 'index.html');
  const trustedEntryUrl = app.isPackaged ? pathToFileURL(packagedEntryPath).href : 'http://127.0.0.1:5173/';
  mainWindow = new BrowserWindow(createWindowOptions({
    platform: process.platform,
    preloadPath: path.join(__dirname, 'preload.cjs'),
    runtimeArgument: rendererRuntimeArgument,
  }));
  if (process.platform !== 'darwin') mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (allowedExternalUrl(url, aiRuntime.getCatalog())) void shell.openExternal(url).catch((error) => console.error('无法打开外部链接', error));
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const trusted = new URL(trustedEntryUrl);
      if (target.origin === trusted.origin && target.pathname === trusted.pathname) return;
    } catch {}
    event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  if (app.isPackaged) mainWindow.loadFile(packagedEntryPath);
  else mainWindow.loadURL('http://127.0.0.1:5173');
}

function openSettingsFromMenu() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  const sendOpenSettings = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
    mainWindow.webContents.send('application:open-settings');
  };
  if (mainWindow.webContents.isLoadingMainFrame()) mainWindow.webContents.once('did-finish-load', sendOpenSettings);
  else sendOpenSettings();
}

function registerIpc() {
  ipcMain.handle('updates:get-state', () => sanitizeUpdateState(updateManager.getState()));
  ipcMain.handle('updates:check', async () => sanitizeUpdateState(await updateManager.check('manual')));
  ipcMain.handle('updates:download', async () => sanitizeUpdateState(await updateManager.download()));
  ipcMain.handle('updates:install', () => sanitizeUpdateState(updateManager.install()));

  ipcMain.handle('sessions:list', () => store.listSessions());
  ipcMain.handle('sessions:get', (_event, id) => store.getSession(id));
  ipcMain.handle('sessions:save', (_event, session) => store.saveSession(sanitizeRendererSession(session)));
  ipcMain.handle('sessions:delete', (_event, id) => store.deleteSession(id));

  ipcMain.handle('feedback:get-state', () => feedbackService.getState());
  ipcMain.handle('feedback:submit', (_event, payload) => feedbackService.submit(payload));
  ipcMain.handle('feedback:set-consent', (_event, enabled) => feedbackService.setConsent(Boolean(enabled)));
  ipcMain.handle('feedback:retry', (_event, feedbackId) => feedbackService.retry(String(feedbackId || '') || undefined));
  ipcMain.handle('feedback:cancel', (_event, feedbackId) => feedbackService.cancel(String(feedbackId || '')));
  ipcMain.handle('feedback:delete', (_event, feedbackId) => feedbackService.delete(String(feedbackId || '')));

  ipcMain.handle('external-links:open', (_event, id) => openPublicLink(id, (url) => shell.openExternal(url)));

  ipcMain.handle('ai-config:get-catalog', () => aiRuntime.getCatalog());
  ipcMain.handle('ai-config:get-status', () => aiRuntime.getStatus());
  ipcMain.handle('ai-config:list-models', async (_event, payload) => {
    try { return { ok: true, ...(await aiRuntime.listModels(payload)) }; }
    catch (error) { return { ok: false, error: structuredProviderError(error, 'AI_MODEL_DISCOVERY_FAILED') }; }
  });
  ipcMain.handle('ai-config:test-capability', async (_event, payload) => {
    try { return await aiRuntime.testCapability(payload); }
    catch (error) { return { ok: false, error: structuredProviderError(error, 'AI_CONNECTION_FAILED'), status: aiRuntime.getStatus() }; }
  });
  ipcMain.handle('ai-config:complete-setup', async (_event, payload) => {
    try { return await aiRuntime.completeSetup(payload); }
    catch (error) { return { ok: false, error: structuredProviderError(error, 'VECTOR_INDEX_FAILED'), status: aiRuntime.getStatus() }; }
  });
  ipcMain.handle('ai-config:cancel-setup', () => aiRuntime.cancelSetup());
  ipcMain.handle('ai-config:pause-build', () => aiRuntime.pauseBuild());
  ipcMain.handle('ai-config:resume-build', () => aiRuntime.resumeBuild());
  ipcMain.handle('ai-config:cancel-build', () => aiRuntime.cancelBuild());
  ipcMain.handle('ai-config:open-external', async (_event, url) => {
    if (!allowedExternalUrl(url, aiRuntime.getCatalog())) return false;
    await shell.openExternal(url);
    return true;
  });

  ipcMain.handle('corpus:status', () => aiRuntime.getCorpusStatus());
  ipcMain.handle('corpus:books', (_event, payload) => corpusLibrary.listBooks(payload));
  ipcMain.handle('corpus:book', (_event, id) => corpusLibrary.getBook(String(id || '')));
  ipcMain.handle('corpus:book-entries', (_event, payload) => corpusLibrary.searchBookEntries(payload));
  ipcMain.handle('corpus:select-import-files', async () => {
    try {
      const selected = await dialog.showOpenDialog(mainWindow, {
        title: '导入古籍',
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: '古籍文本', extensions: ['txt', 'md'] }],
      });
      if (selected.canceled) return { ok: true, canceled: true };
      return { ok: true, batch: corpusLibrary.previewFiles(selected.filePaths) };
    } catch (error) {
      return corpusFailure(error, 'CORPUS_PREVIEW_FAILED');
    }
  });
  ipcMain.handle('corpus:preview-import-files', (_event, filePaths) => {
    try { return { ok: true, batch: corpusLibrary.previewFiles(filePaths) }; }
    catch (error) { return corpusFailure(error, 'CORPUS_PREVIEW_FAILED'); }
  });
  ipcMain.handle('corpus:commit-import', (_event, payload) => {
    try {
      const vectorEnabled = Boolean(aiRuntime.getStatus().activeCapabilities?.embedding);
      const result = corpusLibrary.commitImport({ ...(payload || {}), sendForIndex: Boolean(payload?.sendForIndex && vectorEnabled) });
      const bookIds = result.results.filter((item) => item.ok && item.book.indexRequested).map((item) => item.book.id);
      broadcastCorpusState();
      if (bookIds.length) void aiRuntime.indexBooks(bookIds).then(broadcastCorpusState, broadcastCorpusState);
      return { ok: true, ...result };
    } catch (error) {
      return corpusFailure(error, 'CORPUS_IMPORT_FAILED');
    }
  });
  ipcMain.handle('corpus:set-enabled', (_event, payload) => {
    try {
      const book = corpusLibrary.setEnabled(String(payload?.id || ''), Boolean(payload?.enabled), { requestIndex: Boolean(payload?.requestIndex) });
      broadcastCorpusState();
      if (aiRuntime.getStatus().activeCapabilities?.embedding && book.origin === 'user' && book.enabled && book.indexRequested && book.indexState !== 'ready') {
        void aiRuntime.indexBooks([book.id]).then(broadcastCorpusState, broadcastCorpusState);
      }
      return { ok: true, book };
    } catch (error) { return corpusFailure(error); }
  });
  ipcMain.handle('corpus:update-metadata', (_event, payload) => {
    try {
      const result = corpusLibrary.updateMetadata(String(payload?.id || ''), payload || {});
      broadcastCorpusState();
      if (aiRuntime.getStatus().activeCapabilities?.embedding && result.requiresIndex && result.book.enabled) {
        void aiRuntime.indexBooks([result.book.id]).then(broadcastCorpusState, broadcastCorpusState);
      }
      return { ok: true, ...result };
    } catch (error) { return corpusFailure(error); }
  });
  ipcMain.handle('corpus:trash', (_event, id) => {
    try { const book = corpusLibrary.moveToTrash(String(id || '')); broadcastCorpusState(); return { ok: true, book }; }
    catch (error) { return corpusFailure(error); }
  });
  ipcMain.handle('corpus:restore', (_event, id) => {
    try { const book = corpusLibrary.restore(String(id || '')); broadcastCorpusState(); return { ok: true, book }; }
    catch (error) { return corpusFailure(error); }
  });
  ipcMain.handle('corpus:purge', (_event, id) => {
    try {
      const bookId = String(id || '');
      corpusLibrary.purge(bookId);
      corpusIndex.purgeBook(bookId);
      broadcastCorpusState();
      return { ok: true };
    } catch (error) { return corpusFailure(error); }
  });
  ipcMain.handle('corpus:pause-index', () => aiRuntime.pauseLibraryBuild());
  ipcMain.handle('corpus:resume-index', () => aiRuntime.resumeLibraryBuild());
  ipcMain.handle('corpus:cancel-index', () => aiRuntime.cancelLibraryBuild());
  ipcMain.handle('corpus:rebuild-vectors', () => aiRuntime.rebuildActiveIndex());

  ipcMain.handle('retrieval:search', async (_event, payload) => aiRuntime.search(payload));
  ipcMain.handle('ai:analyze', async (_event, payload) => {
    try {
      const evidence = aiRuntime.filterEvidence(payload.evidence);
      return { ok: true, report: await aiRuntime.analyze({ ...payload, evidence }) };
    }
    catch (error) { return { ok: false, error: structuredProviderError(error, 'AI_ANALYSIS_FAILED') }; }
  });
  ipcMain.handle('ai:follow-up', async (_event, payload) => {
    try {
      const evidence = aiRuntime.filterEvidence(payload.evidence);
      return { ok: true, answer: await aiRuntime.followUp({ ...payload, evidence }) };
    }
    catch (error) { return { ok: false, error: structuredProviderError(error, 'AI_FOLLOW_UP_FAILED') }; }
  });
}

async function runCommandMode() {
  if (process.argv.includes('--verify-platform-runtime')) {
    process.stdout.write(`${JSON.stringify({
      ...runtimeProfile,
      userData: app.getPath('userData'),
      sessionData: app.getPath('sessionData'),
    })}\n`);
    return;
  }
  if (process.argv.includes('--configure-api-keys-env')) {
    if (!oneTimeSiliconFlowKey) throw new Error('未收到 WENYAO_SILICONFLOW_KEY');
    aiRuntime.stagePreset('siliconflow-cn-quality', oneTimeSiliconFlowKey, true);
    process.stdout.write(`SiliconFlow 访问密钥已由${secretStore.name}加密保存为待验证配置。\n`);
    return;
  }
  if (process.argv.includes('--verify-model-stack')) {
    const status = aiRuntime.getStatus();
    if (!status.draft) {
      if (status.status !== 'ready') throw new Error(status.message);
      process.stdout.write(`${JSON.stringify(status)}\n`);
      return;
    }
    const result = await aiRuntime.testDraftCapabilities();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) throw new Error(result.error?.message || '三项能力检测失败');
    return;
  }
  if (process.argv.includes('--build-vector-index')) {
    const status = aiRuntime.getStatus();
    const capabilities = CAPABILITIES.filter((capability) => status.draft?.pipeline?.[capability]);
    const result = await aiRuntime.completeSetup({ capabilities, bulkEmbeddingAccepted: true });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.ok) throw new Error(result.error?.message || '向量索引构建失败');
    return;
  }
  if (process.argv.includes('--verify-hybrid-retrieval')) {
    const result = await aiRuntime.search({ query: '近期事业升迁是否有机会', domainTerms: ['事业', '功名', '官鬼', '世爻'], limit: 8 });
    process.stdout.write(`${JSON.stringify({ diagnostics: result.diagnostics, evidence: result.evidence.map((item) => ({ id: item.id, source: item.source, kind: item.knowledgeKind })) })}\n`);
    return;
  }
  if (process.argv.includes('--verify-analysis')) {
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
    const retrieval = await aiRuntime.search({ query: '学业会好吗', domainTerms: ['学业', '父母', '官鬼', '用神两现'], limit: 8 });
    const report = await aiRuntime.analyze({
      question: '学业会好吗？', category: 'study', plate,
      evidence: retrieval.evidence, retrievalDiagnostics: retrieval.diagnostics,
    });
    const answer = await aiRuntime.followUp({
      question: '应期能否判断？',
      session: { question: '学业会好吗？', category: 'study', plate, analysis: report, messages: [] },
      evidence: retrieval.evidence,
    });
    const result = {
      mode: report.mode,
      markdownLength: report.markdown.length,
      hasMarkdownHeading: /^#{1,6}\s+/m.test(report.markdown),
      basisCount: (report.markdown.match(/\]\(#(?:plate-facts|evidence-[^)]+)\)/g) || []).length,
      hasJsonEnvelope: /^\s*\{/.test(report.markdown),
      followUpMarkdownLength: answer.content.length,
      followUpBasisCount: (answer.content.match(/\]\(#(?:plate-facts|evidence-[^)]+)\)/g) || []).length,
      followUpHasJsonEnvelope: /^\s*\{/.test(answer.content),
      retrieval: retrieval.diagnostics,
      provider: report.provider,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.markdownLength || !result.hasMarkdownHeading || !result.basisCount || result.hasJsonEnvelope
      || !result.followUpMarkdownLength || !result.followUpBasisCount || result.followUpHasJsonEnvelope) {
      throw new Error('真实 AI 解读验收未满足 Markdown 与引用契约');
    }
    return;
  }
}

if (startup.shouldStart) {
  if (!startup.commandMode) {
    app.on('second-instance', () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    });
  }

  app.whenReady().then(async () => {
    store = new JsonStore(dataPath());
    feedbackService = new FeedbackService({ store, endpoint: feedbackConfig.endpoint });
    corpus = loadCorpus();
    const corpusHash = hashCorpus(corpus);
    corpusLibrary = new CorpusLibrary({
      rootPath: path.join(app.getPath('userData'), 'corpus-library'),
      builtInCorpus: corpus,
      builtInManifest: loadCorpusManifest(),
    });
    corpusLibrary.initialize();
    corpusIndex = new CorpusIndexCoordinator({ indexRoot: path.join(app.getPath('userData'), 'vector-indexes') });
    for (const bookId of corpusLibrary.consumePurgedBookIds()) corpusIndex.purgeBook(bookId);
    secretStore = createSecretStore({
      safeStorage,
      provider: runtimeProfile.secureStorage,
    });
    aiRuntime = new AIRuntime({
      store,
      secretStore,
      corpusLibrary,
      corpusIndex,
      corpusHash,
      indexRoot: path.join(app.getPath('userData'), 'vector-indexes'),
      legacyIndexBases: [
        path.join(app.getPath('userData'), 'corpus-vectors'),
        resourcePath('corpus-vectors.f32').replace(/\.f32$/, ''),
      ],
      onStatus: (status) => {
        broadcastAIStatus(status);
        broadcastCorpusState();
      },
    });
    aiRuntime.initialize();

    if (startup.commandMode) {
      try { await runCommandMode(); app.quit(); }
      catch (error) { process.stderr.write(`${error.message}\n`); app.exit(1); }
      return;
    }

    updateManager = createUpdateManager({
      updater: runtimeProfile.updateMode === 'native' ? autoUpdater : null,
      currentVersion: app.getVersion(),
      supported: runtimeProfile.updateMode === 'native',
      broadcast: broadcastUpdateState,
    });
    registerIpc();
    createWindow();
    void feedbackService.retry();
    if (process.platform === 'darwin') {
      installApplicationMenu({
        Menu,
        appName: app.name,
        onOpenSettings: openSettingsFromMenu,
      });
    }
    updateManager.start();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('before-quit', () => updateManager?.stop());
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
