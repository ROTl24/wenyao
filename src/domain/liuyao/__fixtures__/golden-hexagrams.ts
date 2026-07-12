export type GoldenTrigramKey = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';

export interface GoldenHexagram {
  readonly key: string;
  readonly name: string;
  readonly shortName: string;
  readonly upperTrigram: GoldenTrigramKey;
  readonly lowerTrigram: GoldenTrigramKey;
  readonly palace: GoldenTrigramKey;
  readonly generation: '本宫' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';
  readonly shiLine: 1 | 2 | 3 | 4 | 5 | 6;
  readonly yingLine: 1 | 2 | 3 | 4 | 5 | 6;
}

// 独立黄金表：按八宫本宫、一世至五世、游魂、归魂显式列出，不从生产规则派生。
export const GOLDEN_HEXAGRAMS = [
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
] as const satisfies readonly GoldenHexagram[];

export const GOLDEN_TRIGRAM_BITS: Readonly<Record<GoldenTrigramKey, readonly [boolean, boolean, boolean]>> = {
  乾: [true, true, true],
  兑: [true, true, false],
  离: [true, false, true],
  震: [true, false, false],
  巽: [false, true, true],
  坎: [false, true, false],
  艮: [false, false, true],
  坤: [false, false, false],
};
