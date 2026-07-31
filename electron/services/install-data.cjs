const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIRECTORY_NAME = 'data';
const MIGRATION_MARKER_NAME = '.wenyao-data-location.json';

function resolved(filePath) {
  return path.resolve(filePath);
}

function isNestedPath(parentPath, childPath) {
  const relative = path.relative(resolved(parentPath), resolved(childPath));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertSeparateDirectories(sourcePath, targetPath) {
  if (resolved(sourcePath) === resolved(targetPath)) return;
  if (isNestedPath(sourcePath, targetPath) || isNestedPath(targetPath, sourcePath)) {
    throw new Error(`安装目录的数据文件夹不能与旧数据目录互相包含：${targetPath}`);
  }
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function directoryManifest(rootPath) {
  const manifest = new Map();

  function visit(relativeDirectory) {
    const absoluteDirectory = path.join(rootPath, relativeDirectory);
    const entries = fs.readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(rootPath, relativePath);
      if (entry.isSymbolicLink()) {
        throw new Error(`旧数据目录包含不受支持的符号链接：${relativePath}`);
      }
      if (entry.isDirectory()) {
        visit(relativePath);
        continue;
      }
      if (!entry.isFile()) {
        throw new Error(`旧数据目录包含不受支持的文件类型：${relativePath}`);
      }
      const stat = fs.statSync(absolutePath);
      manifest.set(relativePath, { bytes: stat.size, sha256: sha256(absolutePath) });
    }
  }

  visit('');
  return manifest;
}

function manifestsEqual(left, right) {
  if (left.size !== right.size) return false;
  for (const [relativePath, expected] of left) {
    const actual = right.get(relativePath);
    if (!actual || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) return false;
  }
  return true;
}

function targetContainsManifest(targetPath, sourceManifest) {
  const targetManifest = directoryManifest(targetPath);
  for (const [relativePath, expected] of sourceManifest) {
    const actual = targetManifest.get(relativePath);
    if (!actual || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) return false;
  }
  return true;
}

function directoryIsEmpty(directoryPath) {
  return fs.existsSync(directoryPath) && fs.readdirSync(directoryPath).length === 0;
}

function writeMigrationMarker(targetPath, sourcePath, fileCount) {
  const markerPath = path.join(targetPath, MIGRATION_MARKER_NAME);
  const temporaryPath = `${markerPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify({
    version: 1,
    dataRoot: targetPath,
    migratedFrom: sourcePath,
    migratedFileCount: fileCount,
    migratedAt: new Date().toISOString(),
  }, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, markerPath);
}

function assertWritableDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
  const probePath = path.join(directoryPath, `.wenyao-write-test-${process.pid}-${crypto.randomUUID()}`);
  try {
    fs.writeFileSync(probePath, 'write-test', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    throw new Error(`安装目录不可写，问爻无法安全保存历史和 API 密钥：${directoryPath}`, { cause: error });
  } finally {
    try { fs.rmSync(probePath, { force: true }); } catch {}
  }
}

function migrateLegacyUserData(sourcePath, targetPath) {
  const source = resolved(sourcePath);
  const target = resolved(targetPath);
  assertSeparateDirectories(source, target);

  if (source === target || !fs.existsSync(source)) {
    assertWritableDirectory(target);
    return { migrated: false, source, target, fileCount: 0 };
  }

  if (!fs.statSync(source).isDirectory()) {
    throw new Error(`旧数据路径不是文件夹：${source}`);
  }

  if (directoryIsEmpty(target)) fs.rmdirSync(target);
  const sourceManifest = directoryManifest(source);

  if (fs.existsSync(target)) {
    if (!fs.statSync(target).isDirectory() || !targetContainsManifest(target, sourceManifest)) {
      throw new Error(`安装目录与旧数据目录同时存在且内容不同，已停止迁移以避免覆盖：${target}`);
    }
    writeMigrationMarker(target, source, sourceManifest.size);
    fs.rmSync(source, { recursive: true });
    assertWritableDirectory(target);
    return { migrated: true, source, target, fileCount: sourceManifest.size };
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stagingPath = `${target}.migration-staging`;
  if (fs.existsSync(stagingPath)) {
    throw new Error(`发现未完成的数据迁移暂存目录，请先保留并检查其中内容：${stagingPath}`);
  }

  try {
    fs.cpSync(source, stagingPath, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    });
    const sourceAfterCopy = directoryManifest(source);
    const stagingManifest = directoryManifest(stagingPath);
    if (!manifestsEqual(sourceManifest, sourceAfterCopy) || !manifestsEqual(sourceManifest, stagingManifest)) {
      throw new Error('旧数据在迁移期间发生变化或复制校验失败，原数据未删除。');
    }
    fs.renameSync(stagingPath, target);
    if (!targetContainsManifest(target, sourceManifest)) {
      throw new Error('安装目录中的迁移数据未通过最终校验，原数据未删除。');
    }
    writeMigrationMarker(target, source, sourceManifest.size);
    fs.rmSync(source, { recursive: true });
  } catch (error) {
    try { fs.rmSync(stagingPath, { recursive: true, force: true }); } catch {}
    throw error;
  }

  assertWritableDirectory(target);
  return { migrated: true, source, target, fileCount: sourceManifest.size };
}

function configureInstallDataPaths(electronApp, executablePath = process.execPath) {
  const originalUserDataPath = electronApp.getPath('userData');
  if (!electronApp.isPackaged) {
    return {
      migrated: false,
      source: originalUserDataPath,
      target: originalUserDataPath,
      fileCount: 0,
    };
  }

  const installDirectory = path.dirname(resolved(executablePath));
  const target = path.join(installDirectory, DATA_DIRECTORY_NAME);
  const result = migrateLegacyUserData(originalUserDataPath, target);
  electronApp.setPath('userData', target);
  electronApp.setPath('sessionData', target);
  return result;
}

module.exports = {
  DATA_DIRECTORY_NAME,
  MIGRATION_MARKER_NAME,
  assertWritableDirectory,
  configureInstallDataPaths,
  directoryManifest,
  manifestsEqual,
  migrateLegacyUserData,
};
