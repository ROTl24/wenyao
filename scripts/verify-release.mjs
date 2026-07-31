import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseRoot = path.join(projectRoot, 'release');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const installerName = `WenYao-${version}-Setup.exe`;
const installerPath = path.join(releaseRoot, installerName);
const blockmapPath = `${installerPath}.blockmap`;
const latestPath = path.join(releaseRoot, 'latest.yml');
const packagedUpdateConfigPath = path.join(releaseRoot, 'win-unpacked', 'resources', 'app-update.yml');

function requireFile(filePath, minimumBytes = 1) {
  if (!existsSync(filePath)) throw new Error(`缺少发布产物：${path.relative(projectRoot, filePath)}`);
  const bytes = statSync(filePath).size;
  if (bytes < minimumBytes) throw new Error(`发布产物异常小：${path.relative(projectRoot, filePath)} (${bytes} bytes)`);
  return bytes;
}

function yamlScalar(document, key) {
  const match = document.match(new RegExp(`^${key}:\\s*['"]?([^'"\\r\\n]+)['"]?\\s*$`, 'm'));
  return match?.[1]?.trim() || '';
}

function sha512(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    const input = createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(hash.digest('base64')));
  });
}

const installerBytes = requireFile(installerPath, 1024 * 1024);
requireFile(blockmapPath, 1024);
requireFile(latestPath, 100);
requireFile(packagedUpdateConfigPath, 40);

const latest = readFileSync(latestPath, 'utf8');
const packagedUpdateConfig = readFileSync(packagedUpdateConfigPath, 'utf8');
const metadataVersion = yamlScalar(latest, 'version');
const metadataPath = yamlScalar(latest, 'path');
const metadataSha512 = yamlScalar(latest, 'sha512');

if (metadataVersion !== version) {
  throw new Error(`latest.yml 版本 ${metadataVersion || '<missing>'} 与 package.json ${version} 不一致`);
}
if (metadataPath !== installerName) {
  throw new Error(`latest.yml 安装包路径 ${metadataPath || '<missing>'} 与 ${installerName} 不一致`);
}
if (!/^[A-Za-z0-9+/]{80,}={0,2}$/.test(metadataSha512)) {
  throw new Error('latest.yml 缺少有效的 SHA-512');
}
const actualSha512 = await sha512(installerPath);
if (actualSha512 !== metadataSha512) {
  throw new Error('latest.yml SHA-512 与安装包内容不一致');
}
for (const expectedLine of ['provider: github', 'owner: ROTl24', 'repo: wenyao']) {
  if (!packagedUpdateConfig.includes(expectedLine)) {
    throw new Error(`app-update.yml 缺少 ${expectedLine}`);
  }
}

process.stdout.write(`${JSON.stringify({
  version,
  installer: installerName,
  installerBytes,
  metadata: 'latest.yml',
  blockmap: `${installerName}.blockmap`,
  provider: 'github:ROTl24/wenyao',
})}\n`);
