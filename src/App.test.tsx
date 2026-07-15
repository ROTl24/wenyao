import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { desktop } from './lib/desktop';
import { buildPlate } from './lib/divination';
import type { DivinationSession } from './lib/session';

function completedHistorySession(question: string): DivinationSession {
  const castAt = new Date('2026-07-14T08:00:00.000Z');
  return {
    id: 'saved-session',
    question,
    category: 'career',
    castAt: castAt.toISOString(),
    updatedAt: castAt.toISOString(),
    status: 'complete',
    tosses: [],
    plate: buildPlate([7, 8, 7, 8, 7, 8], castAt),
    messages: [],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  Object.defineProperty(window, 'wenyao', { value: undefined, configurable: true });
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
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(await screen.findByRole('heading', { name: '第一爻' })).toBeVisible();
    expect(screen.getAllByLabelText(/乾隆古币/)).toHaveLength(3);
  });

  it('opens history and settings from the desktop chrome', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    expect(await screen.findByRole('heading', { name: '历史记录' })).toBeVisible();
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
});
