import { BASE_RULE_CONTEXT } from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { assertReviewedArtifactManifest } from '../rules/review-gate.js';
import { hasRegisteredRequiredSources } from '../rules/registry.js';
import { canonicalStringify } from '../rules/tables.js';
import {
  GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
  GROWTH_SHENSHA_REVIEW_REPORT_PATHS,
} from './growth-shensha-manifest-expectations.js';
import {
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_CORE_V1_MANIFEST,
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES,
} from './growth-shensha-core-v1.js';

const BUNDLE_GATE_ERROR = '长生神煞规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '长生神煞规则上下文未通过项目运行门';
export {
  GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
  GROWTH_SHENSHA_REVIEW_REPORT_PATHS,
} from './growth-shensha-manifest-expectations.js';

export function assertProjectEnabledGrowthShenShaBundle(
  manifest: unknown = GROWTH_SHENSHA_CORE_V1_MANIFEST,
): void {
  assertReviewedArtifactManifest(manifest, {
    id: { field: 'bundleId', value: 'growth_shensha_core_v1' },
    version: '1.0.0',
    artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    sourceRefs: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
    reportPaths: GROWTH_SHENSHA_REVIEW_REPORT_PATHS,
    errorMessage: BUNDLE_GATE_ERROR,
  });
}

function bundleProfilePayload(context: RuleContext) {
  return {
    growthProfile: context.growthProfile,
    sixSpiritProfile: context.sixSpiritProfile,
    shenShaProfile: context.shenShaProfile,
  };
}

const EXPECTED_PROFILE_PAYLOAD = canonicalStringify(bundleProfilePayload(BASE_RULE_CONTEXT));
const REQUIRED_SOURCES = GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);

function hasExactBundleContext(context: unknown): context is RuleContext {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  const candidate = context as RuleContext;
  try {
    return canonicalStringify(bundleProfilePayload(candidate)) === EXPECTED_PROFILE_PAYLOAD
      && hasRegisteredRequiredSources(candidate.sources, REQUIRED_SOURCES);
  } catch {
    return false;
  }
}

export function assertProjectEnabledGrowthShenShaContext(
  context: unknown,
): asserts context is RuleContext {
  assertProjectEnabledGrowthShenShaBundle();
  if (!hasExactBundleContext(context)) throw new Error(CONTEXT_GATE_ERROR);
}
