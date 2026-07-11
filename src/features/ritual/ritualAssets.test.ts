import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_RITUAL_HANDS_MANIFEST,
  DEFAULT_RITUAL_HANDS_MANIFEST_URL,
  loadRitualHandsManifest,
  parseRitualHandsManifest,
  resolveRitualAssetUrl,
  resolveRitualHandsManifestUrls,
  type RitualHandsManifest,
} from './ritualAssets';

const common = {
  id: 'test-hands',
  version: 1,
  closedPoster: '/closed.png',
  openPoster: '/open.png',
  width: 2560,
  height: 1440,
  colorSpace: 'srgb' as const,
};

describe('手掌资产 manifest', () => {
  it('默认清单严格使用现有两张静态图和遮挡切镜模式', () => {
    expect(DEFAULT_RITUAL_HANDS_MANIFEST).toEqual({
      id: 'wenyao-ritual-stills-v1',
      version: 1,
      mode: 'still-occlusion-cut',
      closedPoster: '/images/ritual-hands-closed.png',
      openPoster: '/images/ritual-hands.png',
      width: 1672,
      height: 941,
      colorSpace: 'srgb',
      alphaMode: 'none',
    });
  });

  it.each<RitualHandsManifest>([
    { ...common, mode: 'still-occlusion-cut', alphaMode: 'none' },
    {
      ...common,
      mode: 'opaque-video',
      alphaMode: 'none',
      source: '/hands.webm',
      duration: 3.2,
      mimeType: 'video/webm',
    },
    {
      ...common,
      mode: 'alpha-video',
      alphaMode: 'straight',
      source: '/hands-alpha.webm',
      duration: 3.2,
      mimeType: 'video/webm',
    },
    {
      ...common,
      mode: 'image-sequence',
      alphaMode: 'straight',
      frames: ['/frame-0001.png', '/frame-0002.png'],
      frameRate: 24,
    },
  ])('解析并保留 $mode 清单', (manifest) => {
    expect(parseRitualHandsManifest(manifest)).toEqual(manifest);
  });

  it('拒绝缺少视频源、空序列和不匹配的 alpha 声明', () => {
    expect(() => parseRitualHandsManifest({
      ...common,
      mode: 'opaque-video',
      alphaMode: 'none',
      duration: 3.2,
    })).toThrow(/source/);
    expect(() => parseRitualHandsManifest({
      ...common,
      mode: 'image-sequence',
      alphaMode: 'straight',
      frames: [],
      frameRate: 24,
    })).toThrow(/frames/);
    expect(() => parseRitualHandsManifest({
      ...common,
      mode: 'alpha-video',
      alphaMode: 'none',
      source: '/alpha.webm',
      duration: 3.2,
    })).toThrow(/alphaMode/);
  });

  it('从 public manifest URL 加载并解析运行时视频清单', async () => {
    const runtimeManifest: RitualHandsManifest = {
      ...common,
      mode: 'opaque-video',
      alphaMode: 'none',
      source: '/runtime-hands.webm',
      duration: 3.2,
      mimeType: 'video/webm',
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(runtimeManifest),
    });

    const baseUrl = 'https://app.test/ui/index.html';
    await expect(loadRitualHandsManifest({ baseUrl, fetcher })).resolves.toEqual({
      ...runtimeManifest,
      closedPoster: 'https://app.test/ui/closed.png',
      openPoster: 'https://app.test/ui/open.png',
      source: 'https://app.test/ui/runtime-hands.webm',
    });
    expect(fetcher).toHaveBeenCalledWith('https://app.test/ui/ritual/manifest.json', {
      cache: 'no-cache',
    });
  });

  it('public manifest 请求或解析失败时显式回退内置静态清单', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));

    await expect(loadRitualHandsManifest({
      baseUrl: 'https://app.test/ui/index.html',
      fetcher,
    })).resolves.toEqual({
      ...DEFAULT_RITUAL_HANDS_MANIFEST,
      closedPoster: 'https://app.test/ui/images/ritual-hands-closed.png',
      openPoster: 'https://app.test/ui/images/ritual-hands.png',
    });
  });

  it('以 Electron file:// document base 解析 manifest 与所有资产而非 file 根目录', () => {
    const baseUrl = 'file:///C:/Program%20Files/WenYao/resources/app.asar/dist/index.html';

    expect(resolveRitualAssetUrl(DEFAULT_RITUAL_HANDS_MANIFEST_URL, baseUrl)).toBe(
      'file:///C:/Program%20Files/WenYao/resources/app.asar/dist/ritual/manifest.json',
    );
    expect(resolveRitualHandsManifestUrls(DEFAULT_RITUAL_HANDS_MANIFEST, baseUrl)).toEqual({
      ...DEFAULT_RITUAL_HANDS_MANIFEST,
      closedPoster: 'file:///C:/Program%20Files/WenYao/resources/app.asar/dist/images/ritual-hands-closed.png',
      openPoster: 'file:///C:/Program%20Files/WenYao/resources/app.asar/dist/images/ritual-hands.png',
    });
  });
});
