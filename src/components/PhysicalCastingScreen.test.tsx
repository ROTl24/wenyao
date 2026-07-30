import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  appendPhysicalCastLine,
  createPhysicalCastDraft,
} from '../lib/physicalCasting';
import { PhysicalCastingScreen } from './PhysicalCastingScreen';

describe('线下逐爻录入页', () => {
  it('keeps confirmation disabled until one accessible money pattern is previewed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const draft = createPhysicalCastDraft(
      '项目能否落地',
      'career',
      '2026-07-12T04:00:00.000Z',
    );

    render(
      <PhysicalCastingScreen
        draft={draft}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('heading', { name: '第一爻' })).toBeVisible();
    const options = screen.getByRole('group', { name: '第一爻钱象' });
    expect(within(options).getAllByRole('button')).toHaveLength(4);
    expect(within(options).getByRole('button', {
      name: '两字一背，少阳 7 · 静爻',
    })).toHaveAttribute('aria-pressed', 'false');

    const confirm = screen.getByRole('button', { name: '定此爻' });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('请选择钱象')).toBeVisible();

    fireEvent.click(within(options).getByRole('button', {
      name: '两字一背，少阳 7 · 静爻',
    }));

    expect(screen.getByText('少阳 · 7')).toBeVisible();
    expect(within(options).getByRole('button', {
      name: '两字一背，少阳 7 · 静爻',
    })).toHaveAttribute('aria-pressed', 'true');
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith(7);

    fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('shows confirmed progress from the initial line upward', () => {
    const draft = appendPhysicalCastLine(
      createPhysicalCastDraft(
        '项目能否落地',
        'career',
        '2026-07-12T04:00:00.000Z',
      ),
      6,
      '2026-07-30T00:00:00.000Z',
    );

    render(
      <PhysicalCastingScreen
        draft={draft}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: '第二爻' })).toBeVisible();
    expect(screen.getByRole('group', { name: '第二爻钱象' })).toBeVisible();
    expect(screen.getByLabelText('初爻：老阴')).toBeVisible();
    expect(screen.getByLabelText('二爻：正在起卦')).toBeVisible();
  });
});
