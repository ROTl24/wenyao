import { Solar } from 'lunar-javascript';
import { shanghaiDateTimeParts, shanghaiTime } from './shanghaiTime';

export const TRADITIONAL_CALENDAR_RULE = 'zi_hour_23_next_day_v1' as const;
export const TRADITIONAL_CALENDAR_MIN_YEAR = 1900;
export const TRADITIONAL_CALENDAR_MAX_YEAR = 2100;

const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

export interface TraditionalCalendarContext {
  timezone: typeof shanghaiTime.timezone;
  rule: typeof TRADITIONAL_CALENDAR_RULE;
  traditionalDate: string;
  lunarYearGanZhi: string;
  lunarYearBranch: string;
  lunarMonth: number;
  leapMonth: boolean;
  lunarDay: number;
  lunarLabel: string;
  timeBranch: string;
  numbers: {
    year: number;
    month: number;
    day: number;
    hour: number;
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function shiftGregorianDate(
  parts: { year: number; month: number; day: number },
  days: number,
) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function hourBranchNumber(hour: number): number {
  if (hour === 23 || hour === 0) return 1;
  return Math.floor((hour + 1) / 2) + 1;
}

export function traditionalCalendarAt(instant: Date): TraditionalCalendarContext {
  if (!Number.isFinite(instant.getTime())) throw new TypeError('起卦时间无效');
  const shanghai = shanghaiDateTimeParts(instant);
  const traditionalDate = shanghai.hour === 23
    ? shiftGregorianDate(shanghai, 1)
    : shanghai;
  if (
    traditionalDate.year < TRADITIONAL_CALENDAR_MIN_YEAR
    || traditionalDate.year > TRADITIONAL_CALENDAR_MAX_YEAR
  ) {
    throw new RangeError(`时间起卦仅支持 ${TRADITIONAL_CALENDAR_MIN_YEAR}—${TRADITIONAL_CALENDAR_MAX_YEAR} 年`);
  }

  const lunar = Solar.fromYmd(
    traditionalDate.year,
    traditionalDate.month,
    traditionalDate.day,
  ).getLunar();
  const lunarMonthValue = lunar.getMonth();
  const lunarYearBranch = lunar.getYearZhi();
  const yearNumber = EARTHLY_BRANCHES.indexOf(lunarYearBranch as typeof EARTHLY_BRANCHES[number]) + 1;
  const hourNumber = hourBranchNumber(shanghai.hour);
  if (yearNumber <= 0) throw new Error('无法确定农历年支');

  return {
    timezone: shanghaiTime.timezone,
    rule: TRADITIONAL_CALENDAR_RULE,
    traditionalDate: `${traditionalDate.year}-${pad(traditionalDate.month)}-${pad(traditionalDate.day)}`,
    lunarYearGanZhi: lunar.getYearInGanZhi(),
    lunarYearBranch,
    lunarMonth: Math.abs(lunarMonthValue),
    leapMonth: lunarMonthValue < 0,
    lunarDay: lunar.getDay(),
    lunarLabel: `农历${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    timeBranch: EARTHLY_BRANCHES[hourNumber - 1],
    numbers: {
      year: yearNumber,
      month: Math.abs(lunarMonthValue),
      day: lunar.getDay(),
      hour: hourNumber,
    },
  };
}

export function formatTraditionalLunarDateLabel(instant: Date): string | null {
  try {
    return traditionalCalendarAt(instant).lunarLabel;
  } catch {
    return null;
  }
}
