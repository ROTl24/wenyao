import type { Branch, FactRelation } from '../model.js';
import type {
  EffectsRuleBundleManifest,
  RuleAuthority,
  RuleSourceRef,
} from '../rules/model.js';
import { canonicalStringify, deepFreeze } from '../rules/tables.js';
import { WENWANG_NAJIA_V2_ARTIFACT_HASH } from '../rules/wenwang-najia-v2.js';
import { GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH, GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES } from './growth-shensha-core-v1.js';
import { RELATION_CORE_V1_ARTIFACT_HASH, RELATION_SOURCE_EVIDENCE_CAPSULES } from './relation-core-v1.js';
import {
  EFFECTS_REVIEW_CHECKED_CLAIMS,
  EFFECTS_REVIEW_REPORT_PATHS,
} from './effects-manifest-expectations.js';

export interface EffectsSourceEvidenceCapsule {
  readonly ref: RuleSourceRef;
  readonly payload: string;
}

export type MonthStatus =
  | 'commanding'
  | 'same-element'
  | 'generated-by-month'
  | 'residual-qi'
  | 'resting';

interface EffectsRule {
  readonly relation: FactRelation;
  readonly ruleId: string;
  readonly profileId: string;
  readonly authority: RuleAuthority;
  readonly certainty: 'computed' | 'conditional' | 'delegated-twelve-stage';
  readonly sourceRefs: readonly string[];
  readonly version: '1.0.0';
}

const CORPUS_VERSION = '2026.07.11-user-books-1';
const ZENGSHAN_BOOK_HASH = '5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae';
const BUSHI_BOOK_HASH = 'e6ba468011293b3f4cd368a3f5c66c284334b1dcb96dd5530f9b749c84ba881b';

const SEASONS_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/15%E5%8F%88&oldid=2100323';
const MOVING_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/15&oldid=2100321';
const THREE_HARMONY_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/19&oldid=2100447';
const DAY_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/17&oldid=2100338';
const FAN_FU_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/25&oldid=2100458';
const VOID_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/26&oldid=2100460';

const OWNED_EFFECTS_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  {
    ref: {
      id: 'WS-ZENGSHAN-SEASONS-2100323',
      title: '《增删卜易·四时旺相章》',
      url: SEASONS_URL,
      locator: '四时旺相章：月建、同五行、月生及未火丑水余气',
      contentHash: '81fd4baddc7171116e544a987a89cecf0c5c520134ff230c8750825b06bf705e',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-SEASONS-2100323',
      `fixedUrl=${SEASONS_URL}`,
      'locator=四时旺相章第又十五',
      'normalizedClaim=同支当令；同五行归类，对冲土支另标月破且不作有效生扶；月令所生为相；未月火、丑月水为余气；其余休囚',
      'normalizationNote=原文正二月休囚句重复“火”并漏“水”；候选按同段旺相结构归一为“其余休囚”；丑月水余气为原文直载',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-MOVING-2100321',
      title: '《增删卜易·动变生克冲合章》',
      url: MOVING_URL,
      locator: '动变生克冲合章第十五：变爻回头作用于本位动爻',
      contentHash: '8a3bd4cb3162a7260d0f33b9bb05616844335d96c46d0221c98ab36af180a641',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-MOVING-2100321',
      `fixedUrl=${MOVING_URL}`,
      'locator=动变生克冲合章第十五',
      'normalizedClaim=变爻对本位动爻按变生、变克、变冲、变合方向判定回头生克冲合',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-THREE-HARMONY-2100447',
      title: '《增删卜易·六合章》三合条',
      url: THREE_HARMONY_URL,
      locator: '六合章三合条：四组三合、两动补局及空破入墓条件',
      contentHash: 'b4cca4a1168daddee1f1381c51cf8232ca0a74510ed0b74a1b2c25eef295a347',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-THREE-HARMONY-2100447',
      `fixedUrl=${THREE_HARMONY_URL}`,
      'locator=六合章三合条',
      'normalizedClaim=本卦三支齐且至少一员动/暗动；内初三或外四六同时明动可由其中一个本位化爻补局；空破日破/日墓/化墓降候选',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-DAY-2100338',
      title: '《增删卜易·日辰章》',
      url: DAY_URL,
      locator: '日辰章：静旺逢日冲为暗动、休囚逢日冲为日破',
      contentHash: '82da6f9676ad40a24d06b4eaf1f54fe7b13df88d3fb4fc18cec52c6bf65e21f9',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-DAY-2100338',
      `fixedUrl=${DAY_URL}`,
      'locator=日辰章第十七',
      'normalizedClaim=日支冲静爻先保留原始冲；旺静条件分类为暗动，休囚无扶条件分类为日破',
      'normalizationNote=无扶白名单是产品profile操作化，非原文完整算法',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-FAN-FU-2100458',
      title: '《增删卜易·反伏章》',
      url: FAN_FU_URL,
      locator: '反伏章：内外卦对应地支反吟、伏吟及半卦变化',
      contentHash: '5f683b9e4bf080dbc9919973b279e63d38dca6d8217c1bf180c68e661cd5f048',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-FAN-FU-2100458',
      `fixedUrl=${FAN_FU_URL}`,
      'locator=反伏章第二十五',
      'normalizedClaim=本变对应三支全冲为反吟、全同为伏吟；区分内外且该半卦须有实际变化',
      'normalizationNote=对应支全冲/全同且半卦实动是由2100458例证提炼的命名profile；方位法只保留在禁用的《卜筮正宗》variant',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-VOID-2100460',
      title: '《增删卜易·旬空章》',
      url: VOID_URL,
      locator: '旬空章：六旬各空两支',
      contentHash: '4cf2d5f1acc0ea6cb532329dc7865fe733d97d4b18791f1e82a65802bc513646',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-VOID-2100460',
      `fixedUrl=${VOID_URL}`,
      'locator=旬空章第二十六',
      'normalizedClaim=甲子戌亥、甲戌申酉、甲申午未、甲午辰巳、甲辰寅卯、甲寅子丑',
    ].join('\n'),
  },
  {
    ref: {
      id: 'CORPUS-ZENGSHAN-EFFECTS',
      title: '本地语料《增删卜易》日月动变与卦局条目',
      url: `urn:wenyao:corpus:ZENGSHAN-BUYI@${CORPUS_VERSION}`,
      locator: 'ZENGSHAN-BUYI-0047/0048/0054/0056/0057/0058/0060/0062/0063/0064/0066/0079',
      contentHash: '218bf82923531754da057049700a42931f8f27b9e401832f85ac3e2f52f49267',
    },
    payload: [
      'sourceId=CORPUS-ZENGSHAN-EFFECTS',
      `fixedUrl=urn:wenyao:corpus:ZENGSHAN-BUYI@${CORPUS_VERSION}`,
      `localBookSha256=${ZENGSHAN_BOOK_HASH}`,
      'localEntries=ZENGSHAN-BUYI-0047:13f51c0e23bd25d99ad0887fcfae4eeb4dbe423596438a6299edb5e337a524d7,ZENGSHAN-BUYI-0048:8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b,ZENGSHAN-BUYI-0054:0f2009f48b1eb2cd1bbe5bcceda7c07c0d505dfbcfdcde0effd3ce4de244ab8e,ZENGSHAN-BUYI-0056:1d818e39a2f6d1510b87dfe8e0b0dcf87386c9676ab9faccc02db518dd6d332c,ZENGSHAN-BUYI-0057:8ca5e3329fe5ae98aed5703878e6c54ab6c1c7095881694aa5b6923ef01d51ce,ZENGSHAN-BUYI-0058:13ddbbf4040c7bd90c1ba93779b2c529353d02ca110dce5dea0ce50eb5dd9d64,ZENGSHAN-BUYI-0060:e8afac171243393b25858f37925fb3e686be259276022aeb2f98d079ee16b932,ZENGSHAN-BUYI-0062:34c393656661ebd31df4eb2d80e9e178896b6abdc2f734acada67f2cfe37eda8,ZENGSHAN-BUYI-0063:dad94225c5a75e4abba8e7acc26915c6a75dc370232b6f9fe409cf97ce41e286,ZENGSHAN-BUYI-0064:032e33e83153b4217aa75a552ebd1a8b92feff66d806096280baca0bb7f19732,ZENGSHAN-BUYI-0066:a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a,ZENGSHAN-BUYI-0079:cd41af7f1ef51b05290badd128e7b656ae4baaed200f01f45a2af5bbd618809d',
    ].join('\n'),
  },
  {
    ref: {
      id: 'CORPUS-BUSHI-EFFECTS',
      title: '本地语料《卜筮正宗》旬空月破、八对进退与方位反吟条目',
      url: `urn:wenyao:corpus:BUSHI-ZHENGZONG@${CORPUS_VERSION}`,
      locator: 'BUSHI-ZHENGZONG-0046/0047/0095/0097',
      contentHash: '1734bc45e5c7fdd50ccdd42534c3d59c6af8291ddcb83b6bf61e4810709d8e45',
    },
    payload: [
      'sourceId=CORPUS-BUSHI-EFFECTS',
      `fixedUrl=urn:wenyao:corpus:BUSHI-ZHENGZONG@${CORPUS_VERSION}`,
      `localBookSha256=${BUSHI_BOOK_HASH}`,
      'localEntries=BUSHI-ZHENGZONG-0046:d863150cbda9a39ba1a2d5d24e5ec24b4792a6ba0f1b34c82f38b3af1790b86b,BUSHI-ZHENGZONG-0047:834fcfbc31881afd7aba78021a97a28d994db0e93f69d2eea01184dd425af8f4,BUSHI-ZHENGZONG-0095:c06f824c4b00d4bf1305922a0a95b2c988ac97e92ad2cf866822d59e88dae760,BUSHI-ZHENGZONG-0097:5ef89ee43992127c1c0813094de00bd965c9a33a40882018e279949ae205efb7',
    ].join('\n'),
  },
] as const satisfies readonly EffectsSourceEvidenceCapsule[]);

const relationSource = (id: string) => {
  const capsule = RELATION_SOURCE_EVIDENCE_CAPSULES.find(({ ref }) => ref.id === id);
  if (!capsule) throw new Error(`effects 依赖来源缺失：${id}`);
  return capsule;
};

const growthSource = GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.find(
  ({ ref }) => ref.id === 'WS-ZENGSHAN-GROWTH-2100461',
);
if (!growthSource) throw new Error('effects 依赖来源缺失：WS-ZENGSHAN-GROWTH-2100461');

export const EFFECTS_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  ...OWNED_EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  relationSource('WS-ZENGSHAN-11'),
  relationSource('WS-ZENGSHAN-12'),
  relationSource('WS-ZENGSHAN-19'),
  relationSource('WS-ZENGSHAN-20'),
  growthSource,
] as const satisfies readonly EffectsSourceEvidenceCapsule[]);

const SOURCE = {
  seasons: 'WS-ZENGSHAN-SEASONS-2100323',
  moving: 'WS-ZENGSHAN-MOVING-2100321',
  threeHarmony: 'WS-ZENGSHAN-THREE-HARMONY-2100447',
  day: 'WS-ZENGSHAN-DAY-2100338',
  fanFu: 'WS-ZENGSHAN-FAN-FU-2100458',
  void: 'WS-ZENGSHAN-VOID-2100460',
  localZengshan: 'CORPUS-ZENGSHAN-EFFECTS',
  localBushi: 'CORPUS-BUSHI-EFFECTS',
  generates: 'WS-ZENGSHAN-11',
  controls: 'WS-ZENGSHAN-12',
  combines: 'WS-ZENGSHAN-19',
  clashes: 'WS-ZENGSHAN-20',
  growth: 'WS-ZENGSHAN-GROWTH-2100461',
} as const;

const rule = (
  relation: FactRelation,
  ruleId: string,
  authority: RuleAuthority,
  certainty: EffectsRule['certainty'],
  sourceRefs: readonly string[],
): EffectsRule => ({
  relation,
  ruleId,
  profileId: 'yehe_effects_v1',
  authority,
  certainty,
  sourceRefs,
  version: '1.0.0',
});

export const LIUYAO_EFFECTS_V1_ARTIFACT = deepFreeze({
  artifactSchema: 'liuyao-effects-core/v1',
  bundleId: 'liuyao_effects_v1',
  version: '1.0.0',
  dependsOn: {
    wenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    relationArtifactHash: RELATION_CORE_V1_ARTIFACT_HASH,
    growthShenShaArtifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  },
  localCorpus: {
    corpusVersion: CORPUS_VERSION,
    books: [
      {
        sourceId: 'ZENGSHAN-BUYI',
        bookSha256: ZENGSHAN_BOOK_HASH,
        entries: [
          ['ZENGSHAN-BUYI-0047', '13f51c0e23bd25d99ad0887fcfae4eeb4dbe423596438a6299edb5e337a524d7'],
          ['ZENGSHAN-BUYI-0048', '8093a8de4643f9d7baa0c6a29797686c88dbc96e29ef0b0cc87d2a174d6cf61b'],
          ['ZENGSHAN-BUYI-0054', '0f2009f48b1eb2cd1bbe5bcceda7c07c0d505dfbcfdcde0effd3ce4de244ab8e'],
          ['ZENGSHAN-BUYI-0056', '1d818e39a2f6d1510b87dfe8e0b0dcf87386c9676ab9faccc02db518dd6d332c'],
          ['ZENGSHAN-BUYI-0057', '8ca5e3329fe5ae98aed5703878e6c54ab6c1c7095881694aa5b6923ef01d51ce'],
          ['ZENGSHAN-BUYI-0058', '13ddbbf4040c7bd90c1ba93779b2c529353d02ca110dce5dea0ce50eb5dd9d64'],
          ['ZENGSHAN-BUYI-0060', 'e8afac171243393b25858f37925fb3e686be259276022aeb2f98d079ee16b932'],
          ['ZENGSHAN-BUYI-0062', '34c393656661ebd31df4eb2d80e9e178896b6abdc2f734acada67f2cfe37eda8'],
          ['ZENGSHAN-BUYI-0063', 'dad94225c5a75e4abba8e7acc26915c6a75dc370232b6f9fe409cf97ce41e286'],
          ['ZENGSHAN-BUYI-0064', '032e33e83153b4217aa75a552ebd1a8b92feff66d806096280baca0bb7f19732'],
          ['ZENGSHAN-BUYI-0066', 'a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a'],
          ['ZENGSHAN-BUYI-0079', 'cd41af7f1ef51b05290badd128e7b656ae4baaed200f01f45a2af5bbd618809d'],
        ],
      },
      {
        sourceId: 'BUSHI-ZHENGZONG',
        bookSha256: BUSHI_BOOK_HASH,
        entries: [
          ['BUSHI-ZHENGZONG-0046', 'd863150cbda9a39ba1a2d5d24e5ec24b4792a6ba0f1b34c82f38b3af1790b86b'],
          ['BUSHI-ZHENGZONG-0047', '834fcfbc31881afd7aba78021a97a28d994db0e93f69d2eea01184dd425af8f4'],
          ['BUSHI-ZHENGZONG-0095', 'c06f824c4b00d4bf1305922a0a95b2c988ac97e92ad2cf866822d59e88dae760'],
          ['BUSHI-ZHENGZONG-0097', '5ef89ee43992127c1c0813094de00bd965c9a33a40882018e279949ae205efb7'],
        ],
      },
    ],
  },
  monthStatus: {
    priority: ['commanding', 'same-element', 'generated-by-month', 'residual-qi', 'resting'] as const,
    residualPairs: [['未', '巳'], ['未', '午'], ['丑', '子'], ['丑', '亥']] as const,
    effectiveSupportStatuses: ['commanding', 'same-element', 'generated-by-month'] as const,
  },
  dayClash: {
    appliesTo: 'static-base-lines-only',
    supportSources: ['month', 'day', 'other-moving-base-line'] as const,
    supportRelations: ['generates', 'same-element'] as const,
    excludedSupportSources: ['year', 'hour', 'combines-only', 'residual-qi'] as const,
    darkMovingRequires: ['raw-day-clash', 'not-month-break', 'effective-month-support'] as const,
    dayBreakRequiresEither: ['month-break', 'month-controls-without-whitelisted-support'] as const,
    classification: 'mutually-exclusive',
    normalizationNote: '无扶白名单是产品profile操作化，非原文完整算法',
  },
  moving: {
    returnDirection: 'changed-to-base',
    returnBasisRelations: {
      generates: 'returns-generate',
      controls: 'returns-control',
      clashes: 'returns-clash',
      combines: 'returns-combine',
    },
    advanceDirection: 'base-to-changed',
    defaultAdvancePairs: [['亥', '子'], ['寅', '卯'], ['巳', '午'], ['申', '酉'], ['丑', '辰'], ['辰', '未'], ['未', '戌']] as const,
    auditAdvancePairs: [['亥', '子'], ['寅', '卯'], ['巳', '午'], ['申', '酉'], ['丑', '辰'], ['辰', '未'], ['未', '戌'], ['戌', '丑']] as const,
    auditProfile: {
      id: 'bushi-eight-pair-audit-v1',
      enabled: false,
      sourceRefs: [SOURCE.localBushi],
    },
    transitionGrowth: {
      evaluator: 'twelveStage',
      sourceBundleId: 'growth_shensha_core_v1',
      sourceArtifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
      input: ['base.branchElement', 'changed.branch'] as const,
      stageRelations: { 墓: 'changes-to-tomb', 绝: 'changes-to-absolute' },
      copiedElementBranchTable: false,
    },
  },
  threeHarmony: {
    groups: [
      { id: 'water', element: '水', branches: ['申', '子', '辰'] },
      { id: 'wood', element: '木', branches: ['亥', '卯', '未'] },
      { id: 'fire', element: '火', branches: ['寅', '午', '戌'] },
      { id: 'metal', element: '金', branches: ['巳', '酉', '丑'] },
    ] as const,
    memberModes: ['base-three-with-active-member', 'inner-1-3-two-base-one-own-changed', 'outer-4-6-two-base-one-own-changed'] as const,
    duplicateMemberResolution: {
      enumeration: 'all-activated-member-combinations',
      preference: 'unblocked-first',
      tieBreak: 'code-unit-minimum-member-entity-ids',
      alternatives: 'record-non-selected-activated-member-sets',
    },
    blockers: ['is-void', 'is-month-break', 'is-day-break', 'is-growth-stage', 'changes-to-tomb'] as const,
    dayGrowthStageBlocker: {
      sourcePillar: 'day',
      stage: '墓',
      excludedPillars: ['year', 'month', 'hour'] as const,
    },
    blockedRelation: 'has-three-harmony-candidate',
    completeRelation: 'forms-three-harmony',
  },
  sideFormations: {
    correspondingLinePairs: [[1, 4], [2, 5], [3, 6]] as const,
    sixHarmonyHexagrams: ['复', '泰', '豫', '节', '困', '贲', '旅', '否'] as const,
    sixClashHexagrams: ['坤', '震', '大壮', '坎', '兑', '艮', '离', '巽', '无妄', '乾'] as const,
    changedSideRequiresMovingLine: true,
  },
  fanFu: {
    normalizationNote: '对应支全冲/全同且半卦实动是由2100458例证提炼的命名profile；方位法只保留在禁用的《卜筮正宗》variant',
    defaultProfile: {
      id: 'yehe-corresponding-branches-v1',
      fan: 'three-corresponding-branches-all-clash',
      fu: 'three-corresponding-branches-all-identical',
      halfRequiresMovingLine: true,
    },
    variants: [{
      id: 'directional-trigram-fan-yin-v1',
      enabled: false,
      model: 'trigram-direction-opposition',
      oppositeTrigramPairs: [
        ['乾', '巽'],
        ['坎', '离'],
        ['艮', '坤'],
        ['震', '兑'],
      ] as const,
      sourceRefs: [SOURCE.localBushi],
    }],
  },
  rules: [
    rule('has-month-status', 'effects-month-status/v1', 'profile-dependent', 'computed', [SOURCE.seasons, SOURCE.localZengshan]),
    rule('is-month-break', 'effects-month-break/v1', 'structural', 'computed', [SOURCE.clashes, SOURCE.localBushi]),
    rule('is-void', 'effects-day-void/v1', 'structural', 'computed', [SOURCE.void, SOURCE.localBushi]),
    rule('is-dark-moving', 'effects-dark-moving/v1', 'profile-dependent', 'conditional', [SOURCE.day, SOURCE.clashes, SOURCE.localZengshan]),
    rule('is-day-break', 'effects-day-break/v1', 'profile-dependent', 'conditional', [SOURCE.day, SOURCE.clashes, SOURCE.localZengshan]),
    rule('returns-generate', 'effects-returns-generate/v1', 'profile-dependent', 'computed', [SOURCE.moving, SOURCE.generates, SOURCE.localZengshan]),
    rule('returns-control', 'effects-returns-control/v1', 'profile-dependent', 'computed', [SOURCE.moving, SOURCE.controls, SOURCE.localZengshan]),
    rule('returns-clash', 'effects-returns-clash/v1', 'profile-dependent', 'computed', [SOURCE.moving, SOURCE.clashes, SOURCE.localZengshan]),
    rule('returns-combine', 'effects-returns-combine/v1', 'profile-dependent', 'computed', [SOURCE.moving, SOURCE.combines, SOURCE.localZengshan]),
    rule('advances', 'effects-seven-advance/v1', 'profile-dependent', 'computed', [SOURCE.localZengshan]),
    rule('retreats', 'effects-seven-retreat/v1', 'profile-dependent', 'computed', [SOURCE.localZengshan]),
    rule('changes-to-tomb', 'effects-changes-to-tomb/v1', 'profile-dependent', 'delegated-twelve-stage', [SOURCE.growth]),
    rule('changes-to-absolute', 'effects-changes-to-absolute/v1', 'profile-dependent', 'delegated-twelve-stage', [SOURCE.growth]),
    rule('forms-three-harmony', 'effects-restricted-three-harmony/v1', 'profile-dependent', 'conditional', [SOURCE.threeHarmony, SOURCE.localZengshan]),
    rule('has-three-harmony-candidate', 'effects-restricted-three-harmony-candidate/v1', 'profile-dependent', 'conditional', [SOURCE.threeHarmony, SOURCE.localZengshan]),
    rule('is-six-harmony', 'effects-hexagram-six-harmony/v1', 'structural', 'computed', [SOURCE.combines]),
    rule('is-six-clash', 'effects-hexagram-six-clash/v1', 'structural', 'computed', [SOURCE.clashes]),
    rule('is-fan-yin', 'effects-corresponding-fan-yin/v1', 'profile-dependent', 'computed', [SOURCE.fanFu, SOURCE.localZengshan]),
    rule('is-fu-yin', 'effects-corresponding-fu-yin/v1', 'profile-dependent', 'computed', [SOURCE.fanFu, SOURCE.localZengshan]),
  ],
} as const);

export const LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD = canonicalStringify(LIUYAO_EFFECTS_V1_ARTIFACT);

// 两次独立自动审阅与生产脚本均对 UTF-8 canonical payload 复算同一 hash。
export const LIUYAO_EFFECTS_V1_ARTIFACT_HASH = '208ff324b2bc1a9dbdf45a848927d8bf6f0495152ab0ba6c45e477a7c5e742d6';

export const LIUYAO_EFFECTS_V1_MANIFEST = deepFreeze({
  bundleId: 'liuyao_effects_v1',
  version: '1.0.0',
  artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  verificationLevel: 'independent-automated',
  runtimeStatus: 'project-enabled',
  reviews: [
    {
      reviewerId: 'codex-source-reviewer-effects-a-24bcce01bb0c4f31',
      reviewerKind: 'automated-agent',
      independentRunId: 'effects-a-20260712-115921-24bcce01bb0c4f318a377bbf47be82dd',
      reviewedAt: '2026-07-12T11:59:21+08:00',
      artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: EFFECTS_REVIEW_REPORT_PATHS[0],
      checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
    },
    {
      reviewerId: 'codex-corpus-matrix-effects-b',
      reviewerKind: 'automated-agent',
      independentRunId: 'liuyao-effects-v1-b-a5d7cb2f-77da-4b82-bd23-2d9a9c5454c4',
      reviewedAt: '2026-07-12T12:00:40.9619972+08:00',
      artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: EFFECTS_REVIEW_REPORT_PATHS[1],
      checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
    },
  ],
  sourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
} as const satisfies EffectsRuleBundleManifest);

export function effectsRule(relation: FactRelation): EffectsRule {
  const found = LIUYAO_EFFECTS_V1_ARTIFACT.rules.find((candidate) => candidate.relation === relation);
  if (!found) throw new Error(`effects 规则缺失：${relation}`);
  return found;
}

export function isResidualPair(month: Branch, line: Branch): boolean {
  return LIUYAO_EFFECTS_V1_ARTIFACT.monthStatus.residualPairs
    .some(([left, right]) => left === month && right === line);
}
