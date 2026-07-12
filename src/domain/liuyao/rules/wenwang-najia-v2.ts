import type { RulePackManifest, RuleSourceRef } from './model.js';
import { canonicalStringify, deepFreeze, type WenwangNajiaArtifact } from './tables.js';

export interface RuleSourceEvidenceCapsule {
  readonly ref: RuleSourceRef;
  readonly payload: string;
}

export const RULE_SOURCE_EVIDENCE_CAPSULES = deepFreeze([
  {
    ref: {
      id: 'WS-JING-7903767',
      title: '《京氏易传》固定修订 7903767',
      url: 'https://zh.wikisource.org/w/index.php?title=%E4%BA%AC%E6%B0%8F%E6%98%93%E5%82%B3&oldid=7903767',
      locator: '卷上至卷中依次出现的 64 个“下卦/上卦/卦名”标题',
      contentHash: '5de73e5085eeac3ddb5ad8e65ef07b2a082858a73ed4626bab42766e4fd1599f',
    },
    payload: 'sourceId=WS-JING-7903767\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E4%BA%AC%E6%B0%8F%E6%98%93%E5%82%B3&oldid=7903767\nlocator=卷上至卷中依次出现的 64 个“下卦/上卦/卦名”标题\nnormalizedClaim=逐项核对六十四卦的上卦、下卦与短名；只做繁简和异体字规范化',
  },
  {
    ref: {
      id: 'WS-YIPI-760928',
      title: '《易禆传（四库全书本）/外篇》固定修订 760928',
      url: 'https://zh.wikisource.org/w/index.php?title=%E6%98%93%E7%A6%86%E5%82%B3_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%A4%96%E7%AF%87&oldid=760928',
      locator: '“八卦变”末段与“纳甲”',
      contentHash: 'a72e145219d07666ddcce98608adc2b8a3b8fa9e3dd9756bd5f7588c5d64b45f',
    },
    payload: 'sourceId=WS-YIPI-760928\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E6%98%93%E7%A6%86%E5%82%B3_(%E5%9B%9B%E5%BA%AB%E5%85%A8%E6%9B%B8%E6%9C%AC)/%E5%A4%96%E7%AF%87&oldid=760928\nlocator=“八卦变”末段与“纳甲”\nnormalizedClaim=交叉核对八宫逐爻变法、游魂归魂、世应规律和八卦六爻纳甲全表',
  },
  {
    ref: {
      id: 'WS-NAJIA1-2031149',
      title: '《易学象数论/纳甲一》固定修订 2031149',
      url: 'https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%B8%80&oldid=2031149',
      locator: '第 1 段',
      contentHash: 'c84c34c9bfb51c7fd2aaff50d5dc44efd2c1828fe78031da5845d29c81389f0c',
    },
    payload: 'sourceId=WS-NAJIA1-2031149\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%B8%80&oldid=2031149\nlocator=第 1 段\nnormalizedClaim=核对乾坤内外甲乙壬癸以及震巽庚辛、坎离戊己、艮兑丙丁的纳干分配',
  },
  {
    ref: {
      id: 'WS-NAJIA2-2031150',
      title: '《易学象数论/纳甲二》固定修订 2031150',
      url: 'https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%BA%8C&oldid=2031150',
      locator: '第 1 段“十二支六阳六阴……”',
      contentHash: 'e4d9223ed012da4f61c1bb8040a21bea6419859943e4a68dad125977e8f30aef',
    },
    payload: 'sourceId=WS-NAJIA2-2031150\nfixedUrl=https://zh.wikisource.org/w/index.php?title=%E6%98%93%E5%AD%B8%E8%B1%A1%E6%95%B8%E8%AB%96/%E7%B4%8D%E7%94%B2%E4%BA%8C&oldid=2031150\nlocator=第 1 段“十二支六阳六阴……”\nnormalizedClaim=核对六阳支顺列、六阴支逆列、八卦初爻锚点及内外卦三爻切分',
  },
  {
    ref: {
      id: 'CTEXT-ZENGSHAN-1',
      title: 'CText《增删卜易》卷一（URN ctp:ws950329）',
      url: 'https://ctext.org/wiki.pl?chapter=950329&if=en',
      locator: '条目 47–65“八宫六十四卦卦名/八卦各宫全图”',
      contentHash: 'cabc19abff5dc855e8794a72977ba64bd25280926e8c17ceed7f8e2512e30efc',
    },
    payload: 'sourceId=CTEXT-ZENGSHAN-1\nsourceUrl=https://ctext.org/wiki.pl?chapter=950329&if=en\nlocator=条目 47–65“八宫六十四卦卦名/八卦各宫全图”\nnormalizedClaim=交叉核对八宫八组完整卦名、世应与纳甲；拒绝转录中的可见 OCR 错字',
  },
  {
    ref: {
      id: 'CTEXT-ZENGSHAN-2',
      title: 'CText《增删卜易》卷二（URN ctp:ws157683）',
      url: 'https://ctext.org/wiki.pl?chapter=157683&if=en&remap=gb',
      locator: '条目 49–75“飞伏神章第二十八”',
      contentHash: '40cd8eb2840a9decf8ef30f2d2d4cc1ef3000f6aed8aed4e609cd928fce53c28',
    },
    payload: 'sourceId=CTEXT-ZENGSHAN-2\nsourceUrl=https://ctext.org/wiki.pl?chapter=157683&if=en&remap=gb\nlocator=条目 49–75“飞伏神章第二十八”\nnormalizedClaim=核对本宫首卦、同爻位、现爻为飞、所借爻为伏的结构位置及姤遁实例',
  },
  {
    ref: {
      id: 'CTEXT-ZHENGZONG',
      title: 'CText《卜筮正宗》（URN ctp:ws801184）',
      url: 'https://ctext.org/wiki.pl?chapter=801184&if=gb',
      locator: '条目 13–16“伏神正传”及 70–75“辟易林补遗伏神之谬”',
      contentHash: 'be1a1dcec0c65ea68f0eb673a41c3485562bfc5fe3d3ffcdf0f10aae0473b4a9',
    },
    payload: 'sourceId=CTEXT-ZHENGZONG\nsourceUrl=https://ctext.org/wiki.pl?chapter=801184&if=gb\nlocator=条目 13–16“伏神正传”及 70–75“辟易林补遗伏神之谬”\nnormalizedClaim=核对伏神取本宫首卦同位的结构内核；对宫互换、爻爻皆伏及启用顺序不进入本结构包',
  },
] as const satisfies readonly RuleSourceEvidenceCapsule[]);

export const WENWANG_NAJIA_V2_ARTIFACT = deepFreeze({
  artifactSchema: 'wenwang-najia-structural-tables/v1',
  rulePackId: 'wenwang_najia_v2',
  version: '2.0.0',
  stemElements: [
    { stem: '甲', element: '木' }, { stem: '乙', element: '木' },
    { stem: '丙', element: '火' }, { stem: '丁', element: '火' },
    { stem: '戊', element: '土' }, { stem: '己', element: '土' },
    { stem: '庚', element: '金' }, { stem: '辛', element: '金' },
    { stem: '壬', element: '水' }, { stem: '癸', element: '水' },
  ],
  branchElements: [
    { branch: '子', element: '水' }, { branch: '丑', element: '土' },
    { branch: '寅', element: '木' }, { branch: '卯', element: '木' },
    { branch: '辰', element: '土' }, { branch: '巳', element: '火' },
    { branch: '午', element: '火' }, { branch: '未', element: '土' },
    { branch: '申', element: '金' }, { branch: '酉', element: '金' },
    { branch: '戌', element: '土' }, { branch: '亥', element: '水' },
  ],
  generates: [
    { source: '木', target: '火' }, { source: '火', target: '土' },
    { source: '土', target: '金' }, { source: '金', target: '水' },
    { source: '水', target: '木' },
  ],
  controls: [
    { source: '木', target: '土' }, { source: '土', target: '水' },
    { source: '水', target: '火' }, { source: '火', target: '金' },
    { source: '金', target: '木' },
  ],
  relationOrder: ['父母', '兄弟', '子孙', '妻财', '官鬼'],
  trigrams: [
    { key: '乾', nature: '天', element: '金', bits: [true, true, true], inner: { stem: '甲', branches: ['子', '寅', '辰'] }, outer: { stem: '壬', branches: ['午', '申', '戌'] } },
    { key: '兑', nature: '泽', element: '金', bits: [true, true, false], inner: { stem: '丁', branches: ['巳', '卯', '丑'] }, outer: { stem: '丁', branches: ['亥', '酉', '未'] } },
    { key: '离', nature: '火', element: '火', bits: [true, false, true], inner: { stem: '己', branches: ['卯', '丑', '亥'] }, outer: { stem: '己', branches: ['酉', '未', '巳'] } },
    { key: '震', nature: '雷', element: '木', bits: [true, false, false], inner: { stem: '庚', branches: ['子', '寅', '辰'] }, outer: { stem: '庚', branches: ['午', '申', '戌'] } },
    { key: '巽', nature: '风', element: '木', bits: [false, true, true], inner: { stem: '辛', branches: ['丑', '亥', '酉'] }, outer: { stem: '辛', branches: ['未', '巳', '卯'] } },
    { key: '坎', nature: '水', element: '水', bits: [false, true, false], inner: { stem: '戊', branches: ['寅', '辰', '午'] }, outer: { stem: '戊', branches: ['申', '戌', '子'] } },
    { key: '艮', nature: '山', element: '土', bits: [false, false, true], inner: { stem: '丙', branches: ['辰', '午', '申'] }, outer: { stem: '丙', branches: ['戌', '子', '寅'] } },
    { key: '坤', nature: '地', element: '土', bits: [false, false, false], inner: { stem: '乙', branches: ['未', '巳', '卯'] }, outer: { stem: '癸', branches: ['丑', '亥', '酉'] } },
  ],
  hexagrams: [
    { key: '乾-乾', name: '乾为天', shortName: '乾', upperTrigram: '乾', lowerTrigram: '乾', palace: '乾', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '乾-巽', name: '天风姤', shortName: '姤', upperTrigram: '乾', lowerTrigram: '巽', palace: '乾', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '乾-艮', name: '天山遁', shortName: '遁', upperTrigram: '乾', lowerTrigram: '艮', palace: '乾', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '乾-坤', name: '天地否', shortName: '否', upperTrigram: '乾', lowerTrigram: '坤', palace: '乾', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '巽-坤', name: '风地观', shortName: '观', upperTrigram: '巽', lowerTrigram: '坤', palace: '乾', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '艮-坤', name: '山地剥', shortName: '剥', upperTrigram: '艮', lowerTrigram: '坤', palace: '乾', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '离-坤', name: '火地晋', shortName: '晋', upperTrigram: '离', lowerTrigram: '坤', palace: '乾', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '离-乾', name: '火天大有', shortName: '大有', upperTrigram: '离', lowerTrigram: '乾', palace: '乾', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '坎-坎', name: '坎为水', shortName: '坎', upperTrigram: '坎', lowerTrigram: '坎', palace: '坎', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '坎-兑', name: '水泽节', shortName: '节', upperTrigram: '坎', lowerTrigram: '兑', palace: '坎', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '坎-震', name: '水雷屯', shortName: '屯', upperTrigram: '坎', lowerTrigram: '震', palace: '坎', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '坎-离', name: '水火既济', shortName: '既济', upperTrigram: '坎', lowerTrigram: '离', palace: '坎', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '兑-离', name: '泽火革', shortName: '革', upperTrigram: '兑', lowerTrigram: '离', palace: '坎', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '震-离', name: '雷火丰', shortName: '丰', upperTrigram: '震', lowerTrigram: '离', palace: '坎', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '坤-离', name: '地火明夷', shortName: '明夷', upperTrigram: '坤', lowerTrigram: '离', palace: '坎', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '坤-坎', name: '地水师', shortName: '师', upperTrigram: '坤', lowerTrigram: '坎', palace: '坎', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '艮-艮', name: '艮为山', shortName: '艮', upperTrigram: '艮', lowerTrigram: '艮', palace: '艮', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '艮-离', name: '山火贲', shortName: '贲', upperTrigram: '艮', lowerTrigram: '离', palace: '艮', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '艮-乾', name: '山天大畜', shortName: '大畜', upperTrigram: '艮', lowerTrigram: '乾', palace: '艮', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '艮-兑', name: '山泽损', shortName: '损', upperTrigram: '艮', lowerTrigram: '兑', palace: '艮', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '离-兑', name: '火泽睽', shortName: '睽', upperTrigram: '离', lowerTrigram: '兑', palace: '艮', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '乾-兑', name: '天泽履', shortName: '履', upperTrigram: '乾', lowerTrigram: '兑', palace: '艮', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '巽-兑', name: '风泽中孚', shortName: '中孚', upperTrigram: '巽', lowerTrigram: '兑', palace: '艮', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '巽-艮', name: '风山渐', shortName: '渐', upperTrigram: '巽', lowerTrigram: '艮', palace: '艮', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '震-震', name: '震为雷', shortName: '震', upperTrigram: '震', lowerTrigram: '震', palace: '震', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '震-坤', name: '雷地豫', shortName: '豫', upperTrigram: '震', lowerTrigram: '坤', palace: '震', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '震-坎', name: '雷水解', shortName: '解', upperTrigram: '震', lowerTrigram: '坎', palace: '震', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '震-巽', name: '雷风恒', shortName: '恒', upperTrigram: '震', lowerTrigram: '巽', palace: '震', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '坤-巽', name: '地风升', shortName: '升', upperTrigram: '坤', lowerTrigram: '巽', palace: '震', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '坎-巽', name: '水风井', shortName: '井', upperTrigram: '坎', lowerTrigram: '巽', palace: '震', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '兑-巽', name: '泽风大过', shortName: '大过', upperTrigram: '兑', lowerTrigram: '巽', palace: '震', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '兑-震', name: '泽雷随', shortName: '随', upperTrigram: '兑', lowerTrigram: '震', palace: '震', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '巽-巽', name: '巽为风', shortName: '巽', upperTrigram: '巽', lowerTrigram: '巽', palace: '巽', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '巽-乾', name: '风天小畜', shortName: '小畜', upperTrigram: '巽', lowerTrigram: '乾', palace: '巽', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '巽-离', name: '风火家人', shortName: '家人', upperTrigram: '巽', lowerTrigram: '离', palace: '巽', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '巽-震', name: '风雷益', shortName: '益', upperTrigram: '巽', lowerTrigram: '震', palace: '巽', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '乾-震', name: '天雷无妄', shortName: '无妄', upperTrigram: '乾', lowerTrigram: '震', palace: '巽', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '离-震', name: '火雷噬嗑', shortName: '噬嗑', upperTrigram: '离', lowerTrigram: '震', palace: '巽', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '艮-震', name: '山雷颐', shortName: '颐', upperTrigram: '艮', lowerTrigram: '震', palace: '巽', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '艮-巽', name: '山风蛊', shortName: '蛊', upperTrigram: '艮', lowerTrigram: '巽', palace: '巽', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '离-离', name: '离为火', shortName: '离', upperTrigram: '离', lowerTrigram: '离', palace: '离', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '离-艮', name: '火山旅', shortName: '旅', upperTrigram: '离', lowerTrigram: '艮', palace: '离', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '离-巽', name: '火风鼎', shortName: '鼎', upperTrigram: '离', lowerTrigram: '巽', palace: '离', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '离-坎', name: '火水未济', shortName: '未济', upperTrigram: '离', lowerTrigram: '坎', palace: '离', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '艮-坎', name: '山水蒙', shortName: '蒙', upperTrigram: '艮', lowerTrigram: '坎', palace: '离', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '巽-坎', name: '风水涣', shortName: '涣', upperTrigram: '巽', lowerTrigram: '坎', palace: '离', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '乾-坎', name: '天水讼', shortName: '讼', upperTrigram: '乾', lowerTrigram: '坎', palace: '离', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '乾-离', name: '天火同人', shortName: '同人', upperTrigram: '乾', lowerTrigram: '离', palace: '离', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '坤-坤', name: '坤为地', shortName: '坤', upperTrigram: '坤', lowerTrigram: '坤', palace: '坤', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '坤-震', name: '地雷复', shortName: '复', upperTrigram: '坤', lowerTrigram: '震', palace: '坤', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '坤-兑', name: '地泽临', shortName: '临', upperTrigram: '坤', lowerTrigram: '兑', palace: '坤', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '坤-乾', name: '地天泰', shortName: '泰', upperTrigram: '坤', lowerTrigram: '乾', palace: '坤', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '震-乾', name: '雷天大壮', shortName: '大壮', upperTrigram: '震', lowerTrigram: '乾', palace: '坤', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '兑-乾', name: '泽天夬', shortName: '夬', upperTrigram: '兑', lowerTrigram: '乾', palace: '坤', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '坎-乾', name: '水天需', shortName: '需', upperTrigram: '坎', lowerTrigram: '乾', palace: '坤', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '坎-坤', name: '水地比', shortName: '比', upperTrigram: '坎', lowerTrigram: '坤', palace: '坤', generation: '归魂', shiLine: 3, yingLine: 6 },
    { key: '兑-兑', name: '兑为泽', shortName: '兑', upperTrigram: '兑', lowerTrigram: '兑', palace: '兑', generation: '本宫', shiLine: 6, yingLine: 3 },
    { key: '兑-坎', name: '泽水困', shortName: '困', upperTrigram: '兑', lowerTrigram: '坎', palace: '兑', generation: '一世', shiLine: 1, yingLine: 4 },
    { key: '兑-坤', name: '泽地萃', shortName: '萃', upperTrigram: '兑', lowerTrigram: '坤', palace: '兑', generation: '二世', shiLine: 2, yingLine: 5 },
    { key: '兑-艮', name: '泽山咸', shortName: '咸', upperTrigram: '兑', lowerTrigram: '艮', palace: '兑', generation: '三世', shiLine: 3, yingLine: 6 },
    { key: '坎-艮', name: '水山蹇', shortName: '蹇', upperTrigram: '坎', lowerTrigram: '艮', palace: '兑', generation: '四世', shiLine: 4, yingLine: 1 },
    { key: '坤-艮', name: '地山谦', shortName: '谦', upperTrigram: '坤', lowerTrigram: '艮', palace: '兑', generation: '五世', shiLine: 5, yingLine: 2 },
    { key: '震-艮', name: '雷山小过', shortName: '小过', upperTrigram: '震', lowerTrigram: '艮', palace: '兑', generation: '游魂', shiLine: 4, yingLine: 1 },
    { key: '震-兑', name: '雷泽归妹', shortName: '归妹', upperTrigram: '震', lowerTrigram: '兑', palace: '兑', generation: '归魂', shiLine: 3, yingLine: 6 },
  ],
  hiddenSpiritPolicy: {
    id: 'missing-visible-relation-from-palace-head-same-position/v1',
    missingFrom: 'base-visible-relations',
    source: 'palace-head-hexagram',
    placement: 'same-line-position',
    status: 'potential',
  },
} as const satisfies WenwangNajiaArtifact);

export const WENWANG_NAJIA_V2_CANONICAL_PAYLOAD = canonicalStringify(WENWANG_NAJIA_V2_ARTIFACT);

// 由审查脚本对上面的 UTF-8 canonical payload 独立复算；领域运行时不导入 node:crypto。
export const WENWANG_NAJIA_V2_ARTIFACT_HASH = '241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa';

const FINAL_REVIEW_INPUT_SOURCE_REFS = RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id);
const FINAL_REVIEW_CHECKED_CLAIMS = [
  'hexagrams:64',
  'najia-lines:384',
  'review-assertions:25',
  'qian-to-gou-full-changed-reinstall',
  'qian-to-kun-dual-relations',
  'hidden-spirit-candidates:56',
] as const;

export const WENWANG_NAJIA_V2_MANIFEST = deepFreeze({
  rulePackId: 'wenwang_najia_v2',
  version: '2.0.0',
  artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
  verificationLevel: 'independent-automated',
  runtimeStatus: 'project-enabled',
  reviews: [
    {
      reviewerId: 'codex-ctext-audit-a',
      reviewerKind: 'automated-agent',
      independentRunId: 'wenwang-final-a-20260712',
      reviewedAt: '2026-07-12T08:00:00+08:00',
      artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: [...FINAL_REVIEW_INPUT_SOURCE_REFS],
      reportPath: 'docs/domain/reviews/wenwang-najia-v2-review-a.md',
      checkedClaims: [...FINAL_REVIEW_CHECKED_CLAIMS],
    },
    {
      reviewerId: 'codex-wikisource-audit-b',
      reviewerKind: 'automated-agent',
      independentRunId: 'wenwang-final-b-20260712',
      reviewedAt: '2026-07-12T07:57:25.9273596+08:00',
      artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
      outcome: 'matched',
      inputSourceRefs: [...FINAL_REVIEW_INPUT_SOURCE_REFS],
      reportPath: 'docs/domain/reviews/wenwang-najia-v2-review-b.md',
      checkedClaims: [...FINAL_REVIEW_CHECKED_CLAIMS],
    },
  ],
  sourceRefs: RULE_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
} as const satisfies RulePackManifest);
