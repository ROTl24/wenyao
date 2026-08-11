import { describe, expect, it, vi } from 'vitest';
import { generateRandomCasting } from './casting';
import { createTossFromValue, randomToss } from './divination';

describe('随机起卦', () => {
  it('uses the cryptographic random source and maps each byte parity to a coin face', () => {
    const randomValues = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).set([0, 1, 3]);
      return array;
    });

    expect(randomToss()).toEqual(createTossFromValue(8));
    expect(randomValues).toHaveBeenCalledTimes(1);
  });

  it('creates all six lines in one batch with the same three-coin value mapping', () => {
    const values = [6, 7, 8, 9, 7, 8] as const;
    let index = 0;
    const castAt = new Date('2026-08-03T14:59:00.000Z');
    const casting = generateRandomCasting(
      castAt,
      () => createTossFromValue(values[index++]),
    );

    expect(casting.method).toBe('random');
    expect(casting.basis).toEqual({ kind: 'random', algorithm: 'three_coin_secure_batch_v1' });
    expect(casting.lines.map((line) => line.value)).toEqual(values);
    expect(casting.lines.map((line) => line.lineIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(casting.lines.every((line) => (
      line.recordedAt === castAt.toISOString()
      && line.coin?.faces.length === 3
      && !Object.hasOwn(line.coin, 'visualSeed')
    ))).toBe(true);
  });
});
