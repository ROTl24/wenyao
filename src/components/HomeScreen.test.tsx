import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen 事项题签', () => {
  it('presents eight text-first category choices with stable accessible names', () => {
    const onCategoryChange = vi.fn();
    const { container } = render(
      <HomeScreen
        question="问事业"
        category={null}
        onQuestionChange={vi.fn()}
        onCategoryChange={onCategoryChange}
        onStart={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: '选择事项' });
    expect(within(group).getAllByRole('button')).toHaveLength(8);
    expect(container.querySelector('.category-button svg')).not.toBeInTheDocument();

    fireEvent.click(within(group).getByRole('button', { name: '事业工作' }));
    expect(onCategoryChange).toHaveBeenCalledWith('career');
  });

  it('exposes the current category through aria-pressed', () => {
    render(
      <HomeScreen
        question="问事业"
        category="career"
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '事业工作' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '感情婚姻' })).toHaveAttribute('aria-pressed', 'false');
  });
});
