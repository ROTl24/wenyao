import { describe, expect, it } from 'vitest';
import { createTossFromValue } from './divination';
import {
  confirmCurrentToss,
  createSession,
  prepareToss,
  type DivinationSession,
  type PreparedToss,
} from './session';
import {
  normalizeStoredSession,
  sanitizeRendererSession,
  storedCastingMethod,
  validateSessionForSave,
} from './sessionValidation';

function completedDigitalSession(): DivinationSession {
  let session = createSession(
    '线下与在线会话契约是否一致',
    'other',
    new Date('2026-07-11T04:00:00.000Z'),
  );
  for (const [index, value] of ([6, 7, 8, 9, 7, 8] as const).entries()) {
    session = confirmCurrentToss(
      prepareToss(session, createTossFromValue(value), `digital-seed-${index}`),
    );
  }
  return session;
}

function completedPhysicalSession(): DivinationSession {
  const digital = completedDigitalSession();
  return {
    ...digital,
    id: 'physical-session',
    castingMethod: 'physical',
    tosses: digital.tosses.map(({ visualSeed: _visualSeed, ...toss }) => toss),
  };
}

describe('会话存储契约', () => {
  it('normalizes only a missing legacy casting method', () => {
    const {
      castingMethod: _castingMethod,
      ...legacy
    } = completedDigitalSession();
    const plate = legacy.plate;
    const messages = legacy.messages;

    const normalized = normalizeStoredSession(legacy);

    expect(normalized.castingMethod).toBe('digital');
    expect(normalized.plate).toEqual(plate);
    expect(normalized.messages).toEqual(messages);
    expect(normalized.plate).not.toBe(plate);
    expect(normalized.messages).not.toBe(messages);
    expect(Object.hasOwn(legacy, 'castingMethod')).toBe(false);
  });

  it('rejects explicitly invalid stored casting methods instead of migrating them', () => {
    const explicitInvalidValues = ['manual', undefined, null];

    for (const castingMethod of explicitInvalidValues) {
      const session = {
        ...completedDigitalSession(),
        castingMethod,
      };
      expect(() => normalizeStoredSession(session)).toThrow('起卦方式无效');
      expect(() => storedCastingMethod(session)).toThrow('起卦方式无效');
    }
  });

  it('canonicalizes sessions with the Electron IPC allowlist', () => {
    const input = {
      ...completedDigitalSession(),
      forgedTopLevel: true,
      tosses: completedDigitalSession().tosses.map((toss) => ({
        ...toss,
        forgedTossField: true,
      })),
    };

    const sanitized = sanitizeRendererSession(input) as Record<string, unknown>;
    const tosses = sanitized.tosses as Array<Record<string, unknown>>;

    expect(sanitized).not.toHaveProperty('forgedTopLevel');
    expect(tosses[0]).not.toHaveProperty('forgedTossField');
    expect(sanitized.plate).toEqual(input.plate);
    expect(sanitized.analysis).toEqual(input.analysis);
    expect(sanitized.messages).toEqual(input.messages);
    expect(sanitized.plate).not.toBe(input.plate);
    expect(sanitized.messages).not.toBe(input.messages);
  });

  it('accepts canonical digital and physical session shapes', () => {
    expect(() => validateSessionForSave(completedDigitalSession())).not.toThrow();
    expect(() => validateSessionForSave(completedPhysicalSession())).not.toThrow();
  });

  it('validates the complete top-level session contract', () => {
    const corruptions: Array<[string, (session: Record<string, unknown>) => void]> = [
      ['empty id', (session) => { session.id = ' '; }],
      ['untrimmed id', (session) => { session.id = ' session-id '; }],
      ['empty question', (session) => { session.question = ' '; }],
      ['category', (session) => { session.category = 'invalid'; }],
      ['castAt', (session) => { session.castAt = '2026-07-11'; }],
      ['updatedAt', (session) => { session.updatedAt = 'not-a-date'; }],
      ['status', (session) => { session.status = 'draft'; }],
      ['tosses', (session) => { session.tosses = null; }],
      ['messages', (session) => { session.messages = null; }],
    ];

    for (const [, corrupt] of corruptions) {
      const session = structuredClone(completedDigitalSession());
      corrupt(session as unknown as Record<string, unknown>);
      expect(() => validateSessionForSave(session)).toThrow('会话数据无效');
    }
  });

  it('requires stable toss ids and exact confirmed timestamps', () => {
    const emptyId = completedDigitalSession();
    emptyId.tosses[0].id = ' ';
    expect(() => validateSessionForSave(emptyId)).toThrow('投币历史冲突');

    const invalidConfirmedAt = completedDigitalSession();
    invalidConfirmedAt.tosses[0].confirmedAt = '2026-07-11';
    expect(() => validateSessionForSave(invalidConfirmedAt)).toThrow('投币历史冲突');

    const repeatedId = completedDigitalSession();
    repeatedId.tosses[1].id = repeatedId.tosses[0].id;
    expect(() => validateSessionForSave(repeatedId)).toThrow('投币历史冲突');
  });

  it('rejects confirmedAt and repeated ids on the current toss', () => {
    let session = confirmCurrentToss(prepareToss(
      createSession('当前钱象状态测试', 'other', new Date('2026-07-11T04:00:00.000Z')),
      createTossFromValue(7),
      'seed-1',
    ));
    session = prepareToss(session, createTossFromValue(8), 'seed-2');

    const withConfirmedAt = structuredClone(session);
    (withConfirmedAt.currentToss as PreparedToss & { confirmedAt?: string }).confirmedAt =
      '2026-07-11T04:01:00.000Z';
    expect(() => validateSessionForSave(withConfirmedAt)).toThrow('当前投币状态冲突');

    const repeatedId = structuredClone(session);
    repeatedId.currentToss!.id = repeatedId.tosses[0].id;
    expect(() => validateSessionForSave(repeatedId)).toThrow('当前投币状态冲突');
  });

  it('locks digital complete and casting state cardinality', () => {
    const incomplete = completedDigitalSession();
    incomplete.tosses.pop();
    expect(() => validateSessionForSave(incomplete)).toThrow('在线起卦状态冲突');

    const completeWithCurrent = completedDigitalSession();
    completeWithCurrent.currentToss = {
      ...createTossFromValue(7),
      id: 'seventh-toss',
      lineIndex: 7,
      visualSeed: 'seed-7',
    };
    expect(() => validateSessionForSave(completeWithCurrent)).toThrow('在线起卦状态冲突');

    const castingWithSix = completedDigitalSession();
    castingWithSix.status = 'casting';
    expect(() => validateSessionForSave(castingWithSix)).toThrow('在线起卦状态冲突');
  });
});
