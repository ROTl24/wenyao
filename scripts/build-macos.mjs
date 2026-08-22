import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const releaseRoot = path.join(projectRoot, 'release');
const dmgPath = path.join(releaseRoot, `WenYao-${packageJson.version}-universal.dmg`);
const appPath = path.join(releaseRoot, 'mac-universal', `${packageJson.build.productName}.app`);
const appArchivePath = path.join(releaseRoot, `WenYao-${packageJson.version}-universal-app.zip`);
const checksumPath = path.join(releaseRoot, 'SHA256SUMS.txt');
const electronBuilderCliPath = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败，退出码 ${result.status}`);
}

if (process.platform !== 'darwin') {
  throw new Error('macOS 通用安装包必须在 macOS 构建机上生成。');
}

run(process.execPath, [path.join(projectRoot, 'scripts', 'prepare-macos-icon.mjs')]);
run(process.execPath, [electronBuilderCliPath, '--mac', 'dmg', '--universal', '--publish', 'never']);

if (!existsSync(dmgPath)) throw new Error(`缺少 DMG：${path.relative(projectRoot, dmgPath)}`);
if (!existsSync(appPath)) throw new Error(`缺少通用应用包：${path.relative(projectRoot, appPath)}`);

run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appPath, appArchivePath]);
const digest = createHash('sha256').update(readFileSync(dmgPath)).digest('hex');
writeFileSync(checksumPath, `${digest}  ${path.basename(dmgPath)}\n`, 'utf8');

process.stdout.write(`${JSON.stringify({
  dmg: path.relative(projectRoot, dmgPath),
  appArchive: path.relative(projectRoot, appArchivePath),
  checksum: path.relative(projectRoot, checksumPath),
})}\n`);
