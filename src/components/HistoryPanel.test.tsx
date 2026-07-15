import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { buildPlate } from '../lib/divination';
import type { DivinationSession } from '../lib/session';
import { HistoryPanel } from './HistoryPanel';

const castAt = new Date('2026-07-14T08:00:00.000Z');

const completeSession: DivinationSession = {
  id: 'complete-session',
  question: '项目能否顺利落地',
  category: 'career',
  castAt: castAt.toISOString(),
  updatedAt: castAt.toISOString(),
  status: 'complete',
  tosses: [],
  plate: buildPlate([7, 8, 7, 8, 7, 8], castAt),
  messages: [],
};

const castingSession: DivinationSession = {
  id: 'casting-session',
  question: '关系是否适合继续推进',
  category: 'relationship',
  castAt: new Date('2026-07-15T08:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-07-15T08:00:00.000Z').toISOString(),
  status: 'casting',
  tosses: [],
  messages: [],
};

function renderHistory(overrides: Partial<ComponentProps<typeof HistoryPanel>> = {}) {
  const props = {
    sessions: [completeSession, castingSession],
    onClose: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const view = render(<HistoryPanel {...props} />);
  return { ...view, ...props };
}

describe('HistoryPanel 占簿目录', () => {
  it('shows category, cast status and a compact hexagram while preserving search semantics', () => {
    const { container } = renderHistory();

    expect(screen.getByRole('dialog')).toHaveTextContent('问爻占簿');
    expect(screen.getByRole('textbox', { name: '搜索占簿' })).toBeVisible();
    expect(screen.getByText('事业工作')).toBeVisible();
    expect(screen.getByText('感情婚姻')).toBeVisible();
    expect(screen.getByText('起卦中 · 已定 0 爻')).toBeVisible();
    expect(container.querySelector('.history-glyph .hexagram-lines--compact')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '搜索占簿' }), { target: { value: '感情' } });
    expect(screen.queryByText('项目能否顺利落地')).not.toBeInTheDocument();
    expect(screen.getByText('关系是否适合继续推进')).toBeVisible();
  });

  it('keeps opening and confirmed deletion as separate actions', () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHistory({ onOpen, onDelete });

    fireEvent.click(screen.getByText('项目能否顺利落地').closest('button')!);
    expect(onOpen).toHaveBeenCalledWith(completeSession);

    fireEvent.click(screen.getByRole('button', { name: '删除：项目能否顺利落地' }));
    expect(onDelete).toHaveBeenCalledWith('complete-session');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
