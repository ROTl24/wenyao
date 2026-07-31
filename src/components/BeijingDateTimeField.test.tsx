import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeijingDateTimeField } from './BeijingDateTimeField';

const baseProps = {
  id: 'cast-time',
  value: '2026-07-12T12:00',
  error: '',
  disabled: false,
  helperText: '默认当前时间，可修改到实际摇卦时刻',
  layout: 'wide' as const,
};

describe('BeijingDateTimeField', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('splits the value and recombines either edited segment', () => {
    const onChange = vi.fn();
    const { rerender } = render(<BeijingDateTimeField {...baseProps} onChange={onChange} />);
    const group = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    const date = within(group).getByLabelText('日期');
    const time = within(group).getByLabelText('时刻');

    expect(date).toHaveValue('2026-07-12');
    expect(time).toHaveValue('12:00');

    fireEvent.change(date, { target: { value: '2026-07-13' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-07-13T12:00');

    rerender(
      <BeijingDateTimeField
        {...baseProps}
        value="2026-07-13T12:00"
        onChange={onChange}
      />,
    );
    fireEvent.change(within(group).getByLabelText('时刻'), { target: { value: '12:34' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-07-13T12:34');
  });

  it('preserves an explicitly incomplete value when either segment is cleared', () => {
    const onChange = vi.fn();
    const { rerender } = render(<BeijingDateTimeField {...baseProps} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('日期'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('T12:00');

    rerender(<BeijingDateTimeField {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('时刻'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-07-12T');
  });

  it('announces errors from both native controls', () => {
    const error = '请输入完整的北京时间';
    render(
      <BeijingDateTimeField
        {...baseProps}
        error={error}
        onChange={vi.fn()}
      />,
    );

    const date = screen.getByLabelText('日期');
    const time = screen.getByLabelText('时刻');
    expect(date).toHaveAttribute('aria-invalid', 'true');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(date).toHaveAccessibleDescription(error);
    expect(time).toHaveAccessibleDescription(error);
    expect(screen.getByRole('alert')).toHaveTextContent(error);
  });

  it('sets the current Beijing minute through the quick action', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T04:34:48.000Z'));
    const onChange = vi.fn();
    render(<BeijingDateTimeField {...baseProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '使用当前北京时间' }));
    expect(onChange).toHaveBeenCalledWith('2026-07-12T12:34');
  });

  it('locks every action when disabled and keeps keyboard focus visible when enabled', () => {
    const { rerender } = render(
      <BeijingDateTimeField {...baseProps} disabled onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('日期')).toBeDisabled();
    expect(screen.getByLabelText('时刻')).toBeDisabled();
    expect(screen.getByRole('button', { name: '使用当前北京时间' })).toBeDisabled();

    rerender(<BeijingDateTimeField {...baseProps} onChange={vi.fn()} />);
    const date = screen.getByLabelText('日期');
    const time = screen.getByLabelText('时刻');
    const now = screen.getByRole('button', { name: '使用当前北京时间' });
    date.focus();
    expect(date).toHaveFocus();
    time.focus();
    expect(time).toHaveFocus();
    now.focus();
    expect(now).toHaveFocus();
  });
});
