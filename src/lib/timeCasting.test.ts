import { describe, expect, it } from 'vitest';
import { deriveTimeCasting } from './timeCasting';
import { traditionalCalendarAt } from './traditionalCalendar';

describe('梅花年月日时起卦', () => {
  it('uses the approved lunar year-month-day-hour formula before zi hour', () => {
    const castAt = new Date('2026-08-03T14:59:00.000Z'); // 北京 2026-08-03 22:59
    const casting = deriveTimeCasting(castAt);

    expect(casting.basis).toMatchObject({
      kind: 'time',
      algorithm: 'time_meihua_lunar_v1',
      upperTrigramNumber: 2,
      lowerTrigramNumber: 6,
      movingLine: 4,
      calendar: {
        traditionalDate: '2026-08-03',
        lunarYearBranch: '午',
        lunarMonth: 6,
        lunarDay: 21,
        timeBranch: '亥',
        numbers: { year: 7, month: 6, day: 21, hour: 12 },
      },
    });
    expect(casting.lines.map((line) => line.value)).toEqual([8, 7, 8, 9, 7, 8]);
    expect(casting.lines.every((line) => !Object.hasOwn(line, 'coin'))).toBe(true);
  });

  it('changes the traditional date at 23:00 and keeps the whole zi branch stable', () => {
    const ziStart = deriveTimeCasting(new Date('2026-08-03T15:00:00.000Z')); // 北京 23:00
    const afterMidnight = deriveTimeCasting(new Date('2026-08-03T16:59:00.000Z')); // 北京次日 00:59

    expect(ziStart.basis).toMatchObject({
      upperTrigramNumber: 3,
      lowerTrigramNumber: 4,
      movingLine: 6,
      calendar: {
        traditionalDate: '2026-08-04',
        lunarMonth: 6,
        lunarDay: 22,
        timeBranch: '子',
        numbers: { year: 7, month: 6, day: 22, hour: 1 },
      },
    });
    expect(ziStart.lines.map((line) => line.value)).toEqual([7, 8, 8, 7, 8, 9]);
    expect(afterMidnight.lines.map((line) => line.value)).toEqual(
      ziStart.lines.map((line) => line.value),
    );
    expect(afterMidnight.basis.calendar).toEqual(ziStart.basis.calendar);
  });

  it('rejects dates outside the versioned calendar support range', () => {
    expect(() => traditionalCalendarAt(new Date('1899-12-30T16:00:00.000Z'))).toThrow(
      '时间起卦仅支持 1900—2100 年',
    );
  });
});
