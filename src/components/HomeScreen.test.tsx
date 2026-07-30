import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen 事项题签', () => {
  const sharedProps = {
    castingMethod: 'digital' as const,
    physicalTimeInput: '2026-07-12T12:00',
    physicalTimeError: '',
    onCastingMethodChange: vi.fn(),
    onPhysicalTimeChange: vi.fn(),
  };

  it('presents eight text-first category choices with stable accessible names', () => {
    const onCategoryChange = vi.fn();
    const { container } = render(
      <HomeScreen
        question="问事业"
        category={null}
        {...sharedProps}
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
        {...sharedProps}
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '事业工作' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '感情婚姻' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches between online and offline casting and exposes Beijing time only offline', () => {
    const onCastingMethodChange = vi.fn();
    const { rerender } = render(
      <HomeScreen
        question="问事业"
        category="career"
        {...sharedProps}
        onCastingMethodChange={onCastingMethodChange}
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText('起卦时间（北京时间）')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /线下起卦/ }));
    expect(onCastingMethodChange).toHaveBeenCalledWith('physical');

    rerender(
      <HomeScreen
        question="问事业"
        category="career"
        {...sharedProps}
        castingMethod="physical"
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('起卦时间（北京时间）')).toHaveValue('2026-07-12T12:00');
  });
});
