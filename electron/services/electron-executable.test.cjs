const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { electronExecutableCandidate } = require('../../scripts/electron-executable.cjs');

const projectRoot = path.join('repo', 'wenyao');

test('maintenance scripts resolve Electron for every supported desktop platform', () => {
  assert.equal(
    electronExecutableCandidate(projectRoot, 'win32'),
    path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron.exe'),
  );
  assert.equal(
    electronExecutableCandidate(projectRoot, 'darwin'),
    path.join(projectRoot, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron'),
  );
  assert.equal(
    electronExecutableCandidate(projectRoot, 'linux'),
    path.join(projectRoot, 'node_modules', 'electron', 'dist', 'electron'),
  );
});
