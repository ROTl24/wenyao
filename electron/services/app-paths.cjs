const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIRECTORY_NAME = 'data';

function resolved(filePath) {
  return path.resolve(filePath);
}

function assertWritableDirectory(directoryPath, label = '数据目录') {
  const directory = resolved(directoryPath);
  const probePath = path.join(directory, `.wenyao-write-test-${process.pid}-${crypto.randomUUID()}`);

  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(probePath, 'write-test', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.rmSync(probePath);
  } catch (error) {
    try { fs.rmSync(probePath, { force: true }); } catch {}
    throw new Error(`${label}不可写，问爻无法安全保存本机数据：${directory}`, { cause: error });
  }

  return directory;
}

function applicationBundleRoot(executablePath) {
  const absolutePath = resolved(executablePath);
  const parsed = path.parse(absolutePath);
  const segments = absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const segment of segments) {
    current = path.join(current, segment);
    if (segment.toLowerCase().endsWith('.app')) return current;
  }
  return null;
}

function assertOutsideApplicationBundle(directoryPath, executablePath) {
  const bundleRoot = applicationBundleRoot(executablePath);
  if (!bundleRoot) return;
  const relative = path.relative(bundleRoot, resolved(directoryPath));
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`macOS 数据目录不能位于应用包内部：${resolved(directoryPath)}`);
  }
}

function configureApplicationPaths(
  electronApp,
  { executablePath = process.execPath, platform = process.platform } = {},
) {
  if (!electronApp.isPackaged) {
    return {
      userData: electronApp.getPath('userData'),
      sessionData: electronApp.getPath('sessionData'),
    };
  }

  if (platform === 'win32') {
    const installDirectory = path.dirname(resolved(executablePath));
    const dataDirectory = assertWritableDirectory(
      path.join(installDirectory, DATA_DIRECTORY_NAME),
      '安装目录中的数据文件夹',
    );
    electronApp.setPath('userData', dataDirectory);
    electronApp.setPath('sessionData', dataDirectory);
    return { userData: dataDirectory, sessionData: dataDirectory };
  }

  const userData = electronApp.getPath('userData');
  const sessionData = platform === 'darwin'
    ? path.join(
      electronApp.getPath('home'),
      'Library',
      'Caches',
      electronApp.getName?.() || electronApp.name || '问爻',
      'Session',
    )
    : electronApp.getPath('sessionData');

  assertOutsideApplicationBundle(userData, executablePath);
  assertOutsideApplicationBundle(sessionData, executablePath);
  const writableUserData = assertWritableDirectory(userData, '用户数据目录');
  const writableSessionData = assertWritableDirectory(sessionData, '会话缓存目录');
  electronApp.setPath('userData', writableUserData);
  electronApp.setPath('sessionData', writableSessionData);
  return { userData: writableUserData, sessionData: writableSessionData };
}

module.exports = {
  DATA_DIRECTORY_NAME,
  applicationBundleRoot,
  assertOutsideApplicationBundle,
  assertWritableDirectory,
  configureApplicationPaths,
};
