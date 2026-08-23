const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { sanitizeRendererSession } = require('./services/ipc-payload.cjs');
const { runtimeProfileFromArguments } = require('./services/runtime-profile.cjs');

const runtime = runtimeProfileFromArguments(process.argv, {
  platform: process.platform,
  arch: process.arch,
  isPackaged: false,
});

const UPDATE_STATUSES = new Set([
  'idle',
  'checking',
  'available',
  'downloading',
  'downloaded',
  'upToDate',
  'error',
  'unsupported',
]);

function safeText(value, fallback = '', maxLength = 200) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function sanitizeUpdateState(value) {
  if (!value || typeof value !== 'object' || !UPDATE_STATUSES.has(value.status)) {
    return { status: 'unsupported', currentVersion: '' };
  }

  const output = {
    status: value.status,
    currentVersion: safeText(value.currentVersion, '', 64),
  };
  if (['available', 'downloading', 'downloaded', 'error'].includes(value.status)) {
    const availableVersion = safeText(value.availableVersion, '', 64);
    if (availableVersion) output.availableVersion = availableVersion;
  }
  if (value.status === 'checking') output.manual = Boolean(value.manual);
  if (value.status === 'downloading') {
    const progress = Number(value.progress);
    output.progress = Number.isFinite(progress)
      ? Math.min(100, Math.max(0, Math.round(progress * 10) / 10))
      : 0;
  }
  if (value.status === 'error') {
    output.operation = value.operation === 'download' ? 'download' : 'check';
    output.manual = Boolean(value.manual);
    output.message = output.operation === 'download'
      ? '更新包下载失败，请检查网络连接后重试。'
      : '暂时无法检查更新，请检查网络连接后重试。';
  }
  return output;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickOwn(input, fields) {
  const output = {};
  if (!isRecord(input)) return output;
  for (const field of fields) {
    if (Object.hasOwn(input, field)) output[field] = structuredClone(input[field]);
  }
  return output;
}

function importMetadata(value) {
  return pickOwn(value, ['draftId', 'title', 'author', 'edition']);
}

function droppedFilePaths(files) {
  if (!files || typeof files[Symbol.iterator] !== 'function') return [];
  // Keep one item beyond the accepted limit so the main process can reject
  // an oversized batch instead of silently dropping the remaining files.
  return Array.from(files).slice(0, 21).map((file) => {
    try { return webUtils.getPathForFile(file); }
    catch { return ''; }
  }).filter(Boolean);
}

contextBridge.exposeInMainWorld('wenyao', {
  runtime,
  application: {
    onOpenSettings: (listener) => {
      if (typeof listener !== 'function') return () => {};
      const subscription = () => listener();
      ipcRenderer.on('application:open-settings', subscription);
      return () => ipcRenderer.removeListener('application:open-settings', subscription);
    },
  },
  externalLinks: {
    open: (id) => ipcRenderer.invoke('external-links:open', safeText(id, '', 32)).then(Boolean),
  },
  updates: {
    getState: () => ipcRenderer.invoke('updates:get-state').then(sanitizeUpdateState),
    check: () => ipcRenderer.invoke('updates:check').then(sanitizeUpdateState),
    download: () => ipcRenderer.invoke('updates:download').then(sanitizeUpdateState),
    install: () => ipcRenderer.invoke('updates:install').then(sanitizeUpdateState),
    onState: (listener) => {
      if (typeof listener !== 'function') return () => {};
      const subscription = (_event, state) => listener(sanitizeUpdateState(state));
      ipcRenderer.on('updates:state', subscription);
      return () => ipcRenderer.removeListener('updates:state', subscription);
    },
  },
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    get: (id) => ipcRenderer.invoke('sessions:get', id),
    save: (session) => ipcRenderer.invoke('sessions:save', sanitizeRendererSession(session)),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
  },
  feedback: {
    getState: () => ipcRenderer.invoke('feedback:get-state'),
    submit: (payload) => ipcRenderer.invoke('feedback:submit', structuredClone(payload)),
    setConsent: (enabled) => ipcRenderer.invoke('feedback:set-consent', Boolean(enabled)),
    retry: (feedbackId) => ipcRenderer.invoke('feedback:retry', safeText(feedbackId, '', 100)),
    cancel: (feedbackId) => ipcRenderer.invoke('feedback:cancel', safeText(feedbackId, '', 100)),
    delete: (feedbackId) => ipcRenderer.invoke('feedback:delete', safeText(feedbackId, '', 100)),
  },
  aiConfig: {
    getCatalog: () => ipcRenderer.invoke('ai-config:get-catalog'),
    getStatus: () => ipcRenderer.invoke('ai-config:get-status'),
    discoverModels: (payload) => ipcRenderer.invoke('ai-config:discover-models', pickOwn(payload, ['baseUrl', 'apiKey'])),
    saveDraft: (payload) => ipcRenderer.invoke('ai-config:save-draft', pickOwn(payload, [
      'presetId',
      'fields',
      'connection',
      'pipeline',
      'apiKey',
      'consentAccepted',
    ])),
    testDraft: () => ipcRenderer.invoke('ai-config:test-draft'),
    buildAndActivate: () => ipcRenderer.invoke('ai-config:build-and-activate'),
    pauseBuild: () => ipcRenderer.invoke('ai-config:pause-build'),
    resumeBuild: () => ipcRenderer.invoke('ai-config:resume-build'),
    cancelBuild: () => ipcRenderer.invoke('ai-config:cancel-build'),
    removeConnection: (id) => ipcRenderer.invoke('ai-config:remove-connection', safeText(id, '', 100)),
    openExternal: (url) => ipcRenderer.invoke('ai-config:open-external', safeText(url, '', 500)),
    onStatus: (listener) => {
      if (typeof listener !== 'function') return () => {};
      const subscription = (_event, status) => listener(structuredClone(status));
      ipcRenderer.on('ai-config:status', subscription);
      return () => ipcRenderer.removeListener('ai-config:status', subscription);
    },
  },
  corpus: {
    status: () => ipcRenderer.invoke('corpus:status'),
    books: (payload = {}) => ipcRenderer.invoke('corpus:books', pickOwn(payload, ['includeDeleted', 'query', 'offset', 'limit'])),
    book: (id) => ipcRenderer.invoke('corpus:book', safeText(id, '', 100)),
    bookEntries: (payload) => ipcRenderer.invoke('corpus:book-entries', pickOwn(payload, ['bookId', 'query', 'offset', 'limit'])),
    selectImportFiles: () => ipcRenderer.invoke('corpus:select-import-files'),
    previewDroppedFiles: (files) => ipcRenderer.invoke('corpus:preview-import-files', droppedFilePaths(files)),
    commitImport: (payload) => ipcRenderer.invoke('corpus:commit-import', {
      batchId: safeText(payload?.batchId, '', 100),
      sendForIndex: Boolean(payload?.sendForIndex),
      books: Array.isArray(payload?.books) ? payload.books.slice(0, 20).map(importMetadata) : [],
    }),
    setEnabled: (id, enabled, requestIndex = false) => ipcRenderer.invoke('corpus:set-enabled', { id: safeText(id, '', 100), enabled: Boolean(enabled), requestIndex: Boolean(requestIndex) }),
    updateMetadata: (payload) => ipcRenderer.invoke('corpus:update-metadata', pickOwn(payload, ['id', 'title', 'author', 'edition'])),
    trash: (id) => ipcRenderer.invoke('corpus:trash', safeText(id, '', 100)),
    restore: (id) => ipcRenderer.invoke('corpus:restore', safeText(id, '', 100)),
    purge: (id) => ipcRenderer.invoke('corpus:purge', safeText(id, '', 100)),
    pauseIndex: () => ipcRenderer.invoke('corpus:pause-index'),
    resumeIndex: () => ipcRenderer.invoke('corpus:resume-index'),
    cancelIndex: () => ipcRenderer.invoke('corpus:cancel-index'),
    rebuildVectors: () => ipcRenderer.invoke('corpus:rebuild-vectors'),
    onState: (listener) => {
      if (typeof listener !== 'function') return () => {};
      const subscription = (_event, state) => listener(structuredClone(state));
      ipcRenderer.on('corpus:state', subscription);
      return () => ipcRenderer.removeListener('corpus:state', subscription);
    },
  },
  retrieval: {
    search: (payload) => ipcRenderer.invoke('retrieval:search', payload),
  },
  ai: {
    analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload),
    followUp: (payload) => ipcRenderer.invoke('ai:follow-up', payload),
  },
});
