import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen 事项题签', () => {
  const sharedProps = {
    castingMethod: 'digital' as const,
    castingTimeInput: '2026-07-12T12:00',
    castingTimeError: '',
    starting: false,
    startError: '',
    onCastingMethodChange: vi.fn(),
    onCastingTimeChange: vi.fn(),
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

  it('offers all four casting methods and exposes Beijing time for physical and time casting', () => {
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
    const methods = screen.getByRole('group', { name: '选择起卦方式' });
    expect(within(methods).getAllByRole('button')).toHaveLength(4);
    expect(within(methods).getByRole('button', { name: /随机起卦/ })).toBeVisible();
    expect(within(methods).getByRole('button', { name: /时间起卦/ })).toBeVisible();
    expect(screen.queryByRole('group', { name: '起卦时间（北京时间）' })).not.toBeInTheDocument();
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
    const timeField = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    expect(within(timeField).getByLabelText('日期')).toHaveValue('2026-07-12');
    expect(within(timeField).getByLabelText('时刻')).toHaveValue('12:00');

    fireEvent.change(within(timeField).getByLabelText('时刻'), { target: { value: '12:01' } });
    expect(sharedProps.onCastingTimeChange).toHaveBeenCalledWith('2026-07-12T12:01');

    rerender(
      <HomeScreen
        question="问事中"
        category="career"
        {...sharedProps}
        castingMethod="time"
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: '起卦时间（北京时间）' })).toHaveTextContent('同一时辰内卦象相同');
  });

  it('associates an offline time error with both segments and prevents starting', () => {
    const error = '请输入完整的北京时间';
    render(
      <HomeScreen
        question="问事业"
        category="career"
        {...sharedProps}
        castingMethod="physical"
        castingTimeInput="2026-07-12T"
        castingTimeError={error}
        onQuestionChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onStart={vi.fn()}
      />,
    );

    const timeField = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    expect(within(timeField).getByLabelText('日期')).toHaveAccessibleDescription(error);
    expect(within(timeField).getByLabelText('时刻')).toHaveAccessibleDescription(error);
    expect(within(timeField).getByRole('alert')).toHaveTextContent(error);
    expect(screen.getByRole('button', { name: '开始起卦' })).toBeDisabled();
  });
});
