const { contextBridge, ipcRenderer } = require('electron');

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

function sanitizeToss(value, confirmed) {
  return pickOwn(value, [
    'id',
    'lineIndex',
    'visualSeed',
    ...(confirmed ? ['confirmedAt'] : []),
    'faces',
    'value',
    'label',
    'moving',
    'baseYang',
    'changedYang',
  ]);
}

function sanitizeRendererSession(value) {
  const session = pickOwn(value, [
    'id',
    'question',
    'category',
    'castingMethod',
    'castAt',
    'updatedAt',
    'status',
    'plate',
    'analysis',
    'messages',
  ]);
  if (Array.isArray(value?.tosses)) {
    session.tosses = value.tosses.map((toss) => sanitizeToss(toss, true));
  }
  if (isRecord(value?.currentToss)) {
    session.currentToss = sanitizeToss(value.currentToss, false);
  }
  return session;
}

contextBridge.exposeInMainWorld('wenyao', {
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
  aiConfig: {
    getCatalog: () => ipcRenderer.invoke('ai-config:get-catalog'),
    getStatus: () => ipcRenderer.invoke('ai-config:get-status'),
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
    list: () => ipcRenderer.invoke('corpus:list'),
    status: () => ipcRenderer.invoke('corpus:status'),
    rebuildVectors: () => ipcRenderer.invoke('corpus:rebuild-vectors'),
  },
  retrieval: {
    search: (payload) => ipcRenderer.invoke('retrieval:search', payload),
  },
  ai: {
    analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload),
    followUp: (payload) => ipcRenderer.invoke('ai:follow-up', payload),
  },
  platform: process.platform,
});
