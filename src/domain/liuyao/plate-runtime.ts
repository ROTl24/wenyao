import type { PlateV2 } from './model.js';
import { WENWANG_NAJIA_V2_ARTIFACT } from './rules/wenwang-najia-v2.js';

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

function validFacet(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const stem = value.stem;
  const branch = value.branch;
  return typeof stem === 'string'
    && typeof branch === 'string'
    && STEM_ELEMENTS.get(stem as never) === value.stemElement
    && BRANCH_ELEMENTS.get(branch as never) === value.branchElement
    && value.ganZhi === `${stem}${branch}`
    && typeof value.yang === 'boolean'
    && SIX_RELATIONS.has(value.relationToBasePalace as never)
    && SIX_RELATIONS.has(value.relationToOwnPalace as never)
    && (value.role === null || value.role === '世' || value.role === '应');
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
  return isPlainObject(value)
    && isNonEmptyString(value.key)
    && isNonEmptyString(value.name)
    && isNonEmptyString(value.palace)
    && [...STEM_ELEMENTS.values(), ...BRANCH_ELEMENTS.values()].includes(value.palaceElement as never)
    && LINE_POSITIONS.includes(value.shiLine as never)
    && LINE_POSITIONS.includes(value.yingLine as never);
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
      || !isNonEmptyString(rulePackRef.version)
      || typeof rulePackRef.artifactHash !== 'string'
      || !/^[0-9a-f]{64}$/.test(rulePackRef.artifactHash)
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

    const rawTosses = candidate.rawTosses as unknown[];
    const lines = candidate.lines as unknown[];
    const movingLines = candidate.movingLines as unknown[];

    const positions = new Set<number>();
    const ids = new Set<string>();
    const movingPositions: number[] = [];
    for (const lineValue of lines) {
      if (!isPlainObject(lineValue)) reject();
      const line = lineValue as Record<string, unknown>;
      const position = line.position;
      const tossValue = line.tossValue;
      if (
        typeof position !== 'number'
        || !LINE_POSITIONS.includes(position as never)
        || positions.has(position)
        || line.id !== `line:${position}`
        || ids.has(line.id as string)
        || typeof tossValue !== 'number'
        || !TOSS_VALUES.has(tossValue)
        || rawTosses[position - 1] !== tossValue
        || typeof line.moving !== 'boolean'
        || line.moving !== (tossValue === 6 || tossValue === 9)
        || !validFacet(line.base)
        || !validFacet(line.changed)
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
