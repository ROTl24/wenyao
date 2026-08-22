const PROVIDERS = {
  dpapi: {
    name: 'Windows DPAPI',
    unavailable: '当前 Windows 环境无法启用 DPAPI 密钥保护',
    nextAction: '请在当前 Windows 用户的正常桌面会话中运行问爻。',
  },
  keychain: {
    name: 'macOS 钥匙串',
    unavailable: '当前 macOS 环境无法访问钥匙串密钥保护',
    nextAction: '请解锁当前用户的登录钥匙串，允许问爻访问后重试。',
  },
  system: {
    name: '系统安全存储',
    unavailable: '当前系统无法启用安全密钥存储',
    nextAction: '请在当前用户的正常桌面会话中运行问爻。',
  },
};

function storageError(message, nextAction) {
  const error = new Error(message);
  error.publicCode = 'SECRET_STORAGE_UNAVAILABLE';
  error.publicNextAction = nextAction;
  return error;
}

function createSecretStore({ safeStorage, provider = 'system' }) {
  const description = PROVIDERS[provider] || PROVIDERS.system;
  return {
    provider,
    name: description.name,
    encrypt(secret) {
      const normalized = String(secret || '').trim();
      if (!normalized) return '';
      if (!safeStorage?.isEncryptionAvailable()) {
        throw storageError(description.unavailable, description.nextAction);
      }
      return safeStorage.encryptString(normalized).toString('base64');
    },
    decrypt(encrypted) {
      const normalized = String(encrypted || '');
      if (!normalized || !safeStorage?.isEncryptionAvailable()) return '';
      try {
        return safeStorage.decryptString(Buffer.from(normalized, 'base64'));
      } catch {
        return '';
      }
    },
  };
}

module.exports = { createSecretStore };
