const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  MIGRATION_MARKER_NAME,
  configureInstallDataPaths,
  migrateLegacyUserData,
} = require('./install-data.cjs');

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-install-data-'));
}

function removeTempDirectory(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

test('packaged app moves the complete legacy userData tree into the selected installation directory', () => {
  const root = tempDirectory();
  try {
    const legacyPath = path.join(root, 'roaming', 'liuyao-divination');
    const installPath = path.join(root, 'selected-install');
    const executablePath = path.join(installPath, '问爻.exe');
    fs.mkdirSync(path.join(legacyPath, 'Local Storage'), { recursive: true });
    fs.mkdirSync(installPath, { recursive: true });
    fs.writeFileSync(path.join(legacyPath, 'app-data.json'), JSON.stringify({
      sessions: [{ id: 'history-1' }],
      settings: { encryptedDeepSeekApiKey: 'dpapi-ciphertext' },
    }));
    fs.writeFileSync(path.join(legacyPath, 'corpus-vectors.f32'), Buffer.from([1, 2, 3, 4]));
    fs.writeFileSync(path.join(legacyPath, 'Local Storage', 'state'), 'renderer-state');

    const changedPaths = new Map();
    const electronApp = {
      isPackaged: true,
      getPath(name) {
        assert.equal(name, 'userData');
        return legacyPath;
      },
      setPath(name, value) {
        changedPaths.set(name, value);
      },
    };

    const result = configureInstallDataPaths(electronApp, executablePath);
    const targetPath = path.join(installPath, 'data');
    assert.equal(result.migrated, true);
    assert.equal(changedPaths.get('userData'), targetPath);
    assert.equal(changedPaths.get('sessionData'), targetPath);
    assert.equal(fs.existsSync(legacyPath), false);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(targetPath, 'app-data.json'), 'utf8')).settings.encryptedDeepSeekApiKey,
      'dpapi-ciphertext',
    );
    assert.deepEqual(fs.readFileSync(path.join(targetPath, 'corpus-vectors.f32')), Buffer.from([1, 2, 3, 4]));
    assert.equal(fs.readFileSync(path.join(targetPath, 'Local Storage', 'state'), 'utf8'), 'renderer-state');
    assert.equal(JSON.parse(fs.readFileSync(path.join(targetPath, MIGRATION_MARKER_NAME), 'utf8')).version, 1);
  } finally {
    removeTempDirectory(root);
  }
});

test('verified target copy lets an interrupted migration finish without overwriting data', () => {
  const root = tempDirectory();
  try {
    const sourcePath = path.join(root, 'legacy');
    const targetPath = path.join(root, 'install', 'data');
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(sourcePath, 'app-data.json'), '{"sessions":[]}');
    fs.copyFileSync(path.join(sourcePath, 'app-data.json'), path.join(targetPath, 'app-data.json'));
    fs.writeFileSync(path.join(targetPath, 'new-runtime-file'), 'kept');

    const result = migrateLegacyUserData(sourcePath, targetPath);
    assert.equal(result.migrated, true);
    assert.equal(fs.existsSync(sourcePath), false);
    assert.equal(fs.readFileSync(path.join(targetPath, 'new-runtime-file'), 'utf8'), 'kept');
  } finally {
    removeTempDirectory(root);
  }
});

test('different source and target data aborts migration and preserves both copies', () => {
  const root = tempDirectory();
  try {
    const sourcePath = path.join(root, 'legacy');
    const targetPath = path.join(root, 'install', 'data');
    fs.mkdirSync(sourcePath, { recursive: true });
    fs.mkdirSync(targetPath, { recursive: true });
    fs.writeFileSync(path.join(sourcePath, 'app-data.json'), 'legacy');
    fs.writeFileSync(path.join(targetPath, 'app-data.json'), 'current');

    assert.throws(
      () => migrateLegacyUserData(sourcePath, targetPath),
      /已停止迁移以避免覆盖/,
    );
    assert.equal(fs.readFileSync(path.join(sourcePath, 'app-data.json'), 'utf8'), 'legacy');
    assert.equal(fs.readFileSync(path.join(targetPath, 'app-data.json'), 'utf8'), 'current');
  } finally {
    removeTempDirectory(root);
  }
});

test('development keeps Electron default userData and never writes into the repository', () => {
  const root = tempDirectory();
  try {
    const changedPaths = [];
    const electronApp = {
      isPackaged: false,
      getPath: () => path.join(root, 'development-user-data'),
      setPath: (...args) => changedPaths.push(args),
    };

    const result = configureInstallDataPaths(electronApp, path.join(root, 'electron.exe'));
    assert.equal(result.migrated, false);
    assert.equal(result.target, path.join(root, 'development-user-data'));
    assert.deepEqual(changedPaths, []);
  } finally {
    removeTempDirectory(root);
  }
});
