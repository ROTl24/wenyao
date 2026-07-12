import { assertProjectEnabledEffectsContext } from '../facts/effects-registry.js';
import { assertProjectEnabledGrowthShenShaContext } from '../facts/growth-shensha-registry.js';
import { assertProjectEnabledRelationContext } from '../facts/relation-registry.js';
import { BASE_RULE_CONTEXT } from './default-context.js';
import type { RuleContext } from './model.js';
import { assertReviewedArtifactManifest } from './review-gate.js';
import {
  assertProjectEnabledRuleContext,
  hasRegisteredRequiredSources,
} from './registry.js';
import { canonicalStringify } from './tables.js';
import {
  USE_GOD_REVIEW_CHECKED_CLAIMS,
  USE_GOD_REVIEW_REPORT_PATHS,
} from './use-god-manifest-expectations.js';
import {
  USE_GOD_CORE_V1_ARTIFACT_HASH,
  USE_GOD_CORE_V1_MANIFEST,
  USE_GOD_SOURCE_EVIDENCE_CAPSULES,
} from './use-god-core-v1.js';

const BUNDLE_GATE_ERROR = '用神规则包未通过项目运行门';
const CONTEXT_GATE_ERROR = '用神规则上下文未通过项目运行门';

export function assertProjectEnabledUseGodBundle(
  manifest: unknown = USE_GOD_CORE_V1_MANIFEST,
): void {
  assertReviewedArtifactManifest(manifest, {
    id: { field: 'bundleId', value: 'use_god_core_v1' },
    version: '1.0.0',
    artifactHash: USE_GOD_CORE_V1_ARTIFACT_HASH,
    sourceRefs: USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
    checkedClaims: USE_GOD_REVIEW_CHECKED_CLAIMS,
    reportPaths: USE_GOD_REVIEW_REPORT_PATHS,
    errorMessage: BUNDLE_GATE_ERROR,
  });
}

const EXPECTED_PROFILE = canonicalStringify(BASE_RULE_CONTEXT.useGodProfile);
const REQUIRED_SOURCES = USE_GOD_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref);

function exactProductionContext(context: unknown): context is RuleContext {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  const candidate = context as RuleContext;
  try {
    return canonicalStringify(candidate.useGodProfile) === EXPECTED_PROFILE
      && hasRegisteredRequiredSources(candidate.sources, REQUIRED_SOURCES);
  } catch {
    return false;
  }
}

export function assertProjectEnabledUseGodContext(
  context: unknown,
): asserts context is RuleContext {
  try {
    assertProjectEnabledUseGodBundle();
    assertProjectEnabledRuleContext(context);
    assertProjectEnabledRelationContext(context);
    assertProjectEnabledGrowthShenShaContext(context);
    assertProjectEnabledEffectsContext(context);
  } catch {
    throw new Error(CONTEXT_GATE_ERROR);
  }
  if (!exactProductionContext(context)) throw new Error(CONTEXT_GATE_ERROR);
}
