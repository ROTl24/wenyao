import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const releaseRoot = path.join(projectRoot, 'release');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const version = packageJson.version;
const productName = packageJson.build.productName;
const dmgName = `WenYao-${version}-universal.dmg`;
const dmgPath = path.join(releaseRoot, dmgName);
const appPath = path.join(releaseRoot, 'mac-universal', `${productName}.app`);
const executablePath = path.join(appPath, 'Contents', 'MacOS', productName);
const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist');
const checksumPath = path.join(releaseRoot, 'SHA256SUMS.txt');
const architectureBinaries = [
  executablePath,
  path.join(appPath, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Electron Framework'),
  ...['', ' (GPU)', ' (Plugin)', ' (Renderer)'].map((suffix) => path.join(
    appPath,
    'Contents',
    'Frameworks',
    `${productName} Helper${suffix}.app`,
    'Contents',
    'MacOS',
    `${productName} Helper${suffix}`,
  )),
];

function requireFile(filePath, minimumBytes = 1) {
  if (!existsSync(filePath)) throw new Error(`缺少发布产物：${path.relative(projectRoot, filePath)}`);
  const bytes = statSync(filePath).size;
  if (bytes < minimumBytes) throw new Error(`发布产物异常小：${path.relative(projectRoot, filePath)} (${bytes} bytes)`);
  return bytes;
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`${command} 执行失败：${result.stderr || result.stdout || `退出码 ${result.status}`}`);
  }
  return result;
}

function plistValue(key) {
  return run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, infoPlistPath]).stdout.trim();
}

if (process.platform !== 'darwin') {
  throw new Error('macOS 发布验收必须在 macOS 构建机上执行。');
}

const dmgBytes = requireFile(dmgPath, 10 * 1024 * 1024);
requireFile(executablePath, 64 * 1024);
requireFile(infoPlistPath, 100);
requireFile(checksumPath, 64);

run('hdiutil', ['verify', dmgPath]);
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);
const signing = run('codesign', ['-dvvv', appPath]).stderr;
if (!/Signature=adhoc/.test(signing)) throw new Error('应用未使用预期的零成本 ad-hoc 签名封装');

for (const binaryPath of architectureBinaries) {
  requireFile(binaryPath, 1024);
  const architectures = run('lipo', ['-archs', binaryPath]).stdout.trim().split(/\s+/).sort();
  if (architectures.join(' ') !== 'arm64 x86_64') {
    throw new Error(`${path.relative(appPath, binaryPath)} 不是通用二进制：${architectures.join(' ') || '<missing>'}`);
  }
}
if (plistValue('LSMinimumSystemVersion') !== '13.0') {
  throw new Error(`最低系统版本应为 macOS 13.0，实际为 ${plistValue('LSMinimumSystemVersion') || '<missing>'}`);
}
if (plistValue('CFBundleShortVersionString') !== version || plistValue('CFBundleIdentifier') !== packageJson.build.appId) {
  throw new Error('应用包版本或 Bundle Identifier 与 package.json 不一致');
}

const gatekeeper = run('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], { allowFailure: true });
if (gatekeeper.status === 0) {
  throw new Error('未公证的零成本构建不应被误报为已通过 Gatekeeper 信任评估');
}

const runtime = run(executablePath, ['--verify-platform-runtime']);
const runtimeLine = runtime.stdout.trim().split(/\r?\n/).findLast((line) => line.trim().startsWith('{'));
const runtimeProfile = runtimeLine ? JSON.parse(runtimeLine) : null;
if (runtimeProfile?.platform !== 'darwin' || runtimeProfile?.isPackaged !== true || runtimeProfile?.updateMode !== 'manual') {
  throw new Error(`macOS 运行时配置错误：${runtimeLine || '<missing>'}`);
}
for (const dataDirectory of [runtimeProfile.userData, runtimeProfile.sessionData]) {
  if (!dataDirectory || path.resolve(dataDirectory).startsWith(path.resolve(appPath))) {
    throw new Error(`运行时数据目录不得位于应用包内：${dataDirectory || '<missing>'}`);
  }
}
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

const actualDigest = createHash('sha256').update(readFileSync(dmgPath)).digest('hex');
const checksum = readFileSync(checksumPath, 'utf8').trim();
if (checksum !== `${actualDigest}  ${dmgName}`) throw new Error('SHA256SUMS.txt 与 DMG 内容不一致');

process.stdout.write(`${JSON.stringify({
  version,
  dmg: dmgName,
  dmgBytes,
  architectures: ['x86_64', 'arm64'],
  universalBinaries: architectureBinaries.length,
  signing: 'adhoc',
  gatekeeper: 'expected-user-override',
  runtime: runtimeProfile,
})}\n`);
