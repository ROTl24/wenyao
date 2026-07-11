import { Solar } from 'lunar-javascript';
import type {
  Branch,
  CalendarPillar,
  CalendarSnapshot,
  Element,
  GanZhi,
  PillarKind,
  Stem,
  XunName,
} from './model.js';
import type { RuleContext } from './rules/model.js';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const STEM_ELEMENTS: Readonly<Record<Stem, Element>> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};

const BRANCH_ELEMENTS: Readonly<Record<Branch, Element>> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};

const ZONED_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SHANGHAI_OFFSET = '+08:00';

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface XunInfo {
  readonly xun: XunName;
  readonly voidBranches: readonly [Branch, Branch];
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

function parseInstant(castAt: string): Date {
  const match = ZONED_ISO_PATTERN.exec(castAt);
  if (!match) {
    throw new TypeError('castAt 必须是带时区的合法 ISO 时间');
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const [offsetHour, offsetMinute] = offsetText === 'Z'
    ? [0, 0]
    : offsetText.slice(1).split(':').map(Number);

  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) {
    throw new TypeError('castAt 必须是带时区的合法 ISO 时间');
  }

  const epochMilliseconds = Date.parse(castAt);
  if (!Number.isFinite(epochMilliseconds)) {
    throw new TypeError('castAt 必须是带时区的合法 ISO 时间');
  }

  return new Date(epochMilliseconds);
}

function toLocalParts(instant: Date, timezone: 'Asia/Shanghai'): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function formatLocalDateTime(parts: LocalDateTimeParts): string {
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`
    + `T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${SHANGHAI_OFFSET}`;
}

export function getXunInfo(ganZhi: string): XunInfo {
  if (ganZhi.length !== 2) {
    throw new TypeError('干支不属于六十甲子');
  }

  const stemIndex = STEMS.indexOf(ganZhi[0] as Stem);
  const branchIndex = BRANCHES.indexOf(ganZhi[1] as Branch);
  if (stemIndex < 0 || branchIndex < 0 || (branchIndex - stemIndex + 12) % 2 !== 0) {
    throw new TypeError('干支不属于六十甲子');
  }

  const jiaBranchIndex = (branchIndex - stemIndex + 12) % 12;
  const firstVoidIndex = (jiaBranchIndex + 10) % 12;
  return {
    xun: `甲${BRANCHES[jiaBranchIndex]}旬` as XunName,
    voidBranches: [BRANCHES[firstVoidIndex], BRANCHES[(firstVoidIndex + 1) % 12]],
  };
}

function buildPillar(kind: PillarKind, value: string): CalendarPillar {
  const xunInfo = getXunInfo(value);
  const stem = value[0] as Stem;
  const branch = value[1] as Branch;

  return {
    kind,
    ganZhi: value as GanZhi,
    stem: { value: stem, element: STEM_ELEMENTS[stem] },
    branch: { value: branch, element: BRANCH_ELEMENTS[branch] },
    ...xunInfo,
  };
}

export function buildCalendarSnapshot(
  castAt: string,
  profile: RuleContext['calendarProfile'],
): CalendarSnapshot {
  const instant = parseInstant(castAt);
  const local = toLocalParts(instant, profile.timezone);
  const lunar = Solar.fromYmdHms(
    local.year,
    local.month,
    local.day,
    local.hour,
    local.minute,
    local.second,
  ).getLunar();

  return {
    timezone: profile.timezone,
    localDateTime: formatLocalDateTime(local),
    pillars: {
      year: buildPillar('year', lunar.getYearInGanZhiExact()),
      month: buildPillar('month', lunar.getMonthInGanZhiExact()),
      day: buildPillar('day', lunar.getDayInGanZhiExact()),
      hour: buildPillar('hour', lunar.getTimeInGanZhi()),
    },
  };
}
