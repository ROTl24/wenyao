import type { Branch } from '../model.js';
import type {
  RelationBreakPolicy,
  RelationHarmPolicy,
  RelationPunishmentPolicy,
  RelationRuleBundleManifest,
  RuleAuthority,
  RuleSourceRef,
} from '../rules/model.js';
import { canonicalStringify, deepFreeze } from '../rules/tables.js';
import { WENWANG_NAJIA_V2_ARTIFACT_HASH } from '../rules/wenwang-najia-v2.js';
import {
  RELATION_REVIEW_CHECKED_CLAIMS,
  RELATION_REVIEW_REPORT_PATHS,
} from './relation-manifest-expectations.js';

export interface RelationSourceEvidenceCapsule {
  readonly ref: RuleSourceRef;
  readonly payload: string;
}

type FactCertainty = 'computed' | 'disputed';
type SymmetricPair = readonly [Branch, Branch];
type DirectedPair = readonly [Branch, Branch];

interface RelationRuleBase {
  readonly ruleId: string;
  readonly profileId: string;
  readonly authority: RuleAuthority;
  readonly certainty: FactCertainty;
  readonly sourceRefs: readonly string[];
  readonly version: '1.0.0';
}

export interface RelationElementRule extends RelationRuleBase {
  readonly kind: 'element';
  readonly relation: 'generates' | 'controls' | 'same-element';
  readonly primitive: 'wenwang-generates' | 'wenwang-controls' | 'identity';
}

export interface RelationBranchRule extends RelationRuleBase {
  readonly kind: 'branch';
  readonly relation: 'combines' | 'clashes' | 'harms' | 'breaks' | 'punishes';
  readonly direction: 'symmetric' | 'directed';
  readonly pairs: readonly (SymmetricPair | DirectedPair)[];
}

export interface RelationCoreV1Artifact {
  readonly artifactSchema: 'liuyao-relation-core/v1';
  readonly bundleId: 'relation_core_v1';
  readonly version: '1.0.0';
  readonly dependsOnWenwangArtifactHash: string;
  readonly elementRules: readonly RelationElementRule[];
  readonly branchRules: readonly RelationBranchRule[];
  readonly defaultPolicies: {
    readonly harmPolicy: RelationHarmPolicy;
    readonly breakPolicy: 'cross-source-common-four-breaks-v1';
    readonly punishmentPolicy: RelationPunishmentPolicy;
  };
}

export const RELATION_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  {
    ref: {
      id: 'WS-ZENGSHAN-11',
      title: '《增删卜易·五行相生章》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315',
      locator: '五行相生章：金生水、水生木、木生火、火生土、土生金',
      contentHash: 'f16f6336f4fb7df3dae731dbfbc409828edd1fe14dce9d6e11495b61ad0df50c',
    },
    payload: 'sourceId=WS-ZENGSHAN-11\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/11&oldid=2100315\nlocator=五行相生章\nnormalizedClaim=木生火、火生土、土生金、金生水、水生木',
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-12',
      title: '《增删卜易·五行相克章》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316',
      locator: '五行相克章：金克木、木克土、土克水、水克火、火克金',
      contentHash: '1511a1abe713d5ac655b279cf3431f7c1adc05bac644d500c1b6f9dd83d5441a',
    },
    payload: 'sourceId=WS-ZENGSHAN-12\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/12&oldid=2100316\nlocator=五行相克章\nnormalizedClaim=木克土、土克水、水克火、火克金、金克木',
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-19',
      title: '《增删卜易·六合章》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447',
      locator: '六合章：子丑、寅亥、卯戌、辰酉、巳申、午未',
      contentHash: 'd79377f29e075dd8f6f2aa0d386f7e261fa4258d596709e2b0b4ebd0b8787721',
    },
    payload: 'sourceId=WS-ZENGSHAN-19\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447\nlocator=六合章\nnormalizedClaim=子丑、寅亥、卯戌、辰酉、巳申、午未',
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-20',
      title: '《增删卜易·六冲章》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449',
      locator: '六冲章：子午、丑未、寅申、卯酉、辰戌、巳亥',
      contentHash: '53e84f4b5c9b20b7364b7a482d590231f23e9eb0cc2d6bdab2c74836e302b546',
    },
    payload: 'sourceId=WS-ZENGSHAN-20\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/20&oldid=2100449\nlocator=六冲章\nnormalizedClaim=子午、丑未、寅申、卯酉、辰戌、巳亥',
  },
  {
    ref: {
      id: 'WS-LIUREN-DAQUAN-1',
      title: '《六壬大全/卷一》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E5%85%AD%E5%A3%AC%E5%A4%A7%E5%85%A8/1&oldid=854569',
      locator: '卷一“十二支破”“十二支害”“十二支刑”三条',
      contentHash: 'cd27a67f0265fc79cc6683a17ce6bcd90d1a2c01d3657e4860823e46ef2c1ed4',
    },
    payload: 'sourceId=WS-LIUREN-DAQUAN-1\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E5%85%AD%E5%A3%AC%E5%A4%A7%E5%85%A8/1&oldid=854569\nlocator=卷一“十二支破”“十二支害”“十二支刑”三条\nnormalizedClaim=六害子未丑午寅巳卯辰申亥酉戌；六破子酉丑辰寅亥卯午巳申未戌；有向刑寅巳、巳申、丑戌、戌未、子卯互刑及辰午酉亥自刑',
  },
  {
    ref: {
      id: 'WS-WUXING-JINGJI',
      title: '《五行精纪》',
      url: 'https://zh.wikisource.org/w/index.php?title=%E4%BA%94%E8%A1%8C%E7%B2%BE%E7%B4%80&oldid=2352956',
      locator: '“破杀”条：子酉、丑辰、卯午、未戌',
      contentHash: 'a0425df7a140eaaa0af02774092d3562c5d9deae8d54fd8ab47bcb0f283f2f41',
    },
    payload: 'sourceId=WS-WUXING-JINGJI\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E4%BA%94%E8%A1%8C%E7%B2%BE%E7%B4%80&oldid=2352956\nlocator=“破杀”条\nnormalizedClaim=子酉、丑辰、卯午、未戌',
  },
] as const satisfies readonly RelationSourceEvidenceCapsule[]);

const SOURCE = {
  generates: 'WS-ZENGSHAN-11',
  controls: 'WS-ZENGSHAN-12',
  combines: 'WS-ZENGSHAN-19',
  clashes: 'WS-ZENGSHAN-20',
  liuren: 'WS-LIUREN-DAQUAN-1',
  wuxingJingji: 'WS-WUXING-JINGJI',
} as const;

export const RELATION_CORE_V1_ARTIFACT = deepFreeze({
  artifactSchema: 'liuyao-relation-core/v1',
  bundleId: 'relation_core_v1',
  version: '1.0.0',
  dependsOnWenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
  elementRules: [
    { kind: 'element', relation: 'generates', primitive: 'wenwang-generates', ruleId: 'element-generates/v1', profileId: 'relation_core_v1', authority: 'structural', certainty: 'computed', sourceRefs: [SOURCE.generates], version: '1.0.0' },
    { kind: 'element', relation: 'controls', primitive: 'wenwang-controls', ruleId: 'element-controls/v1', profileId: 'relation_core_v1', authority: 'structural', certainty: 'computed', sourceRefs: [SOURCE.controls], version: '1.0.0' },
    { kind: 'element', relation: 'same-element', primitive: 'identity', ruleId: 'element-same/v1', profileId: 'relation_core_v1', authority: 'structural', certainty: 'computed', sourceRefs: [SOURCE.generates, SOURCE.controls], version: '1.0.0' },
  ],
  branchRules: [
    { kind: 'branch', relation: 'combines', direction: 'symmetric', pairs: [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']], ruleId: 'branch-six-combines/v1', profileId: 'relation_core_v1', authority: 'structural', certainty: 'computed', sourceRefs: [SOURCE.combines], version: '1.0.0' },
    { kind: 'branch', relation: 'clashes', direction: 'symmetric', pairs: [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']], ruleId: 'branch-six-clashes/v1', profileId: 'relation_core_v1', authority: 'structural', certainty: 'computed', sourceRefs: [SOURCE.clashes], version: '1.0.0' },
    { kind: 'branch', relation: 'harms', direction: 'symmetric', pairs: [['子', '未'], ['丑', '午'], ['寅', '巳'], ['卯', '辰'], ['申', '亥'], ['酉', '戌']], ruleId: 'branch-six-harms/v1', profileId: 'liuren-six-harms-v1', authority: 'profile-dependent', certainty: 'computed', sourceRefs: [SOURCE.liuren], version: '1.0.0' },
    { kind: 'branch', relation: 'breaks', direction: 'symmetric', pairs: [['子', '酉'], ['丑', '辰'], ['寅', '亥'], ['卯', '午'], ['巳', '申'], ['未', '戌']], ruleId: 'branch-six-breaks-liuren/v1', profileId: 'liuren-six-breaks-v1', authority: 'profile-dependent', certainty: 'disputed', sourceRefs: [SOURCE.liuren], version: '1.0.0' },
    { kind: 'branch', relation: 'breaks', direction: 'symmetric', pairs: [['子', '酉'], ['丑', '辰'], ['卯', '午'], ['未', '戌']], ruleId: 'branch-four-breaks-wuxingjingji/v1', profileId: 'wuxingjingji-four-breaks-v1', authority: 'profile-dependent', certainty: 'disputed', sourceRefs: [SOURCE.wuxingJingji], version: '1.0.0' },
    { kind: 'branch', relation: 'breaks', direction: 'symmetric', pairs: [['子', '酉'], ['丑', '辰'], ['卯', '午'], ['未', '戌']], ruleId: 'branch-common-four-breaks/v1', profileId: 'cross-source-common-four-breaks-v1', authority: 'profile-dependent', certainty: 'disputed', sourceRefs: [SOURCE.liuren, SOURCE.wuxingJingji], version: '1.0.0' },
    { kind: 'branch', relation: 'punishes', direction: 'directed', pairs: [['寅', '巳'], ['巳', '申'], ['丑', '戌'], ['戌', '未'], ['子', '卯'], ['卯', '子'], ['辰', '辰'], ['午', '午'], ['酉', '酉'], ['亥', '亥']], ruleId: 'branch-directional-punishments-liuren/v1', profileId: 'liuren-directional-core-v1', authority: 'profile-dependent', certainty: 'disputed', sourceRefs: [SOURCE.liuren], version: '1.0.0' },
  ],
  defaultPolicies: {
    harmPolicy: 'liuren-six-harms-v1',
    breakPolicy: 'cross-source-common-four-breaks-v1',
    punishmentPolicy: 'liuren-directional-core-v1',
  },
} as const satisfies RelationCoreV1Artifact);

export const RELATION_CORE_V1_CANONICAL_PAYLOAD = canonicalStringify(RELATION_CORE_V1_ARTIFACT);

// 由审查脚本对 UTF-8 canonical payload 独立复算；领域运行时不依赖 node:crypto。
export const RELATION_CORE_V1_ARTIFACT_HASH = '60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608';

export const RELATION_CORE_V1_MANIFEST = deepFreeze({
  bundleId: 'relation_core_v1',
  version: '1.0.0',
  artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
  verificationLevel: 'independent-automated',
  runtimeStatus: 'project-enabled',
  reviews: [
    {
      reviewerId: 'codex-wikisource-relation-a',
      reviewerKind: 'automated-agent',
      independentRunId: 'relation-core-a-rerun-20260712-093342-3136109',
      reviewedAt: '2026-07-12T09:33:42.3136109+08:00',
      artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: RELATION_REVIEW_REPORT_PATHS[0],
      checkedClaims: RELATION_REVIEW_CHECKED_CLAIMS,
    },
    {
      reviewerId: 'codex-corpus-relation-b',
      reviewerKind: 'automated-agent',
      independentRunId: 'relation-core-v1-b-0656a5f5-e8e3-47e0-9df5-02d0fd919f8a',
      reviewedAt: '2026-07-12T09:34:19.2997047+08:00',
      artifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: RELATION_REVIEW_REPORT_PATHS[1],
      checkedClaims: RELATION_REVIEW_CHECKED_CLAIMS,
    },
  ],
  sourceRefs: RELATION_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
} as const satisfies RelationRuleBundleManifest);
