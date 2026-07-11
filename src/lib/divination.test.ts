import { describe, expect, it } from 'vitest';
import {
  buildPlate,
  createToss,
  getHexagram,
  type CoinFace,
  type LineValue,
} from './divination';

describe('乾隆铜钱约定', () => {
  it.each([
    [['text', 'text', 'text'], 6, '老阴'],
    [['text', 'text', 'reverse'], 7, '少阳'],
    [['text', 'reverse', 'reverse'], 8, '少阴'],
    [['reverse', 'reverse', 'reverse'], 9, '老阳'],
  ] as const)('maps %j to %s', (faces, value, label) => {
    expect(createToss(faces as readonly CoinFace[])).toMatchObject({ value, label });
  });
});

describe('六十四卦映射', () => {
  it('maps canonical line patterns from bottom to top', () => {
    expect(getHexagram([true, true, true, true, true, true]).name).toBe('乾为天');
    expect(getHexagram([false, false, false, false, false, false]).name).toBe('坤为地');
    expect(getHexagram([true, false, true, false, true, false]).name).toBe('水火既济');
    expect(getHexagram([false, true, false, true, false, true]).name).toBe('火水未济');
  });
});

describe('排盘不变量', () => {
  it('changes only moving lines and assigns 世应', () => {
    const values: LineValue[] = [6, 7, 8, 9, 7, 8];
    const plate = buildPlate(values, new Date('2026-07-11T12:00:00+08:00'));

    expect(plate.lines).toHaveLength(6);
    expect(plate.movingLines).toEqual([1, 4]);
    plate.lines.forEach((line) => {
      expect(line.baseYang !== line.changedYang).toBe(line.moving);
    });
    expect(plate.lines.filter((line) => line.role === '世')).toHaveLength(1);
    expect(plate.lines.filter((line) => line.role === '应')).toHaveLength(1);
  });
});
