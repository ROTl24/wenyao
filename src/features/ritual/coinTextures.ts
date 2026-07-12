import * as THREE from 'three';

export type CoinTextureQuality = 'balanced' | 'high';

export const DEFAULT_COIN_TEXTURE_QUALITY: CoinTextureQuality = 'balanced';

export type QianlongCoinMaterials = [
  THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterial,
  THREE.MeshPhysicalMaterial,
];

export interface QianlongTextureSet {
  readonly textures: readonly THREE.CanvasTexture[];
  readonly baseColorTextures: readonly THREE.CanvasTexture[];
  /** R=高度、G=粗糙度、B=金属度，各通道不再共用同一灰度信号。 */
  readonly surfaceChannelTextures: readonly THREE.CanvasTexture[];
  readonly heightTextures: readonly THREE.CanvasTexture[];
  readonly roughnessTextures: readonly THREE.CanvasTexture[];
  readonly metalnessTextures: readonly THREE.CanvasTexture[];
  /** @deprecated 保留为已有调试代码的兼容别名。 */
  readonly dataTextures: readonly THREE.CanvasTexture[];
  readonly frontMaterial: THREE.MeshPhysicalMaterial;
  readonly reverseMaterial: THREE.MeshPhysicalMaterial;
  readonly edgeMaterial: THREE.MeshPhysicalMaterial;
  readonly materials: QianlongCoinMaterials;
  dispose(): void;
}

/**
 * 程序贴图只用于实时技术预览：正式满文精确字形、微距浮雕与铸造坑蚀仍需
 * 人工校对的 GLB/贴图替换；当前版本非历史精确终稿。
 */
export const QIANLONG_COIN_ASSET_NOTE =
  '程序贴图只用于实时技术预览：正式满文精确字形、微距浮雕与铸造坑蚀仍需人工校对的 GLB/贴图替换；当前版本非历史精确终稿。';

export const QIANLONG_COIN_INSTANCE_VARIANTS = [
  { tint: [1.035, 0.985, 0.92], roughnessScale: 0.96, metalnessScale: 1 },
  { tint: [0.955, 1.01, 0.975], roughnessScale: 1.045, metalnessScale: 0.965 },
  { tint: [1.005, 0.955, 0.89], roughnessScale: 1.01, metalnessScale: 0.985 },
] as const;

type CoinInstanceVariant = (typeof QIANLONG_COIN_INSTANCE_VARIANTS)[number];

type CoinSurface = 'edge' | 'front' | 'reverse';
type TextureChannel = 'baseColor' | 'surfaceChannels';

function resolutionFor(quality: CoinTextureQuality): number {
  return quality === 'high' ? 2048 : 1024;
}

function createGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function seedFor(surface: CoinSurface): number {
  return {
    edge: 0x5b9_20a,
    front: 0x715_2ef,
    reverse: 0x8d3_681,
  }[surface];
}

function paintFaceFoundation(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  const gradient = context.createRadialGradient(
    size * 0.5,
    size * 0.5,
    size * 0.08,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );

  if (channel === 'surfaceChannels') {
    // 打包的线性数据：高度 R、粗糙度 G、金属度 B。
    gradient.addColorStop(0, 'rgb(136, 148, 240)');
    gradient.addColorStop(0.68, 'rgb(128, 164, 232)');
    gradient.addColorStop(1, 'rgb(118, 184, 218)');
  } else {
    // 居中色差只表现铸造材料的含锡差异，不在 baseColor 中烘焙方向光。
    gradient.addColorStop(0, '#8e5727');
    gradient.addColorStop(0.66, '#70431f');
    gradient.addColorStop(1, '#3f2817');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(224, 112, 248)'
    : 'rgba(191, 132, 54, 0.92)';
  context.lineWidth = size * 0.022;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.454, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(202, 126, 244)'
    : 'rgba(160, 100, 39, 0.9)';
  context.lineWidth = size * 0.012;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.423, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(214, 128, 242)'
    : 'rgba(177, 111, 42, 0.88)';
  context.lineWidth = size * 0.026;
  context.strokeRect(size * 0.365, size * 0.365, size * 0.27, size * 0.27);

  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(96, 208, 146)'
    : 'rgba(38, 24, 14, 0.58)';
  context.lineWidth = size * 0.008;
  context.strokeRect(size * 0.354, size * 0.354, size * 0.292, size * 0.292);
}

function paintFrontInscription(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${Math.round(size * 0.14)}px KaiTi, STKaiti, serif`;
  context.lineWidth = size * 0.009;
  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(176, 142, 232)'
    : 'rgba(47, 27, 13, 0.86)';
  context.fillStyle = channel === 'surfaceChannels'
    ? 'rgb(226, 104, 250)'
    : '#a96f2d';

  const inscriptions = [
    ['乾', 0.5, 0.22],
    ['隆', 0.5, 0.78],
    ['通', 0.78, 0.5],
    ['宝', 0.22, 0.5],
  ] as const;
  for (const [character, x, y] of inscriptions) {
    context.strokeText(character, size * x, size * y);
    context.fillText(character, size * x, size * y);
  }
  context.restore();
}

function paintReverseInscription(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `600 ${Math.round(size * 0.12)}px "Mongolian Baiti", KaiTi, STKaiti, serif`;
  context.lineWidth = size * 0.009;
  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgb(174, 144, 230)'
    : 'rgba(44, 26, 13, 0.84)';
  context.fillStyle = channel === 'surfaceChannels'
    ? 'rgb(222, 108, 248)'
    : '#a46b2b';

  // 技术预览字形：正式满文必须由钱币史料与母语字形专家人工校对后替换。
  const inscriptions = [
    ['ᠪᠣᠣ', 0.24],
    ['ᠴᡳᠣᠸᠠᠨ', 0.76],
  ] as const;
  for (const [text, x] of inscriptions) {
    context.save();
    context.translate(size * x, size * 0.5);
    context.rotate(-Math.PI / 2);
    context.strokeText(text, 0, 0);
    context.fillText(text, 0, 0);
    context.restore();
  }
  context.restore();
}

function paintPits(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
  channel: TextureChannel,
): void {
  const random = createGenerator(seed);
  const count = Math.round(size * 0.34);

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const radiusFromCenter = Math.sqrt(random()) * size * 0.45;
    const x = size * 0.5 + Math.cos(angle) * radiusFromCenter;
    const y = size * 0.5 + Math.sin(angle) * radiusFromCenter;
    const radius = (0.45 + random() * 1.85) * (size / 2048);
    const alpha = 0.035 + random() * 0.11;
    context.fillStyle = channel === 'surfaceChannels'
      ? `rgba(${48 + Math.round(random() * 44)}, ${204 + Math.round(random() * 34)}, ${72 + Math.round(random() * 55)}, ${alpha})`
      : `rgba(${30 + Math.round(random() * 34)}, ${25 + Math.round(random() * 27)}, ${16 + Math.round(random() * 18)}, ${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintPatina(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
  channel: TextureChannel,
): void {
  const random = createGenerator(seed);
  const count = 52;

  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = (0.1 + Math.sqrt(random()) * 0.34) * size;
    const x = size * 0.5 + Math.cos(angle) * distance;
    const y = size * 0.5 + Math.sin(angle) * distance;
    const radius = (0.004 + random() * 0.022) * size;
    const alpha = 0.035 + random() * 0.09;
    context.fillStyle = channel === 'surfaceChannels'
      ? `rgba(${70 + Math.round(random() * 36)}, ${218 + Math.round(random() * 30)}, ${62 + Math.round(random() * 54)}, ${alpha})`
      : `rgba(${25 + Math.round(random() * 18)}, ${66 + Math.round(random() * 38)}, ${47 + Math.round(random() * 25)}, ${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintHairlineWear(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
  channel: TextureChannel,
): void {
  const random = createGenerator(seed);
  context.save();
  context.lineCap = 'round';

  for (let index = 0; index < 48; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = (0.08 + random() * 0.34) * size;
    const x = size * 0.5 + Math.cos(angle) * distance;
    const y = size * 0.5 + Math.sin(angle) * distance;
    const length = (0.008 + random() * 0.036) * size;
    const direction = random() * Math.PI * 2;
    context.strokeStyle = channel === 'surfaceChannels'
      ? `rgba(156, ${116 + Math.round(random() * 30)}, 248, ${0.1 + random() * 0.16})`
      : `rgba(218, 166, 79, ${0.045 + random() * 0.09})`;
    context.lineWidth = Math.max(0.6, size * (0.00035 + random() * 0.00045));
    context.beginPath();
    context.moveTo?.(x, y);
    context.lineTo?.(
      x + Math.cos(direction) * length,
      y + Math.sin(direction) * length,
    );
    context.stroke();
  }
  context.restore();
}

function paintEdge(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, size);
  if (channel === 'surfaceChannels') {
    gradient.addColorStop(0, 'rgb(102, 190, 212)');
    gradient.addColorStop(0.5, 'rgb(142, 164, 232)');
    gradient.addColorStop(1, 'rgb(98, 202, 200)');
  } else {
    gradient.addColorStop(0, '#4e2e16');
    gradient.addColorStop(0.5, '#7f4e21');
    gradient.addColorStop(1, '#3d2515');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = channel === 'surfaceChannels'
    ? 'rgba(180, 132, 244, 0.72)'
    : 'rgba(180, 116, 44, 0.28)';
  context.lineWidth = Math.max(1, size * 0.004);
  for (let line = 0; line < 22; line += 1) {
    const y = ((line + 0.5) / 22) * size;
    context.beginPath();
    context.moveTo?.(0, y);
    context.lineTo?.(size, y);
    context.stroke();
  }
}

function createCoinTexture(
  renderer: THREE.WebGLRenderer,
  quality: CoinTextureQuality,
  surface: CoinSurface,
  channel: TextureChannel,
): THREE.CanvasTexture {
  const size = resolutionFor(quality);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('乾隆通宝程序贴图需要 Canvas 2D 上下文');

  if (surface === 'edge') {
    paintEdge(context, size, channel);
  } else {
    paintFaceFoundation(context, size, channel);
    if (surface === 'front') paintFrontInscription(context, size, channel);
    else paintReverseInscription(context, size, channel);
  }

  const seed = seedFor(surface);
  paintPits(context, size, seed ^ 0xa19_44f, channel);
  paintPatina(context, size, seed ^ 0x91a_2d7, channel);
  paintHairlineWear(context, size, seed ^ 0x4c7_1d3, channel);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = channel === 'baseColor'
    ? THREE.SRGBColorSpace
    : THREE.NoColorSpace;
  texture.anisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.name = `QianlongCoin.${surface}.${channel}`;
  if (surface === 'edge') texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function addPerCoinSurfaceVariation(material: THREE.MeshPhysicalMaterial): void {
  let shaderState: {
    uniforms: Record<string, { value: unknown }>;
  } | null = null;
  let activeVariant: CoinInstanceVariant = QIANLONG_COIN_INSTANCE_VARIANTS[0];

  material.onBeforeCompile = (shader) => {
    shader.uniforms.coinTint = {
      value: new THREE.Color().setRGB(
        activeVariant.tint[0],
        activeVariant.tint[1],
        activeVariant.tint[2],
      ),
    };
    shader.uniforms.coinRoughnessScale = { value: activeVariant.roughnessScale };
    shader.uniforms.coinMetalnessScale = { value: activeVariant.metalnessScale };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 coinTint;
uniform float coinRoughnessScale;
uniform float coinMetalnessScale;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
diffuseColor.rgb *= coinTint;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * coinRoughnessScale, 0.04, 1.0);`,
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
metalnessFactor = clamp(metalnessFactor * coinMetalnessScale, 0.0, 1.0);`,
      );
    shaderState = shader;
  };
  material.onBeforeRender = (_renderer, _scene, _camera, _geometry, object) => {
    activeVariant = QIANLONG_COIN_INSTANCE_VARIANTS[
      object.id % QIANLONG_COIN_INSTANCE_VARIANTS.length
    ];
    if (!shaderState) return;
    (shaderState.uniforms.coinTint.value as THREE.Color).setRGB(
      activeVariant.tint[0],
      activeVariant.tint[1],
      activeVariant.tint[2],
    );
    shaderState.uniforms.coinRoughnessScale.value = activeVariant.roughnessScale;
    shaderState.uniforms.coinMetalnessScale.value = activeVariant.metalnessScale;
  };
  material.customProgramCacheKey = () => 'qianlong-per-coin-surface-variation-v1';
  material.userData.coinInstanceVariants = QIANLONG_COIN_INSTANCE_VARIANTS;
}

function createFaceMaterial(
  name: string,
  baseColor: THREE.CanvasTexture,
  surfaceChannels: THREE.CanvasTexture,
  bumpScale: number,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    map: baseColor,
    bumpMap: surfaceChannels,
    bumpScale,
    roughnessMap: surfaceChannels,
    metalnessMap: surfaceChannels,
    metalness: 0.98,
    roughness: 1,
    clearcoat: 0.015,
    clearcoatRoughness: 0.9,
    envMapIntensity: 0.55,
    vertexColors: true,
  });
  material.name = name;
  addPerCoinSurfaceVariation(material);
  return material;
}

export function createQianlongTextureSet(
  renderer: THREE.WebGLRenderer,
  quality: CoinTextureQuality = DEFAULT_COIN_TEXTURE_QUALITY,
): QianlongTextureSet {
  const frontBaseColor = createCoinTexture(renderer, quality, 'front', 'baseColor');
  const frontSurfaceChannels = createCoinTexture(renderer, quality, 'front', 'surfaceChannels');
  const reverseBaseColor = createCoinTexture(renderer, quality, 'reverse', 'baseColor');
  const reverseSurfaceChannels = createCoinTexture(renderer, quality, 'reverse', 'surfaceChannels');
  const edgeBaseColor = createCoinTexture(renderer, quality, 'edge', 'baseColor');
  const edgeSurfaceChannels = createCoinTexture(renderer, quality, 'edge', 'surfaceChannels');

  const frontMaterial = createFaceMaterial(
    'QianlongCoin.FrontMaterial',
    frontBaseColor,
    frontSurfaceChannels,
    0.022,
  );
  const reverseMaterial = createFaceMaterial(
    'QianlongCoin.ReverseMaterial',
    reverseBaseColor,
    reverseSurfaceChannels,
    0.02,
  );
  const edgeMaterial = createFaceMaterial(
    'QianlongCoin.EdgeAndHoleMaterial',
    edgeBaseColor,
    edgeSurfaceChannels,
    0.014,
  );

  const baseColorTextures = [frontBaseColor, reverseBaseColor, edgeBaseColor] as const;
  const surfaceChannelTextures = [
    frontSurfaceChannels,
    reverseSurfaceChannels,
    edgeSurfaceChannels,
  ] as const;
  const textures = [
    frontBaseColor,
    frontSurfaceChannels,
    reverseBaseColor,
    reverseSurfaceChannels,
    edgeBaseColor,
    edgeSurfaceChannels,
  ] as const;
  const materials: QianlongCoinMaterials = [
    frontMaterial,
    reverseMaterial,
    edgeMaterial,
    edgeMaterial,
  ];
  let disposed = false;

  return {
    textures,
    baseColorTextures,
    surfaceChannelTextures,
    heightTextures: surfaceChannelTextures,
    roughnessTextures: surfaceChannelTextures,
    metalnessTextures: surfaceChannelTextures,
    dataTextures: surfaceChannelTextures,
    frontMaterial,
    reverseMaterial,
    edgeMaterial,
    materials,
    dispose() {
      if (disposed) return;
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      frontMaterial.dispose();
      reverseMaterial.dispose();
      edgeMaterial.dispose();
    },
  };
}
