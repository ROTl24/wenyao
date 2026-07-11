const { spawn } = require('node:child_process');
const path = require('node:path');

const apiKey = process.env.WENYAO_SETUP_KEY || '';
if (!apiKey) {
  process.stderr.write('未提供一次性配置密钥。\n');
  process.exit(1);
}
const electron = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const child = spawn(electron, ['.', '--configure-api-key-env'], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on('exit', (code) => process.exit(code || 0));
