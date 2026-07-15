import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToss } from '../lib/divination';
import { confirmCurrentToss, createSession, prepareToss } from '../lib/session';
import { RitualScreen } from './RitualScreen';

interface MockCoinSceneProps {
  faces: readonly string[];
  phase: 'gathering' | 'casting' | 'settling' | 'revealed';
  visualSeed: string;
  onSettled(): void;
  onSettling?(): void;
}

const sceneMock = vi.hoisted(() => ({
  latestProps: undefined as MockCoinSceneProps | undefined,
}));

vi.mock('./CoinScene', () => ({
  default: (props: MockCoinSceneProps) => {
    sceneMock.latestProps = props;
    return <div data-testid="coin-scene" data-phase={props.phase}>{props.faces.join(',')}</div>;
  },
}));

let reducedMotion = false;

function firstLineSession() {
  return prepareToss(
    createSession('未来三个月项目能否顺利落地', 'career', new Date('2026-07-15T08:00:00.000Z')),
    createToss(['text', 'reverse', 'reverse']),
    'ritual-test-seed',
  );
}

function secondLineSession() {
  return prepareToss(
    confirmCurrentToss(firstLineSession()),
    createToss(['text', 'text', 'reverse']),
    'ritual-second-seed',
  );
}

async function resolveLazyScene() {
  await act(async () => {
    await Promise.resolve();
  });
  return screen.getByTestId('coin-scene');
}

beforeEach(() => {
  reducedMotion = false;
  sceneMock.latestProps = undefined;
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches: reducedMotion,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('起卦仪式物理事件契约', () => {
  it('waits for all physical motion to settle before revealing and enabling confirmation', async () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(<RitualScreen session={firstLineSession()} onConfirm={onConfirm} />);

    const ritual = screen.getByRole('main');
    expect(ritual).toHaveAttribute('data-phase', 'gathering');
    expect(screen.getByRole('button', { name: '待钱象落定' })).toBeDisabled();
    expect(screen.getByRole('region', { name: '第一爻' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /起卦动画/ })).not.toBeInTheDocument();

    await resolveLazyScene();
    expect(sceneMock.latestProps?.visualSeed).toBe('ritual-test-seed');

    act(() => vi.advanceTimersByTime(560));
    expect(ritual).toHaveAttribute('data-phase', 'casting');
    expect(screen.getByText('三钱翻飞入盘')).toBeVisible();

    act(() => vi.advanceTimersByTime(20_000));
    expect(ritual).toHaveAttribute('data-phase', 'casting');
    expect(screen.getByRole('button', { name: '待钱象落定' })).toBeDisabled();

    act(() => sceneMock.latestProps?.onSettling?.());
    expect(ritual).toHaveAttribute('data-phase', 'settling');
    expect(screen.getByText('静候铜声止息')).toBeVisible();

    act(() => sceneMock.latestProps?.onSettled());
    expect(ritual).toHaveAttribute('data-phase', 'revealed');
    expect(screen.getAllByText('少阴')).toHaveLength(2);
    expect(screen.getByText('1 字 2 背 · 钱象已定')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '定此爻' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('ignores a settle callback captured by an older toss', async () => {
    vi.useFakeTimers();
    const first = firstLineSession();
    const { rerender } = render(<RitualScreen session={first} onConfirm={vi.fn()} />);
    await resolveLazyScene();
    act(() => vi.advanceTimersByTime(560));
    const staleSettled = sceneMock.latestProps?.onSettled;

    rerender(<RitualScreen session={secondLineSession()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'gathering');

    act(() => staleSettled?.());
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'gathering');
    expect(screen.getByRole('button', { name: '待钱象落定' })).toBeDisabled();
  });

  it('starts with a clear static result when reduced motion is requested', async () => {
    reducedMotion = true;
    vi.useFakeTimers();
    render(<RitualScreen session={firstLineSession()} onConfirm={vi.fn()} />);

    await resolveLazyScene();
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'revealed');
    expect(sceneMock.latestProps?.phase).toBe('revealed');
    expect(sceneMock.latestProps?.visualSeed).toBe('ritual-test-seed');
    expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled();

    act(() => vi.runAllTimers());
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'revealed');
  });
});
