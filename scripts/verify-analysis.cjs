const { spawn } = require('node:child_process');
const path = require('node:path');
const { electronExecutablePath } = require('./electron-executable.cjs');

const electron = electronExecutablePath(path.join(__dirname, '..'));
const child = spawn(electron, ['.', '--verify-analysis'], {
  cwd: path.join(__dirname, '..'), env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on('exit', (code) => process.exit(code || 0));
