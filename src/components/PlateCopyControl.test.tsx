import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCastingBasis, lineRecordFromToss } from '../lib/casting';
import { createToss } from '../lib/divination';
import { createCompletedSession } from '../lib/session';
import { PlateCopyControl } from './PlateCopyControl';

const castAt = new Date('2026-07-11T12:00:00+08:00');

function session() {
  const values = [6, 7, 8, 9, 7, 8] as const;
  const lines = values.map((value, index) => {
    const faces = value === 6 ? ['text', 'text', 'text'] as const
      : value === 7 ? ['text', 'text', 'reverse'] as const
        : value === 8 ? ['text', 'reverse', 'reverse'] as const
          : ['reverse', 'reverse', 'reverse'] as const;
    return lineRecordFromToss(createToss(faces), index + 1, castAt.toISOString());
  });
  return createCompletedSession('合作是否适合继续？', 'career', castAt, {
    method: 'random',
    basis: defaultCastingBasis('random'),
    lines,
  }, castAt);
}

function installClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

describe('排盘复制控件', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to plain text and reports a successful direct copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<PlateCopyControl session={session()} />);

    fireEvent.click(screen.getByRole('button', { name: '复制排盘 · 纯文本' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain('【六爻排盘（上爻至初爻）】');
    expect(screen.getByText('已复制 · 纯文本')).toBeVisible();
  });

  it('remembers the selected format and copies the matching representation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    render(<PlateCopyControl session={session()} />);

    fireEvent.change(screen.getByLabelText('排盘复制格式'), { target: { value: 'json' } });
    fireEvent.click(screen.getByRole('button', { name: '复制排盘 · JSON' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(JSON.parse(writeText.mock.calls[0][0]).question.text).toBe('合作是否适合继续？');
    expect(window.localStorage.getItem('wenyao:plate-copy-format')).toBe('json');
  });

  it('opens a selected manual-copy fallback when clipboard access fails', async () => {
    installClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    render(<PlateCopyControl session={session()} />);

    fireEvent.click(screen.getByRole('button', { name: '复制排盘 · 纯文本' }));

    const dialog = await screen.findByRole('dialog', { name: '请手动复制排盘' });
    const textarea = screen.getByLabelText('可手动复制的排盘内容') as HTMLTextAreaElement;
    expect(dialog).toBeVisible();
    expect(textarea.value).toContain('合作是否适合继续？');
    await waitFor(() => {
      expect(textarea.selectionStart).toBe(0);
      expect(textarea.selectionEnd).toBe(textarea.value.length);
    });
  });

  it('contains malformed relation data as a visible export error', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const malformed = session();
    malformed.plate!.relationFacts.transformationReturns[0].changedToBaseElementRelation = '未知' as never;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = render(<PlateCopyControl session={malformed} />);

    fireEvent.click(screen.getByRole('button', { name: '复制排盘 · 纯文本' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('排盘复制暂时失败，请保留当前记录并稍后重试。');
    expect(writeText).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('排盘复制失败', expect.any(Error));

    rerender(<PlateCopyControl session={{ ...session(), id: 'different-session' }} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
