import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InkHands, type InkHandsTargets } from './InkHands';
import {
  DEFAULT_RITUAL_HANDS_MANIFEST,
  DEFAULT_RITUAL_HANDS_MANIFEST_URL,
  type RitualHandsManifest,
} from './ritualAssets';

const common = {
  id: 'render-hands',
  version: 1,
  closedPoster: '/closed.png',
  openPoster: '/open.png',
  width: 2560,
  height: 1440,
  colorSpace: 'srgb' as const,
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(DEFAULT_RITUAL_HANDS_MANIFEST),
  });
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
});

describe('InkHands 可替换资产层', () => {
  it('首爻暴露独立闭手、开手和墨幕 DOM，且初始不产生交叉重影', async () => {
    let targets: InkHandsTargets | null = null;
    render(<InkHands firstLine onReady={(value) => { targets = value; }} />);

    await waitFor(() => expect(targets).not.toBeNull());
    expect(targets!.closedHands).toHaveAttribute(
      'src',
      new URL('images/ritual-hands-closed.png', document.baseURI).href,
    );
    expect(targets!.openHands).toHaveAttribute(
      'src',
      new URL('images/ritual-hands.png', document.baseURI).href,
    );
    expect(targets!.closedHands.style.opacity).toBe('1');
    expect(targets!.openHands.style.opacity).toBe('0');
    expect(targets!.inkCover.style.opacity).toBe('0');
  });

  it('reduced motion 的视频清单不创建 video，也不请求视频 source', async () => {
    const manifest: RitualHandsManifest = {
      ...common,
      mode: 'opaque-video',
      alphaMode: 'none',
      source: '/must-not-load.webm',
      duration: 3.2,
    };
    render(<InkHands firstLine manifest={manifest} reducedMotion />);

    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('[src="/must-not-load.webm"]')).toBeNull();
    expect(screen.getByTestId('ritual-hands-open')).toHaveAttribute('src', '/open.png');
    expect(screen.getByTestId('ritual-hands-closed')).toHaveStyle({ opacity: '0' });
    expect(screen.getByTestId('ritual-hands-open')).toHaveStyle({ opacity: '1' });
  });

  it('序列帧只由时间轴句柄推进，不启动独立播放时钟', async () => {
    vi.useFakeTimers();
    const manifest: RitualHandsManifest = {
      ...common,
      mode: 'image-sequence',
      alphaMode: 'straight',
      frames: ['/frame-1.png', '/frame-2.png', '/frame-3.png'],
      frameRate: 24,
    };
    let targets: InkHandsTargets | null = null;
    render(
      <InkHands
        firstLine={false}
        manifest={manifest}
        onReady={(value) => { targets = value; }}
      />,
    );
    expect(targets).not.toBeNull();

    act(() => targets!.setMediaProgress(1));
    expect(screen.getByTestId('ritual-hands-open')).toHaveAttribute('src', '/frame-3.png');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('未显式传 manifest 时以 public JSON 为主源并真实切换到视频适配器', async () => {
    const runtimeManifest: RitualHandsManifest = {
      ...common,
      mode: 'opaque-video',
      alphaMode: 'none',
      source: '/runtime-from-public.webm',
      duration: 3.2,
      mimeType: 'video/webm',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(runtimeManifest),
    });

    render(<InkHands firstLine={false} />);

    const video = await screen.findByTestId('ritual-hands-open');
    expect(video.tagName).toBe('VIDEO');
    expect(video).toHaveAttribute(
      'src',
      new URL('runtime-from-public.webm', document.baseURI).href,
    );
    expect(video).not.toHaveAttribute('autoplay');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL(DEFAULT_RITUAL_HANDS_MANIFEST_URL.slice(1), document.baseURI).href,
      {
      cache: 'no-cache',
      },
    );
  });
});
