import { createTossFromValue, type LineValue } from './divination';
import { defaultCastingBasis, lineRecordFromToss } from './casting';
import {
  createCompletedSession,
  type DivinationSession,
  type SessionCategory,
} from './session';

export interface PhysicalCastLine {
  value: LineValue;
  recordedAt: string;
}

export interface PhysicalCastDraft {
  question: string;
  category: SessionCategory;
  castAt: string;
  lines: PhysicalCastLine[];
}

export const PHYSICAL_TOSS_OPTIONS: ReadonlyArray<{
  value: LineValue;
  countLabel: string;
  description: string;
}> = [
  { value: 6, countLabel: '三字', description: '老阴 6 · 动爻' },
  { value: 7, countLabel: '两字一背', description: '少阳 7 · 静爻' },
  { value: 8, countLabel: '一字两背', description: '少阴 8 · 静爻' },
  { value: 9, countLabel: '三背', description: '老阳 9 · 动爻' },
];

function exactIso(value: string): boolean {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function assertDraft(draft: PhysicalCastDraft): void {
  if (
    !draft.question.trim()
    || !exactIso(draft.castAt)
    || draft.lines.length > 6
    || draft.lines.some((line) => (
      ![6, 7, 8, 9].includes(line.value)
      || !exactIso(line.recordedAt)
    ))
  ) throw new TypeError('线下起卦草稿无效');
}

export function createPhysicalCastDraft(
  question: string,
  category: SessionCategory,
  castAt: string,
): PhysicalCastDraft {
  const draft = { question: question.trim(), category, castAt, lines: [] };
  assertDraft(draft);
  return draft;
}

export function appendPhysicalCastLine(
  draft: PhysicalCastDraft,
  value: LineValue,
  recordedAt = new Date().toISOString(),
): PhysicalCastDraft {
  assertDraft(draft);
  if (draft.lines.length >= 6) throw new Error('六爻已经全部录入');
  const next = {
    ...draft,
    lines: [...draft.lines, { value, recordedAt }],
  };
  assertDraft(next);
  return next;
}

export function replacePhysicalCastLine(
  draft: PhysicalCastDraft,
  zeroIndex: number,
  value: LineValue,
  recordedAt = new Date().toISOString(),
): PhysicalCastDraft {
  assertDraft(draft);
  if (!Number.isInteger(zeroIndex) || zeroIndex < 0 || zeroIndex >= draft.lines.length) {
    throw new RangeError('要修改的爻位不存在');
  }
  const lines = draft.lines.map((line, index) => (
    index === zeroIndex ? { value, recordedAt } : line
  ));
  const next = { ...draft, lines };
  assertDraft(next);
  return next;
}

export function updatePhysicalCastTime(
  draft: PhysicalCastDraft,
  castAt: string,
): PhysicalCastDraft {
  const next = { ...draft, castAt };
  assertDraft(next);
  return next;
}

export function finalizePhysicalCast(
  draft: PhysicalCastDraft,
  finalizedAt = new Date().toISOString(),
): DivinationSession {
  assertDraft(draft);
  if (draft.lines.length !== 6) throw new Error('必须确认完整六爻后才能排盘');
  if (!exactIso(finalizedAt)) throw new TypeError('完成时间无效');

  const castAt = new Date(draft.castAt);
  const lines = draft.lines.map((line, index) => (
    lineRecordFromToss(createTossFromValue(line.value), index + 1, line.recordedAt)
  ));
  return createCompletedSession(
    draft.question,
    draft.category,
    castAt,
    { method: 'physical', basis: defaultCastingBasis('physical'), lines },
    new Date(finalizedAt),
  );
}
