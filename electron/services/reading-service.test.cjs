const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createReadingService } = require('./reading-service.cjs');
const reportV2Facade = require('./report-v2.cjs');
const { JsonStore } = require('./store.cjs');

const FIXED_NOW = '2026-07-12T02:00:00.000Z';
const CORPUS_REF = Object.freeze({ version: 2, hash: 'c'.repeat(64) });
let domain;

test.before(async () => {
  domain = await import('../generated/domain/index.js');
});

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

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

function storeOptions(overrides = {}) {
  return {
    now: () => new Date(FIXED_NOW),
    normalizeValidatedAnalysisReportV2: domain.normalizeValidatedAnalysisReportV2,
    normalizeValidatedFollowUpV2: domain.normalizeValidatedFollowUpV2,
    deriveFollowUpContentV2: domain.deriveFollowUpContentV2,
    ...overrides,
  };
}

function createCompletedStore({ id = 'session-1', category = 'career', question = '事业是否顺利' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-reading-v2-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'), storeOptions());
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

function canonicalEvidence(overrides = {}) {
  const text = overrides.text || '经过核验的事业规则正文。';
  return deepFreeze({
    id: 'evidence:career',
    title: '事业规则',
    source: '测试语料',
    sourceType: 'original',
    location: '第一节',
    text,
    contentHash: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    tags: ['事业'],
    knowledgeKind: 'rule',
    topics: ['事业'],
    supportsRuleIds: ['six-spirit-by-day-stem/v1'],
    ...overrides,
  });
}

function createCatalog(entries = [canonicalEvidence()]) {
  const ownedEntries = entries.map((entry) => deepFreeze(structuredClone(entry)));
  const byId = new Map(ownedEntries.map((entry) => [entry.id, entry]));
  return deepFreeze({
    entries: ownedEntries,
    corpusRef: { ...CORPUS_REF },
    hydrate(candidates, limit = 8) {
      const seen = new Set();
      const ranked = (Array.isArray(candidates) ? candidates : [])
        .map((candidate, index) => ({
          id: typeof candidate === 'string' ? candidate : candidate?.id,
          rank: Number.isSafeInteger(candidate?.rank) ? candidate.rank : index + 1,
        }))
        .filter((candidate) => byId.has(candidate.id) && !seen.has(candidate.id) && seen.add(candidate.id))
        .sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
      return deepFreeze({
        evidence: ranked.slice(0, limit).map(({ id }) => byId.get(id)),
        corpusRef: { ...CORPUS_REF },
      });
    },
  });
}

function diagnostics({ requestedRuleIds = [], candidateCount = 1, overrides = {} } = {}) {
  return {
    mode: 'lexical-fallback',
    lexicalCandidates: candidateCount,
    vectorCandidates: 0,
    fusedCandidates: candidateCount,
    vectorUsed: false,
    rerankUsed: false,
    requestedRuleIds: [...requestedRuleIds],
    matchedRuleIds: [],
    ruleCandidateIds: [],
    ruleBoost: 12,
    warnings: ['测试使用关键词召回。'],
    ...overrides,
  };
}

function harness(store, overrides = {}) {
  const state = { searches: 0, analyzeCalls: 0, followUpCalls: 0, searchInputs: [] };
  const evidenceCatalog = overrides.evidenceCatalog || createCatalog();
  const ports = {
    store,
    domain,
    reportV2: domain,
    evidenceCatalog,
    now: () => new Date(FIXED_NOW),
    createId: (() => {
      let value = 0;
      return () => `service-message-${++value}`;
    })(),
    cloudProviderConfigured: () => false,
    searchCorpus: async (input) => {
      state.searches += 1;
      state.searchInputs.push(structuredClone(input));
      const supported = new Set(evidenceCatalog.entries.flatMap((entry) => entry.supportsRuleIds));
      const matchedRuleIds = input.ruleIds.filter((ruleId) => supported.has(ruleId));
      return {
        candidateRefs: [{ id: 'evidence:career', rank: 1 }],
        evidence: [{ id: 'evidence:career', text: '搜索层伪造正文', supportsRuleIds: ['forged'] }],
        diagnostics: diagnostics({
          requestedRuleIds: input.ruleIds,
          overrides: {
            matchedRuleIds,
            ruleCandidateIds: matchedRuleIds.length ? ['evidence:career'] : [],
          },
        }),
      };
    },
    analyzeCloudV2: async () => {
      state.analyzeCalls += 1;
      throw new Error('不应调用 cloud analyze');
    },
    followUpCloudV2: async () => {
      state.followUpCalls += 1;
      throw new Error('不应调用 cloud follow-up');
    },
    ...overrides,
  };
  delete ports.state;
  return { service: createReadingService(ports), state, evidenceCatalog };
}

async function build(service, sessionId = 'session-1') {
  return service.buildCase({ sessionId });
}

function contractFor(caseSnapshot) {
  return domain.createFactContractV2(caseSnapshot);
}

test('buildCase persists one authoritative Case and concurrent callers serialize per session', async () => {
  const store = createCompletedStore();
  const { service } = harness(store);
  const [first, second] = await Promise.all([
    service.buildCase({ sessionId: 'session-1', facts: [{ id: 'forged' }] }),
    service.buildCase({ sessionId: 'session-1' }),
  ]);
  assert.deepEqual(second, first);
  assert.equal(first.runtimeTrust, 'authoritative');
  assert.equal(first.caseSnapshot.plate.id, 'plate:session-1:v2');
  assert.equal(first.caseSnapshot.facts.some((fact) => fact.id === 'forged'), false);
});

test('buildCase late persistence cannot recreate a deleted session', async () => {
  const store = createCompletedStore({ id: 'deleted-during-build' });
  const gate = deferred();
  const started = deferred();
  const fakeDomain = {
    ...domain,
    async buildDivinationCase(input, hashPort) {
      started.resolve();
      await gate.promise;
      return domain.buildDivinationCase(input, hashPort);
    },
  };
  const { service } = harness(store, { domain: fakeDomain });
  const pending = service.buildCase({ sessionId: 'deleted-during-build' });
  await started.promise;
  store.deleteSession('deleted-during-build');
  gate.resolve();
  await assert.rejects(pending, /会话(?:已删除|不存在)/);
  assert.equal(store.getSession('deleted-during-build'), null);
});

test('needs-review sessions cannot enter the authoritative build route', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-reading-v2-'));
  const filePath = path.join(dir, 'app-data.json');
  fs.writeFileSync(filePath, JSON.stringify({
    migrationVersion: 2,
    sessions: [{
      id: 'review-session', question: '待复核', category: 'other',
      castAt: '2026-07-12T00:00:00.000Z', status: 'complete',
      tosses: [7, 7, 7, 7, 7, 7].map((value, index) => confirmedToss(value, index + 1)),
      messages: [], migrationState: 'needs-review',
    }],
    settings: {},
  }));
  const store = new JsonStore(filePath, storeOptions());
  const { service } = harness(store);
  await assert.rejects(service.buildCase({ sessionId: 'review-session' }), /需要人工复核/);
  assert.equal(store.getSession('review-session').caseSnapshot, undefined);
});

test('selectIntent remains a hash-bound structured delta and clears changed-Case V2 state', async () => {
  const store = createCompletedStore({
    id: 'health-session', category: 'health', question: '替家中长辈看身体情况',
  });
  const { service } = harness(store);
  const initial = await build(service, 'health-session');
  await assert.rejects(service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.other-person' },
    expectedFactSetHash: 'stale',
  }), /权威 Case 已变化/);
  const selected = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.other-person', subjectRelation: '父母' },
    expectedFactSetHash: initial.caseSnapshot.factSetHash,
  });
  assert.equal(selected.caseSnapshot.useGod.intent.id, 'health.other-person');
  assert.equal(selected.caseSnapshot.useGod.intent.subjectRelation, '父母');
  assert.notEqual(selected.caseSnapshot.factSetHash, initial.caseSnapshot.factSetHash);
  assert.equal(store.getSession('health-session').analysisBundle, undefined);
  assert.deepEqual(store.getSession('health-session').messages, []);

  const relationOnly = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { subjectRelation: '子孙' },
    expectedFactSetHash: selected.caseSnapshot.factSetHash,
  });
  assert.equal(relationOnly.caseSnapshot.useGod.intent.id, 'health.other-person');
  assert.equal(relationOnly.caseSnapshot.useGod.intent.subjectRelation, '子孙');

  const switchedIntent = await service.selectIntent({
    sessionId: 'health-session',
    clarification: { explicitIntentId: 'health.self' },
    expectedFactSetHash: relationOnly.caseSnapshot.factSetHash,
  });
  assert.equal(switchedIntent.caseSnapshot.useGod.intent.id, 'health.self');
  assert.equal(switchedIntent.caseSnapshot.useGod.intent.subjectRelation, undefined);
});

test('local analysis uses shared contract/retrieval/validator, hydrates IDs only and caches the complete bundle', async () => {
  const store = createCompletedStore();
  const { service, state } = harness(store);
  const built = await build(service);
  const first = await service.analyze({
    sessionId: 'session-1',
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    facts: [{ id: 'renderer-forged' }],
  });

  assert.deepEqual(Object.keys(first).sort(), ['analysisBundle', 'caseSnapshot', 'runtimeTrust']);
  assert.equal(first.analysisBundle.analysisOrigin, 'local');
  assert.equal(first.analysisBundle.caseHash, built.caseSnapshot.factSetHash);
  assert.equal(first.analysisBundle.report.validation.validatedAt, FIXED_NOW);
  assert.equal(first.analysisBundle.canonicalEvidence[0].text, '经过核验的事业规则正文。');
  assert.equal(first.analysisBundle.canonicalEvidence[0].text.includes('搜索层伪造'), false);
  const retrievalContext = domain.createAnalysisRetrievalContextV2(
    domain.createFactContractV2(built.caseSnapshot).modelContract,
  );
  assert.deepEqual(state.searchInputs[0].domainTerms, retrievalContext.queryTerms);
  assert.deepEqual(state.searchInputs[0].ruleIds, retrievalContext.ruleIds);
  assert.deepEqual(first.analysisBundle.retrievalDiagnostics.requestedRuleIds, state.searchInputs[0].ruleIds);

  const cached = await service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  assert.deepEqual(cached.analysisBundle, first.analysisBundle);
  assert.equal(state.searches, 1, 'cache hit must skip search');
  assert.equal(state.analyzeCalls, 0, 'local path must skip cloud provider');
  assert.equal(Object.isFrozen(cached.analysisBundle), true);
  assert.equal(Object.isFrozen(cached.analysisBundle.canonicalEvidence[0]), true);
});

test('cloud analysis provider receives only model boundary and shares the exact validator clock', async () => {
  const store = createCompletedStore();
  let providerInput;
  let expectedRaw;
  const { service } = harness(store, {
    reportV2: reportV2Facade,
    cloudProviderConfigured: () => true,
    analyzeCloudV2: async (input) => {
      providerInput = input;
      return { raw: expectedRaw, analysisOrigin: 'cloud' };
    },
  });
  const built = await build(service);
  const contract = contractFor(built.caseSnapshot);
  expectedRaw = domain.createLocalRawReportV2(contract, []);
  const result = await service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });

  assert.deepEqual(Object.keys(providerInput).sort(), ['canonicalEvidence', 'modelContract', 'responseSchema']);
  assert.deepEqual(providerInput.modelContract, contract.modelContract);
  assert.equal(Object.hasOwn(providerInput, 'validationContext'), false);
  assert.equal(Object.hasOwn(providerInput, 'caseSnapshot'), false);
  assert.equal(providerInput.canonicalEvidence[0].text, '经过核验的事业规则正文。');
  assert.equal(providerInput.responseSchema, domain.REPORT_V2_SCHEMA);
  assert.equal(result.analysisBundle.analysisOrigin, 'cloud');
  assert.equal(result.analysisBundle.report.validation.validatedAt, FIXED_NOW);
});

test('cache revalidation rejects wrong case/corpus, semantic forgery and same-ID catalog spoof, then rebuilds', async () => {
  const store = createCompletedStore();
  const { service, state } = harness(store);
  const built = await build(service);
  const payload = { sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash };
  const initial = await service.analyze(payload);
  const original = structuredClone(initial.analysisBundle);
  const session = () => store.state.sessions.find((entry) => entry.id === 'session-1');
  const corruptions = [
    (bundle) => { bundle.caseHash = 'd'.repeat(64); },
    (bundle) => { bundle.corpusRef.hash = 'e'.repeat(64); },
    (bundle) => { bundle.retrievalDiagnostics.requestedRuleIds = []; },
    (bundle) => {
      bundle.retrievalDiagnostics.matchedRuleIds = [];
      bundle.retrievalDiagnostics.ruleCandidateIds = [];
    },
    (bundle) => {
      bundle.retrievalDiagnostics.matchedRuleIds = [
        bundle.retrievalDiagnostics.requestedRuleIds.find((ruleId) => (
          ruleId !== 'six-spirit-by-day-stem/v1'
        )),
      ];
      bundle.retrievalDiagnostics.ruleCandidateIds = [];
    },
    (bundle) => {
      const summary = bundle.report.claims.find((claim) => claim.section === 'summary');
      summary.text = '本卦坤为地，变卦坤为地。';
    },
    (bundle) => {
      bundle.canonicalEvidence[0].text = '同 ID 伪造正文。';
      bundle.canonicalEvidence[0].contentHash = crypto.createHash('sha256')
        .update(bundle.canonicalEvidence[0].text, 'utf8').digest('hex');
      bundle.canonicalEvidence[0].supportsRuleIds = ['rule:forged'];
      bundle.canonicalEvidence[0].title = '同 ID 伪造元数据';
      bundle.canonicalEvidence[0].topics = ['伪造主题'];
    },
  ];
  for (const corrupt of corruptions) {
    session().analysisBundle = structuredClone(original);
    corrupt(session().analysisBundle);
    const before = state.searches;
    const rebuilt = await service.analyze(payload);
    assert.equal(state.searches, before + 1);
    assert.deepEqual(rebuilt.analysisBundle, initial.analysisBundle);
  }
});

test('cache hit cannot return a session deleted during its final semantic revalidation', async () => {
  const store = createCompletedStore({ id: 'deleted-cache-hit' });
  const initial = harness(store);
  const built = await build(initial.service, 'deleted-cache-hit');
  await initial.service.analyze({
    sessionId: 'deleted-cache-hit', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });

  const gate = deferred();
  const started = deferred();
  let validations = 0;
  const delayedReportV2 = {
    ...domain,
    async validateAnalysisReportV2(...args) {
      validations += 1;
      if (validations === 2) {
        started.resolve();
        await gate.promise;
      }
      return domain.validateAnalysisReportV2(...args);
    },
  };
  const cached = harness(store, { reportV2: delayedReportV2 });
  const pending = cached.service.analyze({
    sessionId: 'deleted-cache-hit', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  store.deleteSession('deleted-cache-hit');
  gate.resolve();
  await assert.rejects(pending, /会话(?:已删除|不存在)/);
  assert.equal(cached.state.searches, 0);
  assert.equal(store.getSession('deleted-cache-hit'), null);
});

test('analysis search/provider/validator/CAS/delete failures are zero-write', async () => {
  const scenarios = [
    {
      name: 'search',
      overrides: { searchCorpus: async () => { throw new Error('检索失败'); } },
      error: /检索失败/,
    },
    {
      name: 'provider',
      overrides: {
        cloudProviderConfigured: () => true,
        analyzeCloudV2: async () => { throw new Error('模型失败'); },
      },
      error: /模型失败/,
    },
    {
      name: 'stale-diagnostics',
      overrides: {
        searchCorpus: async () => ({
          candidateRefs: [],
          diagnostics: diagnostics({ requestedRuleIds: [], candidateCount: 0 }),
        }),
      },
      error: /diagnostics|ruleIds/i,
    },
    {
      name: 'forged-matched-rules',
      overrides: {
        searchCorpus: async (input) => ({
          candidateRefs: [],
          diagnostics: diagnostics({ requestedRuleIds: input.ruleIds, candidateCount: 0 }),
        }),
      },
      error: /matchedRuleIds|规则证据候选|canonical catalog/,
    },
    {
      name: 'validator',
      overrides: {
        cloudProviderConfigured: () => true,
        analyzeCloudV2: async () => ({ raw: { schemaVersion: '2.0.0' }, analysisOrigin: 'cloud' }),
      },
      error: /校验|字段|caseHash/,
    },
  ];
  for (const scenario of scenarios) {
    const store = createCompletedStore({ id: `failure-${scenario.name}` });
    const { service } = harness(store, scenario.overrides);
    const built = await build(service, `failure-${scenario.name}`);
    await assert.rejects(service.analyze({
      sessionId: `failure-${scenario.name}`, expectedFactSetHash: built.caseSnapshot.factSetHash,
    }), scenario.error);
    assert.equal(store.getSession(`failure-${scenario.name}`).analysisBundle, undefined);
  }

  const deletedStore = createCompletedStore({ id: 'deleted-analysis' });
  const gate = deferred();
  const started = deferred();
  let raw;
  const { service } = harness(deletedStore, {
    cloudProviderConfigured: () => true,
    analyzeCloudV2: async () => { started.resolve(); await gate.promise; return { raw, analysisOrigin: 'cloud' }; },
  });
  const built = await build(service, 'deleted-analysis');
  raw = domain.createLocalRawReportV2(contractFor(built.caseSnapshot), []);
  const pending = service.analyze({
    sessionId: 'deleted-analysis', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  deletedStore.deleteSession('deleted-analysis');
  gate.resolve();
  await assert.rejects(pending, /会话已删除/);
  assert.equal(deletedStore.getSession('deleted-analysis'), null);
});

test('late cloud analysis cannot cross a same-session Case hash replacement', async () => {
  const store = createCompletedStore({ id: 'stale-analysis' });
  const gate = deferred();
  const started = deferred();
  let raw;
  const { service } = harness(store, {
    cloudProviderConfigured: () => true,
    analyzeCloudV2: async () => {
      started.resolve();
      await gate.promise;
      return { raw, analysisOrigin: 'cloud' };
    },
  });
  const built = await build(service, 'stale-analysis');
  raw = domain.createLocalRawReportV2(contractFor(built.caseSnapshot), []);
  const pending = service.analyze({
    sessionId: 'stale-analysis', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  const replacement = structuredClone(built.caseSnapshot);
  replacement.factSetHash = 'd'.repeat(64);
  store.saveAuthoritativeCase('stale-analysis', replacement, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('stale-analysis'),
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    runtimeTrust: 'authoritative',
  });
  gate.resolve();
  await assert.rejects(pending, /权威 Case 已变化/);
  assert.equal(store.getSession('stale-analysis').caseSnapshot.factSetHash, 'd'.repeat(64));
  assert.equal(store.getSession('stale-analysis').analysisBundle, undefined);
});

test('follow-up requires a coherent analysis bundle and persists one derived V2 pair atomically', async () => {
  const store = createCompletedStore();
  let followInput;
  let followRaw;
  const { service } = harness(store, {
    cloudProviderConfigured: () => true,
    analyzeCloudV2: async () => {
      throw new Error('analysis raw not initialized');
    },
    followUpCloudV2: async (input) => {
      followInput = input;
      return { raw: followRaw, analysisOrigin: 'cloud' };
    },
  });
  const built = await build(service);
  await assert.rejects(service.followUp({
    sessionId: 'session-1', question: '先追问', expectedFactSetHash: built.caseSnapshot.factSetHash,
  }), /重新分析|analysisBundle|解卦/);

  const contract = contractFor(built.caseSnapshot);
  const localAnalysisHarness = harness(store);
  await localAnalysisHarness.service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  followRaw = domain.createLocalRawFollowUpV2(contract);
  const result = await service.followUp({
    sessionId: 'session-1', question: '下一步如何？', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });

  assert.deepEqual(Object.keys(followInput).sort(), [
    'analysisReport', 'canonicalEvidence', 'currentV2History', 'modelContract', 'question', 'responseSchema',
  ]);
  assert.equal(followInput.question, '下一步如何？');
  assert.deepEqual(followInput.currentV2History, []);
  assert.equal(followInput.canonicalEvidence[0].text, '经过核验的事业规则正文。');
  assert.equal(result.followUpBundle.analysisOrigin, 'cloud');
  assert.equal(result.messages.length, 2);
  assert.deepEqual(result.messages.map((message) => message.role), ['user', 'assistant']);
  assert.equal(result.messages[0].schemaVersion, '2.0.0');
  assert.equal(result.messages[0].caseHash, built.caseSnapshot.factSetHash);
  assert.equal(
    result.messages[1].content,
    domain.deriveFollowUpContentV2(result.messages[1].followUpBundle.followUp),
  );
  assert.equal(Object.hasOwn(result, 'answer'), false);
  assert.equal(store.getSession('session-1').messages.length, 2);

  const reloaded = new JsonStore(store.filePath, storeOptions()).getSession('session-1');
  assert.deepEqual(reloaded.messages[1].followUpBundle.canonicalEvidence, result.followUpBundle.canonicalEvidence);
  assert.deepEqual(reloaded.messages[1].followUpBundle.retrievalDiagnostics, result.followUpBundle.retrievalDiagnostics);
  assert.equal(reloaded.messages[1].followUpBundle.corpusRef.hash, CORPUS_REF.hash);
});

test('follow-up provider history includes only coherent current-case V2 pairs', async () => {
  const store = createCompletedStore();
  const local = harness(store);
  const built = await build(local.service);
  await local.service.analyze({
    sessionId: 'session-1', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await local.service.followUp({
    sessionId: 'session-1', question: '本地第一问', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });

  const session = store.state.sessions.find((entry) => entry.id === 'session-1');
  session.messages.push(
    { id: 'legacy', role: 'assistant', content: '旧自由文本', createdAt: FIXED_NOW },
    { schemaVersion: '2.0.0', id: 'old-case', role: 'user', content: '旧 Case', caseHash: 'd'.repeat(64), createdAt: FIXED_NOW },
    { schemaVersion: '2.0.0', id: 'orphan', role: 'user', content: '孤立消息', caseHash: built.caseSnapshot.factSetHash, createdAt: FIXED_NOW },
  );
  let history;
  const followRaw = domain.createLocalRawFollowUpV2(contractFor(built.caseSnapshot));
  const cloud = harness(store, {
    cloudProviderConfigured: () => true,
    createId: (() => {
      let value = 100;
      return () => `service-message-${++value}`;
    })(),
    followUpCloudV2: async (input) => {
      history = input.currentV2History;
      return { raw: followRaw, analysisOrigin: 'cloud' };
    },
  });
  await cloud.service.followUp({
    sessionId: 'session-1', question: '第二问', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  assert.deepEqual(history.map((message) => message.content), [
    '本地第一问',
    domain.deriveFollowUpContentV2(session.messages[1].followUpBundle.followUp),
  ]);
});

test('follow-up search/provider/validator/delete failures append neither message', async () => {
  const scenarios = [
    { name: 'search', overrides: { searchCorpus: async () => { throw new Error('追问检索失败'); } }, error: /检索失败/ },
    {
      name: 'provider',
      overrides: { cloudProviderConfigured: () => true, followUpCloudV2: async () => { throw new Error('追问模型失败'); } },
      error: /模型失败/,
    },
    {
      name: 'validator',
      overrides: {
        cloudProviderConfigured: () => true,
        followUpCloudV2: async () => ({ raw: { schemaVersion: '2.0.0' }, analysisOrigin: 'cloud' }),
      },
      error: /校验|字段|caseHash/,
    },
  ];
  for (const scenario of scenarios) {
    const store = createCompletedStore({ id: `follow-${scenario.name}` });
    const local = harness(store);
    const built = await build(local.service, `follow-${scenario.name}`);
    await local.service.analyze({
      sessionId: `follow-${scenario.name}`, expectedFactSetHash: built.caseSnapshot.factSetHash,
    });
    const before = structuredClone(store.getSession(`follow-${scenario.name}`).messages);
    const failing = harness(store, scenario.overrides).service;
    await assert.rejects(failing.followUp({
      sessionId: `follow-${scenario.name}`, question: '失败追问', expectedFactSetHash: built.caseSnapshot.factSetHash,
    }), scenario.error);
    assert.deepEqual(store.getSession(`follow-${scenario.name}`).messages, before);
  }

  const store = createCompletedStore({ id: 'follow-delete' });
  const local = harness(store);
  const built = await build(local.service, 'follow-delete');
  await local.service.analyze({ sessionId: 'follow-delete', expectedFactSetHash: built.caseSnapshot.factSetHash });
  const gate = deferred();
  const started = deferred();
  const raw = domain.createLocalRawFollowUpV2(contractFor(built.caseSnapshot));
  const failing = harness(store, {
    cloudProviderConfigured: () => true,
    followUpCloudV2: async () => { started.resolve(); await gate.promise; return { raw, analysisOrigin: 'cloud' }; },
  }).service;
  const pending = failing.followUp({
    sessionId: 'follow-delete', question: '删除时追问', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  store.deleteSession('follow-delete');
  gate.resolve();
  await assert.rejects(pending, /会话已删除/);
  assert.equal(store.getSession('follow-delete'), null);
});

test('late cloud follow-up cannot append across a Case hash replacement', async () => {
  const store = createCompletedStore({ id: 'stale-follow' });
  const local = harness(store);
  const built = await build(local.service, 'stale-follow');
  await local.service.analyze({
    sessionId: 'stale-follow', expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  const gate = deferred();
  const started = deferred();
  const raw = domain.createLocalRawFollowUpV2(contractFor(built.caseSnapshot));
  const cloud = harness(store, {
    cloudProviderConfigured: () => true,
    followUpCloudV2: async () => {
      started.resolve();
      await gate.promise;
      return { raw, analysisOrigin: 'cloud' };
    },
  });
  const pending = cloud.service.followUp({
    sessionId: 'stale-follow', question: '迟到追问',
    expectedFactSetHash: built.caseSnapshot.factSetHash,
  });
  await started.promise;
  const replacement = structuredClone(built.caseSnapshot);
  replacement.factSetHash = 'd'.repeat(64);
  store.saveAuthoritativeCase('stale-follow', replacement, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('stale-follow'),
    expectedFactSetHash: built.caseSnapshot.factSetHash,
    runtimeTrust: 'authoritative',
  });
  gate.resolve();
  await assert.rejects(pending, /权威 Case 已变化/);
  assert.equal(store.getSession('stale-follow').analysisBundle, undefined);
  assert.deepEqual(store.getSession('stale-follow').messages, []);
});
