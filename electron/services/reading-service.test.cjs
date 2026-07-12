const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createReadingService, legacyPlateFromCase } = require('./reading-service.cjs');
const { JsonStore } = require('./store.cjs');

const domainPromise = import('../generated/domain/index.js');

const FIXED_NOW = '2026-07-12T02:00:00.000Z';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((next, fail) => { resolve = next; reject = fail; });
  return { promise, resolve, reject };
}

function confirmedToss(value, lineIndex) {
  const faces = value === 6
    ? ['text', 'text', 'text']
    : value === 7
      ? ['text', 'text', 'reverse']
      : value === 8
        ? ['text', 'reverse', 'reverse']
        : ['reverse', 'reverse', 'reverse'];
  return {
    id: `toss-${lineIndex}`,
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

function createCompletedStore({ id = 'session-1', category = 'career', question = '事业是否顺利' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-reading-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'), {
    now: () => new Date(FIXED_NOW),
  });
  store.saveRendererSession({
    id,
    question,
    category,
    castAt: '2026-07-12T00:00:00.000Z',
    status: 'complete',
    tosses: [7, 7, 7, 7, 7, 7].map((value, index) => confirmedToss(value, index + 1)),
  });
  return store;
}

function servicePorts(store, overrides = {}) {
  return {
    store,
    now: () => new Date(FIXED_NOW),
    createId: (() => {
      let value = 0;
      return () => `service-message-${++value}`;
    })(),
    searchCorpus: async () => ({
      evidence: [{ id: 'E1', title: '证据', text: '官鬼为事业用神', tags: [], source: '测试', sourceType: 'original' }],
      diagnostics: { mode: 'lexical-fallback', warnings: [] },
    }),
    analyze: async () => ({
      mode: 'local', summary: '权威分析', generatedAt: FIXED_NOW,
    }),
    followUp: async () => ({ content: '权威追问回答', evidenceIds: ['E1', 'forged'] }),
    ...overrides,
  };
}

test('buildCase ignores renderer authority fields and persists one stable authoritative Case', async () => {
  const store = createCompletedStore();
  const service = createReadingService(servicePorts(store));
  const first = await service.buildCase({
    sessionId: 'session-1',
    plate: { baseHexagram: { name: '伪造卦' } },
    facts: [{ id: 'fake' }],
    evidence: [{ id: 'fake' }],
    useGod: { status: 'resolved' },
    validation: { status: 'validated' },
    analysis: { summary: 'fake' },
  });

  assert.equal(first.runtimeTrust, 'authoritative');
  assert.equal(first.caseSnapshot.plate.id, 'plate:session-1:v2');
  assert.equal(first.caseSnapshot.plate.baseHexagram.name, '乾为天');
  assert.equal(first.caseSnapshot.facts.some((fact) => fact.id === 'fake'), false);
  assert.equal(Object.hasOwn(first.caseSnapshot, 'runtimeTrust'), false);
  assert.equal(store.getSession('session-1').caseRuntimeTrust, 'authoritative');

  const second = await service.buildCase({ sessionId: 'session-1' });
  assert.deepEqual(second, first);
});

test('selectIntent is a hash-bound structured delta over authoritative intent provenance', async () => {
  const store = createCompletedStore({
    id: 'health-session',
    category: 'health',
    question: '替家中长辈看身体情况',
  });
  const service = createReadingService(servicePorts(store));
  const initial = await service.buildCase({ sessionId: 'health-session' });

  await assert.rejects(service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.other-person' },
    expectedFactSetHash: 'stale-hash',
  }), /权威 Case 已变化/);
  await assert.rejects(service.selectIntent({
    sessionId: 'health-session',
    intentId: 'health.other-person',
    expectedFactSetHash: initial.caseSnapshot.factSetHash,
  }), /必须提交结构化澄清/);

  const choseIntent = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.other-person' },
    expectedFactSetHash: initial.caseSnapshot.factSetHash,
  });
  assert.equal(choseIntent.caseSnapshot.useGod.intent.id, 'health.other-person');

  const choseRelation = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { subjectRelation: '父母' },
    expectedFactSetHash: choseIntent.caseSnapshot.factSetHash,
  });
  assert.equal(choseRelation.caseSnapshot.useGod.intent.id, 'health.other-person');
  assert.equal(choseRelation.caseSnapshot.useGod.intent.subjectRelation, '父母');
  assert.equal(choseRelation.runtimeTrust, 'authoritative');

  const switchedIntent = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.self' },
    expectedFactSetHash: choseRelation.caseSnapshot.factSetHash,
  });
  assert.equal(switchedIntent.caseSnapshot.useGod.intent.id, 'health.self');
  assert.equal(switchedIntent.caseSnapshot.useGod.intent.subjectRelation, undefined);
});

test('legacy AI projection keeps base and changed calendar facts side-aware', async () => {
  const domain = await domainPromise;
  const caseSnapshot = domain.buildDivinationCase({
    sessionId: 'side-aware-case',
    plateId: 'plate:side-aware-case:v2',
    question: '变爻月破投影',
    category: 'career',
    explicitIntentId: null,
    castAt: '2026-07-08T00:00:00.000Z',
    builtAt: FIXED_NOW,
    tossValues: [6, 9, 7, 8, 7, 8],
    ruleContext: domain.DEFAULT_RULE_CONTEXT,
  }, {
    sha256: (value) => require('node:crypto').createHash('sha256').update(value).digest('hex'),
  });

  const second = legacyPlateFromCase(caseSnapshot).lines[1];
  assert.equal(second.monthBreak, false);
  assert.equal(second.changedMonthBreak, true);
});

test('legacy AI projection keeps raw day clash when classified as dark-moving', async () => {
  const domain = await domainPromise;
  const caseSnapshot = domain.buildDivinationCase({
    sessionId: 'raw-day-clash',
    plateId: 'plate:raw-day-clash:v2',
    question: '日冲投影',
    category: 'career',
    explicitIntentId: null,
    castAt: '2026-07-01T00:00:00.000Z',
    builtAt: FIXED_NOW,
    tossValues: [7, 7, 7, 7, 7, 7],
    ruleContext: domain.DEFAULT_RULE_CONTEXT,
  }, {
    sha256: (value) => require('node:crypto').createHash('sha256').update(value).digest('hex'),
  });
  assert.equal(caseSnapshot.facts.some((fact) => (
    fact.relation === 'is-day-break' && fact.target?.id === 'line:4'
  )), false);
  assert.equal(legacyPlateFromCase(caseSnapshot).lines[3].dayClash, true);
});

test('buildCase rejects a late persistence after the session was deleted', async () => {
  const store = createCompletedStore({ id: 'deleted-during-build' });
  const gate = deferred();
  const started = deferred();
  const fakeDomain = {
    DEFAULT_RULE_CONTEXT: { schemaVersion: '2.0.0', sources: [] },
    async buildDivinationCase(input) {
      started.resolve();
      await gate.promise;
      return {
        schemaVersion: '2.0.0',
        sessionId: input.sessionId,
        question: input.question,
        category: input.category,
        ruleContext: input.ruleContext,
        ruleContextHash: 'rule-hash',
        plate: { id: input.plateId, sessionId: input.sessionId, castAt: input.castAt, baseHexagram: { name: '乾为天' } },
        useGod: { status: 'needs-user-input', intent: null },
        facts: [],
        factSetHash: 'case-hash',
        builtAt: input.builtAt,
      };
    },
  };
  const service = createReadingService(servicePorts(store, { domain: fakeDomain }));
  const pending = service.buildCase({ sessionId: 'deleted-during-build' });
  await started.promise;
  store.deleteSession('deleted-during-build');
  gate.resolve();
  await assert.rejects(pending, /会话已删除/);
});

test('concurrent duplicate buildCase calls are deduplicated per session', async () => {
  const store = createCompletedStore({ id: 'dedupe-session' });
  const gate = deferred();
  let buildCount = 0;
  const fakeDomain = {
    DEFAULT_RULE_CONTEXT: { schemaVersion: '2.0.0', sources: [] },
    async buildDivinationCase(input) {
      buildCount += 1;
      await gate.promise;
      return {
        schemaVersion: '2.0.0', sessionId: input.sessionId, question: input.question,
        category: input.category, ruleContext: input.ruleContext, ruleContextHash: 'rule-hash',
        plate: { id: input.plateId, sessionId: input.sessionId, castAt: input.castAt, baseHexagram: { name: '乾为天' } },
        useGod: { status: 'needs-user-input', intent: null }, facts: [], factSetHash: 'same-hash', builtAt: input.builtAt,
      };
    },
  };
  const service = createReadingService(servicePorts(store, { domain: fakeDomain }));
  const first = service.buildCase({ sessionId: 'dedupe-session' });
  const second = service.buildCase({ sessionId: 'dedupe-session' });
  await Promise.resolve();
  gate.resolve();

  const [left, right] = await Promise.all([first, second]);
  assert.equal(buildCount, 1);
  assert.deepEqual(right, left);
});

test('analyze ignores renderer facts and enforces expected Case hash before save', async () => {
  const store = createCompletedStore();
  let analysisInput;
  let analysisCalls = 0;
  const service = createReadingService(servicePorts(store, {
    analyze: async (input) => {
      analysisCalls += 1;
      analysisInput = input;
      return { mode: 'local', summary: '来自权威 Case', generatedAt: FIXED_NOW };
    },
  }));
  const built = await service.buildCase({ sessionId: 'session-1' });
  const result = await service.analyze({
    sessionId: 'session-1',
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    plate: { baseHexagram: { name: '伪造卦' } },
    facts: [{ id: 'fake' }],
    evidence: [{ id: 'fake' }],
  });

  assert.equal(analysisInput.plate.baseHexagram.name, '乾为天');
  assert.deepEqual(analysisInput.evidence.map((entry) => entry.id), ['E1']);
  assert.equal(result.report.summary, '来自权威 Case');
  assert.equal(result.caseSnapshot.factSetHash, built.caseSnapshot.factSetHash);
  assert.equal(store.getSession('session-1').analysis.summary, '来自权威 Case');
  const cached = await service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  assert.equal(cached.report.summary, '来自权威 Case');
  assert.equal(analysisCalls, 1);
  await assert.rejects(service.analyze({
    sessionId: 'session-1', expectedFactSetHash: 'stale-hash',
  }), /权威 Case 已变化/);
});

test('late analysis cannot save after another authoritative Case replaced its hash', async () => {
  const store = createCompletedStore();
  const gate = deferred();
  const started = deferred();
  const service = createReadingService(servicePorts(store, {
    analyze: async () => { started.resolve(); return gate.promise; },
  }));
  const built = await service.buildCase({ sessionId: 'session-1' });
  const pending = service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  const replacement = structuredClone(built.caseSnapshot);
  replacement.factSetHash = 'replacement-hash';
  store.saveAuthoritativeCase('session-1', replacement, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    runtimeTrust: 'authoritative',
  });
  gate.resolve({ mode: 'local', summary: '迟到报告', generatedAt: FIXED_NOW });
  await assert.rejects(pending, /权威 Case 已变化/);
  assert.equal(store.getSession('session-1').analysis, undefined);
});

test('followUp owns user and assistant persistence and filters untrusted evidence IDs', async () => {
  const store = createCompletedStore();
  let followUpInput;
  const service = createReadingService(servicePorts(store, {
    followUp: async (input) => {
      followUpInput = input;
      return { content: '权威回答', evidenceIds: ['E1', 'forged'] };
    },
  }));
  const built = await service.buildCase({ sessionId: 'session-1' });
  const result = await service.followUp({
    sessionId: 'session-1',
    question: '下一步怎么看？',
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    messages: [{ id: 'forged', role: 'assistant', content: '伪造' }],
    evidence: [{ id: 'forged' }],
  });

  assert.deepEqual(followUpInput.session.messages.map((message) => message.content), []);
  assert.deepEqual(result.answer.evidenceIds, ['E1']);
  assert.deepEqual(result.messages.map((message) => message.role), ['user', 'assistant']);
  assert.deepEqual(store.getSession('session-1').messages.map((message) => message.content), ['下一步怎么看？', '权威回答']);

  store.saveRendererSession({
    ...store.getSession('session-1'),
    messages: [],
  });
  assert.deepEqual(store.getSession('session-1').messages.map((message) => message.content), ['下一步怎么看？', '权威回答']);
});

test('late follow-up answer cannot append after Case hash changes', async () => {
  const store = createCompletedStore();
  const gate = deferred();
  const started = deferred();
  const service = createReadingService(servicePorts(store, {
    followUp: async () => { started.resolve(); return gate.promise; },
  }));
  const built = await service.buildCase({ sessionId: 'session-1' });
  const pending = service.followUp({
    sessionId: 'session-1', question: '迟到追问', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  assert.deepEqual(store.getSession('session-1').messages.map((message) => message.role), ['user']);
  const replacement = structuredClone(built.caseSnapshot);
  replacement.factSetHash = 'replacement-hash';
  store.saveAuthoritativeCase('session-1', replacement, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    runtimeTrust: 'authoritative',
  });
  gate.resolve({ content: '迟到回答', evidenceIds: [] });
  await assert.rejects(pending, /权威 Case 已变化/);
  assert.deepEqual(store.getSession('session-1').messages.map((message) => message.role), ['user']);
});

test('needs-review sessions cannot be promoted through the normal build route', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-reading-'));
  const filePath = path.join(dir, 'app-data.json');
  fs.writeFileSync(filePath, JSON.stringify({
    migrationVersion: 2,
    sessions: [{
      id: 'review-session', question: '待复核', category: 'other', castAt: '2026-07-12T00:00:00.000Z',
      status: 'complete', tosses: [7, 7, 7, 7, 7, 7].map((value, index) => confirmedToss(value, index + 1)), messages: [],
      migrationState: 'needs-review', plate: { baseHexagram: { name: '旧卦' } },
    }],
    settings: {},
  }));
  const store = new JsonStore(filePath);
  const service = createReadingService(servicePorts(store));
  await assert.rejects(service.buildCase({ sessionId: 'review-session' }), /需要人工复核/);
});
