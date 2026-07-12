import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDivinationCase } from './domain/liuyao/case';
import { DEFAULT_RULE_CONTEXT } from './domain/liuyao/rules/default-context';
import { browserSha256 } from './lib/browserReadingAdapter';
import { legacyPlateFromCase } from './lib/casePresentation';
import { createToss } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import type { AnalyzeReadingResult, FollowUpReadingResult, ReadingCaseEnvelope } from './lib/readingClient';
import {
  confirmCurrentToss,
  createSession,
  prepareToss,
  type DivinationSession,
} from './lib/session';

const harness = vi.hoisted(() => ({
  currentSession: null as DivinationSession | null,
  resultSession: null as DivinationSession | null,
  openSession: null as DivinationSession | null,
  historySessions: [] as DivinationSession[],
  onConfirm: null as ((expectedTossId: string) => void) | null,
  onFollowUp: null as ((question: string) => void) | null,
  list: vi.fn(async () => [] as DivinationSession[]),
  get: vi.fn(async () => null as DivinationSession | null),
  save: vi.fn(async (session: DivinationSession) => session),
  delete: vi.fn(async () => true),
  buildCase: vi.fn(),
  selectIntent: vi.fn(),
  analyze: vi.fn(),
  followUp: vi.fn(),
}));

vi.mock('./lib/desktop', () => ({
  desktop: {
    sessions: {
      list: harness.list,
      get: harness.get,
      save: harness.save,
      delete: harness.delete,
    },
    settings: {},
    corpus: {},
    reading: {
      buildCase: harness.buildCase,
      selectIntent: harness.selectIntent,
      analyze: harness.analyze,
      followUp: harness.followUp,
    },
    platform: 'desktop',
  },
}));

vi.mock('./components/RitualScreen', () => ({
  RitualScreen: ({
    session,
    onConfirm,
  }: {
    session: DivinationSession;
    onConfirm(expectedTossId: string): void;
  }) => {
    harness.currentSession = session;
    harness.onConfirm = onConfirm;
    return <h1>{`第${session.currentToss?.lineIndex ?? 0}爻`}</h1>;
  },
}));

vi.mock('./components/ResultScreen', () => ({
  ResultScreen: ({
    session,
    onBack,
    onFollowUp,
  }: {
    session: DivinationSession;
    onBack(): void;
    onFollowUp(question: string): void;
  }) => {
    harness.resultSession = session;
    harness.onFollowUp = onFollowUp;
    return (
      <div>
        <h1>{`成卦-${session.tosses.length}`}</h1>
        <button onClick={onBack} type="button">返回首页测试</button>
      </div>
    );
  },
}));

vi.mock('./components/HistoryPanel', () => ({
  HistoryPanel: ({
    sessions,
    onDelete,
    onOpen,
  }: {
    sessions: DivinationSession[];
    onDelete(id: string): void;
    onOpen(session: DivinationSession): void;
  }) => {
    harness.historySessions = sessions;
    return <div>
      <h2>{`history-${sessions.length}`}</h2>
      <button
        onClick={() => harness.currentSession && onDelete(harness.currentSession.id)}
        type="button"
      >
        删除当前测试会话
      </button>
      <button
        onClick={() => harness.openSession && onOpen(harness.openSession)}
        type="button"
      >
        打开指定测试会话
      </button>
    </div>;
  },
}));

import { App, appFlowReducer, mergeSavedSession } from './App';

function readingEnvelope(
  session: DivinationSession,
  runtimeTrust: ReadingCaseEnvelope['runtimeTrust'] = 'authoritative',
): ReadingCaseEnvelope {
  const builtAt = new Date(Math.max(
    Date.parse(session.updatedAt) + 1,
    Date.parse(session.castAt) + 1,
  )).toISOString();
  const caseSnapshot = buildDivinationCase({
    sessionId: session.id,
    plateId: `plate:${session.id}:v2`,
    question: session.question,
    category: session.category,
    explicitIntentId: null,
    castAt: session.castAt,
    builtAt,
    tossValues: session.tosses.map((toss) => toss.value) as never,
    ruleContext: DEFAULT_RULE_CONTEXT,
  }, { sha256: browserSha256 });
  return { caseSnapshot, runtimeTrust };
}

function analysisResult(session: DivinationSession): AnalyzeReadingResult {
  const caseSnapshot = session.caseSnapshot!;
  const presented = { ...session, plate: legacyPlateFromCase(caseSnapshot) };
  return {
    caseSnapshot,
    runtimeTrust: session.caseRuntimeTrust ?? 'authoritative',
    report: createBrowserLocalReport(presented, []),
    evidence: [],
    retrievalDiagnostics: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

async function startCasting() {
  fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '会变好吗' } });
  fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
  fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
  await screen.findByRole('heading', { name: '第1爻' });
  await waitFor(() => expect(harness.save).toHaveBeenCalled());
  harness.save.mockClear();
}

function completeFixture(question = '完整测试会话'): DivinationSession {
  let session = createSession(question, 'career', new Date('2026-07-12T00:00:00.000Z'));
  for (let index = 0; index < 6; index += 1) {
    session = confirmCurrentToss(
      prepareToss(session, createToss(['text', 'text', 'reverse']), `fixture-${index}`),
      `2026-07-12T00:00:0${index + 1}.000Z`,
    );
  }
  return session;
}

beforeEach(() => {
  vi.clearAllMocks();
  harness.list.mockReset().mockResolvedValue([]);
  harness.get.mockReset().mockResolvedValue(null);
  harness.save.mockReset().mockImplementation(async (session) => session);
  harness.delete.mockReset().mockResolvedValue(true);
  harness.buildCase.mockReset().mockImplementation(async ({ sessionId }: { sessionId: string }) => {
    const completed = harness.save.mock.calls.map(([saved]) => saved as DivinationSession)
      .reverse()
      .find((saved) => saved.id === sessionId && saved.status === 'complete');
    if (!completed) throw new Error('missing completed fixture session');
    return readingEnvelope(completed);
  });
  harness.selectIntent.mockReset();
  harness.analyze.mockReset().mockImplementation(async () => analysisResult(harness.resultSession!));
  harness.followUp.mockReset().mockImplementation(async ({ question }: { question: string }) => {
    const session = harness.resultSession!;
    const createdAt = new Date().toISOString();
    return {
      caseSnapshot: session.caseSnapshot!,
      runtimeTrust: session.caseRuntimeTrust ?? 'authoritative',
      answer: { content: '默认追问', evidenceIds: [] },
      messages: [
        { id: 'user-message', role: 'user', content: question, createdAt },
        { id: 'assistant-message', role: 'assistant', content: '默认追问', evidenceIds: [], createdAt },
      ],
    };
  });
  harness.currentSession = null;
  harness.resultSession = null;
  harness.openSession = null;
  harness.historySessions = [];
  harness.onConfirm = null;
  harness.onFollowUp = null;
});

describe('App 原子确认命令', () => {
  it('相同 state/action 的 reducer 重放得到完全相同的下一爻身份与时间', () => {
    const session = prepareToss(
      createSession('纯 reducer', 'other', new Date('2026-07-12T00:00:00.000Z')),
      createToss(['text', 'reverse', 'text']),
      'seed-current',
    );
    const state = {
      screen: 'casting' as const,
      session,
      pendingConfirmCommit: null,
      caseBuildOperationId: null,
      analysisOperationId: null,
      followUpOperationId: null,
      epoch: 1,
    };
    const action = {
      type: 'ADVANCE_TOSS' as const,
      commandId: 'pure-command-id',
      expectedTossId: session.currentToss!.id,
      transaction: {
        at: '2026-07-12T00:00:01.000Z',
        plateId: 'unused-plate-id',
        next: {
          toss: createToss(['reverse', 'text', 'reverse']),
          visualSeed: 'seed-next',
          id: 'next-toss-id',
        },
      },
    };

    expect(appFlowReducer(state, action)).toEqual(appFlowReducer(state, action));
  });

  it('OPEN_SESSION 增加所有权 epoch，但保留待持久化确认命令', () => {
    const oldSession = prepareToss(createSession('旧会话', 'other'), createToss(['text', 'reverse', 'text']), 'old');
    const nextSession = prepareToss(createSession('新会话', 'other'), createToss(['reverse', 'text', 'reverse']), 'new');
    const pending = {
      id: oldSession.currentToss!.id,
      session: oldSession,
      owner: { sessionId: oldSession.id, epoch: 7 },
    };
    const state = {
      screen: 'casting' as const,
      session: oldSession,
      pendingConfirmCommit: pending,
      caseBuildOperationId: null,
      analysisOperationId: null,
      followUpOperationId: null,
      epoch: 7,
    };

    const opened = appFlowReducer(state, {
      type: 'OPEN_SESSION',
      screen: 'casting',
      session: nextSession,
    });
    expect(opened.epoch).toBe(8);
    expect(opened.pendingConfirmCommit).toBe(pending);
  });

  it('全局历史可接收其他会话的迟到保存，但不会被旧版本倒灌', () => {
    const base = createSession('全局历史', 'other', new Date('2026-07-12T00:00:00.000Z'));
    const current = { ...base, updatedAt: '2026-07-12T00:00:02.000Z' };
    const stale = { ...base, updatedAt: '2026-07-12T00:00:01.000Z' };
    const other = createSession('另一个会话', 'other', new Date('2026-07-12T00:00:03.000Z'));

    expect(mergeSavedSession([current], stale)).toEqual([current]);
    expect(mergeSavedSession([current], other)).toEqual([other, current]);
  });

  it('Case-bearing snapshot 总是胜过同会话的 legacy-only 快照', () => {
    const completed = completeFixture('Case 历史合并');
    const envelope = readingEnvelope(completed);
    const authoritative = {
      ...completed,
      updatedAt: '2026-07-12T00:00:06.000Z',
      caseSnapshot: envelope.caseSnapshot,
      caseRuntimeTrust: envelope.runtimeTrust,
      plate: legacyPlateFromCase(envelope.caseSnapshot),
    };
    const legacyOnly = {
      ...completed,
      updatedAt: '2026-07-12T00:00:07.000Z',
      caseSnapshot: undefined,
    };
    expect(mergeSavedSession([legacyOnly], authoritative)[0].caseSnapshot).toBeDefined();
    expect(mergeSavedSession([authoritative], legacyOnly)[0].caseSnapshot).toBeDefined();
  });

  it('needs-review 历史会话进入明确安全页而不回退 legacy 结果', async () => {
    const review = {
      ...completeFixture('待人工复核'),
      migrationState: 'needs-review' as const,
      caseSnapshot: undefined,
      caseRuntimeTrust: undefined,
    };
    harness.openSession = review;
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开指定测试会话' }));

    expect(await screen.findByRole('heading', { name: '此历史记录需要人工复核' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: '成卦-6' })).not.toBeInTheDocument();
    expect(harness.analyze).not.toHaveBeenCalled();
  });

  it('极残缺 needs-review 记录先安全归一化再进入复核页', async () => {
    harness.list.mockResolvedValue([
      { id: 'incomplete-record', migrationState: 'needs-review' } as never,
      { legacyValue: 123, migrationState: 'needs-review' } as never,
    ]);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    await screen.findByRole('heading', { name: 'history-2' });
    expect(harness.historySessions.every((entry) => (
      typeof entry.id === 'string'
      && typeof entry.question === 'string'
      && Array.isArray(entry.tosses)
    ))).toBe(true);

    harness.openSession = harness.historySessions.find((entry) => entry.id === 'incomplete-record')!;
    fireEvent.click(screen.getByRole('button', { name: '打开指定测试会话' }));
    expect(await screen.findByRole('heading', { name: '此历史记录需要人工复核' })).toBeVisible();
  });

  it('重开已有 analysis 的历史会话会重取证据上下文', async () => {
    const completed = completeFixture('已分析历史');
    const envelope = readingEnvelope(completed);
    const withCase = {
      ...completed,
      ...envelope,
      caseSnapshot: envelope.caseSnapshot,
      caseRuntimeTrust: envelope.runtimeTrust,
      plate: legacyPlateFromCase(envelope.caseSnapshot),
    } as DivinationSession;
    const result = analysisResult(withCase);
    harness.openSession = { ...withCase, analysis: result.report };
    harness.analyze.mockResolvedValue(result);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开指定测试会话' }));

    expect(await screen.findByRole('heading', { name: '成卦-6' })).toBeVisible();
    await waitFor(() => expect(harness.analyze).toHaveBeenCalledWith({
      sessionId: completed.id,
      expectedFactSetHash: envelope.caseSnapshot.factSetHash,
    }));
  });

  it('普通 complete 历史若因中断缺少 Case 会自动恢复构建', async () => {
    const base = completeFixture('中断恢复会话');
    const staleEnvelope = readingEnvelope(base);
    const stalePresented = {
      ...base,
      caseSnapshot: staleEnvelope.caseSnapshot,
      caseRuntimeTrust: staleEnvelope.runtimeTrust,
      plate: legacyPlateFromCase(staleEnvelope.caseSnapshot),
    };
    const recovered = { ...base, analysis: analysisResult(stalePresented).report };
    const delayedCase = deferred<ReadingCaseEnvelope>();
    const delayedAnalysis = deferred<AnalyzeReadingResult>();
    harness.openSession = recovered;
    harness.buildCase.mockReturnValue(delayedCase.promise);
    harness.analyze.mockReturnValue(delayedAnalysis.promise);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开指定测试会话' }));

    expect(await screen.findByRole('heading', { name: '正在建立权威卦例' })).toBeVisible();
    await act(async () => {
      delayedCase.resolve(readingEnvelope(recovered));
      await delayedCase.promise;
    });
    expect(await screen.findByRole('heading', { name: '成卦-6' })).toBeVisible();
    expect(harness.resultSession?.analysis).toBeUndefined();
    const freshAnalysis = analysisResult(harness.resultSession!);
    await act(async () => {
      delayedAnalysis.resolve(freshAnalysis);
      await delayedAnalysis.promise;
    });
    expect(harness.buildCase).toHaveBeenCalledTimes(1);
  });

  it('同一旧 callback 在同一 tick 直接调用两次只推进和保存一次', async () => {
    render(<App />);
    await startCasting();
    const tossId = harness.currentSession!.currentToss!.id;
    const staleCallback = harness.onConfirm!;

    act(() => {
      staleCallback(tossId);
      staleCallback(tossId);
    });

    await screen.findByRole('heading', { name: '第2爻' });
    await waitFor(() => expect(harness.save).toHaveBeenCalledTimes(1));
    expect(harness.save.mock.calls[0][0].tosses).toHaveLength(1);
    expect(harness.save.mock.calls[0][0].currentToss?.lineIndex).toBe(2);
  });

  it('StrictMode 也只执行一次确认持久化命令', async () => {
    render(<StrictMode><App /></StrictMode>);
    await startCasting();
    const tossId = harness.currentSession!.currentToss!.id;

    act(() => harness.onConfirm?.(tossId));

    await screen.findByRole('heading', { name: '第2爻' });
    await waitFor(() => expect(harness.save).toHaveBeenCalledTimes(1));
  });

  it('第六爻先停留在显式 building-case 状态，Case 返回后才进入结果页', async () => {
    const delayedCase = deferred<ReadingCaseEnvelope>();
    harness.buildCase.mockReturnValue(delayedCase.promise);
    render(<StrictMode><App /></StrictMode>);
    await startCasting();

    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      act(() => harness.onConfirm?.(harness.currentSession!.currentToss!.id));
      if (lineIndex < 6) await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
    }

    expect(await screen.findByRole('heading', { name: '正在建立权威卦例' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: '成卦-6' })).not.toBeInTheDocument();
    await waitFor(() => expect(harness.buildCase).toHaveBeenCalledTimes(1));
    const completed = harness.save.mock.calls.map(([saved]) => saved as DivinationSession)
      .reverse()
      .find((saved) => saved.status === 'complete')!;
    await act(async () => {
      delayedCase.resolve(readingEnvelope(completed));
      await delayedCase.promise;
    });
    expect(await screen.findByRole('heading', { name: '成卦-6' })).toBeVisible();
  });

  it('旧会话 Case 迟到后不能覆盖已经开始的新会话', async () => {
    const delayedCase = deferred<ReadingCaseEnvelope>();
    harness.buildCase.mockReturnValue(delayedCase.promise);
    render(<App />);
    await startCasting();
    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      act(() => harness.onConfirm?.(harness.currentSession!.currentToss!.id));
      if (lineIndex < 6) await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
    }
    await screen.findByRole('heading', { name: '正在建立权威卦例' });
    await waitFor(() => expect(harness.buildCase).toHaveBeenCalledTimes(1));
    const oldCompleted = harness.save.mock.calls.map(([saved]) => saved as DivinationSession)
      .reverse()
      .find((saved) => saved.status === 'complete')!;

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除当前测试会话' }));
    await screen.findByRole('button', { name: '开始起卦' });
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '全新的会话' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    await screen.findByRole('heading', { name: '第1爻' });
    const newSessionId = harness.currentSession!.id;

    await act(async () => {
      delayedCase.resolve(readingEnvelope(oldCompleted));
      await delayedCase.promise;
    });
    expect(harness.currentSession?.id).toBe(newSessionId);
    expect(harness.currentSession?.caseSnapshot).toBeUndefined();
    expect(screen.getByRole('heading', { name: '第1爻' })).toBeVisible();
  });

  it('最终保存期间切换会话仍为旧会话完成 Case 构建', async () => {
    const finalSave = deferred<DivinationSession>();
    harness.save.mockImplementation(async (saved: DivinationSession) => (
      saved.status === 'complete' ? finalSave.promise : saved
    ));
    render(<App />);
    await startCasting();
    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      act(() => harness.onConfirm?.(harness.currentSession!.currentToss!.id));
      if (lineIndex < 6) await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
    }
    await screen.findByRole('heading', { name: '正在建立权威卦例' });
    const completed = harness.save.mock.calls.map(([saved]) => saved as DivinationSession)
      .find((saved) => saved.status === 'complete')!;

    harness.openSession = prepareToss(
      createSession('新打开的会话', 'other'),
      createToss(['text', 'text', 'reverse']),
      'new-owner',
    );
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开指定测试会话' }));
    await screen.findByRole('heading', { name: '第1爻' });

    await act(async () => {
      finalSave.resolve(completed);
      await finalSave.promise;
    });
    await waitFor(() => expect(harness.buildCase).toHaveBeenCalledWith({ sessionId: completed.id }));
    expect(screen.getByRole('heading', { name: '第1爻' })).toBeVisible();
  });

  it('最终交互保存失败时不构建 Case，并允许显式重试后完成', async () => {
    let failedFinalSave = false;
    harness.save.mockImplementation(async (session: DivinationSession) => {
      if (session.status === 'complete' && !failedFinalSave) {
        failedFinalSave = true;
        throw new Error('simulated final save failure');
      }
      return session;
    });
    render(<App />);
    await startCasting();
    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      act(() => harness.onConfirm?.(harness.currentSession!.currentToss!.id));
      if (lineIndex < 6) await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
    }

    expect(await screen.findByText(/simulated final save failure/)).toBeVisible();
    expect(harness.buildCase).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试建立卦例' }));
    expect(await screen.findByRole('heading', { name: '成卦-6' })).toBeVisible();
    expect(harness.buildCase).toHaveBeenCalledTimes(1);
  });

  it('第六爻只构建一次 Case，完成后进入结果页且 StrictMode 只分析一次', async () => {
    render(<StrictMode><App /></StrictMode>);
    await startCasting();

    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      const tossId = harness.currentSession!.currentToss!.id;
      act(() => harness.onConfirm?.(tossId));
      if (lineIndex < 6) {
        await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
      }
    }

    expect(await screen.findByRole('heading', { name: '成卦-6' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: '第0爻' })).not.toBeInTheDocument();
    await waitFor(() => expect(harness.analyze).toHaveBeenCalledTimes(1));
    expect(harness.buildCase).toHaveBeenCalledTimes(1);
    expect(harness.buildCase).toHaveBeenCalledWith({ sessionId: harness.resultSession!.id });
    const completed = harness.save.mock.calls.map(([saved]) => saved)
      .filter((saved) => saved.status === 'complete');
    expect(completed).toHaveLength(1);
    expect(completed[0].currentToss).toBeUndefined();
  });

  it('旧会话分析迟到后不能覆盖已经开始的新会话', async () => {
    const delayedAnalysis = deferred<AnalyzeReadingResult>();
    harness.analyze.mockReturnValue(delayedAnalysis.promise);
    render(<App />);
    await startCasting();

    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      const tossId = harness.currentSession!.currentToss!.id;
      act(() => harness.onConfirm?.(tossId));
      if (lineIndex < 6) {
        await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
      }
    }
    await screen.findByRole('heading', { name: '成卦-6' });
    await waitFor(() => expect(harness.analyze).toHaveBeenCalledTimes(1));
    const completed = harness.resultSession!;

    fireEvent.click(screen.getByRole('button', { name: '返回首页测试' }));
    await screen.findByRole('button', { name: '开始起卦' });
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '新的问题' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    await screen.findByRole('heading', { name: '第1爻' });
    const newSessionId = harness.currentSession!.id;

    await act(async () => {
      delayedAnalysis.resolve(analysisResult(completed));
      await delayedAnalysis.promise;
    });

    await waitFor(() => expect(harness.currentSession?.id).toBe(newSessionId));
    expect(harness.currentSession?.analysis).toBeUndefined();
    expect(screen.getByRole('heading', { name: '第1爻' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    await screen.findByRole('heading', { name: /^history-/ });
    expect(harness.historySessions.find((entry) => entry.id === completed.id)?.analysis).toBeDefined();
  });

  it('会话删除后迟到的 save 不会把历史或持久化记录复活', async () => {
    const delayedSave = deferred<DivinationSession>();
    harness.save.mockImplementationOnce(() => delayedSave.promise);
    render(<App />);
    await startCasting();
    const deleted = harness.currentSession!;

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    await screen.findByRole('heading', { name: 'history-0' });
    fireEvent.click(screen.getByRole('button', { name: '删除当前测试会话' }));
    await waitFor(() => expect(harness.delete).toHaveBeenCalledWith(deleted.id));

    await act(async () => {
      delayedSave.resolve(deleted);
      await delayedSave.promise;
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: 'history-0' })).toBeVisible());
    expect(harness.delete).toHaveBeenCalledTimes(2);
  });

  it('删除持久化失败时不会提前移除本地会话', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    harness.delete.mockRejectedValueOnce(new Error('simulated delete failure'));
    render(<App />);
    await startCasting();
    const id = harness.currentSession!.id;
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除当前测试会话' }));

    await waitFor(() => expect(harness.delete).toHaveBeenCalledWith(id));
    expect(screen.getByRole('heading', { name: '第1爻' })).toBeVisible();
    expect(harness.historySessions.some((entry) => entry.id === id)).toBe(true);
    consoleError.mockRestore();
  });

  it('分析与追问交错完成时，当前会话保留服务端返回的报告和消息且 renderer 不再保存它们', async () => {
    const delayedAnalysis = deferred<AnalyzeReadingResult>();
    const delayedFollowUp = deferred<FollowUpReadingResult>();
    harness.analyze.mockReturnValue(delayedAnalysis.promise);
    harness.followUp.mockReturnValue(delayedFollowUp.promise);
    render(<App />);
    await startCasting();

    for (let lineIndex = 1; lineIndex <= 6; lineIndex += 1) {
      act(() => harness.onConfirm?.(harness.currentSession!.currentToss!.id));
      if (lineIndex < 6) {
        await screen.findByRole('heading', { name: `第${lineIndex + 1}爻` });
      }
    }
    await screen.findByRole('heading', { name: '成卦-6' });
    await waitFor(() => expect(harness.analyze).toHaveBeenCalledTimes(1));
    const completed = harness.resultSession!;

    act(() => { harness.onFollowUp?.('交错追问'); });

    await act(async () => {
      delayedAnalysis.resolve(analysisResult(completed));
      await delayedAnalysis.promise;
    });
    await act(async () => {
      delayedFollowUp.resolve({
        caseSnapshot: completed.caseSnapshot!,
        runtimeTrust: completed.caseRuntimeTrust ?? 'authoritative',
        answer: { content: '交错回答', evidenceIds: [] },
        messages: [
          { id: 'cross-user', role: 'user', content: '交错追问', createdAt: new Date().toISOString() },
          { id: 'cross-assistant', role: 'assistant', content: '交错回答', evidenceIds: [], createdAt: new Date().toISOString() },
        ],
      });
      await delayedFollowUp.promise;
    });

    await waitFor(() => {
      expect(harness.resultSession?.analysis).toBeDefined();
      expect(harness.resultSession?.messages.map((message) => message.content))
        .toEqual(['交错追问', '交错回答']);
    });
    expect(harness.save.mock.calls.some(([persisted]) => (
      Boolean(persisted.analysis) || persisted.messages.length > 0
    ))).toBe(false);
  });

  it('同一 tossId 从历史进入新 epoch 后仍产生独立确认命令并完成保存分析', async () => {
    render(<App />);
    await startCasting();
    const repeatedTossId = harness.currentSession!.currentToss!.id;
    act(() => harness.onConfirm?.(repeatedTossId));
    await screen.findByRole('heading', { name: '第2爻' });
    await waitFor(() => expect(harness.save).toHaveBeenCalled());

    let restored = createSession('历史同币次', 'other', new Date('2026-07-12T00:00:00.000Z'));
    for (let index = 0; index < 5; index += 1) {
      restored = confirmCurrentToss(
        prepareToss(restored, createToss(['text', 'text', 'reverse']), `history-${index}`),
        `2026-07-12T00:00:0${index + 1}.000Z`,
      );
    }
    restored = prepareToss(
      restored,
      createToss(['reverse', 'reverse', 'reverse']),
      'history-six',
      { id: repeatedTossId, at: '2026-07-12T00:00:06.000Z' },
    );
    harness.openSession = restored;
    harness.save.mockClear();
    harness.analyze.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '打开指定测试会话' }));
    await screen.findByRole('heading', { name: '第6爻' });
    act(() => harness.onConfirm?.(repeatedTossId));

    await screen.findByRole('heading', { name: '成卦-6' });
    await waitFor(() => expect(harness.analyze).toHaveBeenCalledTimes(1));
    expect(harness.save.mock.calls.some(([saved]) => saved.status === 'complete')).toBe(true);
  });
});
