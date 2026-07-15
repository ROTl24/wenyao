import { describe, expect, it } from 'vitest';
import {
  buildPlate,
  branchCalendarEffects,
  createToss,
  elementOfStemBranch,
  getHexagram,
  type CoinFace,
  type LineValue,
} from './divination';

describe('乾隆铜钱约定', () => {
  it.each([
    [['text', 'text', 'text'], 6, '老阴'],
    [['text', 'text', 'reverse'], 7, '少阳'],
    [['text', 'reverse', 'reverse'], 8, '少阴'],
    [['reverse', 'reverse', 'reverse'], 9, '老阳'],
  ] as const)('maps %j to %s', (faces, value, label) => {
    expect(createToss(faces as readonly CoinFace[])).toMatchObject({ value, label });
  });
});

describe('六十四卦映射', () => {
  it('maps canonical line patterns from bottom to top', () => {
    expect(getHexagram([true, true, true, true, true, true]).name).toBe('乾为天');
    expect(getHexagram([false, false, false, false, false, false]).name).toBe('坤为地');
    expect(getHexagram([true, false, true, false, true, false]).name).toBe('水火既济');
    expect(getHexagram([false, true, false, true, false, true]).name).toBe('火水未济');
  });
});

describe('排盘不变量', () => {
  it('changes only moving lines and assigns 世应', () => {
    const values: LineValue[] = [6, 7, 8, 9, 7, 8];
    const plate = buildPlate(values, new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.lines).toHaveLength(6);
    expect(plate.movingLines).toEqual([1, 4]);
    plate.lines.forEach((line) => {
      expect(line.baseYang !== line.changedYang).toBe(line.moving);
    });
    expect(plate.lines.filter((line) => line.role === '世')).toHaveLength(1);
    expect(plate.lines.filter((line) => line.role === '应')).toHaveLength(1);
    expect(plate.lines.filter((line) => line.changedRole === '世')).toHaveLength(1);
    expect(plate.lines.filter((line) => line.changedRole === '应')).toHaveLength(1);
  });

  it('computes immutable 纳甲 stems, branches and changed-line relations', () => {
    const plate = buildPlate([9, 7, 7, 7, 7, 7], new Date('2026-07-11T12:00:00+08:00'));
    expect(plate.baseHexagram.name).toBe('乾为天');
    expect(plate.changedHexagram.name).toBe('天风姤');
    expect(plate.lines[0]).toMatchObject({ stem: '甲', branch: '子', ganZhi: '甲子', element: '水', changedStem: '辛', changedBranch: '丑', changedGanZhi: '辛丑', changedElement: '土', changedRelation: '父母' });
    expect(plate.lines[3]).toMatchObject({ stem: '壬', branch: '午', ganZhi: '壬午' });
  });

  it('computes calendar clashes, combinations and void status as locked facts', () => {
    expect(branchCalendarEffects('子', '午', '乙丑', ['子', '丑'])).toEqual({
      void: true,
      monthBreak: true,
      dayClash: false,
      monthCombine: false,
      dayCombine: true,
    });
  });

  it('locks four pillars, pillar voids, twelve stages and common shen sha', () => {
    const plate = buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.pillars).toEqual([
      { label: '年柱', ganZhi: '丙午', voidBranches: ['寅', '卯'], twelveStage: '帝旺' },
      { label: '月柱', ganZhi: '乙未', voidBranches: ['辰', '巳'], twelveStage: '衰' },
      { label: '日柱', ganZhi: '丙戌', voidBranches: ['午', '未'], twelveStage: '墓' },
      { label: '时柱', ganZhi: '甲午', voidBranches: ['辰', '巳'], twelveStage: '帝旺' },
    ]);
    expect(plate.shenSha).toEqual([
      { name: '驿马', branches: ['申'] },
      { name: '桃花', branches: ['卯'] },
      { name: '日禄', branches: ['巳'] },
      { name: '贵人', branches: ['酉', '亥'] },
    ]);
  });
});

describe('伏神派生事实', () => {
  const castAt = new Date('2026-07-11T12:00:00+08:00');

  it('在天风姤中按本宫首卦补出妻财伏神，并绑定二爻飞神', () => {
    const plate = buildPlate([8, 7, 7, 7, 7, 7], castAt);

    expect(plate.baseHexagram.name).toBe('天风姤');
    expect(plate.fuShen).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lineIndex: 2,
        relation: '妻财',
        ganZhi: '甲寅',
        flyGanZhi: '辛亥',
        flyRelation: '子孙',
        flyEffect: '飞生伏',
      }),
    ]));
  });

  it('在天山遁中保留飞神克伏神的受制因素', () => {
    const plate = buildPlate([8, 8, 7, 7, 7, 7], castAt);

    expect(plate.baseHexagram.name).toBe('天山遁');
    expect(plate.fuShen).toEqual(expect.arrayContaining([
      expect.objectContaining({
        lineIndex: 1,
        relation: '子孙',
        ganZhi: '甲子',
        flyGanZhi: '丙辰',
        flyEffect: '飞克伏',
        blockingFactors: expect.arrayContaining(['飞神克伏神']),
      }),
    ]));
  });

  it('本宫纯卦六亲齐全时不凭空生成伏神', () => {
    const plate = buildPlate([7, 7, 7, 7, 7, 7], castAt);

    expect(plate.baseHexagram.name).toBe('乾为天');
    expect(plate.fuShen).toEqual([]);
  });

  it('所有伏神候选都来自主卦缺失的六亲，并绑定同爻位飞神', () => {
    for (let mask = 0; mask < 64; mask += 1) {
      const values = Array.from({ length: 6 }, (_, index) => (mask & (1 << index) ? 7 : 8)) as LineValue[];
      const plate = buildPlate(values, castAt);
      const visibleRelations = new Set(plate.lines.map((line) => line.relation));

      for (const hidden of plate.fuShen) {
        expect(visibleRelations.has(hidden.relation)).toBe(false);
        expect(plate.lines[hidden.lineIndex - 1].ganZhi).toBe(hidden.flyGanZhi);
      }
    }
  });
});

describe('干支五行映射', () => {
  it.each([
    ['甲', '木'], ['乙', '木'], ['寅', '木'], ['卯', '木'],
    ['丙', '火'], ['丁', '火'], ['巳', '火'], ['午', '火'],
    ['戊', '土'], ['己', '土'], ['辰', '土'], ['戌', '土'], ['丑', '土'], ['未', '土'],
    ['庚', '金'], ['辛', '金'], ['申', '金'], ['酉', '金'],
    ['壬', '水'], ['癸', '水'], ['子', '水'], ['亥', '水'],
  ] as const)('maps %s to %s', (symbol, element) => {
    expect(elementOfStemBranch(symbol)).toBe(element);
  });

  it('does not classify ordinary text as a stem or branch', () => {
    expect(elementOfStemBranch('宫')).toBeUndefined();
  });
});
