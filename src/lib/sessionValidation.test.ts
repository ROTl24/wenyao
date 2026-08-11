import { describe, expect, it } from 'vitest';
import { createTossFromValue } from './divination';
import { generateRandomCasting } from './casting';
import {
  confirmCurrentToss,
  createCompletedSession,
  createSession,
  prepareToss,
  type DivinationSession,
  type PreparedCoinLine,
} from './session';
import {
  normalizeStoredSession,
  sanitizeRendererSession,
  storedCastingMethod,
  validateSessionForSave,
} from './sessionValidation';
import { deriveTimeCasting } from './timeCasting';

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
    castingBasis: { kind: 'physical', algorithm: 'three_coin_manual_v1' },
    lines: digital.lines.map((line) => ({
      ...line,
      coin: line.coin ? { faces: line.coin.faces } : undefined,
    })),
  };
}

describe('会话存储契约', () => {
  it('normalizes a missing legacy casting method', () => {
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

  it('drops legacy local reports without mutating the stored input', () => {
    const stored = {
      ...completedDigitalSession(),
      analysis: {
        mode: 'local',
        markdown: '旧本地基础推演',
        generatedAt: '2026-07-11T04:00:00.000Z',
      },
    };

    const normalized = normalizeStoredSession(stored);

    expect(normalized.analysis).toBeUndefined();
    expect(stored.analysis.mode).toBe('local');
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
      lines: completedDigitalSession().lines.map((line) => ({
        ...line,
        forgedLineField: true,
      })),
    };

    const sanitized = sanitizeRendererSession(input) as Record<string, unknown>;
    const lines = sanitized.lines as Array<Record<string, unknown>>;

    expect(sanitized).not.toHaveProperty('forgedTopLevel');
    expect(lines[0]).not.toHaveProperty('forgedLineField');
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

  it('accepts complete random and replayable time sessions but rejects forged time evidence', () => {
    const castAt = new Date('2026-08-03T15:00:00.000Z');
    const random = createCompletedSession(
      '随机起卦会话校验',
      'other',
      castAt,
      generateRandomCasting(castAt, () => createTossFromValue(7)),
    );
    const time = createCompletedSession(
      '时间起卦会话校验',
      'other',
      castAt,
      deriveTimeCasting(castAt),
    );

    expect(() => validateSessionForSave(random)).not.toThrow();
    expect(() => validateSessionForSave(time)).not.toThrow();

    const forgedBasis = structuredClone(time);
    if (forgedBasis.castingBasis.kind === 'time') forgedBasis.castingBasis.movingLine = 1;
    expect(() => validateSessionForSave(forgedBasis)).toThrow('时间起卦依据无法重放');

    const forgedCoin = structuredClone(time);
    forgedCoin.lines[0].coin = { faces: ['text', 'text', 'reverse'] };
    expect(() => validateSessionForSave(forgedCoin)).toThrow('六爻记录冲突');

    const forgedValue = structuredClone(time);
    forgedValue.lines[0].value = forgedValue.lines[0].value === 7 ? 8 : 7;
    expect(() => validateSessionForSave(forgedValue)).toThrow('时间起卦爻值与推导依据不一致');
  });

  it('rejects local reports at the persistence seam', () => {
    const session = {
      ...completedDigitalSession(),
      analysis: {
        mode: 'local',
        markdown: '不得保存的本地替代解读',
        generatedAt: '2026-07-11T04:00:00.000Z',
      },
    };

    expect(() => validateSessionForSave(session)).toThrow('仅允许保存云端 AI 解读');
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
      ['lines', (session) => { session.lines = null; }],
      ['messages', (session) => { session.messages = null; }],
    ];

    for (const [, corrupt] of corruptions) {
      const session = structuredClone(completedDigitalSession());
      corrupt(session as unknown as Record<string, unknown>);
      expect(() => validateSessionForSave(session)).toThrow('会话数据无效');
    }
  });

  it('requires stable line ids and exact recorded timestamps', () => {
    const emptyId = completedDigitalSession();
    emptyId.lines[0].id = ' ';
    expect(() => validateSessionForSave(emptyId)).toThrow('六爻记录冲突');

    const invalidRecordedAt = completedDigitalSession();
    invalidRecordedAt.lines[0].recordedAt = '2026-07-11';
    expect(() => validateSessionForSave(invalidRecordedAt)).toThrow('六爻记录冲突');

    const repeatedId = completedDigitalSession();
    repeatedId.lines[1].id = repeatedId.lines[0].id;
    expect(() => validateSessionForSave(repeatedId)).toThrow('六爻记录冲突');
  });

  it('rejects inconsistent derivation and repeated ids on the current toss', () => {
    let session = confirmCurrentToss(prepareToss(
      createSession('当前钱象状态测试', 'other', new Date('2026-07-11T04:00:00.000Z')),
      createTossFromValue(7),
      'seed-1',
    ));
    session = prepareToss(session, createTossFromValue(8), 'seed-2');

    const inconsistent = structuredClone(session);
    (inconsistent.currentLine as PreparedCoinLine).changedYang = true;
    expect(() => validateSessionForSave(inconsistent)).toThrow('当前投币状态冲突');

    const repeatedId = structuredClone(session);
    repeatedId.currentLine!.id = repeatedId.lines[0].id;
    expect(() => validateSessionForSave(repeatedId)).toThrow('当前投币状态冲突');
  });

  it('locks digital complete and casting state cardinality', () => {
    const incomplete = completedDigitalSession();
    incomplete.lines.pop();
    expect(() => validateSessionForSave(incomplete)).toThrow('在线起卦状态冲突');

    const completeWithCurrent = completedDigitalSession();
    completeWithCurrent.currentLine = {
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
