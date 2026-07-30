import { describe, expect, it } from 'vitest';
import {
  formatShanghaiDateTimeInput,
  formatShanghaiDate,
  formatShanghaiDateTime,
  parseShanghaiDateTimeInput,
  shanghaiDateTimeError,
} from './shanghaiTime';

describe('北京时间输入', () => {
  it('uses Asia/Shanghai rules for current and historical daylight-saving instants', () => {
    expect(parseShanghaiDateTimeInput(
      '2026-07-11T12:34',
      new Date('2026-07-12T00:00:00.000Z'),
    )).toBe('2026-07-11T04:34:00.000Z');
    expect(parseShanghaiDateTimeInput(
      '1986-06-01T09:00',
      new Date('2026-07-12T00:00:00.000Z'),
    )).toBe('1986-06-01T00:00:00.000Z');
    expect(formatShanghaiDateTimeInput(new Date('2026-07-11T04:34:00.000Z')))
      .toBe('2026-07-11T12:34');
    expect(formatShanghaiDateTime(new Date('2026-07-11T04:34:56.000Z')))
      .toBe('2026/7/11 12:34:56');
    expect(formatShanghaiDate(new Date('2026-07-11T16:30:00.000Z')))
      .toBe('2026/7/12');
  });

  it('rejects a historical daylight-saving rollback time that maps to two instants', () => {
    const ambiguous = '1986-09-14T01:30';
    const now = new Date('2026-07-12T00:00:00.000Z');

    expect(() => parseShanghaiDateTimeInput(ambiguous, now))
      .toThrow('该北京时间处于夏令时回拨重复时段，无法唯一确定');
    expect(shanghaiDateTimeError(ambiguous, now))
      .toBe('该北京时间处于夏令时回拨重复时段，无法唯一确定');
  });

  it('rejects invalid and future wall times while allowing five minutes of clock skew', () => {
    const now = new Date('2026-07-11T04:00:00.000Z');
    expect(shanghaiDateTimeError('2026-02-30T12:00', now)).toBe('起卦时间无效');
    expect(shanghaiDateTimeError('2026-07-11T12:05', now)).toBe('');
    expect(shanghaiDateTimeError('2026-07-11T12:06', now)).toBe('起卦时间不能超过当前北京时间 5 分钟');
  });
});
