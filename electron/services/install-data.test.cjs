const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertWritableDirectory,
  configureInstallDataPaths,
} = require('./install-data.cjs');

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-install-data-'));
}

function removeTempDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test('packaged app uses the installation data directory without reading or changing legacy userData', () => {
  const root = tempDirectory();
  try {
    const legacyPath = path.join(root, 'roaming', 'liuyao-divination');
    const installPath = path.join(root, 'selected-install');
    const targetPath = path.join(installPath, 'data');
    const executablePath = path.join(installPath, '问爻.exe');
    fs.mkdirSync(legacyPath, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(legacyPath, 'app-data.json'), 'legacy-data');
    fs.writeFileSync(path.join(targetPath, 'app-data.json'), 'install-data');

    const changedPaths = new Map();
    const electronApp = {
      isPackaged: true,
      getPath() {
        assert.fail('packaged startup must not inspect legacy userData');
      },
      setPath(name, value) {
        changedPaths.set(name, value);
      },
    };

    assert.equal(configureInstallDataPaths(electronApp, executablePath), targetPath);
    assert.equal(changedPaths.get('userData'), targetPath);
    assert.equal(changedPaths.get('sessionData'), targetPath);
    assert.equal(fs.readFileSync(path.join(targetPath, 'app-data.json'), 'utf8'), 'install-data');
    assert.equal(fs.readFileSync(path.join(legacyPath, 'app-data.json'), 'utf8'), 'legacy-data');
    assert.deepEqual(fs.readdirSync(installPath), ['data']);
    assert.deepEqual(fs.readdirSync(targetPath), ['app-data.json']);
  } finally {
    removeTempDirectory(root);
  }
});

test('packaged first startup creates an empty writable data directory', () => {
  const root = tempDirectory();
  try {
    const installPath = path.join(root, 'selected-install');
    const targetPath = path.join(installPath, 'data');
    const changedPaths = new Map();
    const electronApp = {
      isPackaged: true,
      getPath() {
        assert.fail('packaged startup must not inspect Electron default userData');
      },
      setPath(name, value) {
        changedPaths.set(name, value);
      },
    };

    assert.equal(
      configureInstallDataPaths(electronApp, path.join(installPath, '问爻.exe')),
      targetPath,
    );
    assert.equal(fs.statSync(targetPath).isDirectory(), true);
    assert.deepEqual(fs.readdirSync(targetPath), []);
    assert.equal(changedPaths.get('userData'), targetPath);
    assert.equal(changedPaths.get('sessionData'), targetPath);
  } finally {
    removeTempDirectory(root);
  }
});

test('unwritable installation data directory fails with an actionable error', () => {
  const originalMkdirSync = fs.mkdirSync;
  const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  fs.mkdirSync = () => { throw denied; };

  try {
    assert.throws(
      () => assertWritableDirectory('D:\\protected-install\\data'),
      (error) => error.message.includes('安装目录不可写')
        && error.message.includes(path.resolve('D:\\protected-install\\data'))
        && error.cause === denied,
    );
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }
});

test('development keeps Electron default userData and never writes into the repository', () => {
  const root = tempDirectory();
  try {
    const changedPaths = [];
    const defaultUserData = path.join(root, 'development-user-data');
    const electronApp = {
      isPackaged: false,
      getPath(name) {
        assert.equal(name, 'userData');
        return defaultUserData;
      },
      setPath: (...args) => changedPaths.push(args),
    };

    assert.equal(configureInstallDataPaths(electronApp, path.join(root, 'electron.exe')), defaultUserData);
    assert.equal(fs.existsSync(defaultUserData), false);
    assert.deepEqual(changedPaths, []);
  } finally {
    removeTempDirectory(root);
  }
});
