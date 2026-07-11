import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoinRigHandle } from './CoinRig';
import type { InkHandsTargets } from './InkHands';
import type {
  RitualTimelineController,
  RitualTimelineOptions,
} from './createRitualTimeline';
import { useRitualController } from './useRitualController';

interface FakeController extends RitualTimelineController {
  options: RitualTimelineOptions;
}

const harness = vi.hoisted(() => ({
  controllers: [] as FakeController[],
  create: vi.fn(),
}));

vi.mock('./createRitualTimeline', () => ({
  createRitualTimeline: harness.create,
}));

function fakeController(options: RitualTimelineOptions): FakeController {
  let progress = 0;
  let killed = false;
  const controller: FakeController = {
    options,
    play: vi.fn(),
    finish: vi.fn(() => {
      if (killed) return;
      progress = 1;
      options.onComplete?.();
    }),
    restart: vi.fn(),
    seek: vi.fn(),
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
  harness.create.mockImplementation((_targets, options: RitualTimelineOptions) => {
    const controller = fakeController(options);
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
});
