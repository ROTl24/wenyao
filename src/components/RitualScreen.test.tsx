import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DivinationSession } from '../lib/session';
import { RitualScreen } from './RitualScreen';

const rig = vi.hoisted(() => ({
  prepare: vi.fn(),
  setProgress: vi.fn(),
  snapToEnd: vi.fn(),
  invalidate: vi.fn(),
}));
const sceneHarness = vi.hoisted(() => ({
  deferReady: false,
  onRigReady: undefined as ((value: typeof rig) => void) | undefined,
}));

vi.mock('./CoinScene', async () => {
  const { useEffect } = await import('react');
  return {
    default: (props: {
      active: boolean;
      tossId: string;
      visualSeed: string;
      onRigReady?(value: typeof rig): void;
    }) => {
      sceneHarness.onRigReady = props.onRigReady;
      useEffect(() => {
        if (!sceneHarness.deferReady) props.onRigReady?.(rig);
      }, [props.onRigReady, props.tossId]);
      return (
        <div
          data-active={String(props.active)}
          data-testid="coin-scene-stub"
          data-toss-id={props.tossId}
          data-visual-seed={props.visualSeed}
        />
      );
    },
  };
});

const session: DivinationSession = {
  id: 'session-1',
  question: '静态交接测试',
  category: 'career',
  castAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
  status: 'casting',
  tosses: [],
  messages: [],
  currentToss: {
    id: 'toss-static-handoff',
    visualSeed: 'ritual-screen-seed',
    lineIndex: 1,
    faces: ['text', 'reverse', 'text'],
    value: 7,
    label: '少阳',
    moving: false,
    baseYang: true,
    changedYang: true,
  },
};

const nextSession: DivinationSession = {
  ...session,
  updatedAt: '2026-07-12T00:01:00.000Z',
  tosses: [{
    ...session.currentToss!,
    confirmedAt: '2026-07-12T00:00:30.000Z',
  }],
  currentToss: {
    ...session.currentToss!,
    id: 'toss-static-handoff-next',
    lineIndex: 2,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  sceneHarness.deferReady = false;
  sceneHarness.onRigReady = undefined;
});

describe('RitualScreen 到 CoinRig 的静态交接', () => {
  it('传递本轮身份，settled 后只 snapToEnd 并把场景切到 demand', async () => {
    render(<RitualScreen session={session} onConfirm={vi.fn()} />);
    const scene = await screen.findByTestId('coin-scene-stub');

    expect(scene).toHaveAttribute('data-toss-id', 'toss-static-handoff');
    expect(scene).toHaveAttribute('data-visual-seed', 'ritual-screen-seed');
    expect(scene).toHaveAttribute('data-active', 'true');

    fireEvent.click(screen.getByRole('button', { name: '起卦动画，点击可直接查看结果' }));

    await waitFor(() => expect(rig.snapToEnd).toHaveBeenCalledTimes(1));
    expect(scene).toHaveAttribute('data-active', 'false');
    expect(rig.setProgress).not.toHaveBeenCalled();
  });

  it('用户先跳过动画、rig 后就绪时仍只落定一次', async () => {
    sceneHarness.deferReady = true;
    render(<RitualScreen session={session} onConfirm={vi.fn()} />);
    await screen.findByTestId('coin-scene-stub');

    fireEvent.click(screen.getByRole('button', { name: '起卦动画，点击可直接查看结果' }));
    expect(rig.snapToEnd).not.toHaveBeenCalled();

    act(() => sceneHarness.onRigReady?.(rig));

    expect(rig.snapToEnd).toHaveBeenCalledTimes(1);
    expect(rig.setProgress).not.toHaveBeenCalled();
  });

  it('上一轮已 settled 时，新 tossId 不会继承旧轮末帧', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<RitualScreen session={session} onConfirm={onConfirm} />);
    await screen.findByTestId('coin-scene-stub');
    fireEvent.click(screen.getByRole('button', { name: '起卦动画，点击可直接查看结果' }));
    await waitFor(() => expect(rig.snapToEnd).toHaveBeenCalledTimes(1));
    rig.snapToEnd.mockClear();

    rerender(<RitualScreen session={nextSession} onConfirm={onConfirm} />);

    const scene = await screen.findByTestId('coin-scene-stub');
    await waitFor(() => expect(scene).toHaveAttribute('data-active', 'true'));
    expect(scene).toHaveAttribute('data-toss-id', 'toss-static-handoff-next');
    expect(rig.snapToEnd).not.toHaveBeenCalled();
  });
});
