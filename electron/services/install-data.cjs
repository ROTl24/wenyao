const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIRECTORY_NAME = 'data';

function resolved(filePath) {
  return path.resolve(filePath);
}

function assertWritableDirectory(directoryPath) {
  const directory = resolved(directoryPath);
  const probePath = path.join(directory, `.wenyao-write-test-${process.pid}-${crypto.randomUUID()}`);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(probePath, 'write-test', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.rmSync(probePath);
  } catch (error) {
    try { fs.rmSync(probePath, { force: true }); } catch {}
    throw new Error(`安装目录不可写，问爻无法安全保存历史和 API 密钥：${directory}`, { cause: error });
  }

  return directory;
}

function configureInstallDataPaths(electronApp, executablePath = process.execPath) {
  if (!electronApp.isPackaged) return electronApp.getPath('userData');

  const installDirectory = path.dirname(resolved(executablePath));
  const target = assertWritableDirectory(path.join(installDirectory, DATA_DIRECTORY_NAME));
  electronApp.setPath('userData', target);
  electronApp.setPath('sessionData', target);
  return target;
}

module.exports = {
  DATA_DIRECTORY_NAME,
  assertWritableDirectory,
  configureInstallDataPaths,
};
