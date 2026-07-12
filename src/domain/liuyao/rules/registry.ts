import type { RuleContext, RulePackManifest, RuleSourceRef } from './model.js';
import { BASE_RULE_CONTEXT } from './default-context.js';
import { canonicalStringify } from './tables.js';
import {
  RULE_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  WENWANG_NAJIA_V2_MANIFEST,
} from './wenwang-najia-v2.js';

const GATE_ERROR = '结构规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '结构规则上下文未通过项目运行门';

function reject(): never {
  throw new Error(GATE_ERROR);
}

export function assertProjectEnabledRulePack(manifest: RulePackManifest): void {
  if (
    manifest.rulePackId !== 'wenwang_najia_v2'
    || manifest.version !== WENWANG_NAJIA_V2_MANIFEST.version
    || manifest.artifactHash !== WENWANG_NAJIA_V2_ARTIFACT_HASH
    || manifest.runtimeStatus !== 'project-enabled'
    || manifest.verificationLevel === 'unverified'
    || manifest.reviews.length < 2
  ) reject();

  const expectedSourceRefs = new Set(WENWANG_NAJIA_V2_MANIFEST.sourceRefs);
  const actualSourceRefs = new Set(manifest.sourceRefs);
  if (
    actualSourceRefs.size !== manifest.sourceRefs.length
    || actualSourceRefs.size !== expectedSourceRefs.size
    || [...expectedSourceRefs].some((sourceRef) => !actualSourceRefs.has(sourceRef))
  ) reject();

  const reviewerIds = new Set<string>();
  const runIds = new Set<string>();
  for (const review of manifest.reviews) {
    if (
      review.outcome !== 'matched'
      || review.artifactHash !== manifest.artifactHash
      || review.reviewerId.trim() === ''
      || review.independentRunId.trim() === ''
      || review.reviewedAt.trim() === ''
      || reviewerIds.has(review.reviewerId)
      || runIds.has(review.independentRunId)
    ) reject();
    reviewerIds.add(review.reviewerId);
    runIds.add(review.independentRunId);
  }

  const requiredReviewerKind = manifest.verificationLevel === 'human-reviewed'
    ? 'human'
    : 'automated-agent';
  if (manifest.reviews.filter(({ reviewerKind }) => reviewerKind === requiredReviewerKind).length < 2) {
    reject();
  }
}

function sameSourceRef(actual: RuleSourceRef | undefined, expected: RuleSourceRef): boolean {
  return actual !== undefined
    && actual !== null
    && typeof actual === 'object'
    && actual.id === expected.id
    && actual.title === expected.title
    && actual.url === expected.url
    && actual.locator === expected.locator
    && actual.contentHash === expected.contentHash;
}

function runtimeProfilePayload(context: RuleContext) {
  return {
    schemaVersion: context.schemaVersion,
    calendarProfile: context.calendarProfile,
    relationProfile: context.relationProfile,
    growthProfile: context.growthProfile,
    shenShaProfile: context.shenShaProfile,
    useGodProfile: context.useGodProfile,
  };
}

const EXPECTED_RUNTIME_PROFILE_PAYLOAD = canonicalStringify(runtimeProfilePayload(BASE_RULE_CONTEXT));

export function assertProjectEnabledRuleContext(context: RuleContext): void {
  try {
    assertProjectEnabledRulePack(WENWANG_NAJIA_V2_MANIFEST);
  } catch {
    throw new Error(CONTEXT_GATE_ERROR);
  }

  if (!context || typeof context !== 'object' || !Array.isArray(context.sources)) {
    throw new Error(CONTEXT_GATE_ERROR);
  }

  const expectedSources = RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);
  let profilesMatch = false;
  try {
    profilesMatch = canonicalStringify(runtimeProfilePayload(context)) === EXPECTED_RUNTIME_PROFILE_PAYLOAD;
  } catch {
    profilesMatch = false;
  }
  if (
    context.rulePackId !== WENWANG_NAJIA_V2_MANIFEST.rulePackId
    || context.rulePackVersion !== WENWANG_NAJIA_V2_MANIFEST.version
    || !profilesMatch
    || context.sources.length !== expectedSources.length
    || context.sources.some((source, index) => !sameSourceRef(source, expectedSources[index]))
  ) {
    throw new Error(CONTEXT_GATE_ERROR);
  }
}
