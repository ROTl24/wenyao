const PROFILE_ARGUMENT_PREFIX = '--wenyao-runtime-profile=';
const ELECTRON_PLATFORMS = new Set(['win32', 'darwin', 'linux']);

function createRuntimeProfile({ platform, arch, isPackaged }) {
  const normalizedPlatform = ELECTRON_PLATFORMS.has(platform) ? platform : 'linux';
  const normalizedArch = typeof arch === 'string' && /^[a-z0-9_-]{1,32}$/i.test(arch) ? arch : 'unknown';
  const packaged = Boolean(isPackaged);
  return {
    kind: 'electron',
    platform: normalizedPlatform,
    arch: normalizedArch,
    isPackaged: packaged,
    updateMode: packaged ? (normalizedPlatform === 'win32' ? 'native' : normalizedPlatform === 'darwin' ? 'manual' : 'none') : 'none',
    secureStorage: normalizedPlatform === 'win32' ? 'dpapi' : normalizedPlatform === 'darwin' ? 'keychain' : 'system',
    capabilities: {
      ai: true,
      corpusImport: true,
    },
  };
}

function runtimeProfileArgument(profile) {
  return `${PROFILE_ARGUMENT_PREFIX}${Buffer.from(JSON.stringify(profile), 'utf8').toString('base64url')}`;
}

function runtimeProfileFromArguments(argv, fallback) {
  const argument = Array.isArray(argv)
    ? argv.findLast((value) => typeof value === 'string' && value.startsWith(PROFILE_ARGUMENT_PREFIX))
    : null;
  if (argument) {
    try {
      const encoded = argument.slice(PROFILE_ARGUMENT_PREFIX.length);
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      return createRuntimeProfile(parsed);
    } catch {}
  }
  return createRuntimeProfile(fallback);
}

module.exports = {
  PROFILE_ARGUMENT_PREFIX,
  createRuntimeProfile,
  runtimeProfileArgument,
  runtimeProfileFromArguments,
};
