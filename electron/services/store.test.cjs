const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JsonStore } = require('./store.cjs');

const VALID_CATEGORY = 'career';
const VALID_CAST_AT = '2026-07-12T00:00:00.000Z';
const CASE_HASH = 'a'.repeat(64);
const CHANGED_CASE_HASH = 'd'.repeat(64);
const CORPUS_REF = Object.freeze({ version: 2, hash: 'b'.repeat(64) });
let sharedDomain;

test.before(async () => {
  sharedDomain = await import('../generated/domain/index.js');
});

function bundleStoreOptions(overrides = {}) {
  return {
    normalizeValidatedAnalysisReportV2: sharedDomain.normalizeValidatedAnalysisReportV2,
    normalizeValidatedFollowUpV2: sharedDomain.normalizeValidatedFollowUpV2,
    deriveFollowUpContentV2: sharedDomain.deriveFollowUpContentV2,
    ...overrides,
  };
}

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
    { id: '  padded-id  ', question: '问题', category: VALID_CATEGORY, castAt: VALID_CAST_AT },
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
    factSetHash: CASE_HASH,
    builtAt: '2026-07-12T00:00:01.000Z',
  };
}

function canonicalEvidence(overrides = {}) {
  const text = overrides.text || '经过核验的规则说明。';
  return {
    id: 'evidence:rule-one',
    title: '规则证据',
    source: '测试语料',
    sourceType: 'original',
    location: '第一节',
    text,
    contentHash: crypto.createHash('sha256').update(text, 'utf8').digest('hex'),
    tags: ['规则'],
    knowledgeKind: 'rule',
    topics: ['六爻'],
    supportsRuleIds: ['rule:one'],
    ...overrides,
  };
}

function analysisClaim(section, index, overrides = {}) {
  return {
    id: `claim:${index}`,
    section,
    text: `第 ${index} 条经过校验的结论。`,
    factIds: [`fact:${index}`],
    ruleIds: [],
    evidenceIds: [],
    confidence: 'high',
    ...overrides,
  };
}

function validatedAnalysis(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    claims: [
      analysisClaim('summary', 1, { ruleIds: ['rule:one'], evidenceIds: ['evidence:rule-one'] }),
      analysisClaim('use-god', 2),
      analysisClaim('calendar', 3),
      analysisClaim('moving', 4),
      analysisClaim('synthesis', 5),
      analysisClaim('guidance', 6, { factIds: [], confidence: 'low' }),
    ],
    uncertainties: [],
    validation: {
      status: 'validated',
      factCheckPassed: true,
      citationCheckPassed: true,
      validatedAt: '2026-07-12T08:00:00.000Z',
    },
    ...overrides,
  };
}

function retrievalDiagnostics(overrides = {}) {
  return {
    mode: 'lexical-fallback',
    lexicalCandidates: 1,
    vectorCandidates: 0,
    fusedCandidates: 1,
    vectorUsed: false,
    rerankUsed: false,
    requestedRuleIds: ['rule:one'],
    matchedRuleIds: ['rule:one'],
    ruleCandidateIds: ['evidence:rule-one'],
    ruleBoost: 12,
    warnings: ['本地向量索引尚未构建。'],
    ...overrides,
  };
}

function validAnalysisBundle(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    analysisOrigin: 'local',
    report: validatedAnalysis(),
    canonicalEvidence: [canonicalEvidence()],
    retrievalDiagnostics: retrievalDiagnostics(),
    corpusRef: { ...CORPUS_REF },
    ...overrides,
  };
}

function validFollowUpBundle(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    analysisOrigin: 'cloud',
    followUp: validatedAnalysis({
      claims: [analysisClaim('guidance', 1, { factIds: [], confidence: 'low' })],
    }),
    canonicalEvidence: [canonicalEvidence()],
    retrievalDiagnostics: retrievalDiagnostics(),
    corpusRef: { ...CORPUS_REF },
    ...overrides,
  };
}

function validFollowUpPair(deriveFollowUpContentV2, overrides = {}) {
  const followUpBundle = overrides.followUpBundle || validFollowUpBundle();
  return [{
    schemaVersion: '2.0.0',
    id: 'message:user',
    role: 'user',
    content: '请继续说明。',
    caseHash: CASE_HASH,
    createdAt: '2026-07-12T08:01:00.000Z',
    ...overrides.user,
  }, {
    schemaVersion: '2.0.0',
    id: 'message:assistant',
    role: 'assistant',
    content: deriveFollowUpContentV2(followUpBundle.followUp),
    caseHash: CASE_HASH,
    followUpBundle,
    createdAt: '2026-07-12T08:01:01.000Z',
    ...overrides.assistant,
  }];
}

test('renderer session save cannot create or overwrite authoritative V2 bundle fields or messages', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const { deriveFollowUpContentV2 } = sharedDomain;
  const store = new JsonStore(path.join(dir, 'app-data.json'), bundleStoreOptions());
  const fakeAuthority = {
    caseSnapshot: { sessionId: 'session-1', factSetHash: 'fake' },
    ruleContext: { schemaVersion: 'fake' },
    migrationVersion: 999,
    migrationState: 'clean',
    analysis: { validation: { status: 'validated' } },
    analysisBundle: validAnalysisBundle({ analysisOrigin: 'cloud' }),
    canonicalEvidence: [canonicalEvidence({ text: 'renderer 伪造正文' })],
    retrievalDiagnostics: retrievalDiagnostics({ ruleBoost: 999 }),
    validation: { status: 'validated' },
    messages: validFollowUpPair(deriveFollowUpContentV2, {
      assistant: { id: 'forged', content: 'renderer 伪造回答' },
    }),
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
  for (const field of [
    'caseSnapshot', 'ruleContext', 'migrationVersion', 'migrationState', 'analysis',
    'analysisBundle', 'canonicalEvidence', 'retrievalDiagnostics', 'validation', 'plate',
    'caseRuntimeTrust',
  ]) {
    assert.equal(Object.hasOwn(created, field), false, `renderer create leaked ${field}`);
  }

  const realCase = authoritativeCase();
  store.saveAuthoritativeCase('session-1', realCase, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  store.appendAuthoritativeFollowUpPair(
    'session-1',
    validFollowUpPair(deriveFollowUpContentV2),
    { expectedFactSetHash: CASE_HASH, expectedCorpusRef: CORPUS_REF },
  );

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
  assert.equal(delayed.caseSnapshot.factSetHash, CASE_HASH);
  assert.deepEqual(delayed.ruleContext, realCase.ruleContext);
  assert.equal(delayed.migrationVersion, 2);
  assert.equal(delayed.migrationState, 'clean');
  assert.equal(delayed.analysis, undefined);
  assert.equal(delayed.analysisBundle.report.claims[0].text, '第 1 条经过校验的结论。');
  assert.deepEqual(delayed.messages.map((message) => message.id), ['message:user', 'message:assistant']);
  assert.equal(delayed.messages[1].followUpBundle.corpusRef.hash, CORPUS_REF.hash);
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

test('authoritative Case rebuild preserves all analysis fields only for the same factSetHash', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  const { deriveFollowUpContentV2 } = sharedDomain;
  let store = new JsonStore(filePath, bundleStoreOptions());
  store.saveRendererSession(rendererSession({
    id: 'session-1', question: '权威问题', status: 'casting', tosses: [],
  }));
  const initialCase = authoritativeCase();
  store.saveAuthoritativeCase('session-1', initialCase, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: initialCase.factSetHash,
    expectedCorpusRef: CORPUS_REF,
  });
  store.appendAuthoritativeFollowUpPair(
    'session-1', validFollowUpPair(deriveFollowUpContentV2), {
      expectedFactSetHash: initialCase.factSetHash,
      expectedCorpusRef: CORPUS_REF,
    },
  );

  const persistedWithLegacy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  persistedWithLegacy.sessions[0].analysis = {
    mode: 'local', summary: '旧版隔离分析', generatedAt: '2026-07-12T00:00:02.000Z',
  };
  fs.writeFileSync(filePath, JSON.stringify(persistedWithLegacy), 'utf8');
  store = new JsonStore(filePath, bundleStoreOptions());

  const sameFacts = { ...structuredClone(initialCase), builtAt: '2026-07-12T00:00:04.000Z' };
  const sameSaved = store.saveAuthoritativeCase('session-1', sameFacts, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: initialCase.factSetHash,
    runtimeTrust: 'authoritative',
  });
  assert.equal(sameSaved.analysis.summary, '旧版隔离分析');
  assert.equal(sameSaved.analysisBundle.caseHash, initialCase.factSetHash);
  assert.deepEqual(
    sameSaved.messages.map((message) => message.id),
    ['message:user', 'message:assistant'],
  );

  const changedFacts = { ...structuredClone(sameFacts), factSetHash: CHANGED_CASE_HASH };
  const changedSaved = store.saveAuthoritativeCase('session-1', changedFacts, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    expectedFactSetHash: initialCase.factSetHash,
    runtimeTrust: 'authoritative',
  });
  assert.equal(changedSaved.analysis, undefined);
  assert.equal(changedSaved.analysisBundle, undefined);
  assert.deepEqual(changedSaved.messages, []);
});

test('authoritative analysis bundle validates, deep-clones and commits in one revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  const store = new JsonStore(filePath, bundleStoreOptions());
  store.saveRendererSession(rendererSession({
    id: 'session-1', question: '权威问题', status: 'casting', tosses: [],
  }));
  const caseSnapshot = authoritativeCase();
  const withCase = store.saveAuthoritativeCase('session-1', caseSnapshot, {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  const input = validAnalysisBundle();
  const saved = store.saveAuthoritativeAnalysisBundle('session-1', input, {
    expectedFactSetHash: caseSnapshot.factSetHash,
    expectedCorpusRef: CORPUS_REF,
  });
  assert.equal(saved.authoritativeRevision, withCase.authoritativeRevision + 1);
  assert.equal(saved.analysis, undefined);
  input.report.claims[0].text = '后续篡改';
  input.canonicalEvidence[0].text = '后续伪造正文';
  assert.equal(store.getSession('session-1').analysisBundle.report.claims[0].text, '第 1 条经过校验的结论。');
  assert.equal(store.getSession('session-1').analysisBundle.canonicalEvidence[0].text, '经过核验的规则说明。');

  const reloaded = new JsonStore(filePath).getSession('session-1');
  assert.equal(reloaded.analysisBundle.report.claims[0].evidenceIds[0], 'evidence:rule-one');
  assert.equal(reloaded.analysisBundle.canonicalEvidence[0].supportsRuleIds[0], 'rule:one');
  assert.equal(reloaded.analysisBundle.retrievalDiagnostics.matchedRuleIds[0], 'rule:one');
  assert.equal(reloaded.analysisBundle.corpusRef.hash, CORPUS_REF.hash);
});

test('invalid authoritative analysis bundles are zero-write across the failure matrix', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'), bundleStoreOptions());
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const before = store.getSession('session-1');
  assert.equal(before.analysis, undefined);
  assert.equal(before.analysisBundle.report.validation.status, 'validated');
  const attempts = [
    [{ ...validAnalysisBundle(), schemaVersion: '1.0.0' }, CASE_HASH, CORPUS_REF],
    [{ ...validAnalysisBundle(), caseHash: CHANGED_CASE_HASH }, CASE_HASH, CORPUS_REF],
    [validAnalysisBundle({
      report: validatedAnalysis({ validation: { status: 'legacy-unverified' } }),
    }), CASE_HASH, CORPUS_REF],
    [validAnalysisBundle({ canonicalEvidence: [] }), CASE_HASH, CORPUS_REF],
    [validAnalysisBundle(), CHANGED_CASE_HASH, CORPUS_REF],
    [validAnalysisBundle(), CASE_HASH, { version: 2, hash: 'e'.repeat(64) }],
    [validAnalysisBundle({
      retrievalDiagnostics: retrievalDiagnostics({ injected: true }),
    }), CASE_HASH, CORPUS_REF],
  ];
  for (const [bundle, expectedFactSetHash, expectedCorpusRef] of attempts) {
    assert.throws(() => store.saveAuthoritativeAnalysisBundle('session-1', bundle, {
      expectedFactSetHash,
      expectedCorpusRef,
    }), /Case|bundle|validation|证据|语料|corpus|额外|schemaVersion/);
    assert.deepEqual(store.getSession('session-1'), before);
  }
});

test('authoritative V2 follow-up requires a coherent analysis and appends exactly one atomic pair', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  const { deriveFollowUpContentV2 } = sharedDomain;
  const store = new JsonStore(filePath, bundleStoreOptions());
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  const withCase = store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  const pair = validFollowUpPair(deriveFollowUpContentV2);

  assert.throws(() => store.appendAuthoritativeFollowUpPair('session-1', pair, {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  }), /analysisBundle|分析/);
  assert.deepEqual(store.getSession('session-1').messages, []);
  assert.equal(store.getSession('session-1').authoritativeRevision, withCase.authoritativeRevision);

  const withAnalysis = store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const saved = store.appendAuthoritativeFollowUpPair('session-1', pair, {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  assert.deepEqual(saved.messages.map((message) => message.id), ['message:user', 'message:assistant']);
  assert.equal(saved.authoritativeRevision, withAnalysis.authoritativeRevision + 1);
  pair[0].content = '后续篡改';
  pair[1].followUpBundle.followUp.claims[0].text = '后续篡改';
  assert.equal(store.getSession('session-1').messages[0].content, '请继续说明。');
  assert.equal(store.getSession('session-1').messages[1].followUpBundle.followUp.claims[0].text, '第 1 条经过校验的结论。');

  const reloaded = new JsonStore(filePath, bundleStoreOptions()).getSession('session-1');
  assert.equal(reloaded.messages[1].followUpBundle.canonicalEvidence[0].supportsRuleIds[0], 'rule:one');
  assert.equal(reloaded.messages[1].followUpBundle.retrievalDiagnostics.ruleCandidateIds[0], 'evidence:rule-one');
  assert.equal(reloaded.messages[1].followUpBundle.corpusRef.hash, CORPUS_REF.hash);
});

test('authoritative V2 follow-up failure matrix leaves messages and revision unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const { deriveFollowUpContentV2 } = sharedDomain;
  const store = new JsonStore(path.join(dir, 'app-data.json'), bundleStoreOptions());
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const before = store.getSession('session-1');
  const malformed = validFollowUpPair(deriveFollowUpContentV2);
  malformed[1].content = '模型自由文本';
  const duplicateBatch = validFollowUpPair(deriveFollowUpContentV2, {
    assistant: { id: 'message:user' },
  });
  const wrongBundleCorpus = validFollowUpPair(deriveFollowUpContentV2, {
    followUpBundle: validFollowUpBundle({ corpusRef: { version: 2, hash: 'e'.repeat(64) } }),
  });
  const attempts = [
    [malformed, CASE_HASH, CORPUS_REF],
    [duplicateBatch, CASE_HASH, CORPUS_REF],
    [validFollowUpPair(deriveFollowUpContentV2), CHANGED_CASE_HASH, CORPUS_REF],
    [validFollowUpPair(deriveFollowUpContentV2), CASE_HASH, { version: 2, hash: 'e'.repeat(64) }],
    [wrongBundleCorpus, CASE_HASH, CORPUS_REF],
  ];
  for (const [pair, expectedFactSetHash, expectedCorpusRef] of attempts) {
    assert.throws(() => store.appendAuthoritativeFollowUpPair('session-1', pair, {
      expectedFactSetHash,
      expectedCorpusRef,
    }), /Case|corpus|语料|ID|派生|content/);
    assert.deepEqual(store.getSession('session-1'), before);
  }

  const first = validFollowUpPair(deriveFollowUpContentV2);
  store.appendAuthoritativeFollowUpPair('session-1', first, {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const afterFirst = store.getSession('session-1');
  assert.throws(() => store.appendAuthoritativeFollowUpPair(
    'session-1', validFollowUpPair(deriveFollowUpContentV2), {
      expectedFactSetHash: CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  ), /ID 冲突/);
  assert.deepEqual(store.getSession('session-1'), afterFirst);

  store.deleteSession('session-1');
  assert.throws(() => store.appendAuthoritativeFollowUpPair(
    'session-1', validFollowUpPair(deriveFollowUpContentV2, {
      user: { id: 'after-delete-user' }, assistant: { id: 'after-delete-assistant' },
    }), {
      expectedFactSetHash: CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  ), /会话已删除/);
});

test('new V2 Store writes fail closed when shared domain normalizers are not injected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  const before = store.getSession('session-1');

  assert.throws(() => store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  }), /normalizeValidatedAnalysisReportV2|归一化器|依赖/);
  assert.deepEqual(store.getSession('session-1'), before);
});

test('Store dependency options reject accessors and symbols before reading injected functions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  let getterRead = false;
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, 'deriveFollowUpContentV2', {
    enumerable: true,
    get() {
      getterRead = true;
      return sharedDomain.deriveFollowUpContentV2;
    },
  });
  assert.throws(
    () => new JsonStore(path.join(dir, 'accessor.json'), accessorOptions),
    /访问器|data|options/,
  );
  assert.equal(getterRead, false);

  const symbolOptions = bundleStoreOptions();
  symbolOptions[Symbol('forged')] = true;
  assert.throws(
    () => new JsonStore(path.join(dir, 'symbol.json'), symbolOptions),
    /symbol|额外|options/,
  );
});

test('missing historical messages migrates to an empty list during an atomic V2 append', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  let store = new JsonStore(filePath, bundleStoreOptions());
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  delete persisted.sessions[0].messages;
  fs.writeFileSync(filePath, JSON.stringify(persisted), 'utf8');

  store = new JsonStore(filePath, bundleStoreOptions());
  const saved = store.appendAuthoritativeFollowUpPair(
    'session-1', validFollowUpPair(sharedDomain.deriveFollowUpContentV2), {
      expectedFactSetHash: CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  );
  assert.deepEqual(saved.messages.map(({ id }) => id), ['message:user', 'message:assistant']);
});

test('malformed persisted messages fails closed without changing bytes or revision', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const filePath = path.join(dir, 'app-data.json');
  let store = new JsonStore(filePath, bundleStoreOptions());
  store.saveRendererSession(rendererSession({ id: 'session-1', question: '权威问题', tosses: [] }));
  store.saveAuthoritativeCase('session-1', authoritativeCase(), {
    expectedInteractionFingerprint: store.getInteractionFingerprint('session-1'),
    runtimeTrust: 'authoritative',
  });
  store.saveAuthoritativeAnalysisBundle('session-1', validAnalysisBundle(), {
    expectedFactSetHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  });
  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  persisted.sessions[0].messages = { damaged: true };
  fs.writeFileSync(filePath, JSON.stringify(persisted, null, 2), 'utf8');
  const bytesBefore = fs.readFileSync(filePath);

  store = new JsonStore(filePath, bundleStoreOptions());
  const revisionBefore = store.getSession('session-1').authoritativeRevision;
  assert.throws(() => store.appendAuthoritativeFollowUpPair(
    'session-1', validFollowUpPair(sharedDomain.deriveFollowUpContentV2), {
      expectedFactSetHash: CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  ), /messages|消息.*损坏|数组/);

  assert.deepEqual(fs.readFileSync(filePath), bytesBefore);
  assert.deepEqual(store.getSession('session-1').messages, { damaged: true });
  assert.equal(store.getSession('session-1').authoritativeRevision, revisionBefore);
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
  assert.throws(() => store.saveAuthoritativeAnalysisBundle(
    'session-1', validAnalysisBundle(), {
      expectedFactSetHash: CHANGED_CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  ), /权威 Case 已变化/);
  assert.throws(() => store.appendAuthoritativeFollowUpPair(
    'session-1', [], {
      expectedFactSetHash: CHANGED_CASE_HASH,
      expectedCorpusRef: CORPUS_REF,
    },
  ), /权威 Case 已变化/);
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
