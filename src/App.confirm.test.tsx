import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToss } from './lib/divination';
import { createBrowserLocalReport } from './lib/localAnalysis';
import {
  confirmCurrentToss,
  createSession,
  prepareToss,
  type DivinationSession,
} from './lib/session';
import type { AnalysisReport } from './lib/types';

type AnalyzeResult =
  | { ok: true; report: AnalysisReport }
  | {
    ok: false;
    error: { code: string; message: string; dataSafe: boolean; nextAction: string };
  };

const harness = vi.hoisted(() => ({
  currentSession: null as DivinationSession | null,
  resultSession: null as DivinationSession | null,
  openSession: null as DivinationSession | null,
  onConfirm: null as ((expectedTossId: string) => void) | null,
  onFollowUp: null as ((question: string) => void) | null,
  save: vi.fn(async (session: DivinationSession) => session),
  delete: vi.fn(async () => true),
  analyze: vi.fn(async (): Promise<AnalyzeResult> => ({
    ok: false as const,
    error: {
      code: 'TEST_OFFLINE',
      message: 'test offline',
      dataSafe: true,
      nextAction: '',
    },
  })),
  followUp: vi.fn(async () => ({
    ok: true as const,
    answer: { content: '默认追问', evidenceIds: [] as string[] },
  })),
}));

vi.mock('./lib/desktop', () => ({
  desktop: {
    sessions: {
      list: vi.fn(async () => []),
      get: vi.fn(async () => null),
      save: harness.save,
      delete: harness.delete,
    },
    settings: {},
    corpus: {},
    retrieval: {
      search: vi.fn(async () => ({ evidence: [], diagnostics: null })),
    },
    ai: {
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
  }) => (
    <div>
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
    </div>
  ),
}));

import { App, appFlowReducer, mergeSavedSession } from './App';

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

beforeEach(() => {
  vi.clearAllMocks();
  harness.save.mockReset().mockImplementation(async (session) => session);
  harness.delete.mockReset().mockResolvedValue(true);
  harness.analyze.mockReset().mockResolvedValue({
    ok: false,
    error: {
      code: 'TEST_OFFLINE',
      message: 'test offline',
      dataSafe: true,
      nextAction: '',
    },
  });
  harness.followUp.mockReset().mockResolvedValue({
    ok: true,
    answer: { content: '默认追问', evidenceIds: [] },
  });
  harness.currentSession = null;
  harness.resultSession = null;
  harness.openSession = null;
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
      pendingSessionWrite: null,
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
      pendingSessionWrite: null,
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

  it('第六爻在同一次状态提交中直接进入结果页且 StrictMode 只分析一次', async () => {
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
    const completed = harness.save.mock.calls.map(([saved]) => saved)
      .filter((saved) => saved.status === 'complete');
    expect(completed).toHaveLength(1);
    expect(completed[0].currentToss).toBeUndefined();
  });

  it('旧会话分析迟到后不能覆盖已经开始的新会话', async () => {
    const delayedAnalysis = deferred<AnalyzeResult>();
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
      delayedAnalysis.resolve({ ok: true, report: createBrowserLocalReport(completed, []) });
      await delayedAnalysis.promise;
    });

    await waitFor(() => expect(harness.currentSession?.id).toBe(newSessionId));
    expect(harness.currentSession?.analysis).toBeUndefined();
    expect(screen.getByRole('heading', { name: '第1爻' })).toBeVisible();
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

  it('分析与追问交错完成时，当前会话和最终持久化快照同时保留全部字段', async () => {
    const delayedAnalysis = deferred<AnalyzeResult>();
    const delayedFollowUp = deferred<{
      ok: true;
      answer: { content: string; evidenceIds: string[] };
    }>();
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
    await waitFor(() => expect(harness.resultSession?.messages).toHaveLength(1));

    await act(async () => {
      delayedAnalysis.resolve({
        ok: true,
        report: createBrowserLocalReport(completed, []),
      });
      await delayedAnalysis.promise;
    });
    await act(async () => {
      delayedFollowUp.resolve({
        ok: true,
        answer: { content: '交错回答', evidenceIds: [] },
      });
      await delayedFollowUp.promise;
    });

    await waitFor(() => {
      expect(harness.resultSession?.analysis).toBeDefined();
      expect(harness.resultSession?.messages.map((message) => message.content))
        .toEqual(['交错追问', '交错回答']);
    });
    await waitFor(() => {
      const persisted = harness.save.mock.calls.at(-1)?.[0];
      expect(persisted?.analysis).toBeDefined();
      expect(persisted?.messages.map((message) => message.content))
        .toEqual(['交错追问', '交错回答']);
    });
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
