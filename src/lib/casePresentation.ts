import type { DivinationCaseV2, PlateLineV2 } from '../domain/liuyao/model';
import type { DivinationPlate, Hexagram, PlateLine, Toss, Trigram, TrigramKey } from './divination';

const TRIGRAMS: Record<TrigramKey, Trigram> = {
  乾: { key: '乾', nature: '天', element: '金', symbol: '☰' },
  兑: { key: '兑', nature: '泽', element: '金', symbol: '☱' },
  离: { key: '离', nature: '火', element: '火', symbol: '☲' },
  震: { key: '震', nature: '雷', element: '木', symbol: '☳' },
  巽: { key: '巽', nature: '风', element: '木', symbol: '☴' },
  坎: { key: '坎', nature: '水', element: '水', symbol: '☵' },
  艮: { key: '艮', nature: '山', element: '土', symbol: '☶' },
  坤: { key: '坤', nature: '地', element: '土', symbol: '☷' },
};

function tossFields(value: PlateLineV2['tossValue']): Toss {
  const faces = value === 6
    ? ['text', 'text', 'text'] as const
    : value === 7
      ? ['text', 'text', 'reverse'] as const
      : value === 8
        ? ['text', 'reverse', 'reverse'] as const
        : ['reverse', 'reverse', 'reverse'] as const;
  return {
    faces: [...faces],
    value,
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 7 || value === 6,
  };
}

function hexagram(side: DivinationCaseV2['plate']['baseHexagram']): Hexagram {
  return {
    name: side.name,
    shortName: side.shortName,
    upper: TRIGRAMS[side.upperTrigram as TrigramKey],
    lower: TRIGRAMS[side.lowerTrigram as TrigramKey],
    palace: side.palace as TrigramKey,
    palaceElement: side.palaceElement,
    generation: side.generation,
    shiLine: side.shiLine,
    yingLine: side.yingLine,
  };
}

function isLineSide(
  entity: DivinationCaseV2['facts'][number]['source'] | undefined,
  lineId: string,
  side: 'base' | 'changed',
): boolean {
  return entity?.type === 'line' && entity.id === lineId && entity.side === side;
}

function hasLineFact(
  caseSnapshot: DivinationCaseV2,
  lineId: string,
  side: 'base' | 'changed',
  relation: string,
  pillar?: 'month' | 'day',
): boolean {
  return caseSnapshot.facts.some((fact) => (
    fact.relation === relation
    && (isLineSide(fact.source, lineId, side) || isLineSide(fact.target, lineId, side))
    && (!pillar || (
      (fact.source.type === 'pillar' && fact.source.id === pillar)
      || (fact.target?.type === 'pillar' && fact.target.id === pillar)
    ))
  ));
}

function sixSpirit(caseSnapshot: DivinationCaseV2, lineId: string): string {
  const fact = caseSnapshot.facts.find((candidate) => (
    candidate.relation === 'is-six-beast'
    && (isLineSide(candidate.source, lineId, 'base') || isLineSide(candidate.target, lineId, 'base'))
  ));
  const value = fact?.values.spirit ?? fact?.values.sixSpirit;
  return typeof value === 'string' ? value : '';
}

function line(caseSnapshot: DivinationCaseV2, source: PlateLineV2): PlateLine {
  return {
    ...tossFields(source.tossValue),
    index: source.position,
    stem: source.base.stem,
    branch: source.base.branch,
    ganZhi: source.base.ganZhi,
    element: source.base.branchElement,
    relation: source.base.relationToBasePalace,
    changedStem: source.changed.stem,
    changedBranch: source.changed.branch,
    changedGanZhi: source.changed.ganZhi,
    changedElement: source.changed.branchElement,
    changedRelation: source.changed.relationToBasePalace,
    void: hasLineFact(caseSnapshot, source.id, 'base', 'is-void'),
    monthBreak: hasLineFact(caseSnapshot, source.id, 'base', 'is-month-break'),
    dayClash: hasLineFact(caseSnapshot, source.id, 'base', 'clashes', 'day'),
    monthCombine: hasLineFact(caseSnapshot, source.id, 'base', 'combines', 'month'),
    dayCombine: hasLineFact(caseSnapshot, source.id, 'base', 'combines', 'day'),
    changedVoid: hasLineFact(caseSnapshot, source.id, 'changed', 'is-void'),
    changedMonthBreak: hasLineFact(caseSnapshot, source.id, 'changed', 'is-month-break'),
    changedDayClash: hasLineFact(caseSnapshot, source.id, 'changed', 'clashes', 'day'),
    changedMonthCombine: hasLineFact(caseSnapshot, source.id, 'changed', 'combines', 'month'),
    changedDayCombine: hasLineFact(caseSnapshot, source.id, 'changed', 'combines', 'day'),
    role: source.base.role,
    beast: sixSpirit(caseSnapshot, source.id),
  };
}

export function legacyPlateFromCase(caseSnapshot: DivinationCaseV2): DivinationPlate {
  const { plate } = caseSnapshot;
  const day = plate.calendar.pillars.day;
  const month = plate.calendar.pillars.month;
  return {
    id: plate.id,
    castAt: plate.castAt,
    dayGanZhi: day.ganZhi,
    monthGanZhi: month.ganZhi,
    monthBranch: month.branch.value,
    voidBranches: [...day.voidBranches],
    baseHexagram: hexagram(plate.baseHexagram),
    changedHexagram: hexagram(plate.changedHexagram),
    movingLines: [...plate.movingLines],
    lines: plate.lines.map((source) => line(caseSnapshot, source)),
  };
}
