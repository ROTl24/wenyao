import { describe, expect, it } from 'vitest';
import {
  confirmCurrentToss,
  createSession,
  normalizeSession,
  prepareToss,
  type DivinationSession,
} from './session';
import { createToss } from './divination';

describe('起卦会话', () => {
  it('creates online sessions by default and keeps the method fixed on the session', () => {
    expect(createSession('近期事业如何发展？', 'career').castingMethod).toBe('digital');
    const physical = createSession('实体铜钱起卦问题', 'other', new Date(), 'physical');
    expect(physical.castingMethod).toBe('physical');
    expect(prepareToss(physical, createToss(['text', 'text', 'reverse']), 'seed')).toBe(physical);
  });

  it('migrates only a missing casting method and rejects explicit invalid values', () => {
    const {
      castingMethod: _castingMethod,
      ...legacy
    } = createSession('旧会话', 'other');
    expect(normalizeSession(legacy as DivinationSession).castingMethod).toBe('digital');

    for (const castingMethod of ['manual', undefined, null]) {
      const invalid = {
        ...createSession('非法会话', 'other'),
        castingMethod,
      } as unknown as DivinationSession;
      expect(() => normalizeSession(invalid)).toThrow('起卦方式无效');
    }
  });

  it('reuses an unconfirmed toss instead of rerolling', () => {
    const session = createSession('近期事业是否会出现新的发展机会？', 'career', new Date('2026-07-11T12:00:00+08:00'));
    const toss = createToss(['text', 'text', 'reverse']);
    const prepared = prepareToss(session, toss, 'seed-1');
    const preparedAgain = prepareToss(prepared, createToss(['reverse', 'reverse', 'reverse']), 'seed-2');
    expect(preparedAgain.currentLine).toEqual(prepared.currentLine);
  });

  it('confirms exactly six lines then creates an immutable plate', () => {
    let session = createSession('近期事业是否会出现新的发展机会？', 'career', new Date('2026-07-11T12:00:00+08:00'));
    const values = [6, 7, 8, 9, 7, 8] as const;
    for (const [index, value] of values.entries()) {
      const faces = value === 6 ? ['text', 'text', 'text'] as const
        : value === 7 ? ['text', 'text', 'reverse'] as const
          : value === 8 ? ['text', 'reverse', 'reverse'] as const
            : ['reverse', 'reverse', 'reverse'] as const;
      session = confirmCurrentToss(prepareToss(session, createToss(faces), `seed-${index}`));
    }
    expect(session.status).toBe('complete');
    expect(session.lines).toHaveLength(6);
    expect(session.plate?.movingLines).toEqual([1, 4]);
    const afterSeventh = confirmCurrentToss(prepareToss(session, createToss(['reverse', 'reverse', 'reverse']), 'seed-7'));
    expect(afterSeventh).toEqual(session);
  });
});
