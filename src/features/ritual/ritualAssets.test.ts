import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RITUAL_HANDS_MANIFEST,
  parseRitualHandsManifest,
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
});
