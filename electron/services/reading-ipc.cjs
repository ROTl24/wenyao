const {
  sanitizeAnalyzePayload,
  sanitizeBuildCasePayload,
  sanitizeFollowUpPayload,
  sanitizeSelectIntentPayload,
} = require('./ipc-payload.cjs');

function registerReadingIpc({ ipcMain, service }) {
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new TypeError('ipcMain 无效');
  if (!service) throw new TypeError('ReadingService 无效');
  ipcMain.handle('reading:build-case', (_event, payload) => (
    service.buildCase(sanitizeBuildCasePayload(payload))
  ));
  ipcMain.handle('reading:select-intent', (_event, payload) => (
    service.selectIntent(sanitizeSelectIntentPayload(payload))
  ));
  ipcMain.handle('reading:analyze', (_event, payload) => (
    service.analyze(sanitizeAnalyzePayload(payload))
  ));
  ipcMain.handle('reading:follow-up', (_event, payload) => (
    service.followUp(sanitizeFollowUpPayload(payload))
  ));
}

module.exports = { registerReadingIpc };
