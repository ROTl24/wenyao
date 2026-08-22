const assert = require('node:assert/strict');
const test = require('node:test');
const { createSecretStore } = require('./secret-store.cjs');

test('secret store encrypts and decrypts through the platform adapter', () => {
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`sealed:${value}`),
    decryptString: (value) => value.toString('utf8').replace(/^sealed:/, ''),
  };
  const store = createSecretStore({ safeStorage, provider: 'keychain' });
  const encrypted = store.encrypt('  secret-value  ');
  assert.equal(store.name, 'macOS 钥匙串');
  assert.equal(store.decrypt(encrypted), 'secret-value');
});

test('Keychain unavailability reports a recoverable Mac-specific action', () => {
  const store = createSecretStore({
    safeStorage: { isEncryptionAvailable: () => false },
    provider: 'keychain',
  });
  assert.throws(
    () => store.encrypt('secret'),
    (error) => error.publicCode === 'SECRET_STORAGE_UNAVAILABLE'
      && /macOS/.test(error.message)
      && /钥匙串/.test(error.publicNextAction),
  );
});

test('decryption failure leaves the persisted ciphertext untouched', () => {
  const encrypted = Buffer.from('persisted-ciphertext').toString('base64');
  const store = createSecretStore({
    safeStorage: {
      isEncryptionAvailable: () => true,
      decryptString() { throw new Error('access denied'); },
    },
    provider: 'dpapi',
  });
  assert.equal(store.decrypt(encrypted), '');
  assert.equal(encrypted, Buffer.from('persisted-ciphertext').toString('base64'));
});
