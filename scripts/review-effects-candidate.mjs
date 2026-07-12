import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import * as domain from '../electron/generated/domain/index.js';
import {
  DEFAULT_RULE_CONTEXT,
  EFFECTS_REVIEW_CHECKED_CLAIMS,
  EFFECTS_REVIEW_REPORT_PATHS,
  EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  LIUYAO_EFFECTS_V1_ARTIFACT,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD,
  LIUYAO_EFFECTS_V1_MANIFEST,
  RELATION_CORE_V1_ARTIFACT_HASH,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  assertProjectEnabledEffectsBundle,
  assertProjectEnabledEffectsContext,
  buildPlateV2,
  deriveEffectsFacts,
  deriveFacts,
  getXunInfo,
  twelveStage,
} from '../electron/generated/domain/index.js';
import { monthStatusForBranches } from '../electron/generated/domain/facts/calendar-effects.js';
import {
  correspondingFanFu,
  hexagramSideFormation,
} from '../electron/generated/domain/facts/formations.js';
import { advanceRetreatRelation } from '../electron/generated/domain/facts/moving-effects.js';

const sha256 = (payload) => createHash('sha256').update(payload, 'utf8').digest('hex');
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const elements = ['木', '火', '土', '金', '水'];
const task5Relations = new Set([
  'has-month-status', 'is-month-break', 'is-day-break', 'is-dark-moving',
  'returns-generate', 'returns-control', 'returns-clash', 'returns-combine',
  'advances', 'retreats', 'changes-to-tomb', 'changes-to-absolute',
  'forms-three-harmony', 'has-three-harmony-candidate',
  'is-six-harmony', 'is-six-clash', 'is-fan-yin', 'is-fu-yin',
]);

const sourceEvidence = EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref, payload }) => ({
  sourceId: ref.id,
  url: ref.url,
  declaredHash: ref.contentHash,
  computedHash: sha256(payload),
  matched: ref.contentHash === sha256(payload),
}));
const expectedFixedSources = {
  'WS-ZENGSHAN-SEASONS-2100323': '/15%E5%8F%88&oldid=2100323',
  'WS-ZENGSHAN-MOVING-2100321': '/15&oldid=2100321',
  'WS-ZENGSHAN-THREE-HARMONY-2100447': '/19&oldid=2100447',
  'WS-ZENGSHAN-DAY-2100338': '/17&oldid=2100338',
  'WS-ZENGSHAN-FAN-FU-2100458': '/25&oldid=2100458',
  'WS-ZENGSHAN-VOID-2100460': '/26&oldid=2100460',
};
const fixedSourceBindingsMatched = Object.entries(expectedFixedSources).every(([id, suffix]) => (
  EFFECTS_SOURCE_EVIDENCE_CAPSULES.find(({ ref }) => ref.id === id)?.ref.url.includes(suffix)
));

const corpus = JSON.parse(readFileSync(new URL('../resources/corpus.json', import.meta.url), 'utf8'));
const corpusManifest = JSON.parse(
  readFileSync(new URL('../resources/corpus-manifest.json', import.meta.url), 'utf8'),
);
const localBookEvidence = LIUYAO_EFFECTS_V1_ARTIFACT.localCorpus.books.map((book) => {
  const manifestSource = corpusManifest.sources.find(({ id }) => id === book.sourceId);
  return {
    sourceId: book.sourceId,
    declaredHash: book.bookSha256,
    manifestHash: manifestSource?.sha256 ?? null,
    matched: book.bookSha256 === manifestSource?.sha256,
  };
});
const localEntryEvidence = LIUYAO_EFFECTS_V1_ARTIFACT.localCorpus.books.flatMap((book) => (
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
  'ZENGSHAN-BUYI': 'CORPUS-ZENGSHAN-EFFECTS',
  'BUSHI-ZHENGZONG': 'CORPUS-BUSHI-EFFECTS',
};
const localCapsuleBindingsMatched = LIUYAO_EFFECTS_V1_ARTIFACT.localCorpus.books.every((book) => {
  const capsuleId = localCapsuleByBook[book.sourceId];
  const payload = EFFECTS_SOURCE_EVIDENCE_CAPSULES.find(({ ref }) => ref.id === capsuleId)?.payload;
  return typeof payload === 'string'
    && book.entries.every(([entryId, hash]) => payload.includes(`${entryId}:${hash}`));
});

const monthStatusCounts = {
  commanding: 0,
  'same-element': 0,
  'generated-by-month': 0,
  'residual-qi': 0,
  resting: 0,
};
for (const month of branches) {
  for (const line of branches) monthStatusCounts[monthStatusForBranches(month, line)] += 1;
}

const sixtyJiaZi = Array.from({ length: 60 }, (_, index) => (
  `${stems[index % stems.length]}${branches[index % branches.length]}`
));
const voidPairs = [
  ['戌', '亥'], ['申', '酉'], ['午', '未'],
  ['辰', '巳'], ['寅', '卯'], ['子', '丑'],
];
const sixtyByTwelveVoidMatched = sixtyJiaZi.every((ganZhi, index) => {
  const expected = voidPairs[Math.floor(index / 10)];
  const actual = getXunInfo(ganZhi).voidBranches;
  return same(actual, expected)
    && branches.filter((branch) => actual.includes(branch)).length === 2;
});

const advanceAudit = Object.fromEntries([
  ['defaultAdvances', LIUYAO_EFFECTS_V1_ARTIFACT.moving.defaultAdvancePairs.filter(
    ([base, changed]) => advanceRetreatRelation(base, changed) === 'advances',
  ).length],
  ['defaultRetreats', LIUYAO_EFFECTS_V1_ARTIFACT.moving.defaultAdvancePairs.filter(
    ([base, changed]) => advanceRetreatRelation(changed, base) === 'retreats',
  ).length],
  ['auditAdvances', LIUYAO_EFFECTS_V1_ARTIFACT.moving.auditAdvancePairs.filter(
    ([base, changed]) => advanceRetreatRelation(base, changed, 'bushi-eight-pair-audit-v1') === 'advances',
  ).length],
  ['auditRetreats', LIUYAO_EFFECTS_V1_ARTIFACT.moving.auditAdvancePairs.filter(
    ([base, changed]) => advanceRetreatRelation(changed, base, 'bushi-eight-pair-audit-v1') === 'retreats',
  ).length],
]);
const growthCounts = { 墓: 0, 绝: 0 };
for (const element of elements) {
  for (const branch of branches) {
    const stage = twelveStage(element, branch);
    if (stage === '墓' || stage === '绝') growthCounts[stage] += 1;
  }
}

const build = (tossValues, suffix) => buildPlateV2({
  plateId: `effects-review-${suffix}`,
  sessionId: 'effects-review',
  castAt: '2026-07-11T04:00:00.000Z',
  tossValues,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const sixtyFourCounts = { harmony: 0, clash: 0 };
for (let state = 0; state < 64; state += 1) {
  const tossValues = Array.from({ length: 6 }, (_, index) => (
    state & (1 << index) ? 7 : 8
  ));
  const formation = hexagramSideFormation(build(tossValues, `64-${state}`), 'base');
  if (formation === 'six-harmony') sixtyFourCounts.harmony += 1;
  if (formation === 'six-clash') sixtyFourCounts.clash += 1;
}

const stateCounts = {
  baseHarmony: 0, baseClash: 0, changedHarmony: 0, changedClash: 0,
  innerFan: 0, outerFan: 0, anyFan: 0, bothFan: 0,
  innerFu: 0, outerFu: 0, anyFu: 0, bothFu: 0,
};
for (let state = 0; state < 4096; state += 1) {
  let cursor = state;
  const tossValues = Array.from({ length: 6 }, () => {
    const toss = [6, 7, 8, 9][cursor % 4];
    cursor = Math.floor(cursor / 4);
    return toss;
  });
  const plate = build(tossValues, `4096-${state}`);
  const base = hexagramSideFormation(plate, 'base');
  if (base === 'six-harmony') stateCounts.baseHarmony += 1;
  if (base === 'six-clash') stateCounts.baseClash += 1;
  if (plate.movingLines.length > 0) {
    const changed = hexagramSideFormation(plate, 'changed');
    if (changed === 'six-harmony') stateCounts.changedHarmony += 1;
    if (changed === 'six-clash') stateCounts.changedClash += 1;
  }
  const fanFu = correspondingFanFu(plate);
  if (fanFu.innerFan) stateCounts.innerFan += 1;
  if (fanFu.outerFan) stateCounts.outerFan += 1;
  if (fanFu.innerFan || fanFu.outerFan) stateCounts.anyFan += 1;
  if (fanFu.innerFan && fanFu.outerFan) stateCounts.bothFan += 1;
  if (fanFu.innerFu) stateCounts.innerFu += 1;
  if (fanFu.outerFu) stateCounts.outerFu += 1;
  if (fanFu.innerFu || fanFu.outerFu) stateCounts.anyFu += 1;
  if (fanFu.innerFu && fanFu.outerFu) stateCounts.bothFu += 1;
}

const fixturePlate = build([8, 6, 6, 8, 7, 8], 'production');
const effectsFacts = deriveEffectsFacts({
  plate: fixturePlate,
  ruleContext: DEFAULT_RULE_CONTEXT,
});
const calendarFacts = effectsFacts.filter(({ scope }) => scope === 'calendar');
const movingFacts = effectsFacts.filter(({ scope }) => scope === 'transition');
const formationFacts = effectsFacts.filter(({ scope }) => scope === 'formation');
const productionFacts = deriveFacts({ plate: fixturePlate, ruleContext: DEFAULT_RULE_CONTEXT });
let productionGateOpen = true;
let productionGateMessage = null;
try {
  assertProjectEnabledEffectsBundle();
  assertProjectEnabledEffectsContext(DEFAULT_RULE_CONTEXT);
} catch (error) {
  productionGateOpen = false;
  productionGateMessage = error instanceof Error ? error.message : String(error);
}
let publicDependencyInjectionRejected = false;
try {
  deriveEffectsFacts({
    plate: fixturePlate,
    ruleContext: DEFAULT_RULE_CONTEXT,
    relationFacts: [],
    growthFacts: [],
  });
} catch (error) {
  publicDependencyInjectionRejected = error instanceof Error
    && error.message === '日月动变派生输入无效';
}

const inputSourceRefs = EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);
const expectedReviews = [
  {
    reviewerId: 'codex-source-reviewer-effects-a-24bcce01bb0c4f31',
    reviewerKind: 'automated-agent',
    independentRunId: 'effects-a-20260712-115921-24bcce01bb0c4f318a377bbf47be82dd',
    reviewedAt: '2026-07-12T11:59:21+08:00',
    artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs,
    reportPath: EFFECTS_REVIEW_REPORT_PATHS[0],
    checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
  },
  {
    reviewerId: 'codex-corpus-matrix-effects-b',
    reviewerKind: 'automated-agent',
    independentRunId: 'liuyao-effects-v1-b-a5d7cb2f-77da-4b82-bd23-2d9a9c5454c4',
    reviewedAt: '2026-07-12T12:00:40.9619972+08:00',
    artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    outcome: 'matched',
    inputSourceRefs,
    reportPath: EFFECTS_REVIEW_REPORT_PATHS[1],
    checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
  },
];
const reviewReportsPresent = EFFECTS_REVIEW_REPORT_PATHS.every((reportPath) => (
  existsSync(new URL(`../${reportPath}`, import.meta.url))
));

const expected4096 = {
  baseHarmony: 512, baseClash: 640, changedHarmony: 504, changedClash: 630,
  innerFan: 128, outerFan: 128, anyFan: 252, bothFan: 4,
  innerFu: 128, outerFu: 128, anyFu: 252, bothFu: 4,
};
const artifactSourceIds = new Set(EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id));
const result = {
  phase: 'PROJECT_ENABLED',
  artifact: {
    declaredHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    computedHash: sha256(LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD),
    matched: LIUYAO_EFFECTS_V1_ARTIFACT_HASH === sha256(LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD),
    canonicalBytes: Buffer.byteLength(LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD, 'utf8'),
    dependencies: LIUYAO_EFFECTS_V1_ARTIFACT.dependsOn,
    dependencyMatched: same(LIUYAO_EFFECTS_V1_ARTIFACT.dependsOn, {
      wenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
      relationArtifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
      growthShenShaArtifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    }),
  },
  manifest: {
    verificationLevel: LIUYAO_EFFECTS_V1_MANIFEST.verificationLevel,
    runtimeStatus: LIUYAO_EFFECTS_V1_MANIFEST.runtimeStatus,
    reviews: LIUYAO_EFFECTS_V1_MANIFEST.reviews,
    reviewsMatched: same(LIUYAO_EFFECTS_V1_MANIFEST.reviews, expectedReviews),
    deepFrozenReviews: Object.isFrozen(LIUYAO_EFFECTS_V1_MANIFEST)
      && Object.isFrozen(LIUYAO_EFFECTS_V1_MANIFEST.reviews)
      && LIUYAO_EFFECTS_V1_MANIFEST.reviews.every((review) => (
        Object.isFrozen(review)
        && Object.isFrozen(review.inputSourceRefs)
        && Object.isFrozen(review.checkedClaims)
      )),
    reviewReportsPresent,
    productionGateOpen,
    productionGateMessage,
  },
  matrices: {
    monthStatusCounts,
    sixtyByTwelveVoidMatched,
    advanceAudit,
    growthCounts,
    sixtyFourCounts,
    stateCounts,
    directionalFanYinPairs: LIUYAO_EFFECTS_V1_ARTIFACT.fanFu.variants[0].oppositeTrigramPairs,
  },
  facts: {
    calendarCount: calendarFacts.length,
    movingCount: movingFacts.length,
    formationCount: formationFacts.length,
    effectsFactsStable: [calendarFacts, movingFacts, formationFacts].every((facts) => (
      new Set(facts.map(({ id }) => id)).size === facts.length
      && facts.every((fact) => Object.isFrozen(fact) && fact.sourceRefs.length > 0)
    )),
    nonZeroByScope: calendarFacts.length > 0 && movingFacts.length > 0 && formationFacts.length > 0,
    productionIncludesAllEffects: effectsFacts.every(({ id }) => (
      productionFacts.some((fact) => fact.id === id)
    )) && productionFacts.some(({ relation }) => task5Relations.has(relation)),
    publicDependencyInjectionRejected,
    productionSurfaceMatched: 'deriveEffectsFacts' in domain
      && !('deriveCalendarEffectsForReviewFixture' in domain)
      && !('deriveMovingEffectsForReviewFixture' in domain)
      && !('deriveFormationsForReviewFixture' in domain)
      && !('deriveRelationFactsForInternalPipeline' in domain)
      && !('deriveEffectsFactsForInternalPipeline' in domain),
  },
  sources: {
    capsuleCount: sourceEvidence.length,
    registeredSourceCount: DEFAULT_RULE_CONTEXT.sources.length,
    fixedSourceBindingsMatched,
    everyRuleSourceRegistered: LIUYAO_EFFECTS_V1_ARTIFACT.rules.every(({ sourceRefs }) => (
      sourceRefs.every((sourceId) => artifactSourceIds.has(sourceId))
    )),
    evidence: sourceEvidence,
  },
  localCorpus: {
    corpusVersionMatched: LIUYAO_EFFECTS_V1_ARTIFACT.localCorpus.corpusVersion
      === corpusManifest.corpusVersion,
    books: localBookEvidence,
    entries: localEntryEvidence,
    capsuleBindingsMatched: localCapsuleBindingsMatched,
  },
};

console.log(JSON.stringify(result, null, 2));

const matched = result.artifact.matched
  && result.artifact.dependencyMatched
  && result.phase === 'PROJECT_ENABLED'
  && result.manifest.verificationLevel === 'independent-automated'
  && result.manifest.runtimeStatus === 'project-enabled'
  && result.manifest.reviews.length === 2
  && result.manifest.reviewsMatched
  && result.manifest.deepFrozenReviews
  && result.manifest.reviewReportsPresent
  && result.manifest.productionGateOpen
  && same(monthStatusCounts, {
    commanding: 12, 'same-element': 20, 'generated-by-month': 28,
    'residual-qi': 4, resting: 80,
  })
  && sixtyByTwelveVoidMatched
  && same(advanceAudit, {
    defaultAdvances: 7, defaultRetreats: 7, auditAdvances: 8, auditRetreats: 8,
  })
  && same(growthCounts, { 墓: 5, 绝: 5 })
  && same(sixtyFourCounts, { harmony: 8, clash: 10 })
  && same(stateCounts, expected4096)
  && same(result.matrices.directionalFanYinPairs, [
    ['乾', '巽'], ['坎', '离'], ['艮', '坤'], ['震', '兑'],
  ])
  && result.facts.effectsFactsStable
  && result.facts.nonZeroByScope
  && result.facts.productionIncludesAllEffects
  && result.facts.publicDependencyInjectionRejected
  && result.facts.productionSurfaceMatched
  && result.sources.fixedSourceBindingsMatched
  && result.sources.everyRuleSourceRegistered
  && sourceEvidence.every(({ matched: sourceMatched }) => sourceMatched)
  && result.localCorpus.corpusVersionMatched
  && result.localCorpus.capsuleBindingsMatched
  && localBookEvidence.every(({ matched: bookMatched }) => bookMatched)
  && localEntryEvidence.every(({ matched: entryMatched }) => entryMatched);

if (!matched) process.exitCode = 1;
