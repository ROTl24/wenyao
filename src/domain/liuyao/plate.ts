import { buildCalendarSnapshot } from './calendar.js';
import type {
  Branch,
  Element,
  HiddenSpiritCandidateV2,
  HexagramSideV2,
  LineFacetV2,
  PlateLineV2,
  PlateV2,
  SixRelation,
  Stem,
} from './model.js';
import type { RuleContext } from './rules/model.js';
import { assertProjectEnabledRuleContext } from './rules/registry.js';
import { deepFreeze, type HexagramRule, type LinePosition, type TrigramKey, type TrigramRule } from './rules/tables.js';
import {
  WENWANG_NAJIA_V2_ARTIFACT,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
} from './rules/wenwang-najia-v2.js';

type TossTuple = PlateV2['rawTosses'];

const TRIGRAM_BY_KEY = deepFreeze(Object.fromEntries(
  WENWANG_NAJIA_V2_ARTIFACT.trigrams.map((trigram) => [trigram.key, trigram]),
) as Record<TrigramKey, TrigramRule>);
const TRIGRAM_BY_BITS = deepFreeze(Object.fromEntries(
  WENWANG_NAJIA_V2_ARTIFACT.trigrams.map((trigram) => [trigram.bits.map(Number).join(''), trigram]),
) as Record<string, TrigramRule>);
const HEXAGRAM_BY_KEY = deepFreeze(Object.fromEntries(
  WENWANG_NAJIA_V2_ARTIFACT.hexagrams.map((hexagram) => [hexagram.key, hexagram]),
) as Record<string, HexagramRule>);
const STEM_ELEMENTS = deepFreeze(Object.fromEntries(
  WENWANG_NAJIA_V2_ARTIFACT.stemElements.map(({ stem, element }) => [stem, element]),
) as Record<Stem, Element>);
const BRANCH_ELEMENTS = deepFreeze(Object.fromEntries(
  WENWANG_NAJIA_V2_ARTIFACT.branchElements.map(({ branch, element }) => [branch, element]),
) as Record<Branch, Element>);

function normalizeTosses(tossValues: readonly number[]): TossTuple {
  if (!Array.isArray(tossValues) || tossValues.length !== 6) {
    throw new TypeError('六爻必须正好包含六个投币值');
  }
  if (tossValues.some((value) => value !== 6 && value !== 7 && value !== 8 && value !== 9)) {
    throw new TypeError('投币值只能是 6、7、8、9');
  }
  return [...tossValues] as unknown as TossTuple;
}

function relationOf(lineElement: Element, palaceElement: Element): SixRelation {
  if (lineElement === palaceElement) return '兄弟';
  if (WENWANG_NAJIA_V2_ARTIFACT.generates.some(
    ({ source, target }) => source === lineElement && target === palaceElement,
  )) return '父母';
  if (WENWANG_NAJIA_V2_ARTIFACT.generates.some(
    ({ source, target }) => source === palaceElement && target === lineElement,
  )) return '子孙';
  if (WENWANG_NAJIA_V2_ARTIFACT.controls.some(
    ({ source, target }) => source === lineElement && target === palaceElement,
  )) return '官鬼';
  return '妻财';
}

function trigramFromLines(lines: readonly boolean[]): TrigramRule {
  const key = lines.map(Number).join('');
  const trigram = TRIGRAM_BY_BITS[key];
  if (!trigram) throw new Error(`无法映射三爻：${key}`);
  return trigram;
}

function hexagramFromLines(lines: readonly boolean[]): HexagramRule {
  if (lines.length !== 6) throw new TypeError('六爻必须正好包含六条阴阳线');
  const lower = trigramFromLines(lines.slice(0, 3));
  const upper = trigramFromLines(lines.slice(3, 6));
  const hexagram = HEXAGRAM_BY_KEY[`${upper.key}-${lower.key}`];
  if (!hexagram) throw new Error('无法映射六十四卦');
  return hexagram;
}

function toHexagramSide(hexagram: HexagramRule): HexagramSideV2 {
  return {
    key: hexagram.key,
    name: hexagram.name,
    shortName: hexagram.shortName,
    upperTrigram: hexagram.upperTrigram,
    lowerTrigram: hexagram.lowerTrigram,
    palace: hexagram.palace,
    palaceElement: TRIGRAM_BY_KEY[hexagram.palace].element,
    generation: hexagram.generation,
    shiLine: hexagram.shiLine,
    yingLine: hexagram.yingLine,
  };
}

interface EquippedLine {
  readonly yang: boolean;
  readonly stem: Stem;
  readonly branch: Branch;
  readonly ganZhi: `${Stem}${Branch}`;
  readonly stemElement: Element;
  readonly branchElement: Element;
  readonly role: '世' | '应' | null;
}

function equipLine(hexagram: HexagramRule, position: LinePosition, yang: boolean): EquippedLine {
  const inner = position <= 3;
  const trigramKey = inner ? hexagram.lowerTrigram : hexagram.upperTrigram;
  const najia = inner ? TRIGRAM_BY_KEY[trigramKey].inner : TRIGRAM_BY_KEY[trigramKey].outer;
  const stem = najia.stem;
  const branch = najia.branches[(position - 1) % 3];
  const role = position === hexagram.shiLine ? '世' : position === hexagram.yingLine ? '应' : null;
  return {
    yang,
    stem,
    branch,
    ganZhi: `${stem}${branch}`,
    stemElement: STEM_ELEMENTS[stem],
    branchElement: BRANCH_ELEMENTS[branch],
    role,
  };
}

function toFacet(
  equipped: EquippedLine,
  basePalaceElement: Element,
  ownPalaceElement: Element,
): LineFacetV2 {
  return {
    ...equipped,
    relationToBasePalace: relationOf(equipped.branchElement, basePalaceElement),
    relationToOwnPalace: relationOf(equipped.branchElement, ownPalaceElement),
  };
}

function buildPotentialHiddenSpirits(
  baseHexagram: HexagramRule,
  baseLines: readonly LineFacetV2[],
): Readonly<Record<number, readonly HiddenSpiritCandidateV2[]>> {
  const visibleRelations = new Set(baseLines.map(({ relationToBasePalace }) => relationToBasePalace));
  const palaceHead = WENWANG_NAJIA_V2_ARTIFACT.hexagrams.find(
    ({ palace, generation }) => palace === baseHexagram.palace && generation === '本宫',
  );
  if (!palaceHead) throw new Error(`缺少 ${baseHexagram.palace} 宫首卦`);
  const palaceElement = TRIGRAM_BY_KEY[baseHexagram.palace].element;
  const sourceLines = Array.from({ length: 6 }, (_, index) => {
    const position = (index + 1) as LinePosition;
    const equipped = equipLine(palaceHead, position, TRIGRAM_BY_KEY[
      position <= 3 ? palaceHead.lowerTrigram : palaceHead.upperTrigram
    ].bits[(position - 1) % 3]);
    return {
      position,
      equipped,
      relation: relationOf(equipped.branchElement, palaceElement),
    };
  });
  const byHostLine: Record<number, HiddenSpiritCandidateV2[]> = {};

  for (const relation of WENWANG_NAJIA_V2_ARTIFACT.relationOrder) {
    if (visibleRelations.has(relation)) continue;
    const matches = sourceLines.filter((line) => line.relation === relation);
    if (matches.length !== 1) {
      throw new Error(`${baseHexagram.name} 缺失六亲 ${relation} 在宫首卦中不是唯一位置`);
    }
    const [{ position, equipped }] = matches;
    const candidate: HiddenSpiritCandidateV2 = {
      id: `hidden:line:${position}:${relation}`,
      hostLineId: `line:${position}`,
      sourceLine: position,
      relation,
      stem: equipped.stem,
      branch: equipped.branch,
      ganZhi: equipped.ganZhi,
      element: equipped.branchElement,
      sourceHexagram: palaceHead.name,
      status: 'potential',
    };
    (byHostLine[position] ??= []).push(candidate);
  }

  for (const candidates of Object.values(byHostLine)) {
    candidates.sort((left, right) => left.sourceLine - right.sourceLine);
  }
  return byHostLine;
}

export function buildPlateV2(input: {
  plateId: string;
  sessionId: string;
  castAt: string;
  tossValues: TossTuple;
  ruleContext: RuleContext;
}): PlateV2 {
  assertProjectEnabledRuleContext(input.ruleContext);
  const rawTosses = normalizeTosses(input.tossValues);
  const baseYang = rawTosses.map((value) => value === 7 || value === 9);
  const changedYang = rawTosses.map((value, index) => (
    value === 6 || value === 9 ? !baseYang[index] : baseYang[index]
  ));
  const baseRule = hexagramFromLines(baseYang);
  const changedRule = hexagramFromLines(changedYang);
  const baseHexagram = toHexagramSide(baseRule);
  const changedHexagram = toHexagramSide(changedRule);
  const basePalaceElement = baseHexagram.palaceElement;
  const changedPalaceElement = changedHexagram.palaceElement;
  const baseFacets = Array.from({ length: 6 }, (_, index) => {
    const position = (index + 1) as LinePosition;
    return toFacet(equipLine(baseRule, position, baseYang[index]), basePalaceElement, basePalaceElement);
  });
  const changedFacets = Array.from({ length: 6 }, (_, index) => {
    const position = (index + 1) as LinePosition;
    return toFacet(equipLine(changedRule, position, changedYang[index]), basePalaceElement, changedPalaceElement);
  });
  const hiddenByLine = buildPotentialHiddenSpirits(baseRule, baseFacets);
  const lines = rawTosses.map((tossValue, index): PlateLineV2 => {
    const position = (index + 1) as LinePosition;
    const moving = tossValue === 6 || tossValue === 9;
    return {
      id: `line:${position}`,
      position,
      tossValue,
      moving,
      base: baseFacets[index],
      changed: changedFacets[index],
      transition: moving
        ? { fromLineId: `line:${position}:base`, toLineId: `line:${position}:changed` }
        : null,
      hiddenSpiritCandidates: hiddenByLine[position] ?? [],
    };
  }) as unknown as PlateV2['lines'];

  return {
    schemaVersion: '2.0.0',
    id: input.plateId,
    sessionId: input.sessionId,
    castAt: input.castAt,
    calendar: buildCalendarSnapshot(input.castAt, input.ruleContext.calendarProfile),
    rulePackRef: {
      id: 'wenwang_najia_v2',
      version: WENWANG_NAJIA_V2_ARTIFACT.version,
      artifactHash: WENWANG_NAJIA_V2_ARTIFACT_HASH,
    },
    rawTosses,
    baseHexagram,
    changedHexagram,
    movingLines: lines.filter(({ moving }) => moving).map(({ position }) => position),
    lines,
  };
}
