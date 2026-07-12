import { createHash } from 'node:crypto';
import {
  BRANCHES,
  DEFAULT_RULE_CONTEXT,
  RELATION_CORE_V1_ARTIFACT,
  RELATION_CORE_V1_ARTIFACT_HASH,
  RELATION_CORE_V1_CANONICAL_PAYLOAD,
  RELATION_CORE_V1_MANIFEST,
  RELATION_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  assertProjectEnabledRelationBundle,
  branchRelationMatches,
} from '../electron/generated/domain/index.js';

const sha256 = (payload) => createHash('sha256').update(payload, 'utf8').digest('hex');
const computedArtifactHash = sha256(RELATION_CORE_V1_CANONICAL_PAYLOAD);
const sourceEvidence = RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref, payload }) => ({
  sourceId: ref.id,
  declaredHash: ref.contentHash,
  computedHash: sha256(payload),
  matched: ref.contentHash === sha256(payload),
}));

const defaultMatrixMatches = BRANCHES.flatMap((source) => BRANCHES.flatMap((target) => (
  branchRelationMatches(source, target, DEFAULT_RULE_CONTEXT.relationProfile)
)));
const matchCounts = Object.fromEntries(
  ['combines', 'clashes', 'harms', 'breaks', 'punishes'].map((relation) => [
    relation,
    defaultMatrixMatches.filter((match) => match.relation === relation).length,
  ]),
);
const punishmentDirections = Object.fromEntries(
  ['forward', 'reverse'].map((direction) => [
    direction,
    defaultMatrixMatches.filter((match) => (
      match.relation === 'punishes' && match.direction === direction
    )).length,
  ]),
);

let productionGateOpen = true;
try {
  assertProjectEnabledRelationBundle(RELATION_CORE_V1_MANIFEST);
} catch {
  productionGateOpen = false;
}

const result = {
  artifact: {
    declaredHash: RELATION_CORE_V1_ARTIFACT_HASH,
    computedHash: computedArtifactHash,
    matched: RELATION_CORE_V1_ARTIFACT_HASH === computedArtifactHash,
    canonicalBytes: Buffer.byteLength(RELATION_CORE_V1_CANONICAL_PAYLOAD, 'utf8'),
    dependsOnWenwangArtifactHash: RELATION_CORE_V1_ARTIFACT.dependsOnWenwangArtifactHash,
    dependencyMatched: RELATION_CORE_V1_ARTIFACT.dependsOnWenwangArtifactHash
      === WENWANG_NAJIA_V2_ARTIFACT_HASH,
  },
  manifest: {
    verificationLevel: RELATION_CORE_V1_MANIFEST.verificationLevel,
    runtimeStatus: RELATION_CORE_V1_MANIFEST.runtimeStatus,
    reviewCount: RELATION_CORE_V1_MANIFEST.reviews.length,
    productionGateOpen,
  },
  tables: {
    elementRuleCount: RELATION_CORE_V1_ARTIFACT.elementRules.length,
    branchRulePairCounts: Object.fromEntries(
      RELATION_CORE_V1_ARTIFACT.branchRules.map((rule) => [rule.ruleId, rule.pairs.length]),
    ),
    defaultOrderedMatrixMatchCounts: matchCounts,
    defaultPunishmentDirections: punishmentDirections,
  },
  sourceEvidence,
};

console.log(JSON.stringify(result, null, 2));

const finalContractMatched = result.artifact.matched
  && result.artifact.dependencyMatched
  && sourceEvidence.every(({ matched }) => matched)
  && result.manifest.verificationLevel === 'independent-automated'
  && result.manifest.runtimeStatus === 'project-enabled'
  && result.manifest.reviewCount === 2
  && result.manifest.productionGateOpen
  && matchCounts.combines === 12
  && matchCounts.clashes === 12
  && matchCounts.harms === 12
  && matchCounts.breaks === 8
  && punishmentDirections.forward === 10;

if (!finalContractMatched) process.exitCode = 1;
