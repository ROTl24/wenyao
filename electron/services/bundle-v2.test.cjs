const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const CASE_HASH = 'a'.repeat(64);
const CORPUS_REF = Object.freeze({ version: 2, hash: 'b'.repeat(64) });
const VALIDATED_AT = '2026-07-12T08:00:00.000Z';
let sharedDomain;

test.before(async () => {
  sharedDomain = await import('../generated/domain/index.js');
});

function analysisOptions(overrides = {}) {
  return {
    expectedCaseHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
    normalizeValidatedAnalysisReportV2: sharedDomain.normalizeValidatedAnalysisReportV2,
    ...overrides,
  };
}

function followUpOptions(overrides = {}) {
  return {
    expectedCaseHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
    normalizeValidatedFollowUpV2: sharedDomain.normalizeValidatedFollowUpV2,
    ...overrides,
  };
}

function pairOptions(overrides = {}) {
  return {
    ...followUpOptions(),
    deriveFollowUpContentV2: sharedDomain.deriveFollowUpContentV2,
    ...overrides,
  };
}

function isDeeplyFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Reflect.ownKeys(value).every((key) => isDeeplyFrozen(value[key], seen));
}

function evidence(overrides = {}) {
  const entry = {
    id: 'evidence:rule-one',
    title: '规则一',
    source: '测试语料',
    sourceType: 'original',
    location: '第一节',
    text: '经过核验的规则说明。',
    tags: ['规则'],
    knowledgeKind: 'rule',
    topics: ['六爻'],
    supportsRuleIds: ['rule:one'],
    ...overrides,
  };
  return {
    ...entry,
    contentHash: Object.hasOwn(overrides, 'contentHash')
      ? overrides.contentHash
      : crypto.createHash('sha256').update(entry.text, 'utf8').digest('hex'),
  };
}

function claim(section, index, overrides = {}) {
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

function validatedReport(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    claims: [
      claim('summary', 1, {
        ruleIds: ['rule:one'], evidenceIds: ['evidence:rule-one'],
      }),
      claim('use-god', 2),
      claim('calendar', 3),
      claim('moving', 4),
      claim('synthesis', 5),
      claim('guidance', 6, { factIds: [], confidence: 'low' }),
    ],
    uncertainties: [],
    validation: {
      status: 'validated',
      factCheckPassed: true,
      citationCheckPassed: true,
      validatedAt: VALIDATED_AT,
    },
    ...overrides,
  };
}

function diagnostics(overrides = {}) {
  return {
    mode: 'lexical-fallback',
    lexicalCandidates: 3,
    vectorCandidates: 0,
    fusedCandidates: 3,
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

function analysisBundle(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    analysisOrigin: 'local',
    report: validatedReport(),
    canonicalEvidence: [evidence()],
    retrievalDiagnostics: diagnostics(),
    corpusRef: { ...CORPUS_REF },
    ...overrides,
  };
}

function followUpBundle(overrides = {}) {
  return {
    schemaVersion: '2.0.0',
    caseHash: CASE_HASH,
    analysisOrigin: 'cloud',
    followUp: validatedReport({
      claims: [claim('guidance', 1, { factIds: [], confidence: 'low' })],
    }),
    canonicalEvidence: [evidence()],
    retrievalDiagnostics: diagnostics(),
    corpusRef: { ...CORPUS_REF },
    ...overrides,
  };
}

test('analysis bundle validator accepts only one coherent exact V2 snapshot', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const input = analysisBundle();
  const validated = assertValidatedAnalysisBundleV2(input, analysisOptions());
  input.report.claims[0].text = '后续篡改';
  input.canonicalEvidence[0].text = '后续伪造正文';

  assert.equal(validated.report.claims[0].text, '第 1 条经过校验的结论。');
  assert.equal(validated.canonicalEvidence[0].text, '经过核验的规则说明。');
  assert.notEqual(validated, input);
  assert.equal(isDeeplyFrozen(validated), true);
  assert.equal(Reflect.set(validated.report.claims[0], 'text', '校验后篡改'), false);
  assert.equal(Reflect.set(validated.canonicalEvidence[0], 'text', '校验后伪造正文'), false);
});

test('analysis bundle validator fails closed for partial, extra, wrong hash/schema or unvalidated reports', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const validate = (value) => assertValidatedAnalysisBundleV2(value, analysisOptions());
  const partial = analysisBundle();
  delete partial.report;
  assert.throws(() => validate(partial), /缺少|report/);
  assert.throws(() => validate({ ...analysisBundle(), extra: true }), /额外|字段/);
  assert.throws(() => validate({ ...analysisBundle(), schemaVersion: '1.0.0' }), /schemaVersion|版本/);
  assert.throws(() => validate({ ...analysisBundle(), caseHash: 'd'.repeat(64) }), /caseHash|Case/);
  assert.throws(() => validate(analysisBundle({
    report: validatedReport({ validation: { status: 'legacy-unverified' } }),
  })), /validation|validated|缺少/);
});

test('analysis bundle validator rejects missing citations, unsupported rules and malformed evidence', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const validate = (value) => assertValidatedAnalysisBundleV2(value, analysisOptions());
  assert.throws(() => validate(analysisBundle({ canonicalEvidence: [] })), /证据|evidence/);
  assert.throws(() => validate(analysisBundle({
    canonicalEvidence: [evidence({ supportsRuleIds: ['rule:other'] })],
  })), /规则|support/);
  assert.throws(() => validate(analysisBundle({
    canonicalEvidence: [evidence({ contentHash: 'not-a-hash' })],
  })), /contentHash|64/);
  assert.throws(() => validate(analysisBundle({
    canonicalEvidence: [evidence({ sourceType: 'forged' })],
  })), /sourceType/);
  assert.throws(() => validate(analysisBundle({
    canonicalEvidence: [evidence({ knowledgeKind: 'forged' })],
  })), /knowledgeKind/);
});

test('analysis bundle validator rejects bad corpus refs and non-exact diagnostics', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const validate = (value, expectedCorpusRef = CORPUS_REF) => assertValidatedAnalysisBundleV2(
    value,
    analysisOptions({ expectedCorpusRef }),
  );
  assert.throws(() => validate(analysisBundle({
    corpusRef: { version: 2, hash: 'd'.repeat(64) },
  })), /corpus|语料/);
  assert.throws(() => validate(analysisBundle(), { version: 2, hash: 'bad' }), /corpus|hash/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ requestedRuleIds: undefined }),
  })), /requestedRuleIds|diagnostics/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ injected: true }),
  })), /额外|diagnostics/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ matchedRuleIds: ['rule:not-requested'] }),
  })), /matchedRuleIds|requestedRuleIds/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ ruleCandidateIds: ['evidence:unknown'] }),
  })), /ruleCandidateIds|证据/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ matchedRuleIds: [] }),
  })), /ruleCandidateIds|matchedRuleIds|规则/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({ vectorCandidates: 1 }),
  })), /vectorCandidates|vectorUsed/);
  assert.throws(() => validate(analysisBundle({
    retrievalDiagnostics: diagnostics({
      mode: 'hybrid-reranked', lexicalCandidates: 0, fusedCandidates: 0, rerankUsed: true,
      requestedRuleIds: [], matchedRuleIds: [], ruleCandidateIds: [],
    }),
    canonicalEvidence: [],
    report: validatedReport({
      claims: [
        claim('summary', 1), claim('use-god', 2), claim('calendar', 3),
        claim('moving', 4), claim('synthesis', 5),
        claim('guidance', 6, { factIds: [], confidence: 'low' }),
      ],
    }),
  })), /rerankUsed|fusedCandidates|候选/);
  for (const [lexicalCandidates, vectorCandidates, fusedCandidates] of [
    [3, 2, 2],
    [3, 2, 6],
  ]) {
    assert.throws(() => validate(analysisBundle({
      retrievalDiagnostics: diagnostics({
        mode: 'hybrid-fused', lexicalCandidates, vectorCandidates, fusedCandidates,
        vectorUsed: true,
      }),
    })), /fusedCandidates|lexicalCandidates|vectorCandidates/);
  }
  assert.throws(() => validate(analysisBundle({
    canonicalEvidence: [evidence(), evidence({ id: 'evidence:extra', text: '额外证据。' })],
    retrievalDiagnostics: diagnostics({ lexicalCandidates: 1, fusedCandidates: 1 }),
  })), /canonicalEvidence|fusedCandidates|证据/);
});

test('analysis bundle validator accepts real retrieval count relationships including empty fallback', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const hybrid = analysisBundle({
    retrievalDiagnostics: diagnostics({
      mode: 'hybrid-fused', lexicalCandidates: 3, vectorCandidates: 2,
      fusedCandidates: 4, vectorUsed: true,
    }),
  });
  assert.doesNotThrow(() => assertValidatedAnalysisBundleV2(hybrid, analysisOptions()));

  const empty = analysisBundle({
    canonicalEvidence: [],
    retrievalDiagnostics: diagnostics({
      lexicalCandidates: 0, vectorCandidates: 0, fusedCandidates: 0,
      requestedRuleIds: [], matchedRuleIds: [], ruleCandidateIds: [], warnings: [],
    }),
    report: validatedReport({
      claims: [
        claim('summary', 1), claim('use-god', 2), claim('calendar', 3),
        claim('moving', 4), claim('synthesis', 5),
        claim('guidance', 6, { factIds: [], confidence: 'low' }),
      ],
    }),
  });
  assert.doesNotThrow(() => assertValidatedAnalysisBundleV2(empty, analysisOptions()));
});

test('analysis bundle validator accepts diagnostics emitted by the real hybrid retrieval port', async () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  const { hybridSearch } = require('./retrieval.cjs');
  const canonical = evidence();
  const found = await hybridSearch({
    corpus: [{
      id: canonical.id,
      title: canonical.title,
      source: canonical.source,
      location: canonical.location,
      text: canonical.text,
      tags: canonical.tags,
      sourceType: canonical.sourceType,
      knowledgeKind: canonical.knowledgeKind,
      supportsRuleIds: canonical.supportsRuleIds,
    }],
    query: '经过核验的规则',
    domainTerms: ['规则'],
    ruleIds: ['rule:one'],
    limit: 1,
  });
  assert.deepEqual(found.candidateRefs, [{ id: canonical.id, rank: 1 }]);
  assert.doesNotThrow(() => assertValidatedAnalysisBundleV2(analysisBundle({
    retrievalDiagnostics: found.diagnostics,
  }), analysisOptions()));
});

test('analysis bundle validator rejects accessor and symbol dependency options without invoking them', () => {
  const { assertValidatedAnalysisBundleV2 } = require('./bundle-v2.cjs');
  let getterRead = false;
  const accessorOptions = {
    expectedCaseHash: CASE_HASH,
    expectedCorpusRef: CORPUS_REF,
  };
  Object.defineProperty(accessorOptions, 'normalizeValidatedAnalysisReportV2', {
    enumerable: true,
    get() {
      getterRead = true;
      return sharedDomain.normalizeValidatedAnalysisReportV2;
    },
  });
  assert.throws(
    () => assertValidatedAnalysisBundleV2(analysisBundle(), accessorOptions),
    /访问器|data|选项/,
  );
  assert.equal(getterRead, false);

  const symbolOptions = analysisOptions();
  symbolOptions[Symbol('forged')] = true;
  assert.throws(
    () => assertValidatedAnalysisBundleV2(analysisBundle(), symbolOptions),
    /symbol|额外|选项/,
  );
});

test('follow-up pair validator owns exact V2 messages and delegates display derivation', () => {
  const { assertAuthoritativeFollowUpPairV2 } = require('./bundle-v2.cjs');
  const followUp = followUpBundle();
  const derived = '由共享 helper 生成的唯一正文';
  let deriveCalls = 0;
  const pair = [{
    schemaVersion: '2.0.0',
    id: 'message:user',
    role: 'user',
    content: '请继续说明。',
    caseHash: CASE_HASH,
    createdAt: '2026-07-12T08:01:00.000Z',
  }, {
    schemaVersion: '2.0.0',
    id: 'message:assistant',
    role: 'assistant',
    content: derived,
    caseHash: CASE_HASH,
    followUpBundle: followUp,
    createdAt: '2026-07-12T08:01:01.000Z',
  }];
  const validated = assertAuthoritativeFollowUpPairV2(pair, {
    ...followUpOptions(),
    deriveFollowUpContentV2(value) {
      deriveCalls += 1;
      assert.equal(JSON.stringify(value), JSON.stringify(followUp.followUp));
      return derived;
    },
  });
  pair[0].content = '后续篡改';
  pair[1].followUpBundle.followUp.claims[0].text = '后续篡改';

  assert.equal(deriveCalls, 1);
  assert.equal(validated[0].content, '请继续说明。');
  assert.equal(validated[1].followUpBundle.followUp.claims[0].text, '第 1 条经过校验的结论。');
  assert.equal(isDeeplyFrozen(validated), true);
  assert.equal(Reflect.set(validated[1], 'content', '校验后自由文本'), false);
});

test('follow-up pair validator rejects free text, wrong roles, times, hashes and malformed bundles', () => {
  const { assertAuthoritativeFollowUpPairV2 } = require('./bundle-v2.cjs');
  const derived = '派生正文';
  const pair = () => [{
    schemaVersion: '2.0.0', id: 'user-id', role: 'user', content: '追问',
    caseHash: CASE_HASH, createdAt: '2026-07-12T08:01:00.000Z',
  }, {
    schemaVersion: '2.0.0', id: 'assistant-id', role: 'assistant', content: derived,
    caseHash: CASE_HASH, followUpBundle: followUpBundle(), createdAt: '2026-07-12T08:01:01.000Z',
  }];
  const validate = (value, derive = () => derived) => assertAuthoritativeFollowUpPairV2(
    value,
    pairOptions({ deriveFollowUpContentV2: derive }),
  );
  const freeText = pair();
  freeText[1].content = '模型自由文本';
  assert.throws(() => validate(freeText), /派生|content/);
  const wrongRole = pair();
  wrongRole[0].role = 'assistant';
  assert.throws(() => validate(wrongRole), /role|角色/);
  const wrongTime = pair();
  wrongTime[1].createdAt = '2026-07-12';
  assert.throws(() => validate(wrongTime), /createdAt|ISO/);
  const reversedTime = pair();
  reversedTime[1].createdAt = '2026-07-12T08:00:59.000Z';
  assert.throws(() => validate(reversedTime), /createdAt|时间|先于/);
  const wrongHash = pair();
  wrongHash[1].caseHash = 'd'.repeat(64);
  assert.throws(() => validate(wrongHash), /caseHash|Case/);
  const malformed = pair();
  malformed[1].followUpBundle.followUp.validation.factCheckPassed = false;
  assert.throws(() => validate(malformed), /validation|validated/);
  assert.throws(() => validate(pair(), null), /deriveFollowUpContentV2|派生/);

  const accessorOptions = pairOptions();
  Object.defineProperty(accessorOptions, 'deriveFollowUpContentV2', {
    enumerable: true,
    get: () => sharedDomain.deriveFollowUpContentV2,
  });
  assert.throws(() => assertAuthoritativeFollowUpPairV2(pair(), accessorOptions), /访问器|data|选项/);
  const symbolOptions = pairOptions();
  symbolOptions[Symbol('forged')] = true;
  assert.throws(() => assertAuthoritativeFollowUpPairV2(pair(), symbolOptions), /symbol|额外|选项/);
});
