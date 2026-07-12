const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JsonStore } = require('./store.cjs');

const VALID_CATEGORY = 'career';
const VALID_CAST_AT = '2026-07-12T00:00:00.000Z';

function rendererSession(input = {}) {
  return {
    category: VALID_CATEGORY,
    castAt: VALID_CAST_AT,
    ...input,
  };
}

test('JsonStore persists, orders and deletes sessions atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const times = [
    new Date('2026-01-01T00:00:00.000Z'),
    new Date('2026-02-01T00:00:00.000Z'),
  ];
  const store = new JsonStore(path.join(dir, 'app-data.json'), {
    now: () => times.shift() || new Date('2026-03-01T00:00:00.000Z'),
  });
  store.saveRendererSession(rendererSession({ id: 'older', question: '旧问题', updatedAt: '2026-01-01T00:00:00.000Z' }));
  store.saveRendererSession(rendererSession({ id: 'newer', question: '新问题', updatedAt: '2026-02-01T00:00:00.000Z' }));

  assert.deepEqual(store.listSessions().map((item) => item.id), ['newer', 'older']);
  assert.equal(store.getSession('older').question, '旧问题');
  store.deleteSession('older');
  assert.equal(store.getSession('older'), null);
  assert.equal(fs.existsSync(`${store.filePath}.tmp`), false);
});

test('renderer create normalizes question and rejects invalid immutable identity fields', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  const created = store.saveRendererSession(rendererSession({
    id: 'normalized-identity',
    question: '  事业是否顺利？\n',
    tosses: [],
  }));
  assert.equal(created.question, '事业是否顺利？');

  const invalid = [
    { id: 'empty-question', question: '   ', category: VALID_CATEGORY, castAt: VALID_CAST_AT },
    { id: 'long-question', question: '问'.repeat(501), category: VALID_CATEGORY, castAt: VALID_CAST_AT },
    { id: 'missing-category', question: '问题', castAt: VALID_CAST_AT },
    { id: 'invalid-category', question: '问题', category: 'forged', castAt: VALID_CAST_AT },
    { id: 'missing-cast-at', question: '问题', category: VALID_CATEGORY },
    { id: 'non-exact-cast-at', question: '问题', category: VALID_CATEGORY, castAt: '2026-07-12' },
  ];
  for (const session of invalid) {
    assert.throws(() => store.saveRendererSession(session), /会话数据无效/);
    assert.equal(store.getSession(session.id), null);
  }
});

function authoritativeCase(sessionId = 'session-1') {
  return {
    schemaVersion: '2.0.0',
    sessionId,
    question: '权威问题',
    category: 'career',
    ruleContext: { schemaVersion: '2.0.0', sources: [{ id: 'source-1' }] },
    ruleContextHash: 'rule-context-real',
    plate: { id: `plate:${sessionId}:v2`, sessionId, castAt: '2026-07-12T00:00:00.000Z' },
    useGod: { status: 'resolved' },
    facts: [{ id: 'fact-real' }],
    factSetHash: 'fact-set-real',
    builtAt: '2026-07-12T00:00:01.000Z',
  };
}

test('renderer session save cannot create or overwrite authoritative fields or messages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  const fakeAuthority = {
    caseSnapshot: { sessionId: 'session-1', factSetHash: 'fake' },
    ruleContext: { schemaVersion: 'fake' },
    migrationVersion: 999,
    migrationState: 'clean',
    analysis: { validation: { status: 'validated' } },
    messages: [{ id: 'forged', role: 'assistant', content: '伪造回答' }],
    plate: { baseHexagram: { name: '伪造卦' } },
    caseRuntimeTrust: 'browser-preview',
  };

  const created = store.saveRendererSession({
    id: 'session-1',
    question: '权威问题',
    category: 'career',
    castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    status: 'complete',
    tosses: [],
    currentToss: undefined,
    ...fakeAuthority,
  });
  assert.deepEqual(created.messages, []);
  for (const field of ['caseSnapshot', 'ruleContext', 'migrationVersion', 'migrationState', 'analysis', 'plate', 'caseRuntimeTrust']) {
    assert.equal(Object.hasOwn(created, field), false, `renderer create leaked ${field}`);
  }

  const realCase = authoritativeCase();
  store.saveAuthoritativeCase('session-1', realCase, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysis('session-1', {
    mode: 'local',
    summary: '权威分析',
    generatedAt: '2026-07-12T00:00:02.000Z',
  }, { expectedFactSetHash: 'fact-set-real' });
  store.appendAuthoritativeMessage('session-1', {
    id: 'message-real',
    role: 'assistant',
    content: '权威回答',
    createdAt: '2026-07-12T00:00:03.000Z',
  }, { expectedFactSetHash: 'fact-set-real' });

  const delayed = store.saveRendererSession({
    id: 'session-1',
    question: 'renderer 不能改写的问题',
    category: 'career',
    castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:04.000Z',
    status: 'complete',
    tosses: [],
    ...fakeAuthority,
  });
  assert.equal(delayed.question, '权威问题');
  assert.equal(delayed.caseSnapshot.factSetHash, 'fact-set-real');
  assert.deepEqual(delayed.ruleContext, realCase.ruleContext);
  assert.equal(delayed.migrationVersion, 2);
  assert.equal(delayed.migrationState, 'clean');
  assert.equal(delayed.analysis.summary, '权威分析');
  assert.deepEqual(delayed.messages.map((message) => message.id), ['message-real']);
  assert.equal(Object.hasOwn(delayed, 'plate'), false);
  assert.equal(delayed.caseRuntimeTrust, 'authoritative');
});

test('authoritative case is identity-bound and advances the stored revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveRendererSession(rendererSession({
    id: 'session-1',
    question: '权威问题',
    updatedAt: '2026-07-12T00:00:05.000Z',
  }));

  assert.throws(
    () => store.saveAuthoritativeCase('session-1', authoritativeCase('other-session')),
    /会话身份不一致/,
  );
  assert.throws(
    () => store.saveAuthoritativeCase('session-1', {
      ...authoritativeCase(),
      question: '其他问题',
    }),
    /会话身份不一致/,
  );

  const fingerprint = store.getInteractionFingerprint('session-1');
  const saved = store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: fingerprint,
    runtimeTrust: 'authoritative',
  });
  assert.equal(saved.caseSnapshot.plate.id, 'plate:session-1:v2');
  assert.equal(saved.authoritativeRevision, 1);
  assert.equal(saved.updatedAt >= '2026-07-12T00:00:05.000Z', true);
});

test('authoritative Case rebuild preserves conversation only for the same factSetHash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveRendererSession(rendererSession({
    id: 'session-1', question: '权威问题', status: 'casting', tosses: [],
  }));
  const initialCase = authoritativeCase();
  store.saveAuthoritativeCase('session-1', initialCase, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysis('session-1', {
    mode: 'local', summary: '旧分析', generatedAt: '2026-07-12T00:00:02.000Z',
  }, { expectedFactSetHash: initialCase.factSetHash });
  store.appendAuthoritativeMessage('session-1', {
    id: 'old-user', role: 'user', content: '旧追问', createdAt: '2026-07-12T00:00:03.000Z',
  }, { expectedFactSetHash: initialCase.factSetHash });

  const sameFacts = { ...structuredClone(initialCase), builtAt: '2026-07-12T00:00:04.000Z' };
  const sameSaved = store.saveAuthoritativeCase('session-1', sameFacts, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: initialCase.factSetHash,
    runtimeTrust: 'authoritative',
  });
  assert.equal(sameSaved.analysis.summary, '旧分析');
  assert.deepEqual(sameSaved.messages.map((message) => message.id), ['old-user']);

  const changedFacts = { ...structuredClone(sameFacts), factSetHash: 'fact-set-reselected' };
  const changedSaved = store.saveAuthoritativeCase('session-1', changedFacts, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: initialCase.factSetHash,
    runtimeTrust: 'authoritative',
  });
  assert.equal(changedSaved.analysis, undefined);
  assert.deepEqual(changedSaved.messages, []);
});

test('authoritative follow-up messages validate and commit as one atomic pair', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveRendererSession(rendererSession({
    id: 'session-1', question: '权威问题', status: 'casting', tosses: [],
  }));
  const caseSnapshot = authoritativeCase();
  const withCase = store.saveAuthoritativeCase('session-1', caseSnapshot, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  const user = {
    id: 'pair-user', role: 'user', content: '原子追问', createdAt: '2026-07-12T00:00:03.000Z',
  };
  const invalidAssistant = {
    id: 'pair-assistant', role: 'assistant', content: '', createdAt: '2026-07-12T00:00:04.000Z',
  };
  assert.throws(() => store.appendAuthoritativeMessages('session-1', [user, invalidAssistant], {
    expectedFactSetHash: caseSnapshot.factSetHash,
  }), /权威消息无效/);
  assert.deepEqual(store.getSession('session-1').messages, []);
  assert.equal(store.getSession('session-1').authoritativeRevision, withCase.authoritativeRevision);

  assert.throws(() => store.appendAuthoritativeMessages('session-1', [
    user,
    { ...invalidAssistant, id: user.id, content: '批内重复 ID' },
  ], { expectedFactSetHash: caseSnapshot.factSetHash }), /权威消息 ID 冲突/);
  assert.deepEqual(store.getSession('session-1').messages, []);

  const assistant = { ...invalidAssistant, content: '原子回答' };
  const saved = store.appendAuthoritativeMessages('session-1', [user, assistant], {
    expectedFactSetHash: caseSnapshot.factSetHash,
  });
  assert.deepEqual(saved.messages.map((message) => message.id), ['pair-user', 'pair-assistant']);
  assert.equal(saved.authoritativeRevision, withCase.authoritativeRevision + 1);

  assert.throws(() => store.appendAuthoritativeMessages('session-1', [
    { ...user, id: 'new-user' },
    { ...assistant, id: 'pair-assistant' },
  ], { expectedFactSetHash: caseSnapshot.factSetHash }), /权威消息 ID 冲突/);
  const afterConflict = store.getSession('session-1');
  assert.deepEqual(afterConflict.messages.map((message) => message.id), ['pair-user', 'pair-assistant']);
  assert.equal(afterConflict.authoritativeRevision, saved.authoritativeRevision);
});

function confirmedToss(id, lineIndex, value = 7) {
  const faces = value === 6
    ? ['text', 'text', 'text']
    : value === 7
      ? ['text', 'text', 'reverse']
      : value === 8
        ? ['text', 'reverse', 'reverse']
        : ['reverse', 'reverse', 'reverse'];
  return {
    id,
    lineIndex,
    value,
    visualSeed: `seed-${lineIndex}`,
    confirmedAt: `2026-07-12T00:00:0${lineIndex}.000Z`,
    faces,
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 7 || value === 6,
  };
}

function preparedToss(id, lineIndex, value = 7) {
  const { confirmedAt: _confirmedAt, ...prepared } = confirmedToss(id, lineIndex, value);
  return prepared;
}

test('renderer progress is monotonic, immutable and independent of renderer timestamps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const times = [
    new Date('2026-07-12T01:00:00.000Z'),
    new Date('2026-07-12T01:00:01.000Z'),
    new Date('2026-07-12T01:00:02.000Z'),
  ];
  const store = new JsonStore(path.join(dir, 'app-data.json'), {
    now: () => times.shift() || new Date('2026-07-12T01:00:03.000Z'),
  });
  const base = {
    id: 'session-progress',
    question: '原始问题',
    category: 'career',
    castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
    status: 'casting',
    tosses: [],
    currentToss: preparedToss('pending-1', 1, 7),
  };
  const created = store.saveRendererSession(base);
  assert.equal(created.updatedAt, '2026-07-12T01:00:00.000Z');

  const advanced = store.saveRendererSession({
    ...base,
    question: '篡改问题',
    category: 'wealth',
    castAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '1900-01-01T00:00:00.000Z',
    tosses: [confirmedToss('confirmed-1', 1)],
    currentToss: preparedToss('pending-2', 2, 8),
  });
  assert.equal(advanced.question, '原始问题');
  assert.equal(advanced.category, 'career');
  assert.equal(advanced.castAt, '2026-07-12T00:00:00.000Z');
  assert.equal(advanced.updatedAt, '2026-07-12T01:00:01.000Z');
  assert.deepEqual(advanced.tosses.map((toss) => toss.id), ['confirmed-1']);

  const delayed = store.saveRendererSession(base);
  assert.deepEqual(delayed.tosses.map((toss) => toss.id), ['confirmed-1']);
  assert.equal(delayed.currentToss.id, 'pending-2');
  assert.equal(delayed.updatedAt, '2026-07-12T01:00:01.000Z');

  assert.throws(() => store.saveRendererSession({
    ...advanced,
    tosses: [confirmedToss('confirmed-1', 1, 9)],
  }), /投币历史冲突/);

  const completed = store.saveRendererSession({
    ...advanced,
    status: 'complete',
    tosses: Array.from({ length: 6 }, (_, index) => confirmedToss(`confirmed-${index + 1}`, index + 1)),
    currentToss: undefined,
  });
  assert.equal(completed.status, 'complete');
  assert.equal(store.saveRendererSession(advanced).status, 'complete');
});

test('renderer cannot create an invalid confirmed toss sequence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  assert.throws(() => store.saveRendererSession(rendererSession({
    id: 'invalid-create',
    question: '非法投币',
    status: 'complete',
    tosses: Array.from({ length: 7 }, (_, index) => confirmedToss(`toss-${index + 1}`, index + 1)),
  })), /投币历史冲突/);
});

test('renderer status is derived from confirmed toss count', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  const partial = store.saveRendererSession(rendererSession({
    id: 'derived-status',
    question: '状态不可伪造',
    status: 'complete',
    tosses: [confirmedToss('confirmed-1', 1)],
    currentToss: preparedToss('pending-2', 2),
  }));
  assert.equal(partial.status, 'casting');
  assert.equal(partial.currentToss.id, 'pending-2');

  const empty = store.saveRendererSession(rendererSession({
    id: 'invalid-status', question: '非法状态', status: 'forged', tosses: [],
  }));
  assert.equal(empty.status, 'casting');
});

test('renderer toss faces, value and derived fields must be self-consistent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  const forged = confirmedToss('forged-toss', 1, 7);
  forged.faces = ['reverse', 'reverse', 'reverse'];
  assert.throws(() => store.saveRendererSession(rendererSession({
    id: 'forged-toss-session',
    question: '伪造投币派生字段',
    status: 'casting',
    tosses: [forged],
  })), /投币历史冲突/);
});

test('deleted session IDs are tombstoned and cannot be revived by delayed saves', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  const session = rendererSession({ id: 'deleted-session', question: '删除测试', tosses: [] });
  store.saveRendererSession(session);
  store.deleteSession(session.id);
  assert.throws(() => store.saveRendererSession(session), /会话已删除/);
  assert.equal(store.getSession(session.id), null);
});

test('failed delete commit keeps the session visible and retryable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  let failRename = false;
  const fileSystem = {
    ...fs,
    renameSync(from, to) {
      if (failRename) throw new Error('simulated delete rename failure');
      return fs.renameSync(from, to);
    },
  };
  const store = new JsonStore(filePath, { fileSystem });
  store.saveRendererSession(rendererSession({ id: 'delete-failure', question: '删除失败', tosses: [] }));
  failRename = true;
  assert.throws(() => store.deleteSession('delete-failure'), /simulated delete rename failure/);
  assert.equal(store.getSession('delete-failure').question, '删除失败');
  assert.deepEqual(store.listSessions().map((session) => session.id), ['delete-failure']);

  failRename = false;
  assert.equal(store.deleteSession('delete-failure'), true);
  assert.equal(store.getSession('delete-failure'), null);
});

test('authoritative writes enforce interaction and Case compare-and-swap guards', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveRendererSession(rendererSession({ id: 'session-1', question: 'CAS', status: 'casting', tosses: [] }));
  const staleInteraction = store.getInteractionFingerprint('session-1');
  store.saveRendererSession(rendererSession({
    id: 'session-1',
    question: 'CAS',
    status: 'casting',
    tosses: [confirmedToss('confirmed-1', 1)],
  }));
  const casCase = { ...authoritativeCase(), question: 'CAS' };
  assert.throws(() => store.saveAuthoritativeCase('session-1', casCase, {
    expectedInteractionFingerprint: staleInteraction,
    runtimeTrust: 'authoritative',
  }), /会话交互状态已变化/);

  const saved = store.saveAuthoritativeCase('session-1', casCase, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  assert.equal(saved.caseRuntimeTrust, 'authoritative');
  assert.throws(() => store.saveAuthoritativeAnalysis('session-1', {
    summary: '迟到分析',
    generatedAt: '2026-07-12T00:00:03.000Z',
  }, { expectedFactSetHash: 'stale-hash' }), /权威 Case 已变化/);
  assert.throws(() => store.appendAuthoritativeMessage('session-1', {
    id: 'stale-message', role: 'assistant', content: '迟到回答', createdAt: '2026-07-12T00:00:04.000Z',
  }, { expectedFactSetHash: 'stale-hash' }), /权威 Case 已变化/);
});

test('corrupt JSON is a startup error instead of an empty-store fallback', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  fs.writeFileSync(filePath, '{ definitely-not-json', 'utf8');
  assert.throws(() => new JsonStore(filePath), /数据文件损坏/);
  assert.equal(fs.readdirSync(dir).some((name) => name.includes('.corrupt-')), false);
});

test('Store writes preserve migrated top-level fields and encrypted settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  fs.writeFileSync(filePath, JSON.stringify({
    migrationVersion: 2,
    sessions: [],
    settings: { encryptedApiKey: 'ciphertext' },
    customTopLevel: { preserve: true },
  }));
  const store = new JsonStore(filePath);
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '保留顶层字段' }));
  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(persisted.customTopLevel, { preserve: true });
  assert.equal(persisted.settings.encryptedApiKey, 'ciphertext');
});

test('JsonStore never exposes an encrypted secret through public settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveSettings({ baseUrl: 'https://api.example.com/v1', model: 'model-a', embeddingModel: 'embed-a', rerankModel: 'rank-a', rerankUrl: 'https://rank.example/reranks', encryptedApiKey: 'ciphertext' });
  assert.deepEqual(store.getPublicSettings(), {
    baseUrl: 'https://api.example.com/v1',
    model: 'model-a',
    embeddingModel: 'embed-a',
    rerankModel: 'rank-a',
    rerankUrl: 'https://rank.example/reranks',
    hasApiKey: true,
  });
});

test('JsonStore defaults to the Alibaba high-quality model stack', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  assert.deepEqual(store.getPublicSettings(), {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.7-plus',
    embeddingModel: 'text-embedding-v4',
    rerankModel: 'qwen3-rerank',
    rerankUrl: '',
    hasApiKey: false,
  });
});
