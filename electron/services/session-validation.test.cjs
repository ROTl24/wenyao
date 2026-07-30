const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeStoredSession,
  storedCastingMethod,
} = require('./session-validation.cjs');

test('legacy sessions default to digital only when castingMethod is absent', () => {
  const legacy = {
    id: 'legacy-session',
    plate: { nested: { retained: true } },
    messages: [],
  };

  const normalized = normalizeStoredSession(legacy);

  assert.equal(normalized.castingMethod, 'digital');
  assert.deepEqual(normalized.plate, legacy.plate);
  assert.notEqual(normalized.plate, legacy.plate);
  assert.equal(storedCastingMethod(legacy), 'digital');
  assert.equal(Object.hasOwn(legacy, 'castingMethod'), false);
});

test('explicitly invalid stored casting methods are rejected', () => {
  for (const castingMethod of ['manual', undefined, null]) {
    const session = { id: 'invalid-method', castingMethod };
    assert.throws(() => normalizeStoredSession(session), /起卦方式无效/);
    assert.throws(() => storedCastingMethod(session), /起卦方式无效/);
  }
});
