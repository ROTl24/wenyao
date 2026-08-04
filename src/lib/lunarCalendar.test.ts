import { describe, expect, it } from 'vitest';
import { formatLunarDateLabel, lunarFromShanghaiInstant } from './lunarCalendar';

describe('农历日期换算', () => {
  it('formats the selected Gregorian date as a complete lunar date', () => {
    expect(formatLunarDateLabel('2026-08-04')).toBe('农历丙午年六月廿二');
  });

  it('preserves leap-month wording', () => {
    expect(formatLunarDateLabel('2025-07-25')).toBe('农历乙巳年闰六月初一');
  });

  it.each(['', '2026-08', '2026-02-30', 'not-a-date'])(
    'returns no label for incomplete or invalid input %j',
    (value) => {
      expect(formatLunarDateLabel(value)).toBeNull();
    },
  );

  it('uses the Shanghai civil date when converting an instant', () => {
    const lunar = lunarFromShanghaiInstant(new Date('2026-08-03T16:30:00.000Z'));

    expect(lunar.getMonthInChinese()).toBe('六');
    expect(lunar.getDayInChinese()).toBe('廿二');
  });
});
