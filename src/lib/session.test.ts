import { describe, expect, it } from 'vitest';
import { confirmCurrentToss, createSession, prepareToss } from './session';
import { createToss } from './divination';

describe('起卦会话', () => {
  it('reuses an unconfirmed toss instead of rerolling', () => {
    const session = createSession('近期事业是否会出现新的发展机会？', 'career', new Date('2026-07-11T12:00:00+08:00'));
    const toss = createToss(['text', 'text', 'reverse']);
    const prepared = prepareToss(session, toss, 'seed-1');
    const preparedAgain = prepareToss(prepared, createToss(['reverse', 'reverse', 'reverse']), 'seed-2');
    expect(preparedAgain.currentToss).toEqual(prepared.currentToss);
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
    expect(session.tosses).toHaveLength(6);
    expect(session.plate?.movingLines).toEqual([1, 4]);
    const afterSeventh = confirmCurrentToss(prepareToss(session, createToss(['reverse', 'reverse', 'reverse']), 'seed-7'));
    expect(afterSeventh).toEqual(session);
  });
});
