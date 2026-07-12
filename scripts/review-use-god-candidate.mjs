import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as domain from '../electron/generated/domain/index.js';
import {
  DEFAULT_RULE_CONTEXT,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  RELATION_CORE_V1_ARTIFACT_HASH,
  USE_GOD_CORE_V1_ARTIFACT,
  USE_GOD_CORE_V1_ARTIFACT_HASH,
  USE_GOD_CORE_V1_CANONICAL_PAYLOAD,
  USE_GOD_CORE_V1_MANIFEST,
  USE_GOD_REVIEW_CHECKED_CLAIMS,
  USE_GOD_REVIEW_REPORT_PATHS,
  USE_GOD_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  assertProjectEnabledUseGodBundle,
  assertProjectEnabledUseGodContext,
  buildPlateV2,
  deriveFacts,
  resolveUseGod,
} from '../electron/generated/domain/index.js';
import * as deriveModule from '../electron/generated/domain/facts/derive.js';
import {
  deriveUseGodDependentFacts,
  deriveUseGodIndependentFacts,
  flyingHiddenRelation,
  spiritElementsForUse,
} from '../electron/generated/domain/facts/use-god-effects.js';
import * as useGodEffectsModule from '../electron/generated/domain/facts/use-god-effects.js';
import * as useGodModule from '../electron/generated/domain/use-god.js';

const sha256 = (payload) => createHash('sha256').update(payload, 'utf8').digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const elements = ['木', '火', '土', '金', '水'];

const sourceEvidence = USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref, payload }) => ({
  sourceId: ref.id,
  declaredHash: ref.contentHash,
  computedHash: sha256(payload),
  matched: ref.contentHash === sha256(payload),
}));

const expectedFixedBindings = {
  'WS-ZENGSHAN-ROLE-PRIMER-2100295': ['/3&oldid=2100295', '八宫图第三'],
  'WS-ZENGSHAN-USE-GOD-2100700': ['/8&oldid=2100700', '用神章第八'],
  'WS-ZENGSHAN-YUAN-JI-2100299': ['/9&oldid=2100299', '第九'],
  'WS-ZENGSHAN-YUAN-JI-STRENGTH-2100301': ['/10&oldid=2100301', '第十'],
  'WS-ZENGSHAN-ELEMENT-GENERATES-2100315': ['/11&oldid=2100315', '第十一'],
  'WS-ZENGSHAN-ELEMENT-CONTROLS-2100316': ['/12&oldid=2100316', '第十二'],
  'WS-ZENGSHAN-LATE-VOLUMES-2572918': ['oldid=2572918', '飞伏神章'],
};
const fixedSourceBindingsMatched = Object.entries(expectedFixedBindings).every(
  ([id, [urlFragment, locatorFragment]]) => {
    const ref = USE_GOD_SOURCE_EVIDENCE_CAPSULES.find(({ ref: source }) => source.id === id)?.ref;
    return ref?.url.includes(urlFragment) && ref.locator.includes(locatorFragment);
  },
);

const corpus = JSON.parse(readFileSync(new URL('../resources/corpus.json', import.meta.url), 'utf8'));
const corpusManifest = JSON.parse(
  readFileSync(new URL('../resources/corpus-manifest.json', import.meta.url), 'utf8'),
);
const localBookEvidence = USE_GOD_CORE_V1_ARTIFACT.localCorpus.books.map((book) => {
  const manifestSource = corpusManifest.sources.find(({ id }) => id === book.sourceId);
  return {
    sourceId: book.sourceId,
    declaredHash: book.bookSha256,
    manifestHash: manifestSource?.sha256 ?? null,
    matched: book.bookSha256 === manifestSource?.sha256,
  };
});
const localEntryEvidence = USE_GOD_CORE_V1_ARTIFACT.localCorpus.books.flatMap((book) => (
  book.entries.map(([entryId, declaredHash]) => {
    const entry = corpus.find(({ id }) => id === entryId);
    const computedHash = entry ? sha256(entry.text) : null;
    return {
      sourceId: book.sourceId,
      entryId,
      declaredHash,
      computedHash,
      matched: declaredHash === computedHash,
    };
  })
));
const localCapsuleByBook = {
  'ZENGSHAN-BUYI': 'CORPUS-ZENGSHAN-USE-GOD',
  'BUSHI-ZHENGZONG': 'CORPUS-BUSHI-USE-GOD',
};
const localCapsuleBindingsMatched = USE_GOD_CORE_V1_ARTIFACT.localCorpus.books.every((book) => {
  const payload = USE_GOD_SOURCE_EVIDENCE_CAPSULES.find(
    ({ ref }) => ref.id === localCapsuleByBook[book.sourceId],
  )?.payload;
  return typeof payload === 'string'
    && book.entries.every(([entryId, hash]) => payload.includes(`${entryId}:${hash}`));
});

const build = (tossValues, suffix) => buildPlateV2({
  plateId: `use-god-review-${suffix}`,
  sessionId: 'use-god-review',
  castAt: '2026-07-11T04:00:00.000Z',
  tossValues,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const fixturePlate = build([9, 8, 7, 6, 7, 8], 'base');

const runtimeIntentEvidence = USE_GOD_CORE_V1_ARTIFACT.intentRules.map((rule) => {
  const supplemental = rule.selector === 'subject-relation'
    ? { subjectRelation: '父母' }
    : rule.selector === 'explicit-target'
      ? { explicitTarget: { kind: 'six-relation', relation: '兄弟' } }
      : {};
  const expectedSelector = rule.selector === 'subject-relation'
    ? { kind: 'six-relation', relation: '父母' }
    : rule.selector === 'explicit-target'
      ? { kind: 'six-relation', relation: '兄弟' }
      : rule.selector;
  const selection = resolveUseGod({
    question: `核验 ${rule.intentId}`,
    category: rule.category,
    explicitIntentId: rule.intentId,
    ...supplemental,
    plate: fixturePlate,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  return {
    intentId: rule.intentId,
    categoryMatched: selection.category === rule.category,
    selectorMatched: same(selection.targetSelector, expectedSelector),
    relatedMatched: same(selection.relatedRelations, rule.relatedRelations),
    candidateSourcesPresent: selection.candidates.every(({ sourceRefs }) => sourceRefs.length > 0),
    scoreAbsent: !JSON.stringify(selection).includes('"score"'),
  };
});

const studyClarification = resolveUseGod({
  question: '今年学业功名如何',
  category: 'study',
  explicitIntentId: null,
  plate: fixturePlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const ambiguityPlate = build([6, 6, 6, 6, 6, 6], 'ambiguity');
const ambiguity = resolveUseGod({
  question: '兄弟之事',
  category: 'other',
  explicitIntentId: 'other.explicit',
  explicitTarget: { kind: 'six-relation', relation: '兄弟' },
  plate: ambiguityPlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const pair = resolveUseGod({
  question: '双方互动',
  category: 'relationship',
  explicitIntentId: 'relationship.relationship-dynamic',
  plate: fixturePlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const hiddenPlate = build([7, 7, 7, 8, 7, 7], 'hidden');
const hiddenSelection = resolveUseGod({
  question: '考试录取',
  category: 'study',
  explicitIntentId: 'study.exam-rank-or-admission',
  plate: hiddenPlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});

const flyingOracle = [
  ['same-element', 'flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying'],
  ['hidden-generates-flying', 'same-element', 'flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying'],
  ['hidden-controls-flying', 'hidden-generates-flying', 'same-element', 'flying-generates-hidden', 'flying-controls-hidden'],
  ['flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying', 'same-element', 'flying-generates-hidden'],
  ['flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying', 'same-element'],
];
const flyingMatrix = elements.map((flying) => elements.map((hidden) => (
  flyingHiddenRelation(flying, hidden).relation
)));
const spiritOracle = {
  木: { source: '水', avoid: '金', enemy: '土' },
  火: { source: '木', avoid: '水', enemy: '金' },
  土: { source: '火', avoid: '木', enemy: '水' },
  金: { source: '土', avoid: '火', enemy: '木' },
  水: { source: '金', avoid: '土', enemy: '火' },
};
const spiritMatrix = Object.fromEntries(elements.map((element) => [
  element,
  spiritElementsForUse(element),
]));

const independentFacts = deriveUseGodIndependentFacts(
  fixturePlate,
  DEFAULT_RULE_CONTEXT,
);
const resolved = resolveUseGod({
  question: '收入如何',
  category: 'wealth',
  explicitIntentId: 'wealth.money-or-valuables',
  plate: fixturePlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const dependentFacts = deriveUseGodDependentFacts(
  fixturePlate,
  DEFAULT_RULE_CONTEXT,
  resolved,
);
const nonSingleDependentCounts = [
  [studyClarification, fixturePlate],
  [ambiguity, ambiguityPlate],
  [pair, fixturePlate],
].map(([selection, plate]) => (
  deriveUseGodDependentFacts(plate, DEFAULT_RULE_CONTEXT, selection).length
));
const hiddenDependentFacts = deriveUseGodDependentFacts(
  hiddenPlate,
  DEFAULT_RULE_CONTEXT,
  hiddenSelection,
);
const fullFixtureFacts = deriveFacts({
  plate: fixturePlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
  useGod: resolved,
});

let productionGateOpen = true;
let productionGateMessage = null;
try {
  assertProjectEnabledUseGodBundle();
  assertProjectEnabledUseGodContext(DEFAULT_RULE_CONTEXT);
  resolveUseGod({
    question: '生产门', category: 'wealth', explicitIntentId: null,
    plate: fixturePlate, ruleContext: DEFAULT_RULE_CONTEXT,
  });
  deriveFacts({ plate: fixturePlate, ruleContext: DEFAULT_RULE_CONTEXT });
} catch (error) {
  productionGateOpen = false;
  productionGateMessage = error instanceof Error ? error.message : String(error);
}

const inputSourceRefs = USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);
const expectedReviews = [
  {
    reviewerId: 'codex-use-god-source-reviewer-a-7d3f8c2a',
    reviewerKind: 'automated-agent',
    independentRunId: 'use-god-a-db5a5320-6b33-4906-93d2-4bc7e867090e',
    reviewedAt: '2026-07-12T13:37:55.6866138+08:00',
    artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs,
    reportPath: USE_GOD_REVIEW_REPORT_PATHS[0],
    checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
  },
  {
    reviewerId: 'codex-corpus-matrix-use-god-b-bb24d3c9',
    reviewerKind: 'automated-agent',
    independentRunId: 'use-god-core-v1-b-bb24d3c9-0d28-497a-b54d-8b518689957e',
    reviewedAt: '2026-07-12T13:45:28.8202434+08:00',
    artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs,
    reportPath: USE_GOD_REVIEW_REPORT_PATHS[1],
    checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
  },
];
const reviewReportsPresent = USE_GOD_REVIEW_REPORT_PATHS.every((reportPath) => (
  existsSync(new URL(`../${reportPath}`, import.meta.url))
));
const result = {
  phase: 'PROJECT_ENABLED',
  artifact: {
    declaredHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
    computedHash: sha256(USE_GOD_CORE_V1_CANONICAL_PAYLOAD),
    matched: USE_GOD_CORE_V1_ARTIFACT_HASH === sha256(USE_GOD_CORE_V1_CANONICAL_PAYLOAD),
    canonicalBytes: Buffer.byteLength(USE_GOD_CORE_V1_CANONICAL_PAYLOAD, 'utf8'),
    dependencyMatched: same(USE_GOD_CORE_V1_ARTIFACT.dependsOn, {
      wenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
      relationArtifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
      growthShenShaArtifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
      effectsArtifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    }),
  },
  manifest: {
    verificationLevel: USE_GOD_CORE_V1_MANIFEST.verificationLevel,
    runtimeStatus: USE_GOD_CORE_V1_MANIFEST.runtimeStatus,
    reviewCount: USE_GOD_CORE_V1_MANIFEST.reviews.length,
    reviewsMatched: same(USE_GOD_CORE_V1_MANIFEST.reviews, expectedReviews),
    deepFrozenReviews: Object.isFrozen(USE_GOD_CORE_V1_MANIFEST)
      && Object.isFrozen(USE_GOD_CORE_V1_MANIFEST.reviews)
      && USE_GOD_CORE_V1_MANIFEST.reviews.every((review) => (
        Object.isFrozen(review)
        && Object.isFrozen(review.inputSourceRefs)
        && Object.isFrozen(review.checkedClaims)
      )),
    checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
    reviewReportsPresent,
    productionGateOpen,
    productionGateMessage,
  },
  sources: {
    capsuleCount: sourceEvidence.length,
    fixedSourceBindingsMatched,
    evidence: sourceEvidence,
  },
  localCorpus: {
    corpusVersionMatched: USE_GOD_CORE_V1_ARTIFACT.localCorpus.corpusVersion
      === corpusManifest.corpusVersion,
    entryCount: localEntryEvidence.length,
    books: localBookEvidence,
    entries: localEntryEvidence,
    capsuleBindingsMatched: localCapsuleBindingsMatched,
  },
  behavior: {
    intentRuleCount: runtimeIntentEvidence.length,
    intentEvidence: runtimeIntentEvidence,
    candidateTiers: USE_GOD_CORE_V1_ARTIFACT.selection.candidateTiers,
    studyClarifies: studyClarification.status === 'needs-user-input',
    ambiguityRetainsAll: ambiguity.status === 'ambiguous' && ambiguity.candidates.length === 2,
    pairWithoutPrimary: pair.selectionMode === 'shi-ying-pair' && pair.primary === null,
    hiddenDisputed: hiddenSelection.status === 'resolved'
      && hiddenSelection.primary?.candidateSource === 'palace-head-hidden'
      && hiddenSelection.primary.certainty === 'disputed',
    scoreAbsent: !USE_GOD_CORE_V1_CANONICAL_PAYLOAD.includes('"score"'),
  },
  matrices: {
    flyingMatrix,
    flyingMatched: same(flyingMatrix, flyingOracle),
    spiritMatrix,
    spiritMatched: same(spiritMatrix, spiritOracle),
  },
  facts: {
    independentCount: independentFacts.length,
    dependentCount: dependentFacts.length,
    allSourceRefsPresent: [...independentFacts, ...dependentFacts].every(
      ({ sourceRefs }) => sourceRefs.length > 0,
    ),
    nonSingleDependentCounts,
    hiddenFactsAllDisputed: hiddenDependentFacts.length > 0
      && hiddenDependentFacts.every(({ certainty }) => certainty === 'disputed'),
    eligibleScopeMatched: dependentFacts.every(({ source }) => (
      source.type !== 'pillar' || source.id === 'month' || source.id === 'day'
    )),
    fixturePipelineIncludesUseGodFacts: independentFacts.every(({ id }) => (
      fullFixtureFacts.some((fact) => fact.id === id)
    )) && dependentFacts.every(({ id }) => fullFixtureFacts.some((fact) => fact.id === id)),
    stableAndFrozen: [...independentFacts, ...dependentFacts].every(
      (fact) => Object.isFrozen(fact) && Object.isFrozen(fact.sourceRefs),
    ),
    fixtureAbsentFromProduction: !('resolveUseGodForReviewFixture' in domain)
      && !('deriveFactsForUseGodReviewFixture' in domain)
      && !('deriveUseGodIndependentFactsForReviewFixture' in domain)
      && !('deriveUseGodDependentFactsForReviewFixture' in domain)
      && !('resolveUseGodForReviewFixture' in useGodModule)
      && !('deriveFactsForUseGodReviewFixture' in deriveModule)
      && !('deriveUseGodIndependentFactsForReviewFixture' in useGodEffectsModule)
      && !('deriveUseGodDependentFactsForReviewFixture' in useGodEffectsModule),
  },
};

console.log(JSON.stringify(result, null, 2));

const matched = result.phase === 'PROJECT_ENABLED'
  && result.artifact.matched
  && result.artifact.dependencyMatched
  && result.manifest.verificationLevel === 'independent-automated'
  && result.manifest.runtimeStatus === 'project-enabled'
  && result.manifest.reviewCount === 2
  && result.manifest.reviewsMatched
  && result.manifest.deepFrozenReviews
  && result.manifest.reviewReportsPresent
  && result.manifest.productionGateOpen
  && result.sources.capsuleCount === 9
  && result.sources.fixedSourceBindingsMatched
  && sourceEvidence.every(({ matched: sourceMatched }) => sourceMatched)
  && result.localCorpus.corpusVersionMatched
  && result.localCorpus.entryCount === 27
  && result.localCorpus.capsuleBindingsMatched
  && localBookEvidence.every(({ matched: bookMatched }) => bookMatched)
  && localEntryEvidence.every(({ matched: entryMatched }) => entryMatched)
  && result.behavior.intentRuleCount === 17
  && runtimeIntentEvidence.every((item) => (
    item.categoryMatched && item.selectorMatched && item.relatedMatched
    && item.candidateSourcesPresent && item.scoreAbsent
  ))
  && same(result.behavior.candidateTiers.map(({ id, tier }) => [id, tier]), [
    ['base-visible', 0], ['true-changed', 1], ['palace-head-hidden', 2],
  ])
  && result.behavior.studyClarifies
  && result.behavior.ambiguityRetainsAll
  && result.behavior.pairWithoutPrimary
  && result.behavior.hiddenDisputed
  && result.behavior.scoreAbsent
  && result.matrices.flyingMatched
  && result.matrices.spiritMatched
  && result.facts.independentCount >= 2
  && result.facts.dependentCount > 0
  && result.facts.allSourceRefsPresent
  && same(result.facts.nonSingleDependentCounts, [0, 0, 0])
  && result.facts.hiddenFactsAllDisputed
  && result.facts.eligibleScopeMatched
  && result.facts.fixturePipelineIncludesUseGodFacts
  && result.facts.stableAndFrozen
  && result.facts.fixtureAbsentFromProduction;

if (!matched) process.exitCode = 1;
