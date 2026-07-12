import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DivinationCaseV2 } from '../domain/liuyao/model';
import { browserSha256, createBrowserReadingAdapter } from './browserReadingAdapter';
import {
  createElectronReadingClient,
  type ReadingClient,
  type ReadingTransport,
} from './readingClient';
import type { DivinationSession, TossRecord } from './session';

const BUILT_AT = '2026-07-12T03:00:00.000Z';

function toss(value: 6 | 7 | 8 | 9, lineIndex: number): TossRecord {
  const faces = value === 6
    ? ['text', 'text', 'text'] as const
    : value === 7
      ? ['text', 'text', 'reverse'] as const
      : value === 8
        ? ['text', 'reverse', 'reverse'] as const
        : ['reverse', 'reverse', 'reverse'] as const;
  return {
    id: `toss-${lineIndex}`,
    lineIndex,
    visualSeed: `seed-${lineIndex}`,
    confirmedAt: `2026-07-12T00:00:0${lineIndex}.000Z`,
    faces: [...faces],
    value,
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 7 || value === 6,
  };
}

function completedSession(id = 'session-1'): DivinationSession {
  return {
    id,
    question: '事业是否顺利',
    category: 'career',
    castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:06.000Z',
    status: 'complete',
    tosses: [7, 7, 7, 7, 7, 7].map((value, index) => toss(value as 7, index + 1)),
    messages: [],
  };
}

function createBrowserHarness() {
  const sessions = new Map<string, DivinationSession>([['session-1', completedSession()]]);
  const adapter = createBrowserReadingAdapter({
    sessions: {
      async get(id) { return structuredClone(sessions.get(id) ?? null); },
      async save(session) {
        sessions.set(session.id, structuredClone(session));
        return structuredClone(session);
      },
    },
    corpus: [],
    now: () => new Date(BUILT_AT),
    createId: (() => {
      let value = 0;
      return () => `browser-message-${++value}`;
    })(),
  });
  return { adapter, sessions };
}

function fakeCase(): DivinationCaseV2 {
  return {
    schemaVersion: '2.0.0',
    sessionId: 'session-1',
    question: '事业是否顺利',
    category: 'career',
    ruleContext: {} as DivinationCaseV2['ruleContext'],
    ruleContextHash: 'rules',
    plate: {
      id: 'plate:session-1:v2', sessionId: 'session-1', baseHexagram: { name: '乾为天' },
    } as DivinationCaseV2['plate'],
    useGod: { status: 'needs-user-input', intent: null } as DivinationCaseV2['useGod'],
    facts: [],
    factSetHash: 'facts',
    builtAt: BUILT_AT,
  };
}

describe('ReadingClient adapters', () => {
  it('browser SHA-256 equals Node SHA-256 for the same UTF-8 canonical payload', () => {
    const payload = '{"emoji":"🪙","question":"事业会好吗？","值":7}';
    expect(browserSha256(payload)).toBe(createHash('sha256').update(payload).digest('hex'));
  });

  it('Electron adapter calls only desktop.reading with narrow payloads', async () => {
    const caseSnapshot = fakeCase();
    const transport: ReadingTransport = {
      buildCase: vi.fn(async () => ({ caseSnapshot, runtimeTrust: 'authoritative' as const })),
      selectIntent: vi.fn(async () => ({ caseSnapshot, runtimeTrust: 'authoritative' as const })),
      analyze: vi.fn(async () => ({
        caseSnapshot, runtimeTrust: 'authoritative' as const,
        report: { mode: 'local', summary: '报告' } as never,
        evidence: [], retrievalDiagnostics: null,
      })),
      followUp: vi.fn(async () => ({
        caseSnapshot, runtimeTrust: 'authoritative' as const,
        answer: { content: '回答', evidenceIds: [] }, messages: [],
      })),
    };
    const client = createElectronReadingClient(transport);
    await client.buildCase({
      sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office' },
      plate: { id: 'fake' }, facts: [{ id: 'fake' }],
    } as never);
    await client.selectIntent({
      sessionId: 'session-1', clarification: { subjectRelation: '父母' },
      expectedFactSetHash: 'facts', evidence: [{ id: 'fake' }],
    } as never);
    await client.analyze({ sessionId: 'session-1', expectedFactSetHash: 'facts', analysis: { fake: true } } as never);
    await client.followUp({ sessionId: 'session-1', question: '追问', expectedFactSetHash: 'facts', messages: ['fake'] } as never);

    expect(transport.buildCase).toHaveBeenCalledWith({
      sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office' },
    });
    expect(transport.selectIntent).toHaveBeenCalledWith({
      sessionId: 'session-1', clarification: { subjectRelation: '父母' }, expectedFactSetHash: 'facts',
    });
    expect(transport.analyze).toHaveBeenCalledWith({ sessionId: 'session-1', expectedFactSetHash: 'facts' });
    expect(transport.followUp).toHaveBeenCalledWith({ sessionId: 'session-1', question: '追问', expectedFactSetHash: 'facts' });
  });

  it('browser preview completes the same Case, analysis and follow-up contract with lowered trust', async () => {
    const { adapter, sessions } = createBrowserHarness();
    const built = await adapter.buildCase({ sessionId: 'session-1' });
    expect(built.runtimeTrust).toBe('browser-preview');
    expect(built.caseSnapshot.plate.id).toBe('plate:session-1:v2');
    expect(Object.hasOwn(built.caseSnapshot, 'runtimeTrust')).toBe(false);
    expect(sessions.get('session-1')?.caseRuntimeTrust).toBe('browser-preview');

    const selected = await adapter.selectIntent({
      sessionId: 'session-1',
      clarification: { explicitIntentId: 'career.rank-or-office' },
      expectedFactSetHash: built.caseSnapshot.factSetHash,
    });
    expect(selected.caseSnapshot.useGod.intent?.id).toBe('career.rank-or-office');
    await expect(adapter.selectIntent({
      sessionId: 'session-1',
      clarification: { explicitIntentId: 'career.contract-or-approval' },
      expectedFactSetHash: 'stale-hash',
    })).rejects.toThrow(/权威 Case 已变化/);

    const analyzed = await adapter.analyze({
      sessionId: 'session-1', expectedFactSetHash: selected.caseSnapshot.factSetHash,
    });
    expect(analyzed.runtimeTrust).toBe('browser-preview');
    expect(analyzed.report.summary).toContain('乾为天');
    expect(analyzed.report.generatedAt).toBe(BUILT_AT);

    const followed = await adapter.followUp({
      sessionId: 'session-1', question: '下一步呢？', expectedFactSetHash: selected.caseSnapshot.factSetHash,
    });
    expect(followed.runtimeTrust).toBe('browser-preview');
    expect(followed.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(sessions.get('session-1')?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('browser selectIntent clears old intent-only provenance when switching intents', async () => {
    const { adapter, sessions } = createBrowserHarness();
    sessions.set('session-1', {
      ...completedSession(),
      question: '替家中长辈看身体情况',
      category: 'health',
    });
    const initial = await adapter.buildCase({ sessionId: 'session-1' });
    const otherPerson = await adapter.selectIntent({
      sessionId: 'session-1',
      clarification: { explicitIntentId: 'health.other-person' },
      expectedFactSetHash: initial.caseSnapshot.factSetHash,
    });
    const withRelation = await adapter.selectIntent({
      sessionId: 'session-1',
      clarification: { subjectRelation: '父母' },
      expectedFactSetHash: otherPerson.caseSnapshot.factSetHash,
    });
    const self = await adapter.selectIntent({
      sessionId: 'session-1',
      clarification: { explicitIntentId: 'health.self' },
      expectedFactSetHash: withRelation.caseSnapshot.factSetHash,
    });

    expect(self.caseSnapshot.useGod.intent?.id).toBe('health.self');
    expect(self.caseSnapshot.useGod.intent?.subjectRelation).toBeUndefined();
  });

  it('browser session persistence preserves preview Case trust and service-owned messages from delayed renderer saves', async () => {
    localStorage.clear();
    vi.resetModules();
    const { desktop } = await import('./desktop');
    const original = completedSession('browser-storage-session');
    await desktop.sessions.save(original);
    const built = await desktop.reading.buildCase({ sessionId: original.id });
    await desktop.reading.followUp({
      sessionId: original.id,
      question: '浏览器追问',
      expectedFactSetHash: built.caseSnapshot.factSetHash,
    });
    await desktop.sessions.save({
      ...original,
      messages: [],
      caseSnapshot: undefined,
      caseRuntimeTrust: undefined,
    });

    const stored = await desktop.sessions.get(original.id);
    expect(stored?.caseSnapshot?.factSetHash).toBe(built.caseSnapshot.factSetHash);
    expect(stored?.caseRuntimeTrust).toBe('browser-preview');
    expect(stored?.messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('browser session persistence clears completed currentToss and tombstones deleted IDs', async () => {
    localStorage.clear();
    vi.resetModules();
    const { desktop } = await import('./desktop');
    const casting: DivinationSession = {
      ...completedSession('browser-tombstone-session'),
      status: 'casting',
      tosses: [],
      currentToss: {
        id: 'pending-1', lineIndex: 1, visualSeed: 'seed',
        faces: ['text', 'text', 'reverse'], value: 7, label: '少阳',
        moving: false, baseYang: true, changedYang: true,
      },
    };
    await desktop.sessions.save(casting);
    await desktop.sessions.save(completedSession(casting.id));
    expect((await desktop.sessions.get(casting.id))?.currentToss).toBeUndefined();

    await desktop.sessions.delete(casting.id);
    await expect(desktop.sessions.save(casting)).rejects.toThrow(/会话已删除/);
    expect(await desktop.sessions.get(casting.id)).toBeNull();
  });

  it('browser renderer persistence derives status and rejects forged toss records', async () => {
    localStorage.clear();
    vi.resetModules();
    const { desktop } = await import('./desktop');
    const first = toss(7, 1);
    const { confirmedAt: _confirmedAt, ...pending } = toss(8, 2);
    const partial: DivinationSession = {
      ...completedSession('browser-derived-status'),
      status: 'complete',
      tosses: [first],
      currentToss: pending,
    };
    const saved = await desktop.sessions.save(partial);
    expect(saved.status).toBe('casting');
    expect(saved.currentToss?.id).toBe(pending.id);

    const forged = completedSession('browser-forged-toss');
    forged.tosses[0] = { ...forged.tosses[0], faces: ['reverse', 'reverse', 'reverse'] };
    await expect(desktop.sessions.save(forged)).rejects.toThrow(/投币历史冲突/);

    const tooMany = completedSession('browser-too-many-tosses');
    tooMany.tosses = [...tooMany.tosses, toss(7, 7)];
    await expect(desktop.sessions.save(tooMany)).rejects.toThrow(/投币历史冲突/);
  });

  it('browser delete failure keeps the session visible and retryable', async () => {
    localStorage.clear();
    vi.resetModules();
    const { desktop } = await import('./desktop');
    const session = completedSession('browser-delete-failure');
    await desktop.sessions.save(session);
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => { throw new Error('simulated storage failure'); });

    await expect(desktop.sessions.delete(session.id)).rejects.toThrow(/simulated storage failure/);
    expect(await desktop.sessions.get(session.id)).not.toBeNull();
    await expect(desktop.sessions.save(session)).resolves.toMatchObject({ id: session.id });
    setItem.mockRestore();
  });

  it.each([
    ['electron', async (): Promise<ReadingClient> => {
      const caseSnapshot = fakeCase();
      return createElectronReadingClient({
        async buildCase() { return { caseSnapshot, runtimeTrust: 'authoritative' }; },
        async selectIntent() { return { caseSnapshot, runtimeTrust: 'authoritative' }; },
        async analyze() { return { caseSnapshot, runtimeTrust: 'authoritative', report: { summary: '报告' } as never, evidence: [], retrievalDiagnostics: null }; },
        async followUp() { return { caseSnapshot, runtimeTrust: 'authoritative', answer: { content: '回答', evidenceIds: [] }, messages: [] }; },
      });
    }],
    ['browser-preview', async (): Promise<ReadingClient> => createBrowserHarness().adapter],
  ])('%s adapter satisfies the narrow buildCase result envelope', async (_name, factory) => {
    const client = await factory();
    const result = await client.buildCase({ sessionId: 'session-1' });
    expect(result).toEqual(expect.objectContaining({
      caseSnapshot: expect.objectContaining({ sessionId: 'session-1' }),
      runtimeTrust: expect.stringMatching(/^(authoritative|browser-preview)$/),
    }));
  });
});
