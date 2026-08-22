const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(projectRoot, '.github', 'workflows', 'release-desktop.yml'), 'utf8');
const buildScript = fs.readFileSync(path.join(projectRoot, 'scripts', 'build-macos.mjs'), 'utf8');
const verifier = fs.readFileSync(path.join(projectRoot, 'scripts', 'verify-macos-release.mjs'), 'utf8');

test('macOS package is a zero-cost universal DMG with an explicit ad-hoc identity', () => {
  assert.equal(packageJson.build.mac.identity, '-');
  assert.equal(packageJson.build.mac.hardenedRuntime, false);
  assert.equal(packageJson.build.mac.minimumSystemVersion, '13.0');
  assert.deepEqual(packageJson.build.mac.target, [{ target: 'dmg', arch: ['universal'] }]);
  assert.equal(packageJson.build.mac.artifactName, 'WenYao-${version}-universal.${ext}');
  assert.match(packageJson.scripts['build:macos'], /scripts\/build-macos\.mjs/);
  assert.match(buildScript, /--universal/);
  assert.match(buildScript, /--publish', 'never/);
});

test('Mac verifier preserves the truthful Gatekeeper and dual-architecture boundary', () => {
  for (const contract of [
    "'codesign'",
    "'hdiutil'",
    "'lipo'",
    "'spctl'",
    '/Signature=adhoc/',
    "architectures.join(' ') !== 'arm64 x86_64'",
    "--verify-platform-runtime",
  ]) {
    assert.ok(verifier.includes(contract), `Mac verifier missing ${contract}`);
  }
});

test('desktop release waits for ARM build and Intel smoke before one privileged publish job', () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /runs-on: macos-15\s/);
  assert.match(workflow, /runs-on: macos-15-intel\s/);
  assert.match(workflow, /verify-macos-intel:/);
  assert.match(workflow, /lipo "\$app\/Contents\/MacOS\/问爻" -verify_arch x86_64 arm64/);
  assert.match(workflow, /publish:\s+if: startsWith\(github\.ref, 'refs\/tags\/v'\)\s+needs:\s+- build-windows\s+- build-macos\s+- verify-macos-intel/s);
  assert.match(workflow, /publish:\s+[\s\S]*?permissions:\s+contents: write/);
  assert.doesNotMatch(workflow, /APPLE_|MAC_CSC|notar/i);
  assert.equal((workflow.match(/gh release edit .*--draft=false/g) || []).length, 1);
});
