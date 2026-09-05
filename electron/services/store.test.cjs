const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JsonStore } = require('./store.cjs');

const CAST_AT = '2026-07-12T04:00:00.000Z';
const UPDATED_AT = '2026-07-30T12:00:00.000Z';
const VALUES = [6, 7, 8, 9, 7, 8];
const FACES_BY_VALUE = {
  6: ['text', 'text', 'text'],
  7: ['text', 'text', 'reverse'],
  8: ['text', 'reverse', 'reverse'],
  9: ['reverse', 'reverse', 'reverse'],
};

function tossFor(value, lineIndex, { castingMethod = 'digital', confirmed = true } = {}) {
  const toss = {
    id: `toss-${lineIndex}`,
    lineIndex,
    faces: FACES_BY_VALUE[value],
    value,
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 6 || value === 7,
  };
  if (castingMethod === 'digital') toss.visualSeed = `seed-${lineIndex}`;
  if (confirmed) toss.confirmedAt = `2026-07-30T12:00:0${lineIndex}.000Z`;
  return toss;
}

function lineFor(value, lineIndex, { castingMethod = 'digital' } = {}) {
  return {
    id: `line-${lineIndex}`,
    lineIndex,
    value,
    recordedAt: `2026-07-30T12:00:0${lineIndex}.000Z`,
    coin: {
      faces: FACES_BY_VALUE[value],
      ...(castingMethod === 'digital' ? { visualSeed: `seed-${lineIndex}` } : {}),
    },
  };
}

function sessionFixture(overrides = {}) {
  return {
    schemaVersion: 2,
    id: 'session-1',
    question: '项目是否可以顺利推进',
    category: 'career',
    castingMethod: 'digital',
    castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1' },
    castAt: CAST_AT,
    updatedAt: UPDATED_AT,
    status: 'casting',
    lines: [],
    messages: [],
    ...overrides,
  };
}

function physicalSession(overrides = {}) {
  return sessionFixture({
    id: 'physical-session',
    castingMethod: 'physical',
    castingBasis: { kind: 'physical', algorithm: 'three_coin_manual_v1' },
    status: 'complete',
    lines: VALUES.map((value, index) => lineFor(value, index + 1, {
      castingMethod: 'physical',
    })),
    plate: { baseHexagram: { name: '测试卦' } },
    ...overrides,
  });
}

function createStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  return new JsonStore(path.join(dir, 'app-data.json'));
}

test('archive import validates all records before writing and rejects stale conflict previews', () => {
  const store = createStore();
  store.saveSession(sessionFixture());
  const before = fs.readFileSync(store.filePath, 'utf8');
  assert.throws(() => store.importSessions({ sessions: [sessionFixture({ id: 'new' }), sessionFixture({ id: 'bad', category: 'invalid' })], resolutions: {} }));
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before);
  assert.equal(store.getSession('new'), null);
  assert.throws(() => store.importSessions({ sessions: [sessionFixture()], resolutions: { 'session-1': { action: 'replace', expectedUpdatedAt: CAST_AT } } }), /预览后/);
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before);
});

test('archive copy isolates feedback target IDs and preserves review without changing original', () => {
  const store = createStore();
  const original = sessionFixture({ analysis: { mode: 'cloud', analysisId: 'report-1', markdown: '原报告' }, messages: [{ id: 'message-1', role: 'assistant', content: '追问回答' }], review: { status: 'happened', observedAt: '2026-08-30', note: '实际结果', tags: ['项目'], updatedAt: UPDATED_AT } });
  store.saveSession(original);
  store.importSessions({ sessions: [original], resolutions: { 'session-1': { action: 'copy', expectedUpdatedAt: UPDATED_AT, newId: 'copy-1' } } });
  assert.deepEqual(store.getSession('session-1'), original);
  const copy = store.getSession('copy-1');
  assert.notEqual(copy.analysis.analysisId, original.analysis.analysisId);
  assert.notEqual(copy.messages[0].id, original.messages[0].id);
  assert.deepEqual(copy.review, original.review);
});

test('archive write failure rolls back memory and disk including unrelated settings', (t) => {
  const store = createStore();
  store.saveSession(sessionFixture());
  const before = fs.readFileSync(store.filePath, 'utf8');
  const rename = fs.renameSync;
  t.mock.method(fs, 'renameSync', (source, destination) => {
    if (destination === store.filePath) throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
    return rename(source, destination);
  });
  assert.throws(() => store.importSessions({ sessions: [sessionFixture({ id: 'new' })], resolutions: {} }), /disk full/);
  assert.equal(store.getSession('new'), null);
  assert.equal(fs.readFileSync(store.filePath, 'utf8'), before);
  assert.equal(fs.readdirSync(path.dirname(store.filePath)).filter((file) => file.endsWith('.tmp')).length, 0);
});

test('JsonStore persists, orders and deletes valid sessions atomically', () => {
  const store = createStore();
  store.saveSession(sessionFixture({
    id: 'older',
    question: '旧问题',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
  store.saveSession(sessionFixture({
    id: 'newer',
    question: '新问题',
    updatedAt: '2026-02-01T00:00:00.000Z',
  }));

  assert.deepEqual(store.listSessions().map((item) => item.id), ['newer', 'older']);
  assert.equal(store.getSession('older').question, '旧问题');
  store.deleteSession('older');
  assert.equal(store.getSession('older'), null);
  assert.equal(fs.existsSync(`${store.filePath}.tmp`), false);
});

test('JsonStore retries transient Windows failures while replacing app-data atomically', () => {
  const store = createStore();
  const originalRenameSync = fs.renameSync;
  let renameAttempts = 0;
  fs.renameSync = (source, target) => {
    if (target === store.filePath && renameAttempts < 2) {
      renameAttempts += 1;
      const error = new Error('simulated transient file lock');
      error.code = 'EPERM';
      throw error;
    }
    renameAttempts += 1;
    return originalRenameSync(source, target);
  };

  try {
    const state = store.getRawAIState();
    state.consentAcceptedAt = '2026-08-31T00:00:00.000Z';
    store.saveAIState(state);
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(renameAttempts, 3);
  assert.equal(new JsonStore(store.filePath).getRawAIState().consentAcceptedAt, '2026-08-31T00:00:00.000Z');
  assert.deepEqual(fs.readdirSync(path.dirname(store.filePath)).filter((name) => name.endsWith('.tmp')), []);
});

test('JsonStore rejects local substitute reports', () => {
  const store = createStore();
  assert.throws(
    () => store.saveSession(sessionFixture({
      analysis: {
        mode: 'local',
        markdown: '不得保存的本地替代解读',
        generatedAt: UPDATED_AT,
      },
    })),
    /仅允许保存云端 AI 解读/,
  );
});

test('legacy sessions without castingMethod read as digital without rewriting or changing the plate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  const legacySession = sessionFixture({
    id: 'legacy-session',
    plate: {
      baseHexagram: { name: '旧盘' },
      nested: { retained: true },
    },
  });
  delete legacySession.schemaVersion;
  delete legacySession.castingBasis;
  legacySession.tosses = [];
  delete legacySession.lines;
  delete legacySession.castingMethod;
  fs.writeFileSync(filePath, JSON.stringify({
    sessions: [legacySession],
    settings: {},
  }, null, 2));
  const bytesBefore = fs.readFileSync(filePath);

  const store = new JsonStore(filePath);
  const fromGet = store.getSession('legacy-session');
  const fromList = store.listSessions()[0];

  assert.equal(fromGet.castingMethod, 'digital');
  assert.equal(fromList.castingMethod, 'digital');
  assert.deepEqual(fromGet.plate, legacySession.plate);
  assert.deepEqual(fromList.plate, legacySession.plate);
  assert.deepEqual(fs.readFileSync(filePath), bytesBefore);
});

test('castingMethod cannot change for an existing session, including legacy digital sessions', () => {
  const store = createStore();
  store.saveSession(sessionFixture());
  assert.throws(
    () => store.saveSession(physicalSession({ id: 'session-1' })),
    /起卦方式不可更改/,
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  const legacy = sessionFixture({ id: 'legacy-method' });
  delete legacy.schemaVersion;
  delete legacy.castingBasis;
  legacy.tosses = [];
  delete legacy.lines;
  delete legacy.castingMethod;
  fs.writeFileSync(filePath, JSON.stringify({ sessions: [legacy], settings: {} }));
  const legacyStore = new JsonStore(filePath);
  assert.throws(
    () => legacyStore.saveSession(physicalSession({ id: 'legacy-method' })),
    /起卦方式不可更改/,
  );
});

test('digital confirmed and current lines require a non-empty visualSeed', () => {
  const store = createStore();
  const confirmed = lineFor(7, 1);
  delete confirmed.coin.visualSeed;
  assert.throws(
    () => store.saveSession(sessionFixture({ lines: [confirmed] })),
    /六爻记录冲突/,
  );

  const current = tossFor(7, 1, { confirmed: false });
  current.visualSeed = '   ';
  assert.throws(
    () => store.saveSession(sessionFixture({ currentLine: current })),
    /当前投币状态冲突/,
  );

  const valid = store.saveSession(sessionFixture({
    id: 'digital-valid',
    lines: [lineFor(7, 1)],
    currentLine: tossFor(8, 2, { confirmed: false }),
  }));
  assert.equal(valid.lines[0].coin.visualSeed, 'seed-1');
  assert.equal(valid.currentLine.visualSeed, 'seed-2');
});

test('physical casting persists only a complete six-line record with no current toss or visualSeed', () => {
  const store = createStore();
  const saved = store.saveSession(physicalSession({
    analysis: { mode: 'cloud', markdown: '# 已解读', generatedAt: UPDATED_AT },
    messages: [{ id: 'message-1', role: 'user', content: '追问', createdAt: UPDATED_AT }],
  }));

  assert.equal(saved.castingMethod, 'physical');
  assert.equal(saved.status, 'complete');
  assert.equal(saved.lines.length, 6);
  assert.equal(saved.lines.some((line) => Object.hasOwn(line.coin, 'visualSeed')), false);
  assert.deepEqual(saved.plate, { baseHexagram: { name: '测试卦' } });
  assert.deepEqual(saved.analysis, { mode: 'cloud', markdown: '# 已解读', generatedAt: UPDATED_AT });
  assert.equal(saved.messages.length, 1);

  assert.throws(
    () => store.saveSession(physicalSession({
      id: 'physical-partial',
      lines: physicalSession().lines.slice(0, 5),
    })),
    /线下起卦只能保存完整六爻/,
  );
  assert.throws(
    () => store.saveSession(physicalSession({
      id: 'physical-casting',
      status: 'casting',
    })),
    /线下起卦只能保存完整六爻/,
  );
  assert.throws(
    () => store.saveSession(physicalSession({
      id: 'physical-current',
      currentLine: tossFor(7, 7, { castingMethod: 'physical', confirmed: false }),
    })),
    /线下起卦只能保存完整六爻/,
  );

  const seeded = physicalSession({ id: 'physical-seeded' });
  seeded.lines[0].coin.visualSeed = undefined;
  assert.throws(() => store.saveSession(seeded), /六爻记录冲突/);
});

test('line order, faces and value must be self-consistent', () => {
  const store = createStore();

  const wrongOrder = physicalSession({ id: 'wrong-order' });
  wrongOrder.lines[1].lineIndex = 3;
  assert.throws(() => store.saveSession(wrongOrder), /六爻记录冲突/);

  const wrongFaces = physicalSession({ id: 'wrong-faces' });
  wrongFaces.lines[0].coin.faces = ['reverse', 'reverse', 'reverse'];
  assert.throws(() => store.saveSession(wrongFaces), /六爻记录冲突/);

  const wrongValue = physicalSession({ id: 'wrong-value' });
  wrongValue.lines[3].value = 6;
  assert.throws(() => store.saveSession(wrongValue), /六爻记录冲突/);
});

test('JsonStore never exposes an encrypted secret through public AI state', () => {
  const store = createStore();
  const state = store.getRawAIState();
  state.connections = [{
    id: 'provider-a', providerId: 'custom', presetId: null, label: '服务 A', region: '',
    baseUrl: 'https://api.example.com/v1', fields: {}, encryptedApiKey: 'ciphertext',
    capabilities: { generation: { protocol: 'openai-chat', model: 'model-a' } },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }];
  state.activePipeline = { generation: { connectionId: 'provider-a' }, embedding: null, rerank: null };
  store.saveAIState(state);

  const publicState = store.getPublicAIState();
  assert.equal(publicState.connections[0].hasApiKey, true);
  assert.equal(Object.hasOwn(publicState.connections[0], 'encryptedApiKey'), false);
  assert.equal(JSON.stringify(publicState).includes('ciphertext'), false);
});

test('JsonStore defaults to an unconfigured provider-neutral AI state', () => {
  const store = createStore();
  const state = store.getPublicAIState();
  assert.equal(state.schemaVersion, 3);
  assert.deepEqual(state.connections, []);
  assert.equal(state.activePipeline, null);
  assert.equal(state.draft, null);
  assert.deepEqual(state.usage, []);
});
