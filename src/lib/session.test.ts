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
    const first = advanceCurrentToss(prepared, prepared.currentToss!.id);
    const repeated = advanceCurrentToss(first, prepared.currentToss!.id);
    expect(first.tosses).toHaveLength(1);
    expect(repeated).toBe(first);
  });

  it('过期 tossId 返回原会话对象', () => {
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const advanced = advanceCurrentToss(prepared, 'stale-toss-id');
    expect(advanced).toBe(prepared);
    expect(advanced.tosses).toHaveLength(0);
  });

  it('同时收到下一爻结果和视觉种子时一次完成确认与准备', () => {
    const prepared = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const nextToss = createToss(['text', 'reverse', 'reverse']);
    const advanced = advanceCurrentToss(prepared, prepared.currentToss!.id, nextToss, 'seed-b');
    expect(advanced.tosses).toHaveLength(1);
    expect(advanced.currentToss).toMatchObject({
      ...nextToss,
      lineIndex: 2,
      visualSeed: 'seed-b',
    });
  });

  it('缺少任一下一爻参数时原子推进不产生中间态', () => {
    const nextToss = createToss(['text', 'reverse', 'reverse']);
    const withoutSeed = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    const withoutToss = prepareToss(createSession('考试是否通过', 'study'), createToss(['text', 'text', 'reverse']), 'seed-a');
    expect(advanceCurrentToss(withoutSeed, withoutSeed.currentToss!.id, nextToss)).toBe(withoutSeed);
    expect(advanceCurrentToss(withoutToss, withoutToss.currentToss!.id, undefined, 'seed-b')).toBe(withoutToss);
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
      createToss(['reverse', 'reverse', 'reverse']),
      'seed-6',
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
