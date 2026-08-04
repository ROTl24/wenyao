import { describe, expect, it } from 'vitest';
import {
  ALMANAC_MAX_YEAR,
  ALMANAC_MIN_YEAR,
  buildAlmanacDetail,
  buildAlmanacMonth,
  currentAlmanacSelection,
} from './almanac';

describe('黄历领域模型', () => {
  it('builds the approved 2026-08-04 daily facts and zi-hour pillars', () => {
    const detail = buildAlmanacDetail({ date: '2026-08-04', hourId: 'zi' });

    expect(detail.gregorianLabel).toBe('2026年8月4日');
    expect(detail.lunarLabel).toBe('农历丙午年六月廿二');
    expect(detail.pillars.map((pillar) => pillar.value)).toEqual(['丙午', '乙未', '庚戌', '丙子']);
    expect(detail.directions).toEqual([
      { label: '财神', direction: '正东' },
      { label: '喜神', direction: '西北' },
      { label: '福神', direction: '西南' },
      { label: '阳贵', direction: '正南' },
      { label: '阴贵', direction: '东北' },
    ]);
    expect(detail.dayGod).toEqual({ name: '青龙', type: '黄道', luck: '吉' });
    expect(detail.clash).toBe('冲(甲辰)龙 · 煞北');
    expect(detail.mansion).toEqual({ name: '室火猪', luck: '吉' });
    expect(detail.construction).toBe('平日');
    expect(detail.selectedHour.rangeLabel).toBe('8月3日 23:00—8月4日 00:59');
  });

  it('uses the next traditional date from 23:00 Beijing time', () => {
    expect(currentAlmanacSelection(new Date('2026-08-03T14:59:59.000Z'))).toEqual({
      date: '2026-08-03',
      hourId: 'hai',
    });
    expect(currentAlmanacSelection(new Date('2026-08-03T15:00:00.000Z'))).toEqual({
      date: '2026-08-04',
      hourId: 'zi',
    });
    expect(currentAlmanacSelection(new Date('2026-08-03T16:59:59.000Z'))).toEqual({
      date: '2026-08-04',
      hourId: 'zi',
    });
    expect(currentAlmanacSelection(new Date('2026-08-03T17:00:00.000Z'))).toEqual({
      date: '2026-08-04',
      hourId: 'chou',
    });
  });

  it('builds a Monday-first six-week month with lunar labels and solar terms', () => {
    const days = buildAlmanacMonth(2026, 8);

    expect(days).toHaveLength(42);
    expect(days[0].date).toBe('2026-07-27');
    expect(days[41].date).toBe('2026-09-06');
    expect(days.find((day) => day.date === '2026-08-04')?.lunarLabel).toBe('廿二');
    expect(days.find((day) => day.date === '2026-08-07')?.solarTerm).toBe('立秋');
  });

  it('preserves leap-month wording in month cells', () => {
    const day = buildAlmanacMonth(2025, 7).find((candidate) => candidate.date === '2025-07-25');
    expect(day?.lunarLabel).toBe('闰六月');
  });

  it('supports the agreed year boundaries and rejects out-of-range dates', () => {
    expect(() => buildAlmanacDetail({ date: `${ALMANAC_MIN_YEAR}-01-01`, hourId: 'wu' })).not.toThrow();
    expect(() => buildAlmanacDetail({ date: `${ALMANAC_MAX_YEAR}-12-31`, hourId: 'wu' })).not.toThrow();
    expect(buildAlmanacMonth(ALMANAC_MIN_YEAR, 1)[0]).toMatchObject({ date: '1900-01-01', selectable: true });
    expect(buildAlmanacMonth(ALMANAC_MAX_YEAR, 12).at(-1)?.selectable).toBe(false);
    expect(() => buildAlmanacDetail({ date: '1899-12-31', hourId: 'wu' })).toThrow('仅支持');
    expect(() => buildAlmanacDetail({ date: '2101-01-01', hourId: 'wu' })).toThrow('仅支持');
  });
});
