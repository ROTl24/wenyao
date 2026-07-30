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

function sessionFixture(overrides = {}) {
  return {
    id: 'session-1',
    question: '项目是否可以顺利推进',
    category: 'career',
    castingMethod: 'digital',
    castAt: CAST_AT,
    updatedAt: UPDATED_AT,
    status: 'casting',
    tosses: [],
    messages: [],
    ...overrides,
  };
}

function physicalSession(overrides = {}) {
  return sessionFixture({
    id: 'physical-session',
    castingMethod: 'physical',
    status: 'complete',
    tosses: VALUES.map((value, index) => tossFor(value, index + 1, {
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
  delete legacy.castingMethod;
  fs.writeFileSync(filePath, JSON.stringify({ sessions: [legacy], settings: {} }));
  const legacyStore = new JsonStore(filePath);
  assert.throws(
    () => legacyStore.saveSession(physicalSession({ id: 'legacy-method' })),
    /起卦方式不可更改/,
  );
});

test('digital confirmed and current tosses require a non-empty visualSeed', () => {
  const store = createStore();
  const confirmed = tossFor(7, 1);
  delete confirmed.visualSeed;
  assert.throws(
    () => store.saveSession(sessionFixture({ tosses: [confirmed] })),
    /投币历史冲突/,
  );

  const current = tossFor(7, 1, { confirmed: false });
  current.visualSeed = '   ';
  assert.throws(
    () => store.saveSession(sessionFixture({ currentToss: current })),
    /当前投币状态冲突/,
  );

  const valid = store.saveSession(sessionFixture({
    id: 'digital-valid',
    tosses: [tossFor(7, 1)],
    currentToss: tossFor(8, 2, { confirmed: false }),
  }));
  assert.equal(valid.tosses[0].visualSeed, 'seed-1');
  assert.equal(valid.currentToss.visualSeed, 'seed-2');
});

test('physical casting persists only a complete six-line record with no current toss or visualSeed', () => {
  const store = createStore();
  const saved = store.saveSession(physicalSession({
    analysis: { markdown: '# 已解读' },
    messages: [{ id: 'message-1', role: 'user', content: '追问', createdAt: UPDATED_AT }],
  }));

  assert.equal(saved.castingMethod, 'physical');
  assert.equal(saved.status, 'complete');
  assert.equal(saved.tosses.length, 6);
  assert.equal(saved.tosses.some((toss) => Object.hasOwn(toss, 'visualSeed')), false);
  assert.deepEqual(saved.plate, { baseHexagram: { name: '测试卦' } });
  assert.deepEqual(saved.analysis, { markdown: '# 已解读' });
  assert.equal(saved.messages.length, 1);

  assert.throws(
    () => store.saveSession(physicalSession({
      id: 'physical-partial',
      tosses: physicalSession().tosses.slice(0, 5),
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
      currentToss: tossFor(7, 7, { castingMethod: 'physical', confirmed: false }),
    })),
    /线下起卦只能保存完整六爻/,
  );

  const seeded = physicalSession({ id: 'physical-seeded' });
  seeded.tosses[0].visualSeed = undefined;
  assert.throws(() => store.saveSession(seeded), /投币历史冲突/);
});

test('toss order, faces, value and derived fields must be self-consistent', () => {
  const store = createStore();

  const wrongOrder = physicalSession({ id: 'wrong-order' });
  wrongOrder.tosses[1].lineIndex = 3;
  assert.throws(() => store.saveSession(wrongOrder), /投币历史冲突/);

  const wrongFaces = physicalSession({ id: 'wrong-faces' });
  wrongFaces.tosses[0].faces = ['reverse', 'reverse', 'reverse'];
  assert.throws(() => store.saveSession(wrongFaces), /投币历史冲突/);

  const wrongDerived = physicalSession({ id: 'wrong-derived' });
  wrongDerived.tosses[3].changedYang = true;
  assert.throws(() => store.saveSession(wrongDerived), /投币历史冲突/);
});

test('JsonStore never exposes an encrypted secret through public settings', () => {
  const store = createStore();
  store.saveSettings({ alibabaBaseUrl: 'https://api.example.com/v1', alibabaModel: 'model-a', embeddingModel: 'embed-a', embeddingDimensions: 1024, rerankModel: 'rank-a', rerankUrl: '', deepseekBaseUrl: 'https://api.deepseek.com', deepseekModel: 'deepseek-v4-pro', encryptedAlibabaApiKey: 'ciphertext', encryptedDeepSeekApiKey: 'ciphertext-2' });
  assert.deepEqual(store.getPublicSettings(), {
    alibabaBaseUrl: 'https://api.example.com/v1',
    alibabaModel: 'model-a',
    embeddingModel: 'embed-a',
    embeddingDimensions: 1024,
    rerankModel: 'rank-a',
    rerankUrl: '',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-pro',
    hasAlibabaApiKey: true,
    hasDeepSeekApiKey: true,
  });
});

test('JsonStore defaults to the Alibaba retrieval and DeepSeek analysis stacks', () => {
  const store = createStore();
  assert.deepEqual(store.getPublicSettings(), {
    alibabaBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    alibabaModel: 'qwen3.7-plus',
    embeddingModel: 'text-embedding-v4',
    embeddingDimensions: 1024,
    rerankModel: 'qwen3-rerank',
    rerankUrl: '',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-v4-pro',
    hasAlibabaApiKey: false,
    hasDeepSeekApiKey: false,
  });
});
