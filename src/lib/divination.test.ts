import { describe, expect, it } from 'vitest';
import {
  buildPlate,
  branchCalendarEffects,
  createToss,
  elementOfStemBranch,
  getHexagram,
  twelveStageFor,
  upgradePlate,
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

  it('classifies day clash by movement and concrete month-day strength evidence', () => {
    const hiddenMovement = buildPlate(
      [6, 7, 8, 9, 7, 8],
      new Date('2026-07-11T12:00:00+08:00'),
    ).lines[1];
    const dayBreak = buildPlate(
      [7, 7, 7, 7, 7, 7],
      new Date('2026-02-13T12:00:00+08:00'),
    ).lines[0];
    const ordinaryClash = buildPlate(
      [9, 7, 7, 7, 7, 7],
      new Date('2026-02-13T12:00:00+08:00'),
    ).lines[0];
    const mixedStrengthClash = buildPlate(
      [7, 7, 7, 7, 7, 7],
      new Date('2026-02-05T12:00:00+08:00'),
    ).lines[2];
    const monthBrokenClash = buildPlate(
      [7, 7, 7, 7, 7, 7],
      new Date('2026-10-15T12:00:00+08:00'),
    ).lines[2];

    expect(hiddenMovement.dayClashAssessment).toEqual({
      kind: 'hidden-movement',
      seasonalStrength: '旺',
      dayToLineElementRelation: '同类',
    });
    expect(dayBreak.dayClashAssessment).toEqual({
      kind: 'day-break',
      seasonalStrength: '休',
      dayToLineElementRelation: '被克',
    });
    expect(ordinaryClash.dayClashAssessment).toEqual({
      kind: 'ordinary-clash',
      seasonalStrength: '休',
      dayToLineElementRelation: '被克',
    });
    expect(mixedStrengthClash.dayClashAssessment).toEqual({
      kind: 'hidden-movement',
      seasonalStrength: '死',
      dayToLineElementRelation: '同类',
    });
    expect(monthBrokenClash).toMatchObject({ monthBreak: true, dayClash: true });
    expect(monthBrokenClash.dayClashAssessment).toEqual({
      kind: 'ordinary-clash',
      seasonalStrength: '旺',
      dayToLineElementRelation: '同类',
    });
  });

  it('separates base structure, active moving actions and same-position transformation returns', () => {
    const plate = buildPlate(
      [9, 7, 7, 7, 7, 7],
      new Date('2026-02-13T12:00:00+08:00'),
    );

    expect(plate.relationFacts.baseRelations).toHaveLength(15);
    expect(plate.relationFacts.baseRelations).toContainEqual(expect.objectContaining({
      id: 'base:2:3',
      leftLineIndex: 2,
      rightLineIndex: 3,
      leftActivity: 'static',
      rightActivity: 'static',
    }));
    expect(plate.relationFacts.activeActions).toContainEqual(expect.objectContaining({
      id: 'active:1>2',
      sourceLineIndex: 1,
      sourceActivity: 'explicit-moving',
      targetKind: 'line',
      targetLineIndex: 2,
      effects: expect.arrayContaining(['生']),
    }));
    expect(plate.relationFacts.transformationReturns).toEqual([
      expect.objectContaining({
        id: 'return:1',
        lineIndex: 1,
        fromGanZhi: '辛丑',
        toGanZhi: '甲子',
      }),
    ]);
    expect(plate.relationFacts.transformationReturns.every((fact) => fact.lineIndex === 1)).toBe(true);
  });

  it('derives six-harmony, six-clash and refrain facts from corresponding line and trigram structures', () => {
    const castAt = new Date('2026-02-13T12:00:00+08:00');
    const pureQian = buildPlate([7, 7, 7, 7, 7, 7], castAt);
    const heavenEarthStandstill = buildPlate([8, 8, 8, 7, 7, 7], castAt);
    const clashToHarmony = buildPlate([9, 9, 9, 7, 7, 7], castAt);
    const innerReversal = buildPlate([9, 7, 7, 7, 7, 7], castAt);
    const outerRepetition = buildPlate([8, 7, 7, 7, 9, 9], castAt);

    expect(pureQian.relationFacts.hexagramDynamics.baseSixRelation).toBe('six-clash');
    expect(pureQian.relationFacts.hexagramDynamics.transition).toBe('none');
    expect(pureQian.relationFacts.hexagramDynamics.inner.fuYin).toBe(false);
    expect(pureQian.relationFacts.hexagramDynamics.outer.fuYin).toBe(false);
    expect(heavenEarthStandstill.baseHexagram.name).toBe('天地否');
    expect(heavenEarthStandstill.relationFacts.hexagramDynamics.baseSixRelation).toBe('six-harmony');
    expect(heavenEarthStandstill.relationFacts.hexagramDynamics.transition).toBe('none');
    expect(clashToHarmony.relationFacts.hexagramDynamics.transition).toBe('clash-to-harmony');
    expect(innerReversal.relationFacts.hexagramDynamics.inner.guaFanYin).toBe(true);
    expect(buildPlate([8, 6, 6, 8, 7, 8], castAt).relationFacts.hexagramDynamics.inner.yaoFanYin).toBe(true);
    expect(outerRepetition.baseHexagram.name).toBe('天风姤');
    expect(outerRepetition.changedHexagram.name).toBe('雷风恒');
    expect(outerRepetition.relationFacts.hexagramDynamics.outer.fuYin).toBe(true);
  });

  it('keeps four pillars free of Bazi twelve-stage fields', () => {
    const plate = buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.pillars).toEqual([
      { label: '年柱', ganZhi: '丙午', voidBranches: ['寅', '卯'] },
      { label: '月柱', ganZhi: '乙未', voidBranches: ['辰', '巳'] },
      { label: '日柱', ganZhi: '丙戌', voidBranches: ['午', '未'] },
      { label: '时柱', ganZhi: '甲午', voidBranches: ['辰', '巳'] },
    ]);
  });

  it('derives 六爻 twelve stages from each line element against month, day and moving transformation branches', () => {
    const plate = buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.lines.map(({ index, twelveStages }) => ({ index, ...twelveStages }))).toEqual([
      { index: 1, month: '墓', day: '养', transformation: '病' },
      { index: 2, month: '养', day: '冠带', transformation: null },
      { index: 3, month: '衰', day: '墓', transformation: null },
      { index: 4, month: '养', day: '冠带', transformation: '长生' },
      { index: 5, month: '冠带', day: '衰', transformation: null },
      { index: 6, month: '养', day: '冠带', transformation: null },
    ]);
  });

  it('uses the 六爻 five-element cycle with earth following water', () => {
    expect(twelveStageFor('木', '亥')).toBe('长生');
    expect(twelveStageFor('火', '午')).toBe('帝旺');
    expect(twelveStageFor('金', '丑')).toBe('墓');
    expect(twelveStageFor('水', '巳')).toBe('绝');
    expect(twelveStageFor('土', '申')).toBe('长生');
    expect(() => twelveStageFor('木', '甲')).toThrow(/地支/);
  });

  it('locks day-based shen sha to the concrete base and moving transformation lines they hit', () => {
    const plate = buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.shenSha).toEqual([
      { name: '驿马', basis: '日支', branches: ['申'], baseLineIndexes: [], changedLineIndexes: [4] },
      { name: '桃花', basis: '日支', branches: ['卯'], baseLineIndexes: [], changedLineIndexes: [] },
      { name: '日禄', basis: '日干', branches: ['巳'], baseLineIndexes: [], changedLineIndexes: [1] },
      { name: '天乙贵人', basis: '日干', branches: ['酉', '亥'], baseLineIndexes: [4, 5], changedLineIndexes: [] },
    ]);
  });

  it('rebuilds stale history with the 六爻 twelve-stage and shen-sha contracts', () => {
    const plate = buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00'));
    const stalePlate = structuredClone(plate) as unknown as Record<string, unknown>;

    for (const pillar of stalePlate.pillars as Array<Record<string, unknown>>) {
      pillar.twelveStage = '旧八字长生';
    }
    for (const line of stalePlate.lines as Array<Record<string, unknown>>) {
      delete line.twelveStages;
      delete line.dayClashAssessment;
    }
    stalePlate.shenSha = [{ name: '驿马', branches: ['申'] }];
    delete stalePlate.relationFacts;

    const upgraded = upgradePlate(stalePlate as unknown as typeof plate);

    expect(upgraded.pillars.every((pillar) => !('twelveStage' in pillar))).toBe(true);
    expect(upgraded.lines[0].twelveStages).toEqual({ month: '墓', day: '养', transformation: '病' });
    expect(upgraded.shenSha[0]).toEqual({
      name: '驿马',
      basis: '日支',
      branches: ['申'],
      baseLineIndexes: [],
      changedLineIndexes: [4],
    });
    expect(upgraded.lines[1].dayClashAssessment.kind).toBe('hidden-movement');
    expect(upgraded.relationFacts.baseRelations).toHaveLength(15);
    expect(upgraded.relationFacts.activeActions.some((fact) => fact.sourceActivity === 'hidden-moving')).toBe(true);
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
        seasonalStrength: '囚',
        dayToHiddenElementRelation: '被克',
      }),
    ]));
  });

  it('uses the same dark-movement source facts for hidden-spirit candidates and relation actions', () => {
    const plate = buildPlate([8, 7, 8, 7, 8, 8], castAt);
    const hidden = plate.fuShen.find((item) => item.lineIndex === 1);
    const hiddenAction = hidden?.activeSourceActions.find((action) => action.id === 'active:2>hidden:1');

    expect(plate.baseHexagram.name).toBe('雷水解');
    expect(hiddenAction).toEqual(expect.objectContaining({
      sourceLineIndex: 2,
      sourceActivity: 'hidden-moving',
      target: 'hidden-spirit',
      effects: expect.arrayContaining(['克']),
    }));
    expect(plate.relationFacts.activeActions).toContainEqual(expect.objectContaining({
      id: hiddenAction?.id,
      sourceActivity: hiddenAction?.sourceActivity,
      targetKind: 'hidden-spirit',
      effects: hiddenAction?.effects,
    }));
  });

  it('marks a hidden spirit as released when an active line attacks its flying spirit', () => {
    const plate = buildPlate([6, 7, 7, 7, 7, 7], castAt);
    const hidden = plate.fuShen.find((item) => item.lineIndex === 2);

    expect(hidden?.activeSourceActions).toContainEqual(expect.objectContaining({
      id: 'active:1>flying:2',
      target: 'flying-spirit',
      effects: expect.arrayContaining(['克']),
    }));
    expect(hidden?.status).toBe('冲飞待出');
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
