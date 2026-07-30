import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  appendPhysicalCastLine,
  createPhysicalCastDraft,
} from '../lib/physicalCasting';
import { PhysicalReviewScreen } from './PhysicalReviewScreen';

function completeDraft() {
  return ([6, 7, 8, 9, 7, 8] as const).reduce(
    (draft, value, index) => appendPhysicalCastLine(
      draft,
      value,
      `2026-07-30T00:00:0${index}.000Z`,
    ),
    createPhysicalCastDraft(
      '项目能否落地',
      'career',
      '2026-07-12T04:00:00.000Z',
    ),
  );
}

describe('线下六爻终审页', () => {
  it('shows all six lines, edits any line and exposes named review controls', () => {
    const onTimeChange = vi.fn();
    const onChangeLine = vi.fn();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <PhysicalReviewScreen
        draft={completeDraft()}
        timeInput="2026-07-12T12:00"
        timeError=""
        finalizing={false}
        finalizeError=""
        onTimeChange={onTimeChange}
        onChangeLine={onChangeLine}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: '六爻已成，请核对' })).toBeVisible();
    expect(screen.getByLabelText('六爻钱象核对')).toBeVisible();
    for (const lineName of ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻']) {
      expect(screen.getByRole('button', { name: `修改${lineName}` })).toBeVisible();
    }
    expect(screen.getByText('三字 · 老阴 6')).toBeVisible();
    expect(screen.getByText('三背 · 老阳 9')).toBeVisible();

    const timeInput = screen.getByLabelText('起卦时间（北京时间）');
    expect(timeInput).toHaveValue('2026-07-12T12:00');
    expect(timeInput).toHaveAttribute('aria-invalid', 'false');
    fireEvent.change(timeInput, { target: { value: '2026-07-12T12:01' } });
    expect(onTimeChange).toHaveBeenCalledWith('2026-07-12T12:01');

    fireEvent.click(screen.getByRole('button', { name: '修改二爻' }));
    const lineEditor = screen.getByRole('group', { name: '修改二爻' });
    expect(within(lineEditor).getAllByRole('button')).toHaveLength(4);
    fireEvent.click(within(lineEditor).getByRole('button', { name: /三背/ }));
    expect(onChangeLine).toHaveBeenCalledWith(1, 9);

    const confirm = screen.getByRole('button', { name: '确认并生成排盘' });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '放弃本次起卦' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('announces a time error and prevents final confirmation', () => {
    render(
      <PhysicalReviewScreen
        draft={completeDraft()}
        timeInput="2099-01-01T00:00"
        timeError="起卦时间不能超过当前北京时间 5 分钟"
        finalizing={false}
        finalizeError=""
        onTimeChange={vi.fn()}
        onChangeLine={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const timeInput = screen.getByLabelText('起卦时间（北京时间）');
    expect(timeInput).toHaveAttribute('aria-invalid', 'true');
    expect(timeInput).toHaveAccessibleDescription('起卦时间不能超过当前北京时间 5 分钟');
    expect(screen.getByRole('alert')).toHaveTextContent('起卦时间不能超过当前北京时间 5 分钟');
    expect(screen.getByRole('button', { name: '确认并生成排盘' })).toBeDisabled();
  });

  it('locks every review control and announces busy state while saving', () => {
    const props = {
      draft: completeDraft(),
      timeInput: '2026-07-12T12:00',
      timeError: '',
      finalizeError: '',
      onTimeChange: vi.fn(),
      onChangeLine: vi.fn(),
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(
      <PhysicalReviewScreen
        {...props}
        finalizing={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '修改二爻' }));
    const editor = screen.getByRole('group', { name: '修改二爻' });
    expect(within(editor).getAllByRole('button')).toHaveLength(4);

    rerender(
      <PhysicalReviewScreen
        {...props}
        finalizing
      />,
    );

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '放弃本次起卦' })).toBeDisabled();
    expect(screen.getByLabelText('起卦时间（北京时间）')).toBeDisabled();
    expect(screen.getByRole('button', { name: '修改初爻' })).toBeDisabled();
    expect(within(editor).getAllByRole('button').every((button) => (
      button.hasAttribute('disabled')
    ))).toBe(true);
    expect(screen.getByRole('button', { name: '正在保存…' })).toBeDisabled();
  });
});
