import { describe, expect, it } from 'vitest';
import { JIE_BOUNDARIES_2026, SIXTY_JIA_ZI_GOLDEN } from './__fixtures__/golden-calendar.js';
import { buildCalendarSnapshot, getXunInfo } from './calendar.js';
import type { Branch, CalendarSnapshot, Element, Stem } from './model.js';
import { BASE_RULE_CONTEXT } from './rules/default-context.js';

const PROFILE = BASE_RULE_CONTEXT.calendarProfile;

function ganZhiOf(snapshot: CalendarSnapshot) {
  return {
    year: snapshot.pillars.year.ganZhi,
    month: snapshot.pillars.month.ganZhi,
    day: snapshot.pillars.day.ganZhi,
    hour: snapshot.pillars.hour.ganZhi,
  };
}

describe('buildCalendarSnapshot', () => {
  it('builds four exact pillars with xun, void and elements in Asia/Shanghai', () => {
    const calendar = buildCalendarSnapshot('2026-07-11T04:00:00.000Z', PROFILE);

    expect(calendar).toEqual({
      timezone: 'Asia/Shanghai',
      localDateTime: '2026-07-11T12:00:00+08:00',
      pillars: {
        year: {
          kind: 'year',
          ganZhi: '丙午',
          stem: { value: '丙', element: '火' },
          branch: { value: '午', element: '火' },
          xun: '甲辰旬',
          voidBranches: ['寅', '卯'],
        },
        month: {
          kind: 'month',
          ganZhi: '乙未',
          stem: { value: '乙', element: '木' },
          branch: { value: '未', element: '土' },
          xun: '甲午旬',
          voidBranches: ['辰', '巳'],
        },
        day: {
          kind: 'day',
          ganZhi: '丙戌',
          stem: { value: '丙', element: '火' },
          branch: { value: '戌', element: '土' },
          xun: '甲申旬',
          voidBranches: ['午', '未'],
        },
        hour: {
          kind: 'hour',
          ganZhi: '甲午',
          stem: { value: '甲', element: '木' },
          branch: { value: '午', element: '火' },
          xun: '甲午旬',
          voidBranches: ['辰', '巳'],
        },
      },
    });
  });

  it.each([
    {
      label: '1986 daylight saving time',
      castAt: '1986-06-01T00:00:00.000Z',
      localDateTime: '1986-06-01T09:00:00+09:00',
    },
    {
      label: '2026 standard time',
      castAt: '2026-07-11T04:00:00.000Z',
      localDateTime: '2026-07-11T12:00:00+08:00',
    },
  ])('formats $label with the actual Shanghai offset and preserves the instant', ({ castAt, localDateTime }) => {
    const calendar = buildCalendarSnapshot(castAt, PROFILE);

    expect(calendar.localDateTime).toBe(localDateTime);
    expect(Date.parse(calendar.localDateTime)).toBe(Date.parse(castAt));
  });

  it.each(JIE_BOUNDARIES_2026)('changes exact pillars at the 2026 $name boundary', (boundary) => {
    const before = buildCalendarSnapshot(boundary.beforeInstant, PROFILE);
    const atBoundary = buildCalendarSnapshot(boundary.atInstant, PROFILE);

    expect(ganZhiOf(before)).toEqual(boundary.before);
    expect(ganZhiOf(atBoundary)).toEqual(boundary.at);
  });

  it('changes the exact day and time pillars at 23:00 zi-hour boundary', () => {
    const before = buildCalendarSnapshot('2026-07-11T14:59:00.000Z', PROFILE);
    const atBoundary = buildCalendarSnapshot('2026-07-11T15:00:00.000Z', PROFILE);

    expect(before.localDateTime).toBe('2026-07-11T22:59:00+08:00');
    expect(atBoundary.localDateTime).toBe('2026-07-11T23:00:00+08:00');
    expect(ganZhiOf(before)).toEqual({
      year: '丙午',
      month: '乙未',
      day: '丙戌',
      hour: '己亥',
    });
    expect(ganZhiOf(atBoundary)).toEqual({
      year: '丙午',
      month: '乙未',
      day: '丁亥',
      hour: '庚子',
    });
  });

  it('does not change the exact day or time pillar again at midnight', () => {
    const beforeMidnight = buildCalendarSnapshot('2026-07-11T15:59:00.000Z', PROFILE);
    const atMidnight = buildCalendarSnapshot('2026-07-11T16:00:00.000Z', PROFILE);

    expect(ganZhiOf(beforeMidnight)).toEqual({
      year: '丙午',
      month: '乙未',
      day: '丁亥',
      hour: '庚子',
    });
    expect(ganZhiOf(atMidnight)).toEqual({
      year: '丙午',
      month: '乙未',
      day: '丁亥',
      hour: '庚子',
    });
  });

  it('produces the same Shanghai snapshot for Z and +08:00 forms of one instant', () => {
    const utc = buildCalendarSnapshot('2026-07-11T04:00:00.000Z', PROFILE);
    const offset = buildCalendarSnapshot('2026-07-11T12:00:00.000+08:00', PROFILE);

    expect(offset).toEqual(utc);
  });

  it('maps every heavenly stem and earthly branch to its reviewed element', () => {
    const expectedStemElements = {
      甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
      己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
    } as const satisfies Record<Stem, Element>;
    const expectedBranchElements = {
      子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
      午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
    } as const satisfies Record<Branch, Element>;
    const seenStems = new Set<Stem>();
    const seenBranches = new Set<Branch>();

    for (const { atInstant } of JIE_BOUNDARIES_2026) {
      const snapshot = buildCalendarSnapshot(atInstant, PROFILE);
      for (const pillar of Object.values(snapshot.pillars)) {
        seenStems.add(pillar.stem.value);
        seenBranches.add(pillar.branch.value);
        expect(pillar.stem.element).toBe(expectedStemElements[pillar.stem.value]);
        expect(pillar.branch.element).toBe(expectedBranchElements[pillar.branch.value]);
      }
    }

    expect(seenStems.size).toBe(10);
    expect(seenBranches.size).toBe(12);
  });

  it.each([
    '2026-07-11T12:00:00',
    '2026-07-11 12:00:00+08:00',
    '2026-02-30T12:00:00+08:00',
    'not-an-iso-time',
  ])('rejects timezone-less or invalid ISO input: %s', (castAt) => {
    expect(() => buildCalendarSnapshot(castAt, PROFILE)).toThrow(TypeError);
  });
});

describe('getXunInfo', () => {
  it.each(SIXTY_JIA_ZI_GOLDEN)('%s has its reviewed xun and void branches', (ganZhi, xun, voids) => {
    expect(getXunInfo(ganZhi)).toEqual({ xun, voidBranches: voids });
  });

  it.each(['甲丑', 'A子', '甲子额外', ''])('rejects combinations outside the sixty Jia Zi: %s', (ganZhi) => {
    expect(() => getXunInfo(ganZhi)).toThrow(new TypeError('干支不属于六十甲子'));
  });
});

describe('golden calendar fixtures', () => {
  it('contains all twelve unique 2026 jie boundaries in order', () => {
    expect(JIE_BOUNDARIES_2026.map(({ name }) => name)).toEqual([
      '小寒',
      '立春',
      '惊蛰',
      '清明',
      '立夏',
      '芒种',
      '小暑',
      '立秋',
      '白露',
      '寒露',
      '立冬',
      '大雪',
    ]);
    expect(new Set(JIE_BOUNDARIES_2026.map(({ atInstant }) => atInstant)).size).toBe(12);
    for (const { beforeInstant, atInstant } of JIE_BOUNDARIES_2026) {
      expect(Date.parse(atInstant) - Date.parse(beforeInstant)).toBe(1_000);
    }
  });

  it('contains sixty unique Jia Zi grouped into six complete xun', () => {
    expect(SIXTY_JIA_ZI_GOLDEN).toHaveLength(60);
    expect(new Set(SIXTY_JIA_ZI_GOLDEN.map(([ganZhi]) => ganZhi)).size).toBe(60);

    const countsByXun: Record<string, number> = {};
    for (const [, xun] of SIXTY_JIA_ZI_GOLDEN) {
      countsByXun[xun] = (countsByXun[xun] ?? 0) + 1;
    }
    expect(countsByXun).toEqual({
      甲子旬: 10,
      甲戌旬: 10,
      甲申旬: 10,
      甲午旬: 10,
      甲辰旬: 10,
      甲寅旬: 10,
    });
  });

  it('gives every golden Jia Zi two distinct void branches', () => {
    for (const [, , voidBranches] of SIXTY_JIA_ZI_GOLDEN) {
      expect(voidBranches).toHaveLength(2);
      expect(new Set(voidBranches).size).toBe(2);
    }
  });
});
