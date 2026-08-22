const fs = require('node:fs');
const path = require('node:path');

function electronExecutableCandidate(projectRoot, platform = process.platform) {
  const distributionRoot = path.join(projectRoot, 'node_modules', 'electron', 'dist');
  if (platform === 'darwin') {
    return path.join(distributionRoot, 'Electron.app', 'Contents', 'MacOS', 'Electron');
  }
  return path.join(distributionRoot, platform === 'win32' ? 'electron.exe' : 'electron');
}

function electronExecutablePath(projectRoot, platform = process.platform) {
  const candidate = electronExecutableCandidate(projectRoot, platform);
  if (!fs.existsSync(candidate)) {
    throw new Error(`缺少当前平台的 Electron 可执行文件：${candidate}\n请先运行 npm install。`);
  }
  return candidate;
}

module.exports = { electronExecutableCandidate, electronExecutablePath };
