import type { SixRelation } from '../model.js';

type LinePosition = 1 | 2 | 3 | 4 | 5 | 6;
type TossTuple = readonly [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9];

export interface GoldenNajiaRow {
  readonly key: string;
  readonly lines: readonly [string, string, string, string, string, string];
}

// 独立黄金表：64 卦各六爻均显式展开，不调用生产纳甲函数。
export const GOLDEN_NAJIA = [
  { key: '乾-乾', lines: ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌'] },
  { key: '乾-巽', lines: ['辛丑', '辛亥', '辛酉', '壬午', '壬申', '壬戌'] },
  { key: '乾-艮', lines: ['丙辰', '丙午', '丙申', '壬午', '壬申', '壬戌'] },
  { key: '乾-坤', lines: ['乙未', '乙巳', '乙卯', '壬午', '壬申', '壬戌'] },
  { key: '巽-坤', lines: ['乙未', '乙巳', '乙卯', '辛未', '辛巳', '辛卯'] },
  { key: '艮-坤', lines: ['乙未', '乙巳', '乙卯', '丙戌', '丙子', '丙寅'] },
  { key: '离-坤', lines: ['乙未', '乙巳', '乙卯', '己酉', '己未', '己巳'] },
  { key: '离-乾', lines: ['甲子', '甲寅', '甲辰', '己酉', '己未', '己巳'] },

  { key: '坎-坎', lines: ['戊寅', '戊辰', '戊午', '戊申', '戊戌', '戊子'] },
  { key: '坎-兑', lines: ['丁巳', '丁卯', '丁丑', '戊申', '戊戌', '戊子'] },
  { key: '坎-震', lines: ['庚子', '庚寅', '庚辰', '戊申', '戊戌', '戊子'] },
  { key: '坎-离', lines: ['己卯', '己丑', '己亥', '戊申', '戊戌', '戊子'] },
  { key: '兑-离', lines: ['己卯', '己丑', '己亥', '丁亥', '丁酉', '丁未'] },
  { key: '震-离', lines: ['己卯', '己丑', '己亥', '庚午', '庚申', '庚戌'] },
  { key: '坤-离', lines: ['己卯', '己丑', '己亥', '癸丑', '癸亥', '癸酉'] },
  { key: '坤-坎', lines: ['戊寅', '戊辰', '戊午', '癸丑', '癸亥', '癸酉'] },

  { key: '艮-艮', lines: ['丙辰', '丙午', '丙申', '丙戌', '丙子', '丙寅'] },
  { key: '艮-离', lines: ['己卯', '己丑', '己亥', '丙戌', '丙子', '丙寅'] },
  { key: '艮-乾', lines: ['甲子', '甲寅', '甲辰', '丙戌', '丙子', '丙寅'] },
  { key: '艮-兑', lines: ['丁巳', '丁卯', '丁丑', '丙戌', '丙子', '丙寅'] },
  { key: '离-兑', lines: ['丁巳', '丁卯', '丁丑', '己酉', '己未', '己巳'] },
  { key: '乾-兑', lines: ['丁巳', '丁卯', '丁丑', '壬午', '壬申', '壬戌'] },
  { key: '巽-兑', lines: ['丁巳', '丁卯', '丁丑', '辛未', '辛巳', '辛卯'] },
  { key: '巽-艮', lines: ['丙辰', '丙午', '丙申', '辛未', '辛巳', '辛卯'] },

  { key: '震-震', lines: ['庚子', '庚寅', '庚辰', '庚午', '庚申', '庚戌'] },
  { key: '震-坤', lines: ['乙未', '乙巳', '乙卯', '庚午', '庚申', '庚戌'] },
  { key: '震-坎', lines: ['戊寅', '戊辰', '戊午', '庚午', '庚申', '庚戌'] },
  { key: '震-巽', lines: ['辛丑', '辛亥', '辛酉', '庚午', '庚申', '庚戌'] },
  { key: '坤-巽', lines: ['辛丑', '辛亥', '辛酉', '癸丑', '癸亥', '癸酉'] },
  { key: '坎-巽', lines: ['辛丑', '辛亥', '辛酉', '戊申', '戊戌', '戊子'] },
  { key: '兑-巽', lines: ['辛丑', '辛亥', '辛酉', '丁亥', '丁酉', '丁未'] },
  { key: '兑-震', lines: ['庚子', '庚寅', '庚辰', '丁亥', '丁酉', '丁未'] },

  { key: '巽-巽', lines: ['辛丑', '辛亥', '辛酉', '辛未', '辛巳', '辛卯'] },
  { key: '巽-乾', lines: ['甲子', '甲寅', '甲辰', '辛未', '辛巳', '辛卯'] },
  { key: '巽-离', lines: ['己卯', '己丑', '己亥', '辛未', '辛巳', '辛卯'] },
  { key: '巽-震', lines: ['庚子', '庚寅', '庚辰', '辛未', '辛巳', '辛卯'] },
  { key: '乾-震', lines: ['庚子', '庚寅', '庚辰', '壬午', '壬申', '壬戌'] },
  { key: '离-震', lines: ['庚子', '庚寅', '庚辰', '己酉', '己未', '己巳'] },
  { key: '艮-震', lines: ['庚子', '庚寅', '庚辰', '丙戌', '丙子', '丙寅'] },
  { key: '艮-巽', lines: ['辛丑', '辛亥', '辛酉', '丙戌', '丙子', '丙寅'] },

  { key: '离-离', lines: ['己卯', '己丑', '己亥', '己酉', '己未', '己巳'] },
  { key: '离-艮', lines: ['丙辰', '丙午', '丙申', '己酉', '己未', '己巳'] },
  { key: '离-巽', lines: ['辛丑', '辛亥', '辛酉', '己酉', '己未', '己巳'] },
  { key: '离-坎', lines: ['戊寅', '戊辰', '戊午', '己酉', '己未', '己巳'] },
  { key: '艮-坎', lines: ['戊寅', '戊辰', '戊午', '丙戌', '丙子', '丙寅'] },
  { key: '巽-坎', lines: ['戊寅', '戊辰', '戊午', '辛未', '辛巳', '辛卯'] },
  { key: '乾-坎', lines: ['戊寅', '戊辰', '戊午', '壬午', '壬申', '壬戌'] },
  { key: '乾-离', lines: ['己卯', '己丑', '己亥', '壬午', '壬申', '壬戌'] },

  { key: '坤-坤', lines: ['乙未', '乙巳', '乙卯', '癸丑', '癸亥', '癸酉'] },
  { key: '坤-震', lines: ['庚子', '庚寅', '庚辰', '癸丑', '癸亥', '癸酉'] },
  { key: '坤-兑', lines: ['丁巳', '丁卯', '丁丑', '癸丑', '癸亥', '癸酉'] },
  { key: '坤-乾', lines: ['甲子', '甲寅', '甲辰', '癸丑', '癸亥', '癸酉'] },
  { key: '震-乾', lines: ['甲子', '甲寅', '甲辰', '庚午', '庚申', '庚戌'] },
  { key: '兑-乾', lines: ['甲子', '甲寅', '甲辰', '丁亥', '丁酉', '丁未'] },
  { key: '坎-乾', lines: ['甲子', '甲寅', '甲辰', '戊申', '戊戌', '戊子'] },
  { key: '坎-坤', lines: ['乙未', '乙巳', '乙卯', '戊申', '戊戌', '戊子'] },

  { key: '兑-兑', lines: ['丁巳', '丁卯', '丁丑', '丁亥', '丁酉', '丁未'] },
  { key: '兑-坎', lines: ['戊寅', '戊辰', '戊午', '丁亥', '丁酉', '丁未'] },
  { key: '兑-坤', lines: ['乙未', '乙巳', '乙卯', '丁亥', '丁酉', '丁未'] },
  { key: '兑-艮', lines: ['丙辰', '丙午', '丙申', '丁亥', '丁酉', '丁未'] },
  { key: '坎-艮', lines: ['丙辰', '丙午', '丙申', '戊申', '戊戌', '戊子'] },
  { key: '坤-艮', lines: ['丙辰', '丙午', '丙申', '癸丑', '癸亥', '癸酉'] },
  { key: '震-艮', lines: ['丙辰', '丙午', '丙申', '庚午', '庚申', '庚戌'] },
  { key: '震-兑', lines: ['丁巳', '丁卯', '丁丑', '庚午', '庚申', '庚戌'] },
] as const satisfies readonly GoldenNajiaRow[];

export interface GoldenChangedRelationCase {
  readonly label: string;
  readonly tossValues: TossTuple;
  readonly line: LinePosition;
  readonly changedGanZhi: string;
  readonly relationToBasePalace: SixRelation;
  readonly relationToOwnPalace: SixRelation;
}

export const GOLDEN_CHANGED_RELATION_CASES = [
  { label: '乾六爻动变坤-初', tossValues: [9, 9, 9, 9, 9, 9], line: 1, changedGanZhi: '乙未', relationToBasePalace: '父母', relationToOwnPalace: '兄弟' },
  { label: '乾六爻动变坤-二', tossValues: [9, 9, 9, 9, 9, 9], line: 2, changedGanZhi: '乙巳', relationToBasePalace: '官鬼', relationToOwnPalace: '父母' },
  { label: '乾六爻动变坤-三', tossValues: [9, 9, 9, 9, 9, 9], line: 3, changedGanZhi: '乙卯', relationToBasePalace: '妻财', relationToOwnPalace: '官鬼' },
  { label: '乾六爻动变坤-四', tossValues: [9, 9, 9, 9, 9, 9], line: 4, changedGanZhi: '癸丑', relationToBasePalace: '父母', relationToOwnPalace: '兄弟' },
  { label: '乾六爻动变坤-五', tossValues: [9, 9, 9, 9, 9, 9], line: 5, changedGanZhi: '癸亥', relationToBasePalace: '子孙', relationToOwnPalace: '妻财' },
  { label: '乾六爻动变坤-上', tossValues: [9, 9, 9, 9, 9, 9], line: 6, changedGanZhi: '癸酉', relationToBasePalace: '兄弟', relationToOwnPalace: '子孙' },
  { label: '坤六爻动变乾-初', tossValues: [6, 6, 6, 6, 6, 6], line: 1, changedGanZhi: '甲子', relationToBasePalace: '妻财', relationToOwnPalace: '子孙' },
  { label: '坤六爻动变乾-二', tossValues: [6, 6, 6, 6, 6, 6], line: 2, changedGanZhi: '甲寅', relationToBasePalace: '官鬼', relationToOwnPalace: '妻财' },
  { label: '坤六爻动变乾-三', tossValues: [6, 6, 6, 6, 6, 6], line: 3, changedGanZhi: '甲辰', relationToBasePalace: '兄弟', relationToOwnPalace: '父母' },
  { label: '坤六爻动变乾-四', tossValues: [6, 6, 6, 6, 6, 6], line: 4, changedGanZhi: '壬午', relationToBasePalace: '父母', relationToOwnPalace: '官鬼' },
  { label: '坤六爻动变乾-五', tossValues: [6, 6, 6, 6, 6, 6], line: 5, changedGanZhi: '壬申', relationToBasePalace: '子孙', relationToOwnPalace: '兄弟' },
  { label: '坤六爻动变乾-上', tossValues: [6, 6, 6, 6, 6, 6], line: 6, changedGanZhi: '壬戌', relationToBasePalace: '兄弟', relationToOwnPalace: '父母' },
  { label: '乾初九变姤', tossValues: [9, 7, 7, 7, 7, 7], line: 1, changedGanZhi: '辛丑', relationToBasePalace: '父母', relationToOwnPalace: '父母' },
  { label: '乾九二变同人', tossValues: [7, 9, 7, 7, 7, 7], line: 2, changedGanZhi: '己丑', relationToBasePalace: '父母', relationToOwnPalace: '子孙' },
  { label: '乾九四变小畜', tossValues: [7, 7, 7, 9, 7, 7], line: 4, changedGanZhi: '辛未', relationToBasePalace: '父母', relationToOwnPalace: '妻财' },
  { label: '乾九五变大有', tossValues: [7, 7, 7, 7, 9, 7], line: 5, changedGanZhi: '己未', relationToBasePalace: '父母', relationToOwnPalace: '父母' },
] as const satisfies readonly GoldenChangedRelationCase[];
