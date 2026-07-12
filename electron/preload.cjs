const { contextBridge, ipcRenderer } = require('electron');
const {
  sanitizeAnalyzePayload,
  sanitizeBuildCasePayload,
  sanitizeFollowUpPayload,
  sanitizeRendererSession,
  sanitizeSelectIntentPayload,
} = require('./services/ipc-payload.cjs');

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
  reading: {
    buildCase: (payload) => ipcRenderer.invoke('reading:build-case', sanitizeBuildCasePayload(payload)),
    selectIntent: (payload) => ipcRenderer.invoke('reading:select-intent', sanitizeSelectIntentPayload(payload)),
    analyze: (payload) => ipcRenderer.invoke('reading:analyze', sanitizeAnalyzePayload(payload)),
    followUp: (payload) => ipcRenderer.invoke('reading:follow-up', sanitizeFollowUpPayload(payload)),
  },
  platform: process.platform,
});
