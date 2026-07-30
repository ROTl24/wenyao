const SHANGHAI_TIMEZONE = 'Asia/Shanghai';
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface ShanghaiDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHANGHAI_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const displayDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const displayDateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: SHANGHAI_TIMEZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export function shanghaiDateTimeParts(instant: Date): ShanghaiDateTimeParts & { second: number } {
  const parts = Object.fromEntries(
    formatter.formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function parseInput(value: string): ShanghaiDateTimeParts {
  const match = INPUT_PATTERN.exec(value);
  if (!match) throw new TypeError('请输入完整的北京时间');
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const check = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  ));
  if (
    check.getUTCFullYear() !== parts.year
    || check.getUTCMonth() !== parts.month - 1
    || check.getUTCDate() !== parts.day
    || check.getUTCHours() !== parts.hour
    || check.getUTCMinutes() !== parts.minute
  ) throw new TypeError('起卦时间无效');
  return parts;
}

function sameMinute(left: ShanghaiDateTimeParts, right: ShanghaiDateTimeParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute;
}

function wallEpoch(parts: ShanghaiDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

function timezoneOffsetAt(epochMilliseconds: number): number {
  const instant = new Date(epochMilliseconds);
  const local = shanghaiDateTimeParts(instant);
  return Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  ) - Math.floor(epochMilliseconds / 1000) * 1000;
}

export function formatShanghaiDateTimeInput(instant = new Date()): string {
  const parts = shanghaiDateTimeParts(instant);
  return [
    String(parts.year).padStart(4, '0'),
    '-',
    String(parts.month).padStart(2, '0'),
    '-',
    String(parts.day).padStart(2, '0'),
    'T',
    String(parts.hour).padStart(2, '0'),
    ':',
    String(parts.minute).padStart(2, '0'),
  ].join('');
}

export function formatShanghaiDateTime(instant: Date): string {
  return displayDateTimeFormatter.format(instant);
}

export function formatShanghaiDate(instant: Date): string {
  return displayDateFormatter.format(instant);
}

export function parseShanghaiDateTimeInput(value: string, now = new Date()): string {
  const requested = parseInput(value);
  const requestedWallEpoch = wallEpoch(requested);
  const probes = [
    requestedWallEpoch - 12 * 60 * 60 * 1000,
    requestedWallEpoch,
    requestedWallEpoch + 12 * 60 * 60 * 1000,
  ];
  const matches = [...new Set(probes.map((probe) => (
    requestedWallEpoch - timezoneOffsetAt(probe)
  )))]
    .map((epoch) => new Date(epoch))
    .filter((candidate) => sameMinute(shanghaiDateTimeParts(candidate), requested))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!matches.length) throw new TypeError('该北京时间不存在或无法解析');
  if (matches.length > 1) {
    throw new TypeError('该北京时间处于夏令时回拨重复时段，无法唯一确定');
  }
  const instant = matches[0];
  if (instant.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new RangeError('起卦时间不能超过当前北京时间 5 分钟');
  }
  return instant.toISOString();
}

export function shanghaiDateTimeError(value: string, now = new Date()): string {
  try {
    parseShanghaiDateTimeInput(value, now);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : '起卦时间无效';
  }
}

export const shanghaiTime = {
  timezone: SHANGHAI_TIMEZONE,
  futureToleranceMinutes: FUTURE_TOLERANCE_MS / 60_000,
};
