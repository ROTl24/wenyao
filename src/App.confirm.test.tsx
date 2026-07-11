import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createToss } from './lib/divination';
import { createSession, prepareToss, type DivinationSession } from './lib/session';

const harness = vi.hoisted(() => ({
  currentSession: null as DivinationSession | null,
  onConfirm: null as ((expectedTossId: string) => void) | null,
  save: vi.fn(async (session: DivinationSession) => session),
  analyze: vi.fn(async () => ({
    ok: false as const,
    error: {
      code: 'TEST_OFFLINE',
      message: 'test offline',
      dataSafe: true,
      nextAction: '',
    },
  })),
}));

vi.mock('./lib/desktop', () => ({
  desktop: {
    sessions: {
      list: vi.fn(async () => []),
      get: vi.fn(async () => null),
      save: harness.save,
      delete: vi.fn(async () => true),
    },
    settings: {},
    corpus: {},
    retrieval: {
      search: vi.fn(async () => ({ evidence: [], diagnostics: null })),
    },
    ai: {
      analyze: harness.analyze,
      followUp: vi.fn(),
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
  ResultScreen: ({ session }: { session: DivinationSession }) => (
    <h1>{`成卦-${session.tosses.length}`}</h1>
  ),
}));

import { App, appFlowReducer } from './App';

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
  harness.currentSession = null;
  harness.onConfirm = null;
});

describe('App 原子确认命令', () => {
  it('相同 state/action 的 reducer 重放得到完全相同的下一爻身份与时间', () => {
    const session = prepareToss(
      createSession('纯 reducer', 'other', new Date('2026-07-12T00:00:00.000Z')),
      createToss(['text', 'reverse', 'text']),
      'seed-current',
    );
    const state = { screen: 'casting' as const, session, pendingConfirmCommit: null };
    const action = {
      type: 'ADVANCE_TOSS' as const,
      expectedTossId: session.currentToss!.id,
      transaction: {
        at: '2026-07-12T00:00:01.000Z',
        next: {
          toss: createToss(['reverse', 'text', 'reverse']),
          visualSeed: 'seed-next',
          id: 'next-toss-id',
        },
      },
    };

    expect(appFlowReducer(state, action)).toEqual(appFlowReducer(state, action));
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
});
