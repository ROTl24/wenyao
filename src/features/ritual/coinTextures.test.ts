import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QIANLONG_COIN_ASSET_NOTE,
  createQianlongTextureSet,
} from './coinTextures';

const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
const context = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  createLinearGradient: vi.fn(() => gradient),
  createRadialGradient: vi.fn(() => gradient),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  strokeText: vi.fn(),
  translate: vi.fn(),
} as unknown as CanvasRenderingContext2D;

const getContext = vi
  .spyOn(HTMLCanvasElement.prototype, 'getContext')
  .mockImplementation(() => context);

afterEach(() => {
  getContext.mockClear();
});

describe('乾隆通宝程序纹理', () => {
  it('高质量正反面为 2K，颜色贴图使用 sRGB、数据贴图保持线性并取设备最大各向异性', () => {
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 12 },
    } as unknown as THREE.WebGLRenderer;
    const set = createQianlongTextureSet(renderer, 'high');

    expect(set.textures.every((texture) => texture.image.width === 2048)).toBe(true);
    expect(set.baseColorTextures.every(
      (texture) => texture.colorSpace === THREE.SRGBColorSpace,
    )).toBe(true);
    expect(set.dataTextures.every(
      (texture) => texture.colorSpace === THREE.NoColorSpace,
    )).toBe(true);
    expect(set.textures.every((texture) => texture.anisotropy === 12)).toBe(true);
    set.dispose();
  });

  it('默认使用 1K balanced，6 张 RGBA8 含 4/3 mip 的预算明显低于 128MiB', () => {
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 8 },
    } as unknown as THREE.WebGLRenderer;
    const set = createQianlongTextureSet(renderer);
    const rgba8BytesWithMipmaps = set.textures.reduce(
      (bytes, texture) => bytes + texture.image.width * texture.image.height * 4 * (4 / 3),
      0,
    );

    expect(set.textures.every((texture) => texture.image.width === 1024)).toBe(true);
    expect(rgba8BytesWithMipmaps).toBeCloseTo(32 * 1024 * 1024, 5);
    expect(rgba8BytesWithMipmaps).toBeLessThan(128 * 1024 * 1024);
    set.dispose();
  });

  it('边缘颜色与数据纹理允许展开后的 U 重复采样', () => {
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 8 },
    } as unknown as THREE.WebGLRenderer;
    const set = createQianlongTextureSet(renderer, 'balanced');
    const edgeTextures = set.textures.filter((texture) => texture.name.includes('.edge.'));

    expect(edgeTextures).toHaveLength(2);
    edgeTextures.forEach((texture) => expect(texture.wrapS).toBe(THREE.RepeatWrapping));
    set.dispose();
  });

  it('材质满足铜质 PBR 范围、无 emissive，孔壁复用边缘材质且资源只释放一次', () => {
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 8 },
    } as unknown as THREE.WebGLRenderer;
    const set = createQianlongTextureSet(renderer, 'high');
    const disposals = [
      ...set.textures.map((texture) => vi.spyOn(texture, 'dispose')),
      ...[set.frontMaterial, set.reverseMaterial, set.edgeMaterial]
        .map((material) => vi.spyOn(material, 'dispose')),
    ];

    for (const material of [set.frontMaterial, set.reverseMaterial, set.edgeMaterial]) {
      expect(material.metalness).toBeGreaterThanOrEqual(0.88);
      expect(material.metalness).toBeLessThanOrEqual(0.96);
      expect(material.roughness).toBeGreaterThanOrEqual(0.38);
      expect(material.roughness).toBeLessThanOrEqual(0.72);
      expect(material.emissive.getHex()).toBe(0);
      expect(material.emissiveMap).toBeNull();
    }
    expect(set.materials).toEqual([
      set.frontMaterial,
      set.reverseMaterial,
      set.edgeMaterial,
      set.edgeMaterial,
    ]);

    set.dispose();
    set.dispose();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
  });

  it('明确标记程序资产不是历史精确终稿', () => {
    expect(QIANLONG_COIN_ASSET_NOTE).toMatch(/正式满文/);
    expect(QIANLONG_COIN_ASSET_NOTE).toMatch(/微距浮雕/);
    expect(QIANLONG_COIN_ASSET_NOTE).toMatch(/铸造坑蚀/);
    expect(QIANLONG_COIN_ASSET_NOTE).toMatch(/人工校对.*GLB|GLB.*人工校对/);
    expect(QIANLONG_COIN_ASSET_NOTE).toMatch(/非历史精确终稿/);
  });
});
