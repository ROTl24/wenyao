import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoinRigHandle } from './CoinRig';
import {
  createRitualTimeline,
  type RitualTimelineTargets,
} from './createRitualTimeline';

interface Fixture {
  targets: RitualTimelineTargets;
  coinRig: CoinRigHandle;
  setMediaProgress: ReturnType<typeof vi.fn>;
}

function fixtureTargets(): Fixture {
  const root = document.createElement('div');
  const closedHands = document.createElement('div');
  const openHands = document.createElement('div');
  const inkCover = document.createElement('div');
  root.append(closedHands, openHands, inkCover);
  document.body.append(root);

  const coinRig: CoinRigHandle = {
    prepare: vi.fn(),
    setProgress: vi.fn(),
    snapToEnd: vi.fn(),
    invalidate: vi.fn(),
  };
  const setMediaProgress = vi.fn();

  return {
    coinRig,
    setMediaProgress,
    targets: {
      closedHands,
      coinRig,
      inkCover,
      openHands,
      root,
      setMediaProgress,
    },
  };
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('唯一 GSAP 摇卦时间轴', () => {
  it('首爻与后五爻标签精确落在冻结时序上', () => {
    const first = createRitualTimeline(fixtureTargets().targets, {
      firstLine: true,
      reducedMotion: false,
    });
    const repeat = createRitualTimeline(fixtureTargets().targets, {
      firstLine: false,
      reducedMotion: false,
    });

    expect(first.getLabels()).toEqual({
      start: 0,
      inkCover: 0.96,
      release: 0.98,
      coinsAirborne: 1.22,
      firstImpact: 1.78,
      lastImpact: 2.06,
      settled: 2.5,
      reveal: 2.82,
      confirmable: 3.2,
    });
    expect(repeat.getLabels()).toEqual({
      start: 0,
      inkCover: 0,
      release: 0.46,
      coinsAirborne: 0.68,
      firstImpact: 1.28,
      lastImpact: 1.56,
      settled: 1.92,
      reveal: 1.92,
      confirmable: 2.2,
    });

    first.kill();
    repeat.kill();
  });

  it('首爻只在墨幕完全遮挡后原子切换开合手，绝不交叉淡化', () => {
    const { targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: true,
      reducedMotion: false,
    });
    const coverAt = controller.getLabels().inkCover;

    controller.seek(coverAt - 0.001);
    expect(targets.closedHands.style.opacity).toBe('1');
    expect(targets.openHands.style.opacity).toBe('0');

    controller.seek('inkCover');
    expect(targets.inkCover.style.opacity).toBe('1');
    expect(targets.closedHands.style.opacity).toBe('0');
    expect(targets.openHands.style.opacity).toBe('1');

    controller.seek('coinsAirborne');
    expect(targets.inkCover.style.opacity).toBe('0');
    controller.kill();
  });

  it('第二至第六爻从开手开始且墨幕始终不遮挡', () => {
    const { targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: false,
      reducedMotion: false,
    });

    controller.seek('start');
    expect(targets.closedHands.style.opacity).toBe('0');
    expect(targets.openHands.style.opacity).toBe('1');
    expect(targets.inkCover.style.opacity).toBe('0');

    controller.seek('release');
    expect(targets.closedHands.style.opacity).toBe('0');
    expect(targets.openHands.style.opacity).toBe('1');
    expect(targets.inkCover.style.opacity).toBe('0');
    controller.kill();
  });

  it('只由主时间轴把 CoinRig 推进到飞行、碰撞与末帧', () => {
    const { coinRig, targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: true,
      reducedMotion: false,
    });

    controller.seek('release');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(0);
    controller.seek('firstImpact');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(0.72);
    controller.seek('lastImpact');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(0.88);
    controller.seek('settled');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(1);
    controller.kill();
  });

  it('相邻细微 seek 保留连续浮点进度，不把飞行量化成百分之一阶梯', () => {
    const { coinRig, targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: true,
      reducedMotion: false,
    });

    controller.seek(1.511);
    const first = vi.mocked(coinRig.setProgress).mock.calls.at(-1)?.[0] ?? 0;
    controller.seek(1.512);
    const second = vi.mocked(coinRig.setProgress).mock.calls.at(-1)?.[0] ?? 0;

    expect(second).not.toBe(first);
    expect(first).not.toBe(Number(first.toFixed(2)));
    expect(second).not.toBe(Number(second.toFixed(2)));
    controller.kill();
  });

  it('finish 将 DOM、手掌媒体和古钱推进到同一最终状态且只完成一次', () => {
    const completed = vi.fn();
    const { coinRig, setMediaProgress, targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: false,
      reducedMotion: false,
      onComplete: completed,
    });

    controller.play();
    controller.finish();
    controller.finish();

    expect(controller.getProgress()).toBe(1);
    expect(targets.closedHands.style.opacity).toBe('0');
    expect(targets.openHands.style.opacity).toBe('1');
    expect(targets.inkCover.style.opacity).toBe('0');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(1);
    expect(coinRig.invalidate).toHaveBeenCalled();
    expect(setMediaProgress).toHaveBeenLastCalledWith(1);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(vi.mocked(coinRig.invalidate).mock.invocationCallOrder.at(-1))
      .toBeLessThan(completed.mock.invocationCallOrder[0]);
    controller.kill();
  });

  it('kill 后旧时间轴即使时钟继续也绝不触发完成回调', async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    const controller = createRitualTimeline(fixtureTargets().targets, {
      firstLine: true,
      reducedMotion: false,
      onComplete: completed,
    });

    controller.play();
    controller.kill();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(completed).not.toHaveBeenCalled();
    expect(controller.isKilled()).toBe(true);
  });

  it('reduced motion 不播放飞行，在 200ms 内完成且首尾同步落定', async () => {
    vi.useFakeTimers();
    const completed = vi.fn();
    const { coinRig, setMediaProgress, targets } = fixtureTargets();
    const controller = createRitualTimeline(targets, {
      firstLine: true,
      reducedMotion: true,
      onComplete: completed,
    });

    controller.play();

    expect(controller.getPlaybackDuration()).toBeLessThanOrEqual(0.2);
    expect(targets.closedHands.style.opacity).toBe('0');
    expect(targets.openHands.style.opacity).toBe('1');
    expect(targets.inkCover.style.opacity).toBe('0');
    expect(coinRig.setProgress).toHaveBeenLastCalledWith(1);
    expect(setMediaProgress).toHaveBeenLastCalledWith(1);
    expect(coinRig.setProgress).not.toHaveBeenCalledWith(0.72);

    await vi.advanceTimersByTimeAsync(200);
    expect(completed).toHaveBeenCalledTimes(1);
    controller.kill();
  });
});
