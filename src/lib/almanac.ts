import { Solar, type Lunar } from 'lunar-javascript';
import { shanghaiDateTimeParts } from './shanghaiTime';

export const ALMANAC_MIN_YEAR = 1900;
export const ALMANAC_MAX_YEAR = 2100;

export type AlmanacHourId =
  | 'zi'
  | 'chou'
  | 'yin'
  | 'mao'
  | 'chen'
  | 'si'
  | 'wu'
  | 'wei'
  | 'shen'
  | 'you'
  | 'xu'
  | 'hai';

export interface AlmanacSelection {
  date: string;
  hourId: AlmanacHourId;
}

export interface AlmanacDateParts {
  year: number;
  month: number;
  day: number;
}

export interface AlmanacMonthDay extends AlmanacDateParts {
  date: string;
  inCurrentMonth: boolean;
  selectable: boolean;
  lunarLabel: string;
  solarTerm: string;
}

export interface AlmanacHour {
  id: AlmanacHourId;
  branch: string;
  label: string;
  rangeLabel: string;
  pillar: string;
}

export interface AlmanacDirection {
  label: '财神' | '喜神' | '福神' | '阳贵' | '阴贵';
  direction: string;
}

export interface AlmanacDetail {
  date: string;
  gregorianLabel: string;
  lunarLabel: string;
  pillars: Array<{ label: '年' | '月' | '日' | '时'; value: string }>;
  directions: AlmanacDirection[];
  dayGod: { name: string; type: string; luck: string };
  clash: string;
  mansion: { name: string; luck: string };
  construction: string;
  hours: AlmanacHour[];
  selectedHour: AlmanacHour;
}

interface HourDefinition {
  id: AlmanacHourId;
  branch: string;
  startHour: number;
  endHour: number;
  startDayOffset?: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HOUR_DEFINITIONS: HourDefinition[] = [
  { id: 'zi', branch: '子', startHour: 23, endHour: 0, startDayOffset: -1 },
  { id: 'chou', branch: '丑', startHour: 1, endHour: 2 },
  { id: 'yin', branch: '寅', startHour: 3, endHour: 4 },
  { id: 'mao', branch: '卯', startHour: 5, endHour: 6 },
  { id: 'chen', branch: '辰', startHour: 7, endHour: 8 },
  { id: 'si', branch: '巳', startHour: 9, endHour: 10 },
  { id: 'wu', branch: '午', startHour: 11, endHour: 12 },
  { id: 'wei', branch: '未', startHour: 13, endHour: 14 },
  { id: 'shen', branch: '申', startHour: 15, endHour: 16 },
  { id: 'you', branch: '酉', startHour: 17, endHour: 18 },
  { id: 'xu', branch: '戌', startHour: 19, endHour: 20 },
  { id: 'hai', branch: '亥', startHour: 21, endHour: 22 },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatAlmanacDate(parts: AlmanacDateParts) {
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function parseAlmanacDate(value: string): AlmanacDateParts {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new TypeError('日期格式必须为 YYYY-MM-DD');
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    instant.getUTCFullYear() !== parts.year
    || instant.getUTCMonth() + 1 !== parts.month
    || instant.getUTCDate() !== parts.day
  ) throw new TypeError('日期无效');
  return parts;
}

export function shiftAlmanacDate(parts: AlmanacDateParts, days: number): AlmanacDateParts {
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  };
}

function assertSupportedDate(parts: AlmanacDateParts) {
  if (parts.year < ALMANAC_MIN_YEAR || parts.year > ALMANAC_MAX_YEAR) {
    throw new RangeError(`仅支持 ${ALMANAC_MIN_YEAR}—${ALMANAC_MAX_YEAR} 年`);
  }
}

function selectedHourId(hour: number): AlmanacHourId {
  if (hour === 23 || hour === 0) return 'zi';
  return HOUR_DEFINITIONS[Math.floor((hour + 1) / 2)].id;
}

export function currentAlmanacSelection(now = new Date()): AlmanacSelection {
  const current = shanghaiDateTimeParts(now);
  const traditionalDate = current.hour === 23
    ? shiftAlmanacDate(current, 1)
    : current;
  assertSupportedDate(traditionalDate);
  return {
    date: formatAlmanacDate(traditionalDate),
    hourId: selectedHourId(current.hour),
  };
}

function monthCellLabel(lunar: Lunar) {
  return lunar.getDayInChinese() === '初一'
    ? `${lunar.getMonthInChinese()}月`
    : lunar.getDayInChinese();
}

export function buildAlmanacMonth(year: number, month: number): AlmanacMonthDay[] {
  if (!Number.isInteger(year) || year < ALMANAC_MIN_YEAR || year > ALMANAC_MAX_YEAR) {
    throw new RangeError(`年份必须在 ${ALMANAC_MIN_YEAR}—${ALMANAC_MAX_YEAR} 之间`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError('月份必须在 1—12 之间');
  }

  const firstWeekDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const mondayOffset = (firstWeekDay + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const instant = new Date(Date.UTC(year, month - 1, index - mondayOffset + 1));
    const parts = {
      year: instant.getUTCFullYear(),
      month: instant.getUTCMonth() + 1,
      day: instant.getUTCDate(),
    };
    const lunar = Solar.fromYmd(parts.year, parts.month, parts.day).getLunar();
    return {
      ...parts,
      date: formatAlmanacDate(parts),
      inCurrentMonth: parts.year === year && parts.month === month,
      selectable: parts.year >= ALMANAC_MIN_YEAR && parts.year <= ALMANAC_MAX_YEAR,
      lunarLabel: monthCellLabel(lunar),
      solarTerm: lunar.getJieQi(),
    };
  });
}

function compactDateLabel(parts: AlmanacDateParts, referenceYear: number) {
  return parts.year === referenceYear
    ? `${parts.month}月${parts.day}日`
    : `${parts.year}年${parts.month}月${parts.day}日`;
}

function hourAnchor(date: AlmanacDateParts, definition: HourDefinition) {
  const anchorDate = shiftAlmanacDate(date, definition.startDayOffset ?? 0);
  return {
    ...anchorDate,
    hour: definition.startHour,
  };
}

function buildHours(date: AlmanacDateParts): AlmanacHour[] {
  return HOUR_DEFINITIONS.map((definition) => {
    const startDate = shiftAlmanacDate(date, definition.startDayOffset ?? 0);
    const endDate = date;
    const anchor = hourAnchor(date, definition);
    const lunar = Solar.fromYmdHms(
      anchor.year,
      anchor.month,
      anchor.day,
      anchor.hour,
      30,
      0,
    ).getLunar();
    return {
      id: definition.id,
      branch: definition.branch,
      label: `${definition.branch}时`,
      rangeLabel: `${compactDateLabel(startDate, date.year)} ${pad(definition.startHour)}:00—${compactDateLabel(endDate, date.year)} ${pad(definition.endHour)}:59`,
      pillar: lunar.getTimeInGanZhi(),
    };
  });
}

function pillarLunar(date: AlmanacDateParts, hourId: AlmanacHourId) {
  const definition = HOUR_DEFINITIONS.find((candidate) => candidate.id === hourId);
  if (!definition) throw new TypeError('时辰无效');
  const anchor = hourAnchor(date, definition);
  return Solar.fromYmdHms(
    anchor.year,
    anchor.month,
    anchor.day,
    anchor.hour,
    30,
    0,
  ).getLunar();
}

export function buildAlmanacDetail(selection: AlmanacSelection): AlmanacDetail {
  const date = parseAlmanacDate(selection.date);
  assertSupportedDate(date);
  const dailyLunar = Solar.fromYmdHms(date.year, date.month, date.day, 12, 0, 0).getLunar();
  const pillars = pillarLunar(date, selection.hourId);
  const hours = buildHours(date);
  const selectedHour = hours.find((hour) => hour.id === selection.hourId);
  if (!selectedHour) throw new TypeError('时辰无效');

  return {
    date: selection.date,
    gregorianLabel: `${date.year}年${date.month}月${date.day}日`,
    lunarLabel: `农历${dailyLunar.getYearInGanZhi()}年${dailyLunar.getMonthInChinese()}月${dailyLunar.getDayInChinese()}`,
    pillars: [
      { label: '年', value: pillars.getYearInGanZhiExact() },
      { label: '月', value: pillars.getMonthInGanZhiExact() },
      { label: '日', value: pillars.getDayInGanZhiExact() },
      { label: '时', value: pillars.getTimeInGanZhi() },
    ],
    directions: [
      { label: '财神', direction: dailyLunar.getDayPositionCaiDesc() },
      { label: '喜神', direction: dailyLunar.getDayPositionXiDesc() },
      { label: '福神', direction: dailyLunar.getDayPositionFuDesc() },
      { label: '阳贵', direction: dailyLunar.getDayPositionYangGuiDesc() },
      { label: '阴贵', direction: dailyLunar.getDayPositionYinGuiDesc() },
    ],
    dayGod: {
      name: dailyLunar.getDayTianShen(),
      type: dailyLunar.getDayTianShenType(),
      luck: dailyLunar.getDayTianShenLuck(),
    },
    clash: `冲${dailyLunar.getDayChongDesc()} · 煞${dailyLunar.getDaySha()}`,
    mansion: {
      name: `${dailyLunar.getXiu()}${dailyLunar.getZheng()}${dailyLunar.getAnimal()}`,
      luck: dailyLunar.getXiuLuck(),
    },
    construction: `${dailyLunar.getZhiXing()}日`,
    hours,
    selectedHour,
  };
}
