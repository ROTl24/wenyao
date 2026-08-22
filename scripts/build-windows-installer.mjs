import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const nsisTemplateRoot = path.join(
  projectRoot,
  'node_modules',
  'app-builder-lib',
  'templates',
  'nsis',
);
const commonTemplatePath = path.join(nsisTemplateRoot, 'common.nsh');
const installSectionTemplatePath = path.join(nsisTemplateRoot, 'installSection.nsh');
const electronBuilderCliPath = path.join(projectRoot, 'node_modules', 'electron-builder', 'cli.js');
const releaseRoot = path.join(projectRoot, 'release');
const interruptedElectronDistPath = path.join(projectRoot, 'node_modules', '.cache', 'wenyao-electron-dist-win32-x64');

function replaceOnce(source, search, replacement, label) {
  const firstIndex = source.indexOf(search);
  if (firstIndex < 0) {
    throw new Error(`electron-builder NSIS 模板已变化，找不到注入点：${label}`);
  }
  if (source.indexOf(search, firstIndex + search.length) >= 0) {
    throw new Error(`electron-builder NSIS 模板中存在重复注入点：${label}`);
  }
  return `${source.slice(0, firstIndex)}${replacement}${source.slice(firstIndex + search.length)}`;
}

function addStepBefore(source, instruction, message) {
  return replaceOnce(
    source,
    instruction,
    `DetailPrint "${message}"\n${instruction}`,
    message,
  );
}

const originalCommonTemplate = readFileSync(commonTemplatePath, 'utf8');
const originalInstallSectionTemplate = readFileSync(installSectionTemplatePath, 'utf8');

const visibleCommonTemplate = replaceOnce(
  originalCommonTemplate,
  'ShowInstDetails nevershow',
  'ShowInstDetails show',
  '显示安装详情区',
);
let descriptiveInstallSectionTemplate = replaceOnce(
  originalInstallSectionTemplate,
  '${IfNot} ${Silent}\n  SetDetailsPrint none\n${endif}',
  [
    '${IfNot} ${Silent}',
    '  SetDetailsPrint both',
    '  DetailPrint "正在检查问爻是否正在运行…"',
    '${endif}',
  ].join('\n'),
  '启用安装详情输出',
);

descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!insertmacro uninstallOldVersion SHELL_CONTEXT',
  '正在检查并安全替换已有版本…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  'SetOutPath $INSTDIR',
  '正在准备安装目录…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!insertmacro installApplicationFiles',
  '正在安装桌面程序与内置卦理资料…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!insertmacro registryAddInstallInfo',
  '正在写入版本与卸载信息…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!insertmacro addStartMenuLink $keepShortcuts',
  '正在创建开始菜单快捷方式…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!insertmacro addDesktopLink $keepShortcuts',
  '正在创建桌面快捷方式…',
);
descriptiveInstallSectionTemplate = addStepBefore(
  descriptiveInstallSectionTemplate,
  '!ifmacrodef customInstall',
  '正在完成安装…',
);

let exitCode = 1;
try {
  writeFileSync(commonTemplatePath, visibleCommonTemplate, 'utf8');
  writeFileSync(installSectionTemplatePath, descriptiveInstallSectionTemplate, 'utf8');

  const builderArguments = [electronBuilderCliPath, '--win', 'nsis', ...process.argv.slice(2)];
  let result = spawnSync(process.execPath, builderArguments, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const interruptedExtractionPath = path.join(releaseRoot, 'win-unpacked.tmp');
  if (result.status !== 0 && existsSync(path.join(interruptedExtractionPath, 'electron.exe'))) {
    // Windows scanners can briefly retain a handle after Electron extraction. Once the
    // failed child exits, preserve that verified runtime and let electron-builder copy it
    // through its supported unpacked electronDist path instead of downloading again.
    rmSync(interruptedElectronDistPath, { recursive: true, force: true });
    mkdirSync(path.dirname(interruptedElectronDistPath), { recursive: true });
    cpSync(interruptedExtractionPath, interruptedElectronDistPath, { recursive: true });
    result = spawnSync(
      process.execPath,
      [...builderArguments, `--config.electronDist=${interruptedElectronDistPath}`],
      {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
      },
    );
  }

  if (result.error) throw result.error;
  if (result.signal) {
    throw new Error(`electron-builder 被信号 ${result.signal} 中止`);
  }
  exitCode = result.status ?? 1;
} finally {
  rmSync(interruptedElectronDistPath, { recursive: true, force: true });
  rmSync(path.join(releaseRoot, 'win-unpacked.tmp'), { recursive: true, force: true });
  writeFileSync(commonTemplatePath, originalCommonTemplate, 'utf8');
  writeFileSync(installSectionTemplatePath, originalInstallSectionTemplate, 'utf8');
}

process.exitCode = exitCode;
