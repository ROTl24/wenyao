import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AlmanacSelection } from '../lib/almanac';
import { CalendarScreen } from './CalendarScreen';

function Harness({
  initial = { date: '2026-08-04', hourId: 'zi' },
  onClose = vi.fn(),
}: {
  initial?: AlmanacSelection;
  onClose?: () => void;
}) {
  const [selection, setSelection] = useState(initial);
  return <CalendarScreen selection={selection} onSelectionChange={setSelection} onClose={onClose} />;
}

describe('CalendarScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-03T15:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the approved month, day facts and zi-hour range', () => {
    render(<Harness />);

    expect(screen.getByRole('heading', { level: 1, name: '2026年8月' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '2026年8月4日' })).toBeVisible();
    expect(screen.getByText('农历丙午年六月廿二')).toBeVisible();
    expect(screen.getByLabelText('四柱')).toHaveTextContent('年丙午月乙未日庚戌时丙子');
    const facts = screen.getByLabelText('黄历详情');
    expect(facts).toHaveTextContent('值神青龙·黄道·吉');
    expect(facts).toHaveTextContent('冲煞冲(甲辰)龙 · 煞北');
    expect(facts).toHaveTextContent('星宿室火猪·吉');
    expect(facts).toHaveTextContent('建除平日');
    expect(screen.getAllByText('8月3日 23:00—8月4日 00:59').length).toBeGreaterThan(0);
  });

  it('changes the visible month without changing details until a day is selected', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '下个月' }));
    expect(screen.getByRole('heading', { level: 1, name: '2026年9月' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '2026年8月4日' })).toBeVisible();

    fireEvent.click(screen.getByRole('gridcell', { name: /2026年9月8日/ }));
    expect(screen.getByRole('heading', { name: '2026年9月8日' })).toBeVisible();
  });

  it('selects a year and month through the in-app period picker', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: '选择年份和月份' }));
    const dialog = screen.getByRole('dialog', { name: '选择年份和月份' });
    fireEvent.click(within(dialog).getByRole('option', { name: '2025年' }));
    fireEvent.click(within(dialog).getByRole('option', { name: '7月' }));

    expect(screen.getByRole('heading', { level: 1, name: '2025年7月' })).toBeVisible();
  });

  it('updates the selected time pillar and returns to the current traditional date', () => {
    render(<Harness initial={{ date: '2026-07-01', hourId: 'wu' }} />);

    fireEvent.click(screen.getByRole('option', { name: /申时/ }));
    expect(screen.getByText(/申时 · 7月1日 15:00—7月1日 16:59/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '回到今日' }));
    expect(screen.getByRole('heading', { name: '2026年8月4日' })).toBeVisible();
    expect(screen.getByText(/子时 · 8月3日 23:00—8月4日 00:59/)).toBeVisible();
  });

  it('closes without mutating the caller-owned screen state', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
