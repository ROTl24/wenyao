const { spawn } = require('node:child_process');
const path = require('node:path');

const electron = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe');
const child = spawn(electron, ['.', '--build-vector-index'], {
  cwd: path.join(__dirname, '..'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.on('exit', (code) => process.exit(code || 0));
