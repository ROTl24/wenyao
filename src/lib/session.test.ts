import { describe, expect, it } from 'vitest';
import { advanceCurrentToss, confirmCurrentToss, createSession, prepareToss } from './session';
import { createToss } from './divination';

describe('起卦会话', () => {
  it('reuses an unconfirmed toss instead of rerolling', () => {
    const session = createSession('近期事业是否会出现新的发展机会？', 'career', new Date('2026-07-11T12:00:00+08:00'));
    const toss = createToss(['text', 'text', 'reverse']);
    const prepared = prepareToss(session, toss, 'seed-1');
    const preparedAgain = prepareToss(prepared, createToss(['reverse', 'reverse', 'reverse']), 'seed-2');
    expect(preparedAgain.currentToss).toEqual(prepared.currentToss);
  });

  it('同一 tossId 只能确认一次', () => {
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const transaction = { at: '2026-07-12T00:00:01.000Z' };
    const first = advanceCurrentToss(prepared, prepared.currentToss!.id, transaction);
    const repeated = advanceCurrentToss(first, prepared.currentToss!.id, transaction);
    expect(first.tosses).toHaveLength(1);
    expect(repeated).toBe(first);
  });

  it('过期 tossId 返回原会话对象', () => {
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const advanced = advanceCurrentToss(prepared, 'stale-toss-id', { at: '2026-07-12T00:00:01.000Z' });
    expect(advanced).toBe(prepared);
    expect(advanced.tosses).toHaveLength(0);
  });

  it('同时收到下一爻结果和视觉种子时一次完成确认与准备', () => {
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const nextToss = createToss(['text', 'reverse', 'reverse']);
    const advanced = advanceCurrentToss(prepared, prepared.currentToss!.id, {
      at: '2026-07-12T00:00:01.000Z',
      next: { toss: nextToss, visualSeed: 'seed-b', id: 'next-toss-id' },
    });
    expect(advanced.tosses).toHaveLength(1);
    expect(advanced.currentToss).toMatchObject({
      ...nextToss,
      id: 'next-toss-id',
      lineIndex: 2,
      visualSeed: 'seed-b',
    });
  });

  it('相同会话与 transaction 重放得到完全一致的身份和确认时间', () => {
    const nextToss = createToss(['text', 'reverse', 'reverse']);
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const transaction = {
      at: '2026-07-12T00:00:01.000Z',
      next: { toss: nextToss, visualSeed: 'seed-b', id: 'deterministic-next' },
    };
    const first = advanceCurrentToss(prepared, prepared.currentToss!.id, transaction);
    const replay = advanceCurrentToss(prepared, prepared.currentToss!.id, transaction);
    expect(replay).toEqual(first);
    expect(first.tosses[0].confirmedAt).toBe(transaction.at);
    expect(first.currentToss?.id).toBe('deterministic-next');
    expect(first.updatedAt).toBe(transaction.at);
  });

  it('第六爻确认成卦后忽略下一爻参数', () => {
    let session = createSession('考试是否通过', 'study');
    for (let index = 0; index < 5; index += 1) {
      session = confirmCurrentToss(prepareToss(session, createToss(['text', 'text', 'reverse']), `seed-${index}`));
    }
    const prepared = prepareToss(session, createToss(['text', 'reverse', 'reverse']), 'seed-5');
    const completed = advanceCurrentToss(
      prepared,
      prepared.currentToss!.id,
      {
        at: '2026-07-12T00:00:06.000Z',
        next: {
          toss: createToss(['reverse', 'reverse', 'reverse']),
          visualSeed: 'seed-6',
          id: 'must-be-ignored',
        },
      },
    );
    expect(completed.status).toBe('complete');
    expect(completed.tosses).toHaveLength(6);
    expect(completed.currentToss).toBeUndefined();
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
