import { BASE_RULE_CONTEXT } from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { assertReviewedArtifactManifest } from '../rules/review-gate.js';
import { hasRegisteredRequiredSources } from '../rules/registry.js';
import { canonicalStringify } from '../rules/tables.js';
import {
  EFFECTS_REVIEW_CHECKED_CLAIMS,
  EFFECTS_REVIEW_REPORT_PATHS,
} from './effects-manifest-expectations.js';
import {
  EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  LIUYAO_EFFECTS_V1_MANIFEST,
} from './effects-core-v1.js';

const BUNDLE_GATE_ERROR = '日月动变规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '日月动变规则上下文未通过项目运行门';

export function assertProjectEnabledEffectsBundle(
  manifest: unknown = LIUYAO_EFFECTS_V1_MANIFEST,
): void {
  assertReviewedArtifactManifest(manifest, {
    id: { field: 'bundleId', value: 'liuyao_effects_v1' },
    version: '1.0.0',
    artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    sourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
    reportPaths: EFFECTS_REVIEW_REPORT_PATHS,
    errorMessage: BUNDLE_GATE_ERROR,
  });
}

const EXPECTED_PROFILE = canonicalStringify(BASE_RULE_CONTEXT.effectsProfile);
const REQUIRED_SOURCES = EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);

function exactProductionContext(context: unknown): context is RuleContext {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  const candidate = context as RuleContext;
  try {
    return canonicalStringify(candidate.effectsProfile) === EXPECTED_PROFILE
      && hasRegisteredRequiredSources(candidate.sources, REQUIRED_SOURCES);
  } catch {
    return false;
  }
}

export function assertProjectEnabledEffectsContext(
  context: unknown,
): asserts context is RuleContext {
  assertProjectEnabledEffectsBundle();
  if (!exactProductionContext(context)) throw new Error(CONTEXT_GATE_ERROR);
}
