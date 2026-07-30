const { contextBridge, ipcRenderer } = require('electron');

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
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    get: (id) => ipcRenderer.invoke('sessions:get', id),
    save: (session) => ipcRenderer.invoke('sessions:save', sanitizeRendererSession(session)),
    delete: (id) => ipcRenderer.invoke('sessions:delete', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (payload) => ipcRenderer.invoke('settings:save', payload),
    clearKey: () => ipcRenderer.invoke('settings:clear-key'),
    test: () => ipcRenderer.invoke('settings:test'),
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
