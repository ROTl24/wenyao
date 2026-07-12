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
    dayClashPolicy: 'strength-aware';
    changedRelationReference: 'base-palace';
  };
  growthProfile: {
    id: 'five-element-forward_v1';
    earthFollows: 'water';
    display: 'all-twelve';
    interpretationWeight: 'sheng-wang-mu-jue-only';
  };
  shenShaProfile: {
    id: 'yehe_limited_four_v1';
    enabled: readonly ['tianyi', 'lushen', 'yima', 'tianxi'];
    authority: 'secondary';
  };
  useGodProfile: {
    id: 'explicit_intent_first_v1';
    ambiguousIntent: 'ask-user';
    multipleCandidates: 'retain-ranked-candidates';
  };
  sources: readonly RuleSourceRef[];
}
