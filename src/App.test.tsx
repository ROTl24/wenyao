import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window, 'wenyao', { value: undefined, configurable: true });
});

describe('问爻桌面体验', () => {
  it('validates the question then enters the first casting line', async () => {
    render(<App />);
    const start = screen.getByRole('button', { name: '开始起卦' });
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '近期事业是否会出现新的发展机会？' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
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
});
