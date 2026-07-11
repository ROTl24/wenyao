import { Suspense, startTransition, useEffect, useState } from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoinRigHandle } from './CoinRig';
import type { InkHandsTargets } from './InkHands';
import type {
  RitualTimelineController,
  RitualTimelineOptions,
  RitualTimelineTargets,
} from './createRitualTimeline';
import { useRitualController } from './useRitualController';

interface FakeController extends RitualTimelineController {
  options: RitualTimelineOptions;
  targets: RitualTimelineTargets;
}

const harness = vi.hoisted(() => ({
  controllers: [] as FakeController[],
  create: vi.fn(),
  snap: vi.fn(),
}));

vi.mock('./createRitualTimeline', () => ({
  createRitualTimeline: harness.create,
  snapRitualTargetsToEnd: harness.snap,
}));

function fakeController(
  targets: RitualTimelineTargets,
  options: RitualTimelineOptions,
): FakeController {
  let progress = 0;
  let killed = false;
  const controller: FakeController = {
    options,
    targets,
    play: vi.fn(),
    finish: vi.fn(() => {
      if (killed) return;
      progress = 1;
      options.onComplete?.();
    }),
    restart: vi.fn(() => { progress = 0; }),
    seek: vi.fn(),
    seekProgress: vi.fn((next: number) => { progress = next; }),
    kill: vi.fn(() => { killed = true; }),
    dispose: vi.fn(() => { killed = true; }),
    getProgress: vi.fn(() => progress),
    getPlaybackDuration: vi.fn(() => options.reducedMotion ? 0.2 : 3.2),
    getLabels: vi.fn(() => ({
      start: 0,
      inkCover: 0.96,
      release: 0.98,
      coinsAirborne: 1.22,
      firstImpact: 1.78,
      lastImpact: 2.06,
      settled: 2.5,
      reveal: 2.82,
      confirmable: 3.2,
    })),
    isKilled: vi.fn(() => killed),
  };
  return controller;
}

function fixtureHands(): InkHandsTargets {
  const root = document.createElement('div');
  const closedHands = document.createElement('div');
  const openHands = document.createElement('div');
  const inkCover = document.createElement('div');
  root.append(closedHands, openHands, inkCover);
  return {
    root,
    closedHands,
    openHands,
    inkCover,
    setMediaProgress: vi.fn(),
  };
}

function fixtureRig(): CoinRigHandle {
  return {
    prepare: vi.fn(),
    setProgress: vi.fn(),
    snapToEnd: vi.fn(),
    invalidate: vi.fn(),
  };
}

function controllableMotionPreference(initial: boolean) {
  let listener: ((event: MediaQueryListEvent) => void) | null = null;
  const media = {
    matches: initial,
    addEventListener: vi.fn((_type: string, next: (event: MediaQueryListEvent) => void) => {
      listener = next;
    }),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(media);
  return {
    change(matches: boolean) {
      media.matches = matches;
      listener?.({ matches } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  harness.controllers.splice(0);
  harness.create.mockReset();
  harness.snap.mockReset();
  harness.snap.mockImplementation((targets: RitualTimelineTargets) => {
    targets.closedHands.style.opacity = '0';
    targets.openHands.style.opacity = '1';
    targets.inkCover.style.opacity = '0';
    targets.setMediaProgress(1);
    targets.coinRig.setProgress(1);
    targets.coinRig.invalidate();
  });
  harness.create.mockImplementation((targets, options: RitualTimelineOptions) => {
    const controller = fakeController(targets, options);
    harness.controllers.push(controller);
    return controller;
  });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe('useRitualController 生命周期', () => {
  it('等待 hands DOM 与 CoinRig 同时 ready，tossId 更换先 kill 且丢弃旧回调', async () => {
    const onReady = vi.fn();
    const onPhase = vi.fn();
    const { result, rerender } = renderHook(
      ({ id, lineIndex }) => useRitualController({
        toss: { id },
        lineIndex,
        onPhase,
        onReady,
      }),
      { initialProps: { id: 'toss-a', lineIndex: 1 } },
    );

    act(() => result.current.onHandsReady(fixtureHands()));
    expect(harness.create).not.toHaveBeenCalled();
    act(() => result.current.bindRig('toss-a', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    expect(harness.controllers[0].play).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith('toss-a');
    expect(result.current.phase).toBe('held');

    act(() => harness.controllers[0].options.onPhase?.('airborne'));
    expect(result.current.phase).toBe('airborne');

    rerender({ id: 'toss-b', lineIndex: 2 });
    expect(harness.controllers[0].kill).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('awaiting-scene');
    act(() => harness.controllers[0].options.onComplete?.());
    expect(result.current.phase).toBe('awaiting-scene');
    expect(onPhase).not.toHaveBeenCalledWith('ready', 'toss-a');
  });

  it('拒绝上一轮 lazy CoinRig 的迟到 ready，只绑定显式匹配的 tossId', async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useRitualController({ toss: { id }, lineIndex: 1 }),
      { initialProps: { id: 'old-toss' } },
    );
    const oldBindRig = result.current.bindRig;
    rerender({ id: 'new-toss' });

    act(() => result.current.onHandsReady(fixtureHands()));
    act(() => oldBindRig('old-toss', fixtureRig()));
    expect(harness.create).not.toHaveBeenCalled();

    act(() => result.current.bindRig('new-toss', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
  });

  it('rig 就绪前请求 skip 会在控制器创建时直接 finish 且不播放', async () => {
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'skip-before-ready' },
      lineIndex: 3,
    }));

    act(() => result.current.skip());
    expect(result.current.phase).toBe('awaiting-scene');
    expect(result.current.confirmable).toBe(false);
    expect(result.current.active).toBe(true);
    act(() => result.current.onHandsReady(fixtureHands()));
    expect(result.current.confirmable).toBe(false);
    act(() => result.current.bindRig('skip-before-ready', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));

    expect(harness.controllers[0].play).not.toHaveBeenCalled();
    expect(harness.controllers[0].finish).toHaveBeenCalledTimes(1);
    expect(result.current.confirmable).toBe(true);
    expect(result.current.active).toBe(false);
  });

  it('tryConfirm 只在 ready 同步返回一次 tossId，并在同一 tick 锁到 confirming', async () => {
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'confirm-once' },
      lineIndex: 4,
    }));
    expect(result.current.tryConfirm()).toBeNull();

    act(() => result.current.onHandsReady(fixtureHands()));
    act(() => result.current.bindRig('confirm-once', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    act(() => harness.controllers[0].options.onComplete?.());

    let first: string | null = null;
    let second: string | null = null;
    act(() => {
      first = result.current.tryConfirm();
      second = result.current.tryConfirm();
    });
    expect(first).toBe('confirm-once');
    expect(second).toBeNull();
    expect(result.current.phase).toBe('confirming');
  });

  it('读取 reduced motion 初值并交给唯一控制器', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'reduced' },
      lineIndex: 1,
    }));

    act(() => result.current.onHandsReady(fixtureHands()));
    act(() => result.current.bindRig('reduced', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));

    expect(harness.controllers[0].options.reducedMotion).toBe(true);
  });

  it('飞行中切换 reduced 只 finish 当前控制器，不 kill 或创建第二条时间轴', async () => {
    const motion = controllableMotionPreference(false);
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'reduce-while-airborne' },
      lineIndex: 1,
    }));
    act(() => result.current.onHandsReady(fixtureHands()));
    act(() => result.current.bindRig('reduce-while-airborne', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    act(() => harness.controllers[0].options.onPhase?.('airborne'));

    act(() => motion.change(true));

    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.controllers[0].kill).not.toHaveBeenCalled();
    expect(harness.controllers[0].finish).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('ready');
  });

  it('ready 后切换 reduced 不 kill、不重建且保持最终阶段', async () => {
    const motion = controllableMotionPreference(false);
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'reduce-after-ready' },
      lineIndex: 2,
    }));
    act(() => result.current.onHandsReady(fixtureHands()));
    act(() => result.current.bindRig('reduce-after-ready', fixtureRig()));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    act(() => harness.controllers[0].options.onComplete?.());

    act(() => motion.change(true));

    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.controllers[0].kill).not.toHaveBeenCalled();
    expect(harness.controllers[0].finish).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('ready');
  });

  it('活动中同一 toss 重绑 hands 会迁移到新 controller 并维持归一化进度', async () => {
    const firstHands = fixtureHands();
    const secondHands = fixtureHands();
    const rig = fixtureRig();
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'rebind-active-targets' },
      lineIndex: 3,
    }));
    act(() => result.current.onHandsReady(firstHands));
    act(() => result.current.bindRig('rebind-active-targets', rig));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    vi.mocked(harness.controllers[0].getProgress).mockReturnValue(0.413);

    act(() => result.current.onHandsReady(secondHands));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(2));

    expect(harness.controllers[0].kill).toHaveBeenCalledTimes(1);
    expect(harness.controllers[1].targets.openHands).toBe(secondHands.openHands);
    expect(harness.controllers[1].seekProgress).toHaveBeenCalledWith(0.413);
    expect(harness.controllers[1].play).toHaveBeenCalledTimes(1);
    act(() => harness.controllers[0].options.onComplete?.());
    expect(result.current.phase).toBe('held');
  });

  it('ready 后 manifest 与 rig 目标重建会同步 snap 新末帧且不复活旧 controller', async () => {
    const firstHands = fixtureHands();
    const firstRig = fixtureRig();
    const nextHands = fixtureHands();
    const nextRig = fixtureRig();
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'rebind-final-targets' },
      lineIndex: 4,
    }));
    act(() => result.current.onHandsReady(firstHands));
    act(() => result.current.bindRig('rebind-final-targets', firstRig));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    act(() => harness.controllers[0].options.onComplete?.());

    act(() => {
      result.current.onHandsReady(nextHands);
      result.current.bindRig('rebind-final-targets', nextRig);
    });
    await waitFor(() => expect(harness.snap).toHaveBeenCalled());

    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.controllers[0].kill).not.toHaveBeenCalled();
    expect(nextHands.closedHands.style.opacity).toBe('0');
    expect(nextHands.openHands.style.opacity).toBe('1');
    expect(nextHands.setMediaProgress).toHaveBeenLastCalledWith(1);
    expect(nextRig.setProgress).toHaveBeenLastCalledWith(1);
    expect(nextRig.invalidate).toHaveBeenCalled();
    expect(result.current.phase).toBe('ready');
  });

  it('reduced 完成后切回动态并换回视频目标仍保持开手末帧', async () => {
    const motion = controllableMotionPreference(true);
    const firstHands = fixtureHands();
    const videoHands = fixtureHands();
    const rig = fixtureRig();
    const { result } = renderHook(() => useRitualController({
      toss: { id: 'reduced-back-to-video' },
      lineIndex: 1,
    }));
    act(() => result.current.onHandsReady(firstHands));
    act(() => result.current.bindRig('reduced-back-to-video', rig));
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    act(() => harness.controllers[0].options.onComplete?.());

    act(() => motion.change(false));
    act(() => result.current.onHandsReady(videoHands));
    await waitFor(() => expect(harness.snap).toHaveBeenCalled());

    expect(videoHands.closedHands.style.opacity).toBe('0');
    expect(videoHands.openHands.style.opacity).toBe('1');
    expect(videoHands.setMediaProgress).toHaveBeenLastCalledWith(1);
    expect(harness.create).toHaveBeenCalledTimes(1);
    expect(harness.controllers[0].kill).not.toHaveBeenCalled();
  });

  it('Suspense 中未提交的新 toss 不会污染已提交 toss 的完成与确认身份', async () => {
    const hands = fixtureHands();
    const rig = fixtureRig();
    const never = new Promise<never>(() => undefined);

    function ConcurrentHarness() {
      const [id, setId] = useState('committed-a');
      const [confirmed, setConfirmed] = useState('unset');
      const controller = useRitualController({ toss: { id }, lineIndex: 1 });
      useEffect(() => {
        controller.onHandsReady(hands);
        controller.bindRig(id, rig);
      }, [controller.bindRig, controller.onHandsReady, id]);

      if (id === 'uncommitted-b') throw never;
      return (
        <div>
          <span data-testid="concurrent-phase">{controller.phase}</span>
          <span data-testid="concurrent-confirmed">{confirmed}</span>
          <button
            onClick={() => startTransition(() => setId('uncommitted-b'))}
            type="button"
          >
            render B
          </button>
          <button
            onClick={() => setConfirmed(controller.tryConfirm() ?? 'none')}
            type="button"
          >
            confirm A
          </button>
        </div>
      );
    }

    render(
      <Suspense fallback={<span>loading B</span>}>
        <ConcurrentHarness />
      </Suspense>,
    );
    await waitFor(() => expect(harness.create).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('concurrent-phase')).toHaveTextContent('held');

    fireEvent.click(screen.getByRole('button', { name: 'render B' }));
    act(() => harness.controllers[0].options.onComplete?.());

    expect(screen.getByTestId('concurrent-phase')).toHaveTextContent('ready');
    fireEvent.click(screen.getByRole('button', { name: 'confirm A' }));
    expect(screen.getByTestId('concurrent-confirmed')).toHaveTextContent('committed-a');
  });
});
