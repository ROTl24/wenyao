import { Solar, type Lunar } from 'lunar-javascript';
import { parseShanghaiDateTimeValue, shanghaiDateTimeParts } from './shanghaiTime';
import { formatTraditionalLunarDateLabel } from './traditionalCalendar';

interface GregorianDateParts {
  year: number;
  month: number;
  day: number;
}

const GREGORIAN_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseGregorianDate(value: string): GregorianDateParts | null {
  const match = GREGORIAN_DATE_PATTERN.exec(value);
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const verification = new Date(0);
  verification.setUTCHours(0, 0, 0, 0);
  verification.setUTCFullYear(parts.year, parts.month - 1, parts.day);

  return verification.getUTCFullYear() === parts.year
    && verification.getUTCMonth() + 1 === parts.month
    && verification.getUTCDate() === parts.day
    ? parts
    : null;
}

export function lunarFromShanghaiInstant(instant: Date): Lunar {
  const parts = shanghaiDateTimeParts(instant);
  return Solar.fromYmdHms(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ).getLunar();
}

export function formatLunarDateLabel(gregorianDate: string): string | null {
  const parts = parseGregorianDate(gregorianDate);
  if (!parts) return null;

  try {
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    return `农历${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  } catch {
    return null;
  }
}

export function formatTraditionalLunarDateTimeLabel(value: string): string | null {
  try {
    return formatTraditionalLunarDateLabel(new Date(parseShanghaiDateTimeValue(value)));
  } catch {
    return null;
  }
}
