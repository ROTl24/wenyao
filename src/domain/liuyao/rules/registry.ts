import type { RuleContext, RuleSourceRef } from './model.js';
import { BASE_RULE_CONTEXT, REGISTERED_RULE_SOURCES } from './default-context.js';
import { assertReviewedArtifactManifest } from './review-gate.js';
import { canonicalStringify } from './tables.js';
import {
  WENWANG_REVIEW_CHECKED_CLAIMS,
  WENWANG_REVIEW_REPORT_PATHS,
} from './wenwang-manifest-expectations.js';
import {
  RULE_SOURCE_EVIDENCE_CAPSULES,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
  WENWANG_NAJIA_V2_MANIFEST,
} from './wenwang-najia-v2.js';

const GATE_ERROR = '结构规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '结构规则上下文未通过项目运行门';

export function assertProjectEnabledRulePack(manifest: unknown): void {
  assertReviewedArtifactManifest(manifest, {
    id: { field: 'rulePackId', value: 'wenwang_najia_v2' },
    version: WENWANG_NAJIA_V2_MANIFEST.version,
    artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    sourceRefs: RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    checkedClaims: WENWANG_REVIEW_CHECKED_CLAIMS,
    reportPaths: WENWANG_REVIEW_REPORT_PATHS,
    errorMessage: GATE_ERROR,
  });
}

function sameSourceRef(
  actual: unknown,
  expected: RuleSourceRef | undefined,
): boolean {
  return actual !== null
    && typeof actual === 'object'
    && !Array.isArray(actual)
    && expected !== undefined
    && (actual as RuleSourceRef).id === expected.id
    && (actual as RuleSourceRef).title === expected.title
    && (actual as RuleSourceRef).url === expected.url
    && (actual as RuleSourceRef).locator === expected.locator
    && (actual as RuleSourceRef).contentHash === expected.contentHash;
}

export function hasRegisteredRequiredSources(
  actualSources: unknown,
  requiredSources: readonly RuleSourceRef[],
): boolean {
  if (
    !Array.isArray(actualSources)
    || !Array.from({ length: actualSources.length }, (_, index) => index in actualSources).every(Boolean)
  ) return false;
  const registeredById = new Map<string, RuleSourceRef>(
    REGISTERED_RULE_SOURCES.map((source) => [source.id, source]),
  );
  const actualById = new Map<string, unknown>();
  for (const source of actualSources) {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) return false;
    const id = (source as { id?: unknown }).id;
    if (typeof id !== 'string' || actualById.has(id)) return false;
    actualById.set(id, source);
  }
  if (actualById.size !== actualSources.length) return false;
  if ([...actualById].some(([id, source]) => !sameSourceRef(source, registeredById.get(id)))) return false;
  return requiredSources.every((source) => sameSourceRef(actualById.get(source.id), source));
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

export function assertProjectEnabledRuleContext(context: unknown): asserts context is RuleContext {
  try {
    assertProjectEnabledRulePack(WENWANG_NAJIA_V2_MANIFEST);
  } catch {
    throw new Error(CONTEXT_GATE_ERROR);
  }

  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error(CONTEXT_GATE_ERROR);
  }
  const candidate = context as Partial<RuleContext>;

  const expectedSources = RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);
  let profilesMatch = false;
  try {
    profilesMatch = canonicalStringify(runtimeProfilePayload(candidate as RuleContext))
      === EXPECTED_RUNTIME_PROFILE_PAYLOAD;
  } catch {
    profilesMatch = false;
  }
  if (
    candidate.rulePackId !== WENWANG_NAJIA_V2_MANIFEST.rulePackId
    || candidate.rulePackVersion !== WENWANG_NAJIA_V2_MANIFEST.version
    || !profilesMatch
    || !hasRegisteredRequiredSources(candidate.sources, expectedSources)
  ) {
    throw new Error(CONTEXT_GATE_ERROR);
  }
}
