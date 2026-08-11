const assert = require('node:assert/strict');
const test = require('node:test');
const {
  deriveTimeBasis,
  normalizeStoredSession,
  storedCastingMethod,
  validateSessionForSave,
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

test('legacy local reports are dropped from normalized sessions without mutating stored input', () => {
  const stored = {
    id: 'legacy-local-report',
    castingMethod: 'digital',
    analysis: {
      mode: 'local',
      markdown: '旧本地基础推演',
      generatedAt: '2026-07-11T04:00:00.000Z',
    },
  };

  const normalized = normalizeStoredSession(stored);

  assert.equal(Object.hasOwn(normalized, 'analysis'), false);
  assert.equal(stored.analysis.mode, 'local');
});

test('explicitly invalid stored casting methods are rejected', () => {
  for (const castingMethod of ['manual', undefined, null]) {
    const session = { id: 'invalid-method', castingMethod };
    assert.throws(() => normalizeStoredSession(session), /起卦方式无效/);
    assert.throws(() => storedCastingMethod(session), /起卦方式无效/);
  }
});

test('time casting evidence is replayable at the 23:00 traditional day boundary', () => {
  const castAt = '2026-08-03T15:00:00.000Z';
  const basis = deriveTimeBasis(castAt);
  const values = [7, 8, 8, 7, 8, 9];
  const session = {
    schemaVersion: 2,
    id: 'time-session',
    question: '时间起卦校验问题',
    category: 'other',
    castingMethod: 'time',
    castingBasis: basis,
    castAt,
    updatedAt: castAt,
    status: 'complete',
    lines: values.map((value, index) => ({
      id: `time-line-${index + 1}`,
      lineIndex: index + 1,
      value,
      recordedAt: castAt,
    })),
    plate: { baseHexagram: { name: '测试卦' } },
    messages: [],
  };

  assert.deepEqual(basis.calendar.numbers, { year: 7, month: 6, day: 22, hour: 1 });
  assert.equal(basis.calendar.traditionalDate, '2026-08-04');
  assert.equal(basis.calendar.timeBranch, '子');
  assert.doesNotThrow(() => validateSessionForSave(session));

  const forged = structuredClone(session);
  forged.castingBasis.movingLine = 1;
  assert.throws(() => validateSessionForSave(forged), /时间起卦依据无法重放/);

  const forgedValue = structuredClone(session);
  forgedValue.lines[0].value = 8;
  assert.throws(() => validateSessionForSave(forgedValue), /时间起卦爻值与推导依据不一致/);
});
