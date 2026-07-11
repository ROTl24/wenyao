import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RITUAL_HANDS_MANIFEST } from '../features/ritual/ritualAssets';
import type { DivinationSession } from '../lib/session';
import { RitualScreen } from './RitualScreen';

const rig = vi.hoisted(() => ({
  prepare: vi.fn(),
  setProgress: vi.fn(),
  setVisible: vi.fn(),
  snapToEnd: vi.fn(),
  invalidate: vi.fn(),
}));

const sceneHarness = vi.hoisted(() => ({
  deferReady: false,
  throwError: false,
  suspend: false,
  pending: null as Promise<void> | null,
  resolvePending: null as (() => void) | null,
  mounts: 0,
  unmounts: 0,
  callbacks: new Map<string, (value: typeof rig) => void>(),
}));

const timelineHarness = vi.hoisted(() => ({
  controllers: [] as Array<{
    tossId: string;
    coinRig: typeof rig;
    killed: boolean;
    options: {
      reducedMotion: boolean;
      onPhase?(phase: 'release' | 'airborne' | 'landing' | 'reveal'): void;
      onComplete?(): void;
    };
    complete(): void;
    finish: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('./CoinScene', async () => {
  const { useEffect } = await import('react');
  return {
    default: (props: {
      active: boolean;
      faces: readonly string[];
      lineIndex: number;
      tossId: string;
      visualSeed: string;
      onRigReady(value: typeof rig): void;
    }) => {
      sceneHarness.callbacks.set(props.tossId, props.onRigReady);
      useEffect(() => {
        if (!sceneHarness.deferReady) props.onRigReady(rig);
      }, [props.onRigReady, props.tossId]);
      useEffect(() => {
        sceneHarness.mounts += 1;
        return () => { sceneHarness.unmounts += 1; };
      }, []);
      if (sceneHarness.suspend && sceneHarness.pending) throw sceneHarness.pending;
      if (sceneHarness.throwError) throw new Error('WebGL context unavailable');
      return (
        <div
          aria-hidden="true"
          data-active={String(props.active)}
          data-faces={props.faces.join(',')}
          data-line-index={props.lineIndex}
          data-testid="coin-scene-stub"
          data-toss-id={props.tossId}
          data-visual-seed={props.visualSeed}
        />
      );
    },
  };
});

vi.mock('../features/ritual/createRitualTimeline', () => {
  const snap = (targets: {
    closedHands: HTMLElement;
    openHands: HTMLElement;
    inkCover: HTMLElement;
    coinRig: typeof rig;
    setMediaProgress(progress: number): void;
  }) => {
    targets.closedHands.style.opacity = '0';
    targets.openHands.style.opacity = '1';
    targets.inkCover.style.opacity = '0';
    targets.setMediaProgress(1);
    targets.coinRig.setVisible(true);
    targets.coinRig.snapToEnd();
    targets.coinRig.invalidate();
  };
  return {
    snapRitualTargetsToEnd: vi.fn(snap),
    createRitualTimeline: vi.fn((targets, options) => {
      let completed = false;
      let progress = 0;
      targets.coinRig.setVisible(false);
      const controller = {
        tossId: '',
        coinRig: targets.coinRig,
        killed: false,
        options,
        complete() {
          if (controller.killed || completed) return;
          completed = true;
          progress = 1;
          snap(targets);
          options.onComplete?.();
        },
        play: vi.fn(() => {
          if (options.reducedMotion) controller.complete();
        }),
        finish: vi.fn(() => controller.complete()),
        restart: vi.fn(),
        seek: vi.fn(),
        seekProgress: vi.fn((next: number) => { progress = next; }),
        kill: vi.fn(() => { controller.killed = true; }),
        dispose: vi.fn(() => { controller.killed = true; }),
        getProgress: vi.fn(() => progress),
        getPlaybackDuration: vi.fn(() => options.reducedMotion ? 0.2 : 3.2),
        getLabels: vi.fn(() => ({})),
        isKilled: vi.fn(() => controller.killed),
      };
      timelineHarness.controllers.push(controller);
      return controller;
    }),
  };
});

function preparedSession(
  id = 'toss-a',
  lineIndex = 1,
  tosses: DivinationSession['tosses'] = [],
): DivinationSession {
  return {
    id: 'session-1',
    question: '静态交接测试',
    category: 'career',
    castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2026-07-12T00:00:00.000Z',
    status: 'casting',
    tosses,
    messages: [],
    currentToss: {
      id,
      visualSeed: `seed-${id}`,
      lineIndex,
      faces: ['text', 'reverse', 'text'],
      value: 7,
      label: '少阳',
      moving: false,
      baseYang: true,
      changedYang: true,
    },
  };
}

function stage(): HTMLButtonElement {
  return screen.getByRole('button', { name: /起卦动画/ });
}

function realControllers() {
  return timelineHarness.controllers.filter((controller) => controller.coinRig === rig);
}

beforeEach(() => {
  vi.clearAllMocks();
  rig.snapToEnd.mockImplementation(() => rig.setProgress(1));
  timelineHarness.controllers.splice(0);
  sceneHarness.deferReady = false;
  sceneHarness.throwError = false;
  sceneHarness.suspend = false;
  sceneHarness.mounts = 0;
  sceneHarness.unmounts = 0;
  sceneHarness.pending = new Promise<void>((resolve) => {
    sceneHarness.resolvePending = resolve;
  });
  sceneHarness.callbacks.clear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(DEFAULT_RITUAL_HANDS_MANIFEST),
  });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

describe('RitualScreen 原子动画与确认', () => {
  it('末帧前持续锁定且不向可访问结果泄露币面，槽位与结果 DOM 始终存在', async () => {
    render(<RitualScreen session={preparedSession()} onConfirm={vi.fn()} />);

    const confirm = screen.getByRole('button', { name: '定此爻' });
    const results = document.querySelector<HTMLElement>('.coin-accessible-results');
    expect(confirm).toBeDisabled();
    expect(results).not.toBeNull();
    expect(document.querySelector('.ritual-confirm-slot > .ritual-confirm')).toBe(confirm);
    expect(within(results!).queryByText('字')).not.toBeInTheDocument();
    expect(within(results!).queryByText('背')).not.toBeInTheDocument();
    expect(stage()).toHaveAttribute('aria-label', expect.stringContaining('准备'));

    await waitFor(() => expect(realControllers()).toHaveLength(1));
    act(() => realControllers()[0].complete());
    expect(confirm).toBeEnabled();
    expect(within(results!).getAllByText(/字|背/)).toHaveLength(3);
    expect(stage()).toHaveAttribute('aria-label', expect.stringContaining('已落定'));
  });

  it('rig 就绪前 skip 只挂起，rig 到达后先写 CoinRig 末帧再解锁按钮', async () => {
    sceneHarness.deferReady = true;
    render(<RitualScreen session={preparedSession('skip-before-rig')} onConfirm={vi.fn()} />);
    fireEvent.click(stage());

    const confirm = screen.getByRole('button', { name: '定此爻' });
    expect(confirm).toBeDisabled();
    expect(timelineHarness.controllers).toHaveLength(0);

    await waitFor(() => expect(sceneHarness.callbacks.has('skip-before-rig')).toBe(true));
    act(() => sceneHarness.callbacks.get('skip-before-rig')?.(rig));

    await waitFor(() => expect(confirm).toBeEnabled());
    expect(rig.setProgress).toHaveBeenLastCalledWith(1);
    expect(rig.invalidate).toHaveBeenCalled();
    expect(screen.getByTestId('coin-scene-stub')).toHaveAttribute('data-active', 'false');
  });

  it('相同 faces 的新 tossId 会完整重新锁定，旧完成回调不能解锁新轮', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<RitualScreen session={preparedSession('toss-a')} onConfirm={onConfirm} />);
    await waitFor(() => expect(realControllers()).toHaveLength(1));
    fireEvent.click(stage());
    expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled();

    rerender(<RitualScreen session={preparedSession('toss-b', 2)} onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: '定此爻' })).toBeDisabled();
    await waitFor(() => expect(realControllers()).toHaveLength(2));
    act(() => realControllers()[0].options.onComplete?.());
    expect(screen.getByRole('button', { name: '定此爻' })).toBeDisabled();

    fireEvent.click(stage());
    expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled();
    expect(screen.getByTestId('coin-scene-stub')).toHaveAttribute('data-toss-id', 'toss-b');
  });

  it('正常跨爻更新复用同一 CoinScene/Canvas 实例，不重建 WebGL 上下文', async () => {
    const { rerender } = render(
      <RitualScreen session={preparedSession('stable-canvas-a')} onConfirm={vi.fn()} />,
    );
    await screen.findByTestId('coin-scene-stub');
    await waitFor(() => expect(sceneHarness.mounts).toBe(1));

    rerender(
      <RitualScreen session={preparedSession('stable-canvas-b', 2)} onConfirm={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('coin-scene-stub')).toHaveAttribute(
      'data-toss-id',
      'stable-canvas-b',
    ));

    expect(sceneHarness.mounts).toBe(1);
    expect(sceneHarness.unmounts).toBe(0);
  });

  it('拒绝旧 lazy rig 迟到回调，同一 tick 双击确认只提交一次 expectedTossId', async () => {
    sceneHarness.deferReady = true;
    const onConfirm = vi.fn();
    const { rerender } = render(<RitualScreen session={preparedSession('old-toss')} onConfirm={onConfirm} />);
    await waitFor(() => expect(sceneHarness.callbacks.has('old-toss')).toBe(true));
    const oldReady = sceneHarness.callbacks.get('old-toss')!;

    rerender(<RitualScreen session={preparedSession('new-toss', 2)} onConfirm={onConfirm} />);
    await waitFor(() => expect(sceneHarness.callbacks.has('new-toss')).toBe(true));
    act(() => oldReady(rig));
    expect(realControllers()).toHaveLength(0);
    act(() => sceneHarness.callbacks.get('new-toss')?.(rig));
    await waitFor(() => expect(realControllers()).toHaveLength(1));
    fireEvent.click(stage());

    const confirm = screen.getByRole('button', { name: '定此爻' });
    act(() => {
      fireEvent.click(confirm);
      fireEvent.click(confirm);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('new-toss');
    expect(confirm).toBeDisabled();
  });

  it('reduced motion 仍经统一 controller 同步到末帧', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    render(<RitualScreen session={preparedSession('reduced')} onConfirm={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled());
    expect(timelineHarness.controllers[0].options.reducedMotion).toBe(true);
    expect(rig.setProgress).toHaveBeenLastCalledWith(1);
  });

  it('CoinScene/WebGL 失败时显示真实错误降级并用静态 rig 完成流程', async () => {
    sceneHarness.throwError = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<RitualScreen session={preparedSession('webgl-fallback')} onConfirm={vi.fn()} />);

    expect(await screen.findByRole('status')).toHaveTextContent('静态铜钱');
    const fallbackCoins = Array.from(document.querySelectorAll<HTMLElement>(
      '.coin-static-fallback__coins > span',
    ));
    expect(fallbackCoins).toHaveLength(3);
    expect(fallbackCoins.every((coin) => coin.style.visibility === 'hidden')).toBe(true);
    fireEvent.click(stage());
    await waitFor(() => expect(screen.getByRole('button', { name: '定此爻' })).toBeEnabled());
    expect(fallbackCoins.every((coin) => coin.style.visibility === 'visible')).toBe(true);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('lazy CoinScene 挂起时静态 rig 可 skip/confirm，真实 rig 后到仍同步末帧', async () => {
    sceneHarness.suspend = true;
    const onConfirm = vi.fn();
    render(<RitualScreen session={preparedSession('lazy-pending')} onConfirm={onConfirm} />);

    expect(await screen.findByText(/正在唤醒 3D 铜钱/)).toHaveAttribute('role', 'status');
    fireEvent.click(stage());
    const confirm = await screen.findByRole('button', { name: '定此爻' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('lazy-pending');

    rig.setProgress.mockClear();
    sceneHarness.suspend = false;
    await act(async () => {
      sceneHarness.resolvePending?.();
      await sceneHarness.pending;
    });

    await screen.findByTestId('coin-scene-stub');
    await waitFor(() => expect(rig.setProgress).toHaveBeenLastCalledWith(1));
    expect(confirm).toBeDisabled();
  });
});
