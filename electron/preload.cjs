const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wenyao', {
  sessions: {
    list: () => ipcRenderer.invoke('sessions:list'),
    get: (id) => ipcRenderer.invoke('sessions:get', id),
    save: (session) => ipcRenderer.invoke('sessions:save', session),
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
  },
  ai: {
    analyze: (payload) => ipcRenderer.invoke('ai:analyze', payload),
    followUp: (payload) => ipcRenderer.invoke('ai:follow-up', payload),
  },
  platform: process.platform,
});
