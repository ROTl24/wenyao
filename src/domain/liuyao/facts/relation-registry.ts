import { BASE_RULE_CONTEXT } from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { assertReviewedArtifactManifest } from '../rules/review-gate.js';
import { hasRegisteredRequiredSources } from '../rules/registry.js';
import { canonicalStringify } from '../rules/tables.js';
import {
  RELATION_REVIEW_CHECKED_CLAIMS,
  RELATION_REVIEW_REPORT_PATHS,
} from './relation-manifest-expectations.js';
import {
  RELATION_CORE_V1_ARTIFACT_HASH,
  RELATION_CORE_V1_MANIFEST,
  RELATION_SOURCE_EVIDENCE_CAPSULES,
} from './relation-core-v1.js';

const BUNDLE_GATE_ERROR = '关系规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '关系规则上下文未通过项目运行门';
const CONTEXT_SHAPE_ERROR = '关系规则上下文结构不匹配';

export function assertProjectEnabledRelationBundle(
  manifest: unknown = RELATION_CORE_V1_MANIFEST,
): void {
  assertReviewedArtifactManifest(manifest, {
    id: { field: 'bundleId', value: 'relation_core_v1' },
    version: '1.0.0',
    artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    sourceRefs: RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    checkedClaims: RELATION_REVIEW_CHECKED_CLAIMS,
    reportPaths: RELATION_REVIEW_REPORT_PATHS,
    errorMessage: BUNDLE_GATE_ERROR,
  });
}

function assertRelationContextShape(context: unknown): asserts context is RuleContext {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    throw new Error(CONTEXT_SHAPE_ERROR);
  }
  const candidate = context as Partial<RuleContext>;
  const requiredSources = RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);
  let profileMatches = false;
  try {
    profileMatches = canonicalStringify(candidate.relationProfile)
      === canonicalStringify(BASE_RULE_CONTEXT.relationProfile);
  } catch {
    profileMatches = false;
  }
  if (!profileMatches || !hasRegisteredRequiredSources(candidate.sources, requiredSources)) {
    throw new Error(CONTEXT_SHAPE_ERROR);
  }
}

function assertRelationContextWithManifest(
  context: unknown,
  manifest: unknown,
): void {
  assertProjectEnabledRelationBundle(manifest);
  try {
    assertRelationContextShape(context);
  } catch {
    throw new Error(CONTEXT_GATE_ERROR);
  }
}

export function assertProjectEnabledRelationContext(
  context: unknown,
): asserts context is RuleContext {
  assertRelationContextWithManifest(context, RELATION_CORE_V1_MANIFEST);
}
