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

  it('labels the selected Gregorian date with its derived lunar date', () => {
    const { rerender } = render(<BeijingDateTimeField {...baseProps} onChange={vi.fn()} />);

    expect(screen.getByText('农历丙午年五月廿八')).toBeVisible();
    expect(screen.getByLabelText('日期')).toHaveAccessibleDescription(/农历丙午年五月廿八/);

    rerender(
      <BeijingDateTimeField
        {...baseProps}
        value="2026-08-04T12:00"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('农历丙午年五月廿八')).not.toBeInTheDocument();
    expect(screen.getByText('农历丙午年六月廿二')).toBeVisible();

    rerender(
      <BeijingDateTimeField
        {...baseProps}
        value="T12:00"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('农历丙午年六月廿二')).not.toBeInTheDocument();
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

  it('uses an in-app ink calendar instead of the native blue-white picker', () => {
    const onChange = vi.fn();
    render(<BeijingDateTimeField {...baseProps} onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: '打开日期选择面板' });

    fireEvent.click(trigger);
    const calendar = screen.getByRole('dialog', { name: '选择起卦日期' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(calendar).getByText('2026年7月')).toBeVisible();
    expect(within(calendar).getByRole('button', { name: '2026年7月12日' }))
      .toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(calendar).getByRole('button', { name: '2026年7月13日' }));
    expect(onChange).toHaveBeenCalledWith('2026-07-13T12:00');
    expect(screen.queryByRole('dialog', { name: '选择起卦日期' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('supports month navigation and keyboard opening without a system picker', () => {
    render(<BeijingDateTimeField {...baseProps} onChange={vi.fn()} />);
    const dateInput = screen.getByLabelText('日期');

    fireEvent.keyDown(dateInput, { key: 'ArrowDown', altKey: true });
    const calendar = screen.getByRole('dialog', { name: '选择起卦日期' });
    fireEvent.click(within(calendar).getByRole('button', { name: '下个月' }));
    expect(within(calendar).getByText('2026年8月')).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '选择起卦日期' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开日期选择面板' })).toHaveFocus();
  });

  it('uses a themed minute-precision time editor', () => {
    const onChange = vi.fn();
    render(<BeijingDateTimeField {...baseProps} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: '打开时刻选择面板' }));
    const timePicker = screen.getByRole('dialog', { name: '选择起卦时刻' });
    expect(within(timePicker).getByLabelText('小时')).toHaveValue(12);
    expect(within(timePicker).getByLabelText('分钟')).toHaveValue(0);

    fireEvent.change(within(timePicker).getByLabelText('小时'), { target: { value: '9' } });
    fireEvent.change(within(timePicker).getByLabelText('分钟'), { target: { value: '7' } });
    fireEvent.click(within(timePicker).getByRole('button', { name: '确定' }));

    expect(onChange).toHaveBeenCalledWith('2026-07-12T09:07');
    expect(screen.queryByRole('dialog', { name: '选择起卦时刻' })).not.toBeInTheDocument();
  });

  it('locks every action when disabled and keeps keyboard focus visible when enabled', () => {
    const { rerender } = render(
      <BeijingDateTimeField {...baseProps} disabled onChange={vi.fn()} />,
    );

    expect(screen.getByLabelText('日期')).toBeDisabled();
    expect(screen.getByLabelText('时刻')).toBeDisabled();
    expect(screen.getByRole('button', { name: '使用当前北京时间' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开日期选择面板' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '打开时刻选择面板' })).toBeDisabled();

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
