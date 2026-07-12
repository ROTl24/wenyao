export type RuleAuthority = 'structural' | 'profile-dependent' | 'secondary';

export interface RuleSourceRef {
  id: string;
  title: string;
  url: string;
  locator: string;
  contentHash: string;
}

export type VerificationLevel = 'unverified' | 'independent-automated' | 'human-reviewed';
export type RulePackRuntimeStatus = 'fixture-only' | 'project-enabled';

export interface RuleReviewRecord {
  reviewerId: string;
  reviewerKind: 'automated-agent' | 'human';
  independentRunId: string;
  reviewedAt: string;
  artifactHash: string;
  outcome: 'matched' | 'disputed';
  inputSourceRefs: readonly string[];
  reportPath: string;
  checkedClaims: readonly string[];
}

export interface RulePackManifest {
  rulePackId: 'wenwang_najia_v2';
  version: string;
  artifactHash: string;
  verificationLevel: VerificationLevel;
  runtimeStatus: RulePackRuntimeStatus;
  reviews: readonly RuleReviewRecord[];
  sourceRefs: readonly string[];
}

export interface RelationRuleBundleManifest {
  bundleId: 'relation_core_v1';
  version: '1.0.0';
  artifactHash: string;
  verificationLevel: VerificationLevel;
  runtimeStatus: RulePackRuntimeStatus;
  reviews: readonly RuleReviewRecord[];
  sourceRefs: readonly string[];
}

export interface GrowthShenShaRuleBundleManifest {
  bundleId: 'growth_shensha_core_v1';
  version: '1.0.0';
  artifactHash: string;
  verificationLevel: VerificationLevel;
  runtimeStatus: RulePackRuntimeStatus;
  reviews: readonly RuleReviewRecord[];
  sourceRefs: readonly string[];
}

export interface EffectsRuleBundleManifest {
  bundleId: 'liuyao_effects_v1';
  version: '1.0.0';
  artifactHash: string;
  verificationLevel: VerificationLevel;
  runtimeStatus: RulePackRuntimeStatus;
  reviews: readonly RuleReviewRecord[];
  sourceRefs: readonly string[];
}

export interface EffectsBundleRef {
  id: 'liuyao_effects_v1';
  version: '1.0.0';
  artifactHash: string;
}

export interface GrowthShenShaBundleRef {
  id: 'growth_shensha_core_v1';
  version: '1.0.0';
  artifactHash: string;
}

export type RelationHarmPolicy = 'liuren-six-harms-v1';
export type RelationBreakPolicy =
  | 'cross-source-common-four-breaks-v1'
  | 'liuren-six-breaks-v1'
  | 'wuxingjingji-four-breaks-v1';
export type RelationPunishmentPolicy = 'liuren-directional-core-v1';

export interface RelationMatchingProfile {
  id: string;
  bundle: {
    id: 'relation_core_v1';
    version: '1.0.0';
    artifactHash: string;
  };
  harmPolicy: RelationHarmPolicy;
  breakPolicy: RelationBreakPolicy;
  punishmentPolicy: RelationPunishmentPolicy;
}

export interface RuleContext {
  schemaVersion: '2.0.0';
  rulePackId: 'wenwang_najia_v2';
  rulePackVersion: string;
  calendarProfile: {
    id: 'beijing_jieqi_zichu_v2';
    timezone: 'Asia/Shanghai';
    yearBoundary: 'li-chun-exact';
    monthBoundary: 'jie-exact';
    dayBoundary: 'zi-hour-23';
    library: 'lunar-javascript@1.7.7';
  };
  relationProfile: {
    id: 'yehe_core_v1';
    bundle: {
      id: 'relation_core_v1';
      version: '1.0.0';
      artifactHash: string;
    };
    changedRelationReference: 'base-palace';
    harmPolicy: 'liuren-six-harms-v1';
    breakPolicy: 'cross-source-common-four-breaks-v1';
    punishmentPolicy: 'liuren-directional-core-v1';
  };
  effectsProfile: {
    id: 'yehe_effects_v1';
    bundle: EffectsBundleRef;
    monthStrengthPolicy: 'yehe-month-status-v1';
    dayClashPolicy: 'yehe-static-strength-aware-v1';
    advanceRetreatPolicy: 'yehe-seven-pair-v1';
    transitionGrowthPolicy: 'five-element-forward-earth-follows-water-v1';
    threeHarmonyPolicy: 'yehe-restricted-members-day-and-transition-tomb-v1';
    fanFuPolicy: 'yehe-corresponding-branches-v1';
  };
  growthProfile: {
    id: 'five-element-forward_v1';
    bundle: GrowthShenShaBundleRef;
    earthFollows: 'water';
    display: 'all-twelve';
    interpretationWeight: 'sheng-wang-mu-jue-only';
  };
  sixSpiritProfile: {
    id: 'yehe-day-stem-six-spirit-v1';
    bundle: GrowthShenShaBundleRef;
    source: 'day-stem';
    target: 'base-lines-only';
  };
  shenShaProfile: {
    id: 'yehe_limited_four_v1';
    bundle: GrowthShenShaBundleRef;
    enabled: readonly ['tianyi', 'lushen', 'yima', 'tianxi'];
    authority: 'secondary';
    tianyiPolicy: 'zengshan-taiyi-day-stem-v1';
    lushenPolicy: 'zengshan-day-stem-lushen-v1';
    yimaPolicy: 'zengshan-day-branch-three-harmony-v1';
    tianxiPolicy: 'zengshan-seasonal-month-branch-v1';
  };
  useGodProfile: {
    id: 'explicit_intent_first_v1';
    ambiguousIntent: 'ask-user';
    multipleCandidates: 'retain-ranked-candidates';
  };
  sources: readonly RuleSourceRef[];
}
