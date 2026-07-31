const assert = require('node:assert/strict');
const test = require('node:test');
const { sanitizeUpdateState } = require('./update-state.cjs');

test('update state allowlist drops URLs, tokens, local paths, and release payloads', () => {
  const sanitized = sanitizeUpdateState({
    status: 'downloading',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
    progress: 120.44,
    token: 'secret',
    downloadUrl: 'https://example.invalid/private.exe',
    installerPath: 'C:\\private\\update.exe',
    releaseNotes: '<script>unsafe</script>',
  });

  assert.deepEqual(sanitized, {
    status: 'downloading',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
    progress: 100,
  });
});

test('invalid updater payloads become unsupported states', () => {
  assert.deepEqual(sanitizeUpdateState(null), {
    status: 'unsupported',
    currentVersion: '',
  });
  assert.deepEqual(sanitizeUpdateState({ status: 'forged', currentVersion: '9.9.9' }), {
    status: 'unsupported',
    currentVersion: '',
  });
});

test('error states replace internal messages with fixed public guidance', () => {
  assert.deepEqual(sanitizeUpdateState({
    status: 'error',
    currentVersion: '0.3.0',
    operation: 'check',
    manual: true,
    message: 'GET https://private.example failed at C:\\secret\\path',
  }), {
    status: 'error',
    currentVersion: '0.3.0',
    operation: 'check',
    manual: true,
    message: '暂时无法检查更新，请检查网络连接后重试。',
  });
});
