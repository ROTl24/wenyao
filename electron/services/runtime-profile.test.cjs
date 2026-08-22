const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createRuntimeProfile,
  runtimeProfileArgument,
  runtimeProfileFromArguments,
} = require('./runtime-profile.cjs');

test('runtime profile exposes real Windows native update and DPAPI capabilities', () => {
  assert.deepEqual(createRuntimeProfile({ platform: 'win32', arch: 'x64', isPackaged: true }), {
    kind: 'electron', platform: 'win32', arch: 'x64', isPackaged: true,
    updateMode: 'native', secureStorage: 'dpapi',
    capabilities: { ai: true, corpusImport: true },
  });
});

test('runtime profile exposes manual updates and Keychain for packaged macOS', () => {
  const profile = createRuntimeProfile({ platform: 'darwin', arch: 'arm64', isPackaged: true });
  assert.deepEqual(profile, {
    kind: 'electron', platform: 'darwin', arch: 'arm64', isPackaged: true,
    updateMode: 'manual', secureStorage: 'keychain',
    capabilities: { ai: true, corpusImport: true },
  });
  assert.deepEqual(
    runtimeProfileFromArguments([
      runtimeProfileArgument(createRuntimeProfile({ platform: 'win32', arch: 'x64', isPackaged: true })),
      runtimeProfileArgument(profile),
    ], {}),
    profile,
  );
});

test('development and malformed renderer arguments fail closed for updates', () => {
  assert.deepEqual(
    runtimeProfileFromArguments(['--wenyao-runtime-profile=not-base64'], {
      platform: 'darwin', arch: 'arm64', isPackaged: false,
    }),
    {
      kind: 'electron', platform: 'darwin', arch: 'arm64', isPackaged: false,
      updateMode: 'none', secureStorage: 'keychain',
      capabilities: { ai: true, corpusImport: true },
    },
  );
});
