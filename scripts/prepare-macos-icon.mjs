import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(projectRoot, 'build', 'icon.png');
const iconsetPath = path.join(projectRoot, 'release', '.mac-icon.iconset');
const outputPath = path.join(projectRoot, 'build', 'icon.icns');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: projectRoot, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败：${result.stderr || result.stdout || `退出码 ${result.status}`}`);
  }
}

if (process.platform !== 'darwin') {
  throw new Error('macOS 图标只能在 macOS 构建机上生成。');
}
if (!existsSync(sourcePath)) {
  throw new Error(`缺少图标源文件：${path.relative(projectRoot, sourcePath)}`);
}

rmSync(iconsetPath, { recursive: true, force: true });
mkdirSync(iconsetPath, { recursive: true });

const variants = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

try {
  for (const [pixels, filename] of variants) {
    run('sips', ['-s', 'format', 'png', '-z', String(pixels), String(pixels), sourcePath, '--out', path.join(iconsetPath, filename)]);
  }
  run('iconutil', ['-c', 'icns', iconsetPath, '-o', outputPath]);
} finally {
  rmSync(iconsetPath, { recursive: true, force: true });
}

process.stdout.write(`${path.relative(projectRoot, outputPath)}\n`);
