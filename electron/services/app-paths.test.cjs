const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  applicationBundleRoot,
  assertWritableDirectory,
  configureApplicationPaths,
} = require('./app-paths.cjs');

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-app-paths-'));
}

function removeTempDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test('packaged Windows keeps the installation data contract', () => {
  const root = tempDirectory();
  try {
    const installPath = path.join(root, 'selected-install');
    const targetPath = path.join(installPath, 'data');
    const changedPaths = new Map();
    const electronApp = {
      isPackaged: true,
      getPath() { assert.fail('Windows packaged startup must not inspect default userData'); },
      setPath(name, value) { changedPaths.set(name, value); },
    };

    assert.deepEqual(configureApplicationPaths(electronApp, {
      executablePath: path.join(installPath, '问爻.exe'),
      platform: 'win32',
    }), { userData: targetPath, sessionData: targetPath });
    assert.equal(changedPaths.get('userData'), targetPath);
    assert.equal(changedPaths.get('sessionData'), targetPath);
    assert.deepEqual(fs.readdirSync(targetPath), []);
  } finally {
    removeTempDirectory(root);
  }
});

test('packaged macOS keeps durable data and caches outside the application bundle', () => {
  const root = tempDirectory();
  try {
    const userData = path.join(root, 'Library', 'Application Support', '问爻');
    const home = path.join(root, 'user');
    const cache = path.join(home, 'Library', 'Caches');
    const sessionData = path.join(cache, '问爻', 'Session');
    const changedPaths = new Map();
    const electronApp = {
      isPackaged: true,
      getName: () => '问爻',
      getPath(name) {
        if (name === 'userData') return userData;
        if (name === 'home') return home;
        assert.fail(`Unexpected Electron path: ${name}`);
      },
      setPath(name, value) { changedPaths.set(name, value); },
    };

    assert.deepEqual(configureApplicationPaths(electronApp, {
      executablePath: path.join(root, 'Applications', '问爻.app', 'Contents', 'MacOS', '问爻'),
      platform: 'darwin',
    }), { userData, sessionData });
    assert.equal(changedPaths.get('userData'), userData);
    assert.equal(changedPaths.get('sessionData'), sessionData);
    assert.equal(fs.statSync(userData).isDirectory(), true);
    assert.equal(fs.statSync(sessionData).isDirectory(), true);
  } finally {
    removeTempDirectory(root);
  }
});

test('packaged macOS rejects data paths inside the signed app bundle', () => {
  const root = tempDirectory();
  const executablePath = path.join(root, '问爻.app', 'Contents', 'MacOS', '问爻');
  const dataPath = path.join(root, '问爻.app', 'Contents', 'MacOS', 'data');
  try {
    assert.equal(applicationBundleRoot(executablePath), path.join(root, '问爻.app'));
    const electronApp = {
      isPackaged: true,
      getName: () => '问爻',
      getPath(name) {
        if (name === 'userData') return dataPath;
        if (name === 'home') return root;
        assert.fail(`Unexpected Electron path: ${name}`);
      },
      setPath() {},
    };
    assert.throws(
      () => configureApplicationPaths(electronApp, { executablePath, platform: 'darwin' }),
      /不能位于应用包内部/,
    );
    assert.equal(fs.existsSync(dataPath), false);
  } finally {
    removeTempDirectory(root);
  }
});

test('unwritable data directory fails with an actionable platform-neutral error', () => {
  const originalMkdirSync = fs.mkdirSync;
  const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
  fs.mkdirSync = () => { throw denied; };
  try {
    assert.throws(
      () => assertWritableDirectory('D:\\protected-data', '用户数据目录'),
      (error) => error.message.includes('用户数据目录不可写')
        && error.message.includes(path.resolve('D:\\protected-data'))
        && error.cause === denied,
    );
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }
});

test('development preserves Electron default paths without writing to the repository', () => {
  const root = tempDirectory();
  try {
    const userData = path.join(root, 'development-user-data');
    const sessionData = path.join(root, 'development-session-data');
    const changedPaths = [];
    const electronApp = {
      isPackaged: false,
      getPath(name) { return name === 'userData' ? userData : sessionData; },
      setPath: (...args) => changedPaths.push(args),
    };
    assert.deepEqual(configureApplicationPaths(electronApp), { userData, sessionData });
    assert.equal(fs.existsSync(userData), false);
    assert.equal(fs.existsSync(sessionData), false);
    assert.deepEqual(changedPaths, []);
  } finally {
    removeTempDirectory(root);
  }
});
