import type { LineValue } from './divination';
import type { LineRecord, TimeCastingBasis, TimeCompletedCasting } from './casting';
import { traditionalCalendarAt } from './traditionalCalendar';

const TRIGRAM_LINES_BY_NUMBER: Record<number, readonly [boolean, boolean, boolean]> = {
  1: [true, true, true],
  2: [true, true, false],
  3: [true, false, true],
  4: [true, false, false],
  5: [false, true, true],
  6: [false, true, false],
  7: [false, false, true],
  8: [false, false, false],
};

function traditionalRemainder(total: number, divisor: number): number {
  const remainder = total % divisor;
  return remainder === 0 ? divisor : remainder;
}

function lineValue(baseYang: boolean, moving: boolean): LineValue {
  if (moving) return baseYang ? 9 : 6;
  return baseYang ? 7 : 8;
}

export function deriveTimeCasting(castAt: Date): TimeCompletedCasting {
  if (!Number.isFinite(castAt.getTime())) throw new TypeError('起卦时间无效');
  const calendar = traditionalCalendarAt(castAt);
  const upperTotal = calendar.numbers.year + calendar.numbers.month + calendar.numbers.day;
  const fullTotal = upperTotal + calendar.numbers.hour;
  const upperTrigramNumber = traditionalRemainder(upperTotal, 8);
  const lowerTrigramNumber = traditionalRemainder(fullTotal, 8);
  const movingLine = traditionalRemainder(fullTotal, 6);
  const baseLines = [
    ...TRIGRAM_LINES_BY_NUMBER[lowerTrigramNumber],
    ...TRIGRAM_LINES_BY_NUMBER[upperTrigramNumber],
  ];
  const recordedAt = castAt.toISOString();
  const lines: LineRecord[] = baseLines.map((baseYang, index) => ({
    id: crypto.randomUUID(),
    lineIndex: index + 1,
    value: lineValue(baseYang, movingLine === index + 1),
    recordedAt,
  }));
  const basis: TimeCastingBasis = {
    kind: 'time',
    algorithm: 'time_meihua_lunar_v1',
    castAt: recordedAt,
    calendar,
    upperTrigramNumber,
    lowerTrigramNumber,
    movingLine,
  };
  return { method: 'time', basis, lines };
}
