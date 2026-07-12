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
const ZONED_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function reject(): never {
  throw new Error(GATE_ERROR);
}

function isCanonicalNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isZonedIso(value: unknown): value is string {
  return isCanonicalNonEmpty(value)
    && ZONED_ISO_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

export function assertProjectEnabledRulePack(manifest: RulePackManifest): void {
  if (
    manifest.rulePackId !== 'wenwang_najia_v2'
    || manifest.version !== WENWANG_NAJIA_V2_MANIFEST.version
    || manifest.artifactHash !== WENWANG_NAJIA_V2_ARTIFACT_HASH
    || manifest.runtimeStatus !== 'project-enabled'
    || (manifest.verificationLevel !== 'independent-automated'
      && manifest.verificationLevel !== 'human-reviewed')
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
  const reportPaths = new Set<string>();
  for (const review of manifest.reviews) {
    const inputSourceRefs = Array.isArray(review.inputSourceRefs) ? review.inputSourceRefs : [];
    const checkedClaims = Array.isArray(review.checkedClaims) ? review.checkedClaims : [];
    const inputSourceRefSet = new Set(inputSourceRefs);
    const checkedClaimSet = new Set(checkedClaims);
    if (
      review.outcome !== 'matched'
      || review.artifactHash !== manifest.artifactHash
      || (review.reviewerKind !== 'automated-agent' && review.reviewerKind !== 'human')
      || !isCanonicalNonEmpty(review.reviewerId)
      || !isCanonicalNonEmpty(review.independentRunId)
      || !isZonedIso(review.reviewedAt)
      || !isCanonicalNonEmpty(review.reportPath)
      || reviewerIds.has(review.reviewerId)
      || runIds.has(review.independentRunId)
      || reportPaths.has(review.reportPath)
      || inputSourceRefs.length === 0
      || inputSourceRefSet.size !== inputSourceRefs.length
      || inputSourceRefs.some((sourceRef) => (
        !isCanonicalNonEmpty(sourceRef) || !actualSourceRefs.has(sourceRef)
      ))
      || checkedClaims.length === 0
      || checkedClaimSet.size !== checkedClaims.length
      || checkedClaims.some((claim) => !isCanonicalNonEmpty(claim))
    ) reject();
    reviewerIds.add(review.reviewerId);
    runIds.add(review.independentRunId);
    reportPaths.add(review.reportPath);
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
