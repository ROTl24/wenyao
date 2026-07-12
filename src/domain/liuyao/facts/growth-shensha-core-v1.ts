import type {
  Branch,
  Element,
  SixSpirit,
  Stem,
  TwelveStage,
} from '../model.js';
import type {
  GrowthShenShaRuleBundleManifest,
  RuleAuthority,
  RuleSourceRef,
} from '../rules/model.js';
import { canonicalStringify, deepFreeze } from '../rules/tables.js';
import { WENWANG_NAJIA_V2_ARTIFACT_HASH } from '../rules/wenwang-najia-v2.js';
import {
  GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
  GROWTH_SHENSHA_REVIEW_REPORT_PATHS,
} from './growth-shensha-manifest-expectations.js';

export interface GrowthShenShaSourceEvidenceCapsule {
  readonly ref: RuleSourceRef;
  readonly payload: string;
}

interface BundleRuleBase {
  readonly ruleId: string;
  readonly profileId: string;
  readonly authority: RuleAuthority;
  readonly sourceRefs: readonly string[];
  readonly version: '1.0.0';
}

interface LocalCorpusEntryBinding {
  readonly id: string;
  readonly purpose: 'growth' | 'six-spirit' | 'shen-sha' | 'variant';
  readonly textSha256: string;
}

interface LocalCorpusBookBinding {
  readonly sourceId: 'ZENGSHAN-BUYI' | 'YIMAO' | 'YIYIN';
  readonly bookSha256: string;
  readonly entries: readonly LocalCorpusEntryBinding[];
}

export interface GrowthShenShaCoreV1Artifact {
  readonly artifactSchema: 'liuyao-growth-shensha-core/v1';
  readonly bundleId: 'growth_shensha_core_v1';
  readonly version: '1.0.0';
  readonly dependsOnWenwangArtifactHash: string;
  readonly localCorpus: {
    readonly corpusVersion: '2026.07.11-user-books-1';
    readonly books: readonly LocalCorpusBookBinding[];
  };
  readonly growth: {
    readonly branchOrder: readonly Branch[];
    readonly stageOrder: readonly TwelveStage[];
    readonly matrix: Readonly<Record<Element, readonly TwelveStage[]>>;
    readonly rule: BundleRuleBase & {
      readonly certaintyByElement: Readonly<Record<Element, 'computed' | 'disputed'>>;
      readonly primaryInterpretationStages: readonly TwelveStage[];
    };
    readonly variants: {
      readonly earthStartsAtShen: {
        readonly id: 'earth-start-shen-follow-water-v1';
        readonly enabled: true;
        readonly startBranch: '申';
        readonly row: readonly TwelveStage[];
        readonly certainty: 'disputed';
        readonly sourceRefs: readonly string[];
      };
      readonly earthStartsAtYin: {
        readonly id: 'earth-start-yin-follow-fire-v1';
        readonly enabled: false;
        readonly startBranch: '寅';
        readonly row: readonly TwelveStage[];
        readonly certainty: 'disputed';
        readonly sourceRefs: readonly string[];
      };
      readonly tenStemDirectionalModel: {
        readonly id: 'ten-stem-yin-reverse-v1';
        readonly enabled: false;
        readonly model: 'ten-stem-not-five-element';
        readonly direction: 'yang-forward-yin-reverse';
        readonly note: string;
        readonly sourceRefs: readonly string[];
      };
    };
  };
  readonly sixSpirit: {
    readonly sequence: readonly SixSpirit[];
    readonly startByDayStem: Readonly<Record<Stem, SixSpirit>>;
    readonly aliases: Readonly<Record<string, SixSpirit>>;
    readonly aliasSourceRefs: readonly string[];
    readonly rule: BundleRuleBase;
  };
  readonly shenSha: {
    readonly tianyi: {
      readonly branchesByDayStem: Readonly<Record<Stem, readonly Branch[]>>;
      readonly rule: BundleRuleBase;
      readonly variants: readonly [{
        readonly id: 'common-jia-wu-geng-cattle-sheep-v1';
        readonly enabled: false;
        readonly branchesByDayStem: Readonly<Record<Stem, readonly Branch[]>>;
        readonly certainty: 'disputed';
        readonly sourceRefs: readonly string[];
      }];
    };
    readonly lushen: {
      readonly branchesByDayStem: Readonly<Record<Stem, readonly [Branch]>>;
      readonly rule: BundleRuleBase;
    };
    readonly yima: {
      readonly branchesByDayBranch: Readonly<Record<Branch, readonly [Branch]>>;
      readonly rule: BundleRuleBase;
    };
    readonly tianxi: {
      readonly branchesByMonthBranch: Readonly<Record<Branch, readonly [Branch]>>;
      readonly rule: BundleRuleBase;
      readonly variants: readonly [
        {
          readonly id: 'monthly-progression-tianxi-v1';
          readonly enabled: false;
          readonly branchesByMonthBranch: Readonly<Record<Branch, readonly [Branch]>>;
          readonly certainty: 'disputed';
          readonly sourceRefs: readonly string[];
        },
        {
          readonly id: 'xingming-year-branch-tianxi-v1';
          readonly enabled: false;
          readonly branchesByYearBranch: Readonly<Record<Branch, readonly [Branch]>>;
          readonly certainty: 'disputed';
          readonly sourceRefs: readonly string[];
        },
      ];
    };
  };
}

const CORPUS_VERSION = '2026.07.11-user-books-1';
const CORPUS_SOURCE_ID = 'ZENGSHAN-BUYI';
const CORPUS_BOOK_SHA256 = '5a1bf59de04180d2f118ebe25abb84565b30aa731c986a83ace4898f5c0c04ae';
const YIMAO_BOOK_SHA256 = 'ab7eb41549cc30b4de2bc1c81757a2f0fdcec8823592e3b05f29417591982642';
const YIYIN_BOOK_SHA256 = '4595d55959dc61e9db879a60214ce2b4ceabb3a8eaab13c179aabdcdd68deab2';

const GROWTH_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/26%E5%8F%881&oldid=2100461';
const SIX_SPIRIT_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93/18&oldid=2101727';
const SHEN_SHA_URL = 'https://zh.wikisource.org/w/index.php?title=%E5%A2%9E%E5%88%AA%E5%8D%9C%E6%98%93&oldid=2572918';

export const GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  {
    ref: {
      id: 'WS-ZENGSHAN-GROWTH-2100461',
      title: '《增删卜易·生旺墓绝章》',
      url: GROWTH_URL,
      locator: '生旺墓绝章第又二十六：十二阶段、四关键阶段及土从水分歧',
      contentHash: 'e1fc94c03775c1f6be3c61869e184e9d653c99fbf12f9f2762293f86fd0d37da',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-GROWTH-2100461',
      `fixedUrl=${GROWTH_URL}`,
      'locator=生旺墓绝章第又二十六',
      'normalizedClaim=十二阶段顺排；木亥火寅金巳水申；土从水且土生申与土生寅有分歧；默认仅生旺墓绝为主要解释',
      `localCorpusVersion=${CORPUS_VERSION}`,
      `localBookSourceId=${CORPUS_SOURCE_ID}`,
      `localBookSha256=${CORPUS_BOOK_SHA256}`,
      'localEntries=ZENGSHAN-BUYI-0066:a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a,ZENGSHAN-BUYI-0067:133a03a5abcfd08bc5318b7fe4fb285d59f08100cfe5341bf7612f201f8cda04',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-SIX-SPIRIT-2101727',
      title: '《增删卜易·六神章》',
      url: SIX_SPIRIT_URL,
      locator: '六神章第十八：按日干从初爻至上爻轮排六神',
      contentHash: 'bd01e879479702de5b4c9f32c333135bfa1b42b4077fc9da29f2a712c9101deb',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-SIX-SPIRIT-2101727',
      `fixedUrl=${SIX_SPIRIT_URL}`,
      'locator=六神章第十八',
      'normalizedClaim=甲乙青龙起、丙丁朱雀起、戊勾陈起、己螣蛇起、庚辛白虎起、壬癸玄武起；从初爻至上爻轮排',
      `localCorpusVersion=${CORPUS_VERSION}`,
      `localBookSourceId=${CORPUS_SOURCE_ID}`,
      `localBookSha256=${CORPUS_BOOK_SHA256}`,
      'localEntries=ZENGSHAN-BUYI-0053:1e42a6bf57e0ddeb1f93e4afa25e5983bdb5009b1c69c1e32c2af2b6652c9434',
    ].join('\n'),
  },
  {
    ref: {
      id: 'WS-ZENGSHAN-SHEN-SHA-2572918',
      title: '《增删卜易·星煞章》',
      url: SHEN_SHA_URL,
      locator: '星煞章第三十三：太乙、禄神、驿马、四季天喜及辅助权限',
      contentHash: '77871a1861cfc355218ec276adec0a3c4562ef1241a993311e18db075e1550c4',
    },
    payload: [
      'sourceId=WS-ZENGSHAN-SHEN-SHA-2572918',
      `fixedUrl=${SHEN_SHA_URL}`,
      'locator=星煞章第三十三',
      'normalizedClaim=默认只取太乙贵人、禄神、驿马、天喜；庚辛贵人午寅；天喜春戌夏丑秋辰冬未；四项只辅助用神旺衰',
      `localCorpusVersion=${CORPUS_VERSION}`,
      `localBookSourceId=${CORPUS_SOURCE_ID}`,
      `localBookSha256=${CORPUS_BOOK_SHA256}`,
      'localEntries=ZENGSHAN-BUYI-0094:ed36de4a2b532c3669d34ffa6a60de506fd5331b69a0057a1e4a7b31862f5fea',
    ].join('\n'),
  },
  {
    ref: {
      id: 'CORPUS-YIMAO-VARIANTS',
      title: '本地语料《易冒》分歧条目',
      url: `urn:wenyao:corpus:YIMAO@${CORPUS_VERSION}`,
      locator: 'YIMAO-0017、YIMAO-0059、YIMAO-0074',
      contentHash: 'ac5ad0142b2026f192ed559f70d2a85a93e6bf9d44a415d3ef0d6806005805aa',
    },
    payload: [
      'sourceId=CORPUS-YIMAO-VARIANTS',
      `fixedUrl=urn:wenyao:corpus:YIMAO@${CORPUS_VERSION}`,
      'locator=YIMAO-0017,YIMAO-0059,YIMAO-0074',
      'normalizedClaim=六神异体元武与腾蛇；土生申、戊生寅、己生酉及十干分寄分歧；逐月天喜寅戌卯亥辰子并列春戌夏丑秋辰冬未',
      `localBookSha256=${YIMAO_BOOK_SHA256}`,
      'localEntries=YIMAO-0017:3d37da2768559b3984ea0d0b1cd49015e43c42311dc8803780266c3db8521042,YIMAO-0059:e4f71865040e4abae52a2f2ae7259984bee0f1b7c479706b84cb97d6eb922f82,YIMAO-0074:edfeacca55caaa43fecb87c1dc60427e2287216be7cbb7a4154810ac83276d4e',
    ].join('\n'),
  },
  {
    ref: {
      id: 'CORPUS-YIYIN-VARIANTS',
      title: '本地语料《易隐》分歧条目',
      url: `urn:wenyao:corpus:YIYIN@${CORPUS_VERSION}`,
      locator: 'YIYIN-0047、YIYIN-0050、YIYIN-0061',
      contentHash: '2613cce3548683b1f6473632dfb965eeb45bd29935c4e1cc1a5c214b31fed8e8',
    },
    payload: [
      'sourceId=CORPUS-YIYIN-VARIANTS',
      `fixedUrl=urn:wenyao:corpus:YIYIN@${CORPUS_VERSION}`,
      'locator=YIYIN-0047,YIYIN-0050,YIYIN-0061',
      'normalizedClaim=年支天喜子酉丑申寅未卯午辰巳巳辰午卯未寅申丑酉子戌亥亥戌；逐月天喜寅戌卯亥辰子巳丑午寅未卯申辰酉巳戌午亥未子申丑酉；天乙甲戊庚丑未、乙己子申、丙丁亥酉、壬癸巳卯、辛午寅',
      `localBookSha256=${YIYIN_BOOK_SHA256}`,
      'localEntries=YIYIN-0047:382b1a6757bb79e5265cacbde92e67d6d3ff592c38e3195a97ded92b53a7e0ef,YIYIN-0050:ac2cd273a56bb0a164b58a77d904d6b8419a6a0670bbbf4853de9296741c488e,YIYIN-0061:9e44a176ad0f1cac1c14b42461c5672d19ceed1559aeb7b359fb41afdc498f60',
    ].join('\n'),
  },
] as const satisfies readonly GrowthShenShaSourceEvidenceCapsule[]);

const SOURCE = {
  growth: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[0].ref.id,
  sixSpirit: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[1].ref.id,
  shenSha: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[2].ref.id,
  yimaoVariants: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[3].ref.id,
  yiyinVariants: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES[4].ref.id,
} as const;

const BRANCH_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const STAGE_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'] as const;

const GROWTH_MATRIX = {
  木: ['沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生'],
  火: ['胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝'],
  土: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
  金: ['死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病'],
  水: ['帝旺', '衰', '病', '死', '墓', '绝', '胎', '养', '长生', '沐浴', '冠带', '临官'],
} as const satisfies Readonly<Record<Element, readonly TwelveStage[]>>;

const TIANYI_BOOK = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['午', '寅'], 辛: ['午', '寅'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
} as const satisfies Readonly<Record<Stem, readonly Branch[]>>;

const TIANYI_COMMON = {
  甲: ['丑', '未'], 乙: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'],
  戊: ['丑', '未'], 己: ['子', '申'], 庚: ['丑', '未'], 辛: ['午', '寅'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
} as const satisfies Readonly<Record<Stem, readonly Branch[]>>;

const LUSHEN = {
  甲: ['寅'], 乙: ['卯'], 丙: ['巳'], 丁: ['午'], 戊: ['巳'],
  己: ['午'], 庚: ['申'], 辛: ['酉'], 壬: ['亥'], 癸: ['子'],
} as const satisfies Readonly<Record<Stem, readonly [Branch]>>;

const YIMA = {
  子: ['寅'], 丑: ['亥'], 寅: ['申'], 卯: ['巳'], 辰: ['寅'], 巳: ['亥'],
  午: ['申'], 未: ['巳'], 申: ['寅'], 酉: ['亥'], 戌: ['申'], 亥: ['巳'],
} as const satisfies Readonly<Record<Branch, readonly [Branch]>>;

const TIANXI_SEASONAL = {
  子: ['未'], 丑: ['未'], 寅: ['戌'], 卯: ['戌'], 辰: ['戌'], 巳: ['丑'],
  午: ['丑'], 未: ['丑'], 申: ['辰'], 酉: ['辰'], 戌: ['辰'], 亥: ['未'],
} as const satisfies Readonly<Record<Branch, readonly [Branch]>>;

const TIANXI_MONTHLY = {
  子: ['申'], 丑: ['酉'], 寅: ['戌'], 卯: ['亥'], 辰: ['子'], 巳: ['丑'],
  午: ['寅'], 未: ['卯'], 申: ['辰'], 酉: ['巳'], 戌: ['午'], 亥: ['未'],
} as const satisfies Readonly<Record<Branch, readonly [Branch]>>;

const TIANXI_YEAR = {
  子: ['酉'], 丑: ['申'], 寅: ['未'], 卯: ['午'], 辰: ['巳'], 巳: ['辰'],
  午: ['卯'], 未: ['寅'], 申: ['丑'], 酉: ['子'], 戌: ['亥'], 亥: ['戌'],
} as const satisfies Readonly<Record<Branch, readonly [Branch]>>;

export const GROWTH_SHENSHA_CORE_V1_ARTIFACT = deepFreeze({
  artifactSchema: 'liuyao-growth-shensha-core/v1',
  bundleId: 'growth_shensha_core_v1',
  version: '1.0.0',
  dependsOnWenwangArtifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
  localCorpus: {
    corpusVersion: CORPUS_VERSION,
    books: [
      {
        sourceId: CORPUS_SOURCE_ID,
        bookSha256: CORPUS_BOOK_SHA256,
        entries: [
          { id: 'ZENGSHAN-BUYI-0053', purpose: 'six-spirit', textSha256: '1e42a6bf57e0ddeb1f93e4afa25e5983bdb5009b1c69c1e32c2af2b6652c9434' },
          { id: 'ZENGSHAN-BUYI-0066', purpose: 'growth', textSha256: 'a8187ed5badeb248a90637acca7eef99370e933bb16a0c4213182c2130ca103a' },
          { id: 'ZENGSHAN-BUYI-0067', purpose: 'growth', textSha256: '133a03a5abcfd08bc5318b7fe4fb285d59f08100cfe5341bf7612f201f8cda04' },
          { id: 'ZENGSHAN-BUYI-0094', purpose: 'shen-sha', textSha256: 'ed36de4a2b532c3669d34ffa6a60de506fd5331b69a0057a1e4a7b31862f5fea' },
        ],
      },
      {
        sourceId: 'YIMAO',
        bookSha256: YIMAO_BOOK_SHA256,
        entries: [
          { id: 'YIMAO-0017', purpose: 'six-spirit', textSha256: '3d37da2768559b3984ea0d0b1cd49015e43c42311dc8803780266c3db8521042' },
          { id: 'YIMAO-0059', purpose: 'variant', textSha256: 'e4f71865040e4abae52a2f2ae7259984bee0f1b7c479706b84cb97d6eb922f82' },
          { id: 'YIMAO-0074', purpose: 'variant', textSha256: 'edfeacca55caaa43fecb87c1dc60427e2287216be7cbb7a4154810ac83276d4e' },
        ],
      },
      {
        sourceId: 'YIYIN',
        bookSha256: YIYIN_BOOK_SHA256,
        entries: [
          { id: 'YIYIN-0047', purpose: 'variant', textSha256: '382b1a6757bb79e5265cacbde92e67d6d3ff592c38e3195a97ded92b53a7e0ef' },
          { id: 'YIYIN-0050', purpose: 'variant', textSha256: 'ac2cd273a56bb0a164b58a77d904d6b8419a6a0670bbbf4853de9296741c488e' },
          { id: 'YIYIN-0061', purpose: 'variant', textSha256: '9e44a176ad0f1cac1c14b42461c5672d19ceed1559aeb7b359fb41afdc498f60' },
        ],
      },
    ],
  },
  growth: {
    branchOrder: BRANCH_ORDER,
    stageOrder: STAGE_ORDER,
    matrix: GROWTH_MATRIX,
    rule: {
      ruleId: 'five-element-twelve-stage-forward/v1',
      profileId: 'five-element-forward_v1',
      authority: 'profile-dependent',
      certaintyByElement: { 木: 'computed', 火: 'computed', 土: 'disputed', 金: 'computed', 水: 'computed' },
      primaryInterpretationStages: ['长生', '帝旺', '墓', '绝'],
      sourceRefs: [SOURCE.growth],
      version: '1.0.0',
    },
    variants: {
      earthStartsAtShen: {
        id: 'earth-start-shen-follow-water-v1',
        enabled: true,
        startBranch: '申',
        row: GROWTH_MATRIX.土,
        certainty: 'disputed',
        sourceRefs: [SOURCE.growth, SOURCE.yimaoVariants],
      },
      earthStartsAtYin: {
        id: 'earth-start-yin-follow-fire-v1',
        enabled: false,
        startBranch: '寅',
        row: GROWTH_MATRIX.火,
        certainty: 'disputed',
        sourceRefs: [SOURCE.growth, SOURCE.yimaoVariants],
      },
      tenStemDirectionalModel: {
        id: 'ten-stem-yin-reverse-v1',
        enabled: false,
        model: 'ten-stem-not-five-element',
        direction: 'yang-forward-yin-reverse',
        note: '阴干逆行属于十干十二长生模型，不能与本五行顺排六爻矩阵混表。',
        sourceRefs: [SOURCE.yimaoVariants],
      },
    },
  },
  sixSpirit: {
    sequence: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
    startByDayStem: {
      甲: '青龙', 乙: '青龙', 丙: '朱雀', 丁: '朱雀', 戊: '勾陈',
      己: '螣蛇', 庚: '白虎', 辛: '白虎', 壬: '玄武', 癸: '玄武',
    },
    aliases: {
      青龙: '青龙', 靑龍: '青龙', 朱雀: '朱雀', 勾陈: '勾陈',
      螣蛇: '螣蛇', 滕蛇: '螣蛇', 腾蛇: '螣蛇', 白虎: '白虎', 玄武: '玄武', 元武: '玄武',
    },
    aliasSourceRefs: [SOURCE.sixSpirit, SOURCE.yimaoVariants],
    rule: {
      ruleId: 'six-spirit-by-day-stem/v1',
      profileId: 'yehe-day-stem-six-spirit-v1',
      authority: 'secondary',
      sourceRefs: [SOURCE.sixSpirit],
      version: '1.0.0',
    },
  },
  shenSha: {
    tianyi: {
      branchesByDayStem: TIANYI_BOOK,
      rule: {
        ruleId: 'tianyi-by-day-stem-zengshan/v1',
        profileId: 'zengshan-taiyi-day-stem-v1',
        authority: 'secondary',
        sourceRefs: [SOURCE.shenSha],
        version: '1.0.0',
      },
      variants: [{
        id: 'common-jia-wu-geng-cattle-sheep-v1',
        enabled: false,
        branchesByDayStem: TIANYI_COMMON,
        certainty: 'disputed',
        sourceRefs: [SOURCE.yiyinVariants],
      }],
    },
    lushen: {
      branchesByDayStem: LUSHEN,
      rule: {
        ruleId: 'lushen-by-day-stem-zengshan/v1',
        profileId: 'zengshan-day-stem-lushen-v1',
        authority: 'secondary',
        sourceRefs: [SOURCE.shenSha],
        version: '1.0.0',
      },
    },
    yima: {
      branchesByDayBranch: YIMA,
      rule: {
        ruleId: 'yima-by-day-branch-three-harmony/v1',
        profileId: 'zengshan-day-branch-three-harmony-v1',
        authority: 'secondary',
        sourceRefs: [SOURCE.shenSha],
        version: '1.0.0',
      },
    },
    tianxi: {
      branchesByMonthBranch: TIANXI_SEASONAL,
      rule: {
        ruleId: 'tianxi-by-seasonal-month-branch/v1',
        profileId: 'zengshan-seasonal-month-branch-v1',
        authority: 'secondary',
        sourceRefs: [SOURCE.shenSha],
        version: '1.0.0',
      },
      variants: [
        {
          id: 'monthly-progression-tianxi-v1',
          enabled: false,
          branchesByMonthBranch: TIANXI_MONTHLY,
          certainty: 'disputed',
          sourceRefs: [SOURCE.yimaoVariants, SOURCE.yiyinVariants],
        },
        {
          id: 'xingming-year-branch-tianxi-v1',
          enabled: false,
          branchesByYearBranch: TIANXI_YEAR,
          certainty: 'disputed',
          sourceRefs: [SOURCE.yiyinVariants],
        },
      ],
    },
  },
} as const satisfies GrowthShenShaCoreV1Artifact);

export const GROWTH_SHENSHA_CORE_V1_CANONICAL_PAYLOAD = canonicalStringify(
  GROWTH_SHENSHA_CORE_V1_ARTIFACT,
);

// 由独立复算脚本固定；领域运行时不依赖 node:crypto。
export const GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH = 'e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129';

export const GROWTH_SHENSHA_CORE_V1_MANIFEST = deepFreeze({
  bundleId: 'growth_shensha_core_v1',
  version: '1.0.0',
  artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
  verificationLevel: 'independent-automated',
  runtimeStatus: 'project-enabled',
  reviews: [
    {
      reviewerId: 'codex-wikisource-growth-shensha-a',
      reviewerKind: 'automated-agent',
      independentRunId: 'growth-shensha-a-20260712-104749-9091214',
      reviewedAt: '2026-07-12T10:47:49.9091214+08:00',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: GROWTH_SHENSHA_REVIEW_REPORT_PATHS[0],
      checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
    },
    {
      reviewerId: 'codex-corpus-growth-shensha-b',
      reviewerKind: 'automated-agent',
      independentRunId: 'growth-shensha-core-v1-b-2c89ce7f-8a84-4960-a5e0-71353952a59a',
      reviewedAt: '2026-07-12T10:50:40.9970624+08:00',
      artifactHash: GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
      reportPath: GROWTH_SHENSHA_REVIEW_REPORT_PATHS[1],
      checkedClaims: GROWTH_SHENSHA_REVIEW_CHECKED_CLAIMS,
    },
  ],
  sourceRefs: GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
} as const satisfies GrowthShenShaRuleBundleManifest);
