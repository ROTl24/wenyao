import type { Element, PlateV2, SixRelation } from './model.js';
import { buildCalendarSnapshot } from './calendar.js';
import { BASE_RULE_CONTEXT } from './rules/default-context.js';
import { canonicalStringify } from './rules/tables.js';
import {
  WENWANG_NAJIA_V2_ARTIFACT,
  WENWANG_NAJIA_V2_ARTIFACT_HASH,
} from './rules/wenwang-najia-v2.js';

const PLATE_GATE_ERROR = 'PlateV2 运行时结构无效';
const PILLAR_KINDS = ['year', 'month', 'day', 'hour'] as const;
const LINE_POSITIONS = [1, 2, 3, 4, 5, 6] as const;
const TOSS_VALUES = new Set([6, 7, 8, 9]);
const SIX_RELATIONS = new Set(['父母', '兄弟', '子孙', '妻财', '官鬼']);
const STEM_ELEMENTS = new Map(
  WENWANG_NAJIA_V2_ARTIFACT.stemElements.map(({ stem, element }) => [stem, element]),
);
const BRANCH_ELEMENTS = new Map(
  WENWANG_NAJIA_V2_ARTIFACT.branchElements.map(({ branch, element }) => [branch, element]),
);
const TRIGRAM_BY_KEY: ReadonlyMap<string, (typeof WENWANG_NAJIA_V2_ARTIFACT.trigrams)[number]> = new Map(
  WENWANG_NAJIA_V2_ARTIFACT.trigrams.map((trigram) => [trigram.key, trigram]),
);
const HEXAGRAM_BY_KEY: ReadonlyMap<string, (typeof WENWANG_NAJIA_V2_ARTIFACT.hexagrams)[number]> = new Map(
  WENWANG_NAJIA_V2_ARTIFACT.hexagrams.map((hexagram) => [hexagram.key, hexagram]),
);
const HIDDEN_CANDIDATE_KEYS = [
  'id',
  'hostLineId',
  'sourceLine',
  'relation',
  'stem',
  'branch',
  'ganZhi',
  'element',
  'sourceHexagram',
  'status',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDenseArray(value: unknown, length?: number): value is unknown[] {
  return Array.isArray(value)
    && (length === undefined || value.length === length)
    && Array.from({ length: value.length }, (_, index) => index in value).every(Boolean);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
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

function validFacet(
  value: unknown,
  basePalaceElement: Element,
  ownPalaceElement: Element,
  expected: Readonly<{
    stem: string;
    branch: string;
    yang: boolean;
    role: '世' | '应' | null;
  }>,
): boolean {
  if (!isPlainObject(value)) return false;
  const stem = value.stem;
  const branch = value.branch;
  const branchElement = value.branchElement;
  return typeof stem === 'string'
    && typeof branch === 'string'
    && stem === expected.stem
    && branch === expected.branch
    && STEM_ELEMENTS.has(stem as never)
    && BRANCH_ELEMENTS.has(branch as never)
    && STEM_ELEMENTS.get(stem as never) === value.stemElement
    && BRANCH_ELEMENTS.get(branch as never) === branchElement
    && value.ganZhi === `${stem}${branch}`
    && value.yang === expected.yang
    && value.relationToBasePalace === relationOf(branchElement as Element, basePalaceElement)
    && value.relationToOwnPalace === relationOf(branchElement as Element, ownPalaceElement)
    && value.role === expected.role;
}

function expectedFacetForSide(
  hexagramKey: string,
  position: number,
): Readonly<{ stem: string; branch: string; yang: boolean }> | null {
  const hexagram = HEXAGRAM_BY_KEY.get(hexagramKey);
  if (!hexagram) return null;
  const inner = position <= 3;
  const trigram = TRIGRAM_BY_KEY.get(
    inner ? hexagram.lowerTrigram : hexagram.upperTrigram,
  );
  if (!trigram) return null;
  const index = (position - 1) % 3;
  const najia = inner ? trigram.inner : trigram.outer;
  return {
    stem: najia.stem,
    branch: najia.branches[index],
    yang: trigram.bits[index],
  };
}

function validPillar(value: unknown, kind: (typeof PILLAR_KINDS)[number]): boolean {
  if (!isPlainObject(value) || value.kind !== kind) return false;
  if (!isPlainObject(value.stem) || !isPlainObject(value.branch)) return false;
  const stem = value.stem.value;
  const branch = value.branch.value;
  return typeof stem === 'string'
    && typeof branch === 'string'
    && STEM_ELEMENTS.get(stem as never) === value.stem.element
    && BRANCH_ELEMENTS.get(branch as never) === value.branch.element
    && value.ganZhi === `${stem}${branch}`
    && isNonEmptyString(value.xun)
    && isDenseArray(value.voidBranches, 2)
    && value.voidBranches.every((candidate) => (
      typeof candidate === 'string' && BRANCH_ELEMENTS.has(candidate as never)
    ));
}

function validHexagramSide(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.key !== 'string') return false;
  const rule = HEXAGRAM_BY_KEY.get(value.key);
  const palace = rule ? TRIGRAM_BY_KEY.get(rule.palace) : undefined;
  return rule !== undefined
    && palace !== undefined
    && value.name === rule.name
    && value.shortName === rule.shortName
    && value.upperTrigram === rule.upperTrigram
    && value.lowerTrigram === rule.lowerTrigram
    && value.palace === rule.palace
    && value.palaceElement === palace.element
    && value.generation === rule.generation
    && value.shiLine === rule.shiLine
    && value.yingLine === rule.yingLine
    && rule.shiLine !== rule.yingLine;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function validHiddenSpiritCandidates(
  lines: readonly unknown[],
  baseHexagram: Record<string, unknown>,
): boolean {
  if (typeof baseHexagram.key !== 'string') return false;
  const baseRule = HEXAGRAM_BY_KEY.get(baseHexagram.key);
  if (!baseRule) return false;
  const palaceHead = WENWANG_NAJIA_V2_ARTIFACT.hexagrams.find(
    ({ palace, generation }) => palace === baseRule.palace && generation === '本宫',
  );
  const palace = TRIGRAM_BY_KEY.get(baseRule.palace);
  if (!palaceHead || !palace) return false;

  const visibleRelations = new Set<SixRelation>();
  for (const lineValue of lines) {
    if (!isPlainObject(lineValue) || !isPlainObject(lineValue.base)) return false;
    const relation = lineValue.base.relationToBasePalace;
    if (!SIX_RELATIONS.has(relation as never)) return false;
    visibleRelations.add(relation as SixRelation);
  }

  const sourceLines = LINE_POSITIONS.map((position) => {
    const inner = position <= 3;
    const trigramKey = inner ? palaceHead.lowerTrigram : palaceHead.upperTrigram;
    const trigram = TRIGRAM_BY_KEY.get(trigramKey);
    if (!trigram) return null;
    const najia = inner ? trigram.inner : trigram.outer;
    const stem = najia.stem;
    const branch = najia.branches[(position - 1) % 3];
    const element = BRANCH_ELEMENTS.get(branch);
    if (!element) return null;
    return {
      position,
      stem,
      branch,
      ganZhi: `${stem}${branch}`,
      element,
      relation: relationOf(element, palace.element),
    };
  });
  if (sourceLines.some((line) => line === null)) return false;

  const expectedByHost = new Map<number, Record<string, unknown>[]>();
  for (const relation of WENWANG_NAJIA_V2_ARTIFACT.relationOrder) {
    if (visibleRelations.has(relation)) continue;
    const matches = sourceLines.filter((line) => line?.relation === relation);
    if (matches.length !== 1 || !matches[0]) return false;
    const source = matches[0];
    const expected = {
      id: `hidden:line:${source.position}:${relation}`,
      hostLineId: `line:${source.position}`,
      sourceLine: source.position,
      relation,
      stem: source.stem,
      branch: source.branch,
      ganZhi: source.ganZhi,
      element: source.element,
      sourceHexagram: palaceHead.name,
      status: 'potential',
    };
    let hostCandidates = expectedByHost.get(source.position);
    if (!hostCandidates) {
      hostCandidates = [];
      expectedByHost.set(source.position, hostCandidates);
    }
    hostCandidates.push(expected);
  }
  for (const expected of expectedByHost.values()) {
    expected.sort((left, right) => Number(left.sourceLine) - Number(right.sourceLine));
  }

  const globalIds = new Set<string>();
  for (const lineValue of lines) {
    if (!isPlainObject(lineValue) || typeof lineValue.position !== 'number') return false;
    const actual = lineValue.hiddenSpiritCandidates;
    const expected = expectedByHost.get(lineValue.position) ?? [];
    if (!isDenseArray(actual, expected.length)) return false;
    for (let index = 0; index < actual.length; index += 1) {
      const candidate = actual[index];
      const expectedCandidate = expected[index];
      if (
        !isPlainObject(candidate)
        || !hasExactKeys(candidate, HIDDEN_CANDIDATE_KEYS)
        || !SIX_RELATIONS.has(candidate.relation as never)
        || candidate.id !== `hidden:line:${candidate.sourceLine}:${candidate.relation}`
        || candidate.hostLineId !== `line:${lineValue.position}`
        || candidate.sourceLine !== lineValue.position
        || HIDDEN_CANDIDATE_KEYS.some((key) => candidate[key] !== expectedCandidate[key])
        || typeof candidate.id !== 'string'
        || globalIds.has(candidate.id)
      ) return false;
      globalIds.add(candidate.id);
    }
  }
  return true;
}

export function assertPlateV2RuntimeShape(value: unknown): asserts value is PlateV2 {
  const reject = (): never => { throw new Error(PLATE_GATE_ERROR); };
  try {
    if (!isPlainObject(value)) reject();
    const candidate = value as Record<string, unknown>;
    if (
      candidate.schemaVersion !== '2.0.0'
      || !isNonEmptyString(candidate.id)
      || !isNonEmptyString(candidate.sessionId)
      || !isNonEmptyString(candidate.castAt)
      || !validHexagramSide(candidate.baseHexagram)
      || !validHexagramSide(candidate.changedHexagram)
      || !isDenseArray(candidate.rawTosses, 6)
      || !isDenseArray(candidate.lines, 6)
      || !isDenseArray(candidate.movingLines)
    ) reject();

    if (!isPlainObject(candidate.rulePackRef)) reject();
    const rulePackRef = candidate.rulePackRef as Record<string, unknown>;
    if (
      rulePackRef.id !== 'wenwang_najia_v2'
      || rulePackRef.version !== WENWANG_NAJIA_V2_ARTIFACT.version
      || rulePackRef.artifactHash !== WENWANG_NAJIA_V2_ARTIFACT_HASH
    ) reject();

    if (!isPlainObject(candidate.calendar)) reject();
    const calendar = candidate.calendar as Record<string, unknown>;
    if (
      calendar.timezone !== 'Asia/Shanghai'
      || !isNonEmptyString(calendar.localDateTime)
      || !isPlainObject(calendar.pillars)
    ) reject();
    const pillars = calendar.pillars as Record<string, unknown>;
    if (!PILLAR_KINDS.every((kind) => validPillar(pillars[kind], kind))) reject();
    const expectedCalendar = buildCalendarSnapshot(
      candidate.castAt as string,
      BASE_RULE_CONTEXT.calendarProfile,
    );
    if (canonicalStringify(calendar) !== canonicalStringify(expectedCalendar)) reject();

    const rawTosses = candidate.rawTosses as unknown[];
    const lines = candidate.lines as unknown[];
    const movingLines = candidate.movingLines as unknown[];
    const baseHexagram = candidate.baseHexagram as Record<string, unknown>;
    const changedHexagram = candidate.changedHexagram as Record<string, unknown>;
    const basePalaceElement = baseHexagram.palaceElement as Element;
    const changedPalaceElement = changedHexagram.palaceElement as Element;

    const positions = new Set<number>();
    const ids = new Set<string>();
    const movingPositions: number[] = [];
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const lineValue = lines[lineIndex];
      if (!isPlainObject(lineValue)) reject();
      const line = lineValue as Record<string, unknown>;
      const position = line.position;
      const tossValue = line.tossValue;
      const baseRole = position === baseHexagram.shiLine ? '世'
        : position === baseHexagram.yingLine ? '应' : null;
      const changedRole = position === changedHexagram.shiLine ? '世'
        : position === changedHexagram.yingLine ? '应' : null;
      const baseExpected = typeof position === 'number'
        ? expectedFacetForSide(baseHexagram.key as string, position)
        : null;
      const changedExpected = typeof position === 'number'
        ? expectedFacetForSide(changedHexagram.key as string, position)
        : null;
      const tossBaseYang = tossValue === 7 || tossValue === 9;
      const tossChangedYang = line.moving ? !tossBaseYang : tossBaseYang;
      if (
        typeof position !== 'number'
        || !LINE_POSITIONS.includes(position as never)
        || position !== lineIndex + 1
        || positions.has(position)
        || line.id !== `line:${position}`
        || ids.has(line.id as string)
        || typeof tossValue !== 'number'
        || !TOSS_VALUES.has(tossValue)
        || rawTosses[position - 1] !== tossValue
        || typeof line.moving !== 'boolean'
        || line.moving !== (tossValue === 6 || tossValue === 9)
        || baseExpected === null
        || changedExpected === null
        || baseExpected.yang !== tossBaseYang
        || changedExpected.yang !== tossChangedYang
        || !validFacet(line.base, basePalaceElement, basePalaceElement, {
          ...baseExpected,
          role: baseRole,
        })
        || !validFacet(line.changed, basePalaceElement, changedPalaceElement, {
          ...changedExpected,
          role: changedRole,
        })
        || !isDenseArray(line.hiddenSpiritCandidates)
      ) reject();
      const linePosition = position as number;

      if (line.moving) {
        if (
          !isPlainObject(line.transition)
          || line.transition.fromLineId !== `line:${position}:base`
          || line.transition.toLineId !== `line:${position}:changed`
        ) reject();
        movingPositions.push(linePosition);
      } else if (line.transition !== null) {
        reject();
      }
      positions.add(linePosition);
      ids.add(line.id as string);
    }

    movingPositions.sort((left, right) => left - right);
    if (
      positions.size !== 6
      || ids.size !== 6
      || !validHiddenSpiritCandidates(lines, baseHexagram)
      || movingLines.length !== movingPositions.length
      || movingLines.some((position, index) => (
        position !== movingPositions[index] || !LINE_POSITIONS.includes(position as never)
      ))
    ) reject();
  } catch (error) {
    if (error instanceof Error && error.message === PLATE_GATE_ERROR) throw error;
    reject();
  }
}
