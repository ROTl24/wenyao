import type { RuleContext } from './model.js';

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

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
    dayClashPolicy: 'strength-aware',
    changedRelationReference: 'base-palace',
  },
  growthProfile: {
    id: 'five-element-forward_v1',
    earthFollows: 'water',
    display: 'all-twelve',
    interpretationWeight: 'sheng-wang-mu-jue-only',
  },
  shenShaProfile: {
    id: 'yehe_limited_four_v1',
    enabled: ['tianyi', 'lushen', 'yima', 'tianxi'],
    authority: 'secondary',
  },
  useGodProfile: {
    id: 'explicit_intent_first_v1',
    ambiguousIntent: 'ask-user',
    multipleCandidates: 'retain-ranked-candidates',
  },
  sources: [],
} as const satisfies RuleContext);
