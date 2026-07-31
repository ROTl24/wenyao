import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { desktop } from './lib/desktop';
import { buildPlate, createTossFromValue } from './lib/divination';
import type { DivinationSession } from './lib/session';

function completedHistorySession(question: string): DivinationSession {
  const castAt = new Date('2026-07-14T08:00:00.000Z');
  const values = [7, 8, 7, 8, 7, 8] as const;
  return {
    id: 'saved-session',
    question,
    category: 'career',
    castingMethod: 'digital',
    castAt: castAt.toISOString(),
    updatedAt: castAt.toISOString(),
    status: 'complete',
    tosses: values.map((value, index) => ({
      ...createTossFromValue(value),
      id: `saved-toss-${index + 1}`,
      lineIndex: index + 1,
      visualSeed: `seed-${index + 1}`,
      confirmedAt: castAt.toISOString(),
    })),
    plate: buildPlate(values, castAt),
    messages: [],
  };
}

function reachPhysicalReview(question = '线下事业如何发展') {
  fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
  fireEvent.click(screen.getByRole('button', { name: /线下起卦/ }));
  fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

  for (let index = 0; index < 6; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: /三字，老阴 6/ }));
    fireEvent.click(screen.getByRole('button', { name: '定此爻' }));
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  Object.defineProperty(window, 'wenyao', { value: undefined, configurable: true });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    configurable: true,
  });
});

describe('问爻桌面体验', () => {
  it('accepts a three-character question then enters the first casting line', async () => {
    render(<App />);
    const start = screen.getByRole('button', { name: '开始起卦' });
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '事业' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '问事业' } });
    fireEvent.click(screen.getByRole('button', { name: /在线起卦/ }));
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(await screen.findByRole('heading', { name: '第一爻' })).toBeVisible();
    expect(screen.getAllByLabelText(/乾隆古币/)).toHaveLength(3);
  });

  it('does not analyze an online cast until the complete session is saved, and can retry that save', async () => {
    let rejectCompleteSave = true;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation(async (next) => {
      if (next.status === 'complete' && rejectCompleteSave) {
        rejectCompleteSave = false;
        throw new Error('磁盘暂时不可写');
      }
      return next;
    });
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '在线事业是否顺利' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    fireEvent.click(screen.getByRole('button', { name: /在线起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

    for (let line = 1; line <= 6; line += 1) {
      expect(await screen.findByRole('heading', { name: `第${['一', '二', '三', '四', '五', '六'][line - 1]}爻` })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: '定此爻' }));
    }

    expect(await screen.findByRole('alert')).toHaveTextContent('本次排盘尚未保存');
    expect(analyze).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const completeSaves = save.mock.calls
      .map(([saved]) => saved)
      .filter((saved) => saved.status === 'complete');
    expect(completeSaves).toHaveLength(2);
    expect(completeSaves[1].id).toBe(completeSaves[0].id);
  });

  it('opens history and settings from the desktop chrome', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    expect(await screen.findByRole('heading', { name: '问爻占簿' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '关闭历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI 设置' }));
    expect(await screen.findByRole('heading', { name: 'AI 与知识库' })).toBeVisible();
  });

  it('opens a completed history record without starting a new AI analysis', async () => {
    const savedSession = completedHistorySession('历史记录是否应保持原样');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    const analyze = vi.spyOn(desktop.ai, 'analyze');

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('历史记录是否应保持原样')).closest('button')!);

    expect(await screen.findByText('AI 解读')).toBeVisible();
    expect(screen.getByRole('button', { name: '开始解读' })).toBeVisible();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it('keeps a generated analysis visible and retries only the failed save', async () => {
    const savedSession = completedHistorySession('解读保存失败时怎么办');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    const analyze = vi.spyOn(desktop.ai, 'analyze');
    const save = vi.spyOn(desktop.sessions, 'save')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (next) => next);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('解读保存失败时怎么办')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));

    expect(await screen.findByRole('heading', { name: '1. 占问主题' })).toBeVisible();
    expect(await screen.findByText('解读已生成，但自动保存失败')).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));

    expect(await screen.findByText('已自动保存')).toBeVisible();
    expect(save).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a deleted session when an older analysis finishes later', async () => {
    const savedSession = completedHistorySession('删除后不得被后台解读恢复');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    let resolveAnalysis: ((value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void) | undefined;
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => (
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
    ));
    const save = vi.spyOn(desktop.sessions, 'save');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('删除后不得被后台解读恢复')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：删除后不得被后台解读恢复' }));
    expect(await screen.findByRole('heading', { name: '心有所问' })).toBeVisible();

    await act(async () => {
      resolveAnalysis?.({
        ok: true,
        report: {
          mode: 'cloud',
          markdown: '## 迟到的解读',
          generatedAt: new Date().toISOString(),
        },
      });
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '心有所问' })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]')).toEqual([]);
  });

  it('merges an analysis and a concurrent follow-up without losing either result', async () => {
    const savedSession = completedHistorySession('并发解读与追问都要保留');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    let resolveAnalysis: ((value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void) | undefined;
    let resolveFollowUp: ((value: Awaited<ReturnType<typeof desktop.ai.followUp>>) => void) | undefined;
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => (
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
    ));
    vi.spyOn(desktop.ai, 'followUp').mockImplementation(() => (
      new Promise((resolve) => {
        resolveFollowUp = resolve;
      })
    ));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('并发解读与追问都要保留')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    fireEvent.change(screen.getByRole('textbox', { name: '你的追问' }), {
      target: { value: '下一步该注意什么？' },
    });
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));
    await waitFor(() => expect(resolveFollowUp).toBeTypeOf('function'));

    await act(async () => {
      resolveAnalysis?.({
        ok: true,
        report: {
          mode: 'cloud',
          markdown: '## 并发主报告\n\n主报告正文。',
          generatedAt: new Date().toISOString(),
        },
      });
      await Promise.resolve();
      resolveFollowUp?.({
        ok: true,
        answer: { content: '### 追问答复\n\n保留追问结果。' },
      });
    });

    await waitFor(() => {
      const [stored] = JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]') as DivinationSession[];
      expect(stored.analysis?.markdown).toContain('并发主报告');
      expect(stored.messages).toHaveLength(2);
    });
    expect(await screen.findByRole('heading', { name: '并发主报告' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '追问答复' })).toBeVisible();
  });

  it('unlocks follow-up and reports the error when its save fails', async () => {
    const savedSession = completedHistorySession('追问失败后仍可继续操作');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.sessions, 'save').mockRejectedValueOnce(new Error('磁盘写入失败'));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('追问失败后仍可继续操作')).closest('button')!);
    const input = await screen.findByRole('textbox', { name: '你的追问' });
    fireEvent.change(input, { target: { value: '失败后还能重试吗？' } });
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('追问未完成');
    expect(screen.getByRole('alert')).toHaveTextContent('磁盘写入失败');
    expect(input).toBeEnabled();
  });

  it('keeps a session visible and rolls back its tombstone when deletion fails', async () => {
    const savedSession = completedHistorySession('删除失败不能从界面消失');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.sessions, 'delete').mockRejectedValueOnce(new Error('文件被占用'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('删除失败不能从界面消失')).closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：删除失败不能从界面消失' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('删除失败：文件被占用'));
    expect(screen.getByRole('heading', { name: '删除失败不能从界面消失' })).toBeVisible();
    expect(screen.getByRole('button', { name: '删除：删除失败不能从界面消失' })).toBeVisible();
  });

  it('waits for an in-flight save and performs one final delete', async () => {
    const savedSession = completedHistorySession('保存完成后只删除一次');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.ai, 'analyze').mockResolvedValue({
      ok: true,
      report: {
        mode: 'cloud',
        markdown: '## 等待保存\n\n用于删除竞态测试。',
        generatedAt: new Date().toISOString(),
      },
    });
    let resolveSave: ((saved: DivinationSession) => void) | undefined;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation((next) => (
      new Promise((resolve) => {
        resolveSave = () => resolve(next);
      })
    ));
    const remove = vi.spyOn(desktop.sessions, 'delete').mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('保存完成后只删除一次')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：保存完成后只删除一次' }));
    expect(remove).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.(save.mock.calls[0][0]);
    });

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: '心有所问' })).toBeVisible();
  });

  it('keeps offline lines in memory until review, then saves one complete physical session', async () => {
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation(async (next) => next);
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();

    expect(await screen.findByRole('heading', { name: '六爻已成，请核对' })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /确认并生成排盘/ }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({
      castingMethod: 'physical',
      status: 'complete',
    });
    expect(saved.tosses).toHaveLength(6);
    expect(saved.tosses.every((toss) => !Object.hasOwn(toss, 'visualSeed'))).toBe(true);
    expect(saved.plate).toBeDefined();
    expect(await screen.findByText('AI 解读')).toBeVisible();
  });

  it('locks the complete physical review while its single session is being saved', async () => {
    let resolveSave: ((saved: DivinationSession) => void) | undefined;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation((next) => (
      new Promise<DivinationSession>((resolve) => {
        resolveSave = () => resolve(next);
      })
    ));
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '历史记录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'AI 设置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '放弃本次起卦' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '修改初爻' })).toBeDisabled();
    const timeField = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    expect(within(timeField).getByLabelText('日期')).toBeDisabled();
    expect(within(timeField).getByLabelText('时刻')).toBeDisabled();
    expect(within(timeField).getByRole('button', { name: '使用当前北京时间' })).toBeDisabled();
    expect(analyze).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.(save.mock.calls[0][0]);
    });

    expect(await screen.findByText('AI 解读')).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('retries a failed physical save with the exact same complete session id', async () => {
    const save = vi.spyOn(desktop.sessions, 'save')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (next) => next);
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].id).toBe(save.mock.calls[0][0].id);
    expect(save.mock.calls[1][0].tosses.map((toss) => toss.id)).toEqual(
      save.mock.calls[0][0].tosses.map((toss) => toss.id),
    );
    expect(await screen.findByText('AI 解读')).toBeVisible();
  });

  it('asks before abandoning recorded offline lines and never creates history', () => {
    const save = vi.spyOn(desktop.sessions, 'save');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '线下问题是否顺利' } });
    fireEvent.click(screen.getByRole('button', { name: '其他' }));
    fireEvent.click(screen.getByRole('button', { name: /线下起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    fireEvent.click(screen.getByRole('button', { name: /两字一背，少阳 7/ }));
    fireEvent.click(screen.getByRole('button', { name: '定此爻' }));

    fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '第二爻' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: '心有所问' })).toBeVisible();
    expect(screen.getByLabelText('所占之事')).toHaveValue('');
    expect(screen.getByRole('button', { name: /在线起卦/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /线下起卦/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '开始起卦' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
});
