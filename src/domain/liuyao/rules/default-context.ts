import {
  RELATION_CORE_V1_ARTIFACT_HASH,
  RELATION_SOURCE_EVIDENCE_CAPSULES,
} from '../facts/relation-core-v1.js';
import {
  GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES,
} from '../facts/growth-shensha-core-v1.js';
import {
  EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
} from '../facts/effects-core-v1.js';
import type { RuleContext, RuleSourceRef } from './model.js';
import { deepFreeze } from './tables.js';
import { RULE_SOURCE_EVIDENCE_CAPSULES } from './wenwang-najia-v2.js';

export function mergeRuleSourceRefs(
  ...groups: readonly (readonly RuleSourceRef[])[]
): readonly RuleSourceRef[] {
  const merged = new Map<string, RuleSourceRef>();
  for (const source of groups.flat()) {
    const existing = merged.get(source.id);
    if (!existing) {
      merged.set(source.id, source);
      continue;
    }
    if (
      existing.title !== source.title
      || existing.url !== source.url
      || existing.locator !== source.locator
      || existing.contentHash !== source.contentHash
    ) throw new Error(`规则来源 ID 冲突：${source.id}`);
  }
  return [...merged.values()];
}

export const REGISTERED_RULE_SOURCES = deepFreeze(mergeRuleSourceRefs(
  RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
  RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
  GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
  EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref),
));

export const BASE_RULE_CONTEXT = deepFreeze({
  schemaVersion: '2.0.0',
  rulePackId: 'wenwang_najia_v2',
  rulePackVersion: '2.0.0',
  calendarProfile: {
    id: 'beijing_jieqi_zichu_v2',
    timezone: 'Asia/Shanghai',
    yearBoundary: 'li-chun-exact',
    monthBoundary: 'jie-exact',
    dayBoundary: 'zi-hour-23',
    library: 'lunar-javascript@1.7.7',
  },
  relationProfile: {
    id: 'yehe_core_v1',
    bundle: {
      id: 'relation_core_v1',
      version: '1.0.0',
      artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    },
    changedRelationReference: 'base-palace',
    harmPolicy: 'liuren-six-harms-v1',
    breakPolicy: 'cross-source-common-four-breaks-v1',
    punishmentPolicy: 'liuren-directional-core-v1',
  },
  effectsProfile: {
    id: 'yehe_effects_v1',
    bundle: {
      id: 'liuyao_effects_v1',
      version: '1.0.0',
      artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
    },
    monthStrengthPolicy: 'yehe-month-status-v1',
    dayClashPolicy: 'yehe-static-strength-aware-v1',
    advanceRetreatPolicy: 'yehe-seven-pair-v1',
    transitionGrowthPolicy: 'five-element-forward-earth-follows-water-v1',
    threeHarmonyPolicy: 'yehe-restricted-members-day-and-transition-tomb-v1',
    fanFuPolicy: 'yehe-corresponding-branches-v1',
  },
  growthProfile: {
    id: 'five-element-forward_v1',
    bundle: {
      id: 'growth_shensha_core_v1',
      version: '1.0.0',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    },
    earthFollows: 'water',
    display: 'all-twelve',
    interpretationWeight: 'sheng-wang-mu-jue-only',
  },
  sixSpiritProfile: {
    id: 'yehe-day-stem-six-spirit-v1',
    bundle: {
      id: 'growth_shensha_core_v1',
      version: '1.0.0',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    },
    source: 'day-stem',
    target: 'base-lines-only',
  },
  shenShaProfile: {
    id: 'yehe_limited_four_v1',
    bundle: {
      id: 'growth_shensha_core_v1',
      version: '1.0.0',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
    },
    enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
    authority: 'secondary',
    tianyiPolicy: 'zengshan-taiyi-day-stem-v1',
    lushenPolicy: 'zengshan-day-stem-lushen-v1',
    yimaPolicy: 'zengshan-day-branch-three-harmony-v1',
    tianxiPolicy: 'zengshan-seasonal-month-branch-v1',
  },
  useGodProfile: {
    id: 'explicit_intent_first_v1',
    ambiguousIntent: 'ask-user',
    multipleCandidates: 'retain-ranked-candidates',
  },
  sources: [],
} as const satisfies RuleContext);

export const DEFAULT_RULE_CONTEXT = deepFreeze({
  ...BASE_RULE_CONTEXT,
  sources: REGISTERED_RULE_SOURCES,
} as const satisfies RuleContext);
