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

type CoinSurface = 'edge' | 'front' | 'reverse';
type TextureChannel = 'baseColor' | 'surfaceData';

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

function seedFor(surface: CoinSurface, channel: TextureChannel): number {
  return {
    edge: { baseColor: 0x5b9_20a, surfaceData: 0xa19_44f },
    front: { baseColor: 0x715_2ef, surfaceData: 0xc41_8a3 },
    reverse: { baseColor: 0x8d3_681, surfaceData: 0xe57_2b9 },
  }[surface][channel];
}

function paintPits(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
  dataTexture: boolean,
): void {
  const random = createGenerator(seed);
  const count = Math.round(size * 0.52);

  for (let index = 0; index < count; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = (0.35 + random() * 1.8) * (size / 2048);
    const alpha = 0.025 + random() * 0.1;
    context.fillStyle = dataTexture
      ? `rgba(${80 + Math.round(random() * 90)}, ${80 + Math.round(random() * 90)}, ${80 + Math.round(random() * 90)}, ${alpha})`
      : `rgba(${35 + Math.round(random() * 45)}, ${48 + Math.round(random() * 45)}, ${24 + Math.round(random() * 28)}, ${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintOxidation(
  context: CanvasRenderingContext2D,
  size: number,
  seed: number,
): void {
  const random = createGenerator(seed);
  const count = 58;

  for (let index = 0; index < count; index += 1) {
    const x = (0.12 + random() * 0.76) * size;
    const y = (0.12 + random() * 0.76) * size;
    const radius = (0.003 + random() * 0.022) * size;
    context.fillStyle = `rgba(${28 + Math.round(random() * 20)}, ${73 + Math.round(random() * 42)}, ${55 + Math.round(random() * 28)}, ${0.025 + random() * 0.1})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function paintFaceFoundation(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  const dataTexture = channel === 'surfaceData';
  const gradient = context.createRadialGradient(
    size * 0.37,
    size * 0.31,
    size * 0.04,
    size * 0.5,
    size * 0.5,
    size * 0.5,
  );
  if (dataTexture) {
    gradient.addColorStop(0, '#c3c3c3');
    gradient.addColorStop(0.62, '#999999');
    gradient.addColorStop(1, '#6f6f6f');
  } else {
    gradient.addColorStop(0, '#d6ae60');
    gradient.addColorStop(0.32, '#a97432');
    gradient.addColorStop(0.76, '#71461f');
    gradient.addColorStop(1, '#392615');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = dataTexture ? '#d8d8d8' : 'rgba(231, 192, 105, 0.58)';
  context.lineWidth = size * 0.018;
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = dataTexture ? '#555555' : 'rgba(35, 20, 10, 0.72)';
  context.lineWidth = size * 0.028;
  context.strokeRect(size * 0.365, size * 0.365, size * 0.27, size * 0.27);
}

function paintFrontInscription(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${Math.round(size * 0.135)}px KaiTi, STKaiti, serif`;
  context.lineWidth = size * 0.006;
  context.strokeStyle = channel === 'surfaceData' ? '#e7e7e7' : 'rgba(218, 170, 79, 0.5)';
  context.fillStyle = channel === 'surfaceData' ? '#f4f4f4' : '#2d1a0d';

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
  context.font = `600 ${Math.round(size * 0.074)}px "Mongolian Baiti", KaiTi, STKaiti, serif`;
  context.lineWidth = size * 0.004;
  context.strokeStyle = channel === 'surfaceData' ? '#e5e5e5' : 'rgba(212, 163, 74, 0.5)';
  context.fillStyle = channel === 'surfaceData' ? '#f2f2f2' : '#2b190c';

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

function paintEdge(
  context: CanvasRenderingContext2D,
  size: number,
  channel: TextureChannel,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, size);
  if (channel === 'surfaceData') {
    gradient.addColorStop(0, '#696969');
    gradient.addColorStop(0.5, '#b4b4b4');
    gradient.addColorStop(1, '#656565');
  } else {
    gradient.addColorStop(0, '#503116');
    gradient.addColorStop(0.5, '#9b672d');
    gradient.addColorStop(1, '#432813');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = channel === 'surfaceData' ? '#cbcbcb' : 'rgba(221, 171, 80, 0.32)';
  context.lineWidth = Math.max(1, size * 0.004);
  for (let line = 0; line < 18; line += 1) {
    const y = ((line + 0.5) / 18) * size;
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

  if (surface === 'edge') paintEdge(context, size, channel);
  else {
    paintFaceFoundation(context, size, channel);
    if (surface === 'front') paintFrontInscription(context, size, channel);
    else paintReverseInscription(context, size, channel);
  }

  const seed = seedFor(surface, channel);
  paintPits(context, size, seed, channel === 'surfaceData');
  if (channel === 'baseColor') paintOxidation(context, size, seed ^ 0x91a_2d7);

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

export function createQianlongTextureSet(
  renderer: THREE.WebGLRenderer,
  quality: CoinTextureQuality = DEFAULT_COIN_TEXTURE_QUALITY,
): QianlongTextureSet {
  const frontBaseColor = createCoinTexture(renderer, quality, 'front', 'baseColor');
  const frontSurfaceData = createCoinTexture(renderer, quality, 'front', 'surfaceData');
  const reverseBaseColor = createCoinTexture(renderer, quality, 'reverse', 'baseColor');
  const reverseSurfaceData = createCoinTexture(renderer, quality, 'reverse', 'surfaceData');
  const edgeBaseColor = createCoinTexture(renderer, quality, 'edge', 'baseColor');
  const edgeSurfaceData = createCoinTexture(renderer, quality, 'edge', 'surfaceData');

  const frontMaterial = new THREE.MeshPhysicalMaterial({
    map: frontBaseColor,
    bumpMap: frontSurfaceData,
    bumpScale: 0.028,
    roughnessMap: frontSurfaceData,
    metalness: 0.94,
    roughness: 0.46,
    clearcoat: 0.06,
    clearcoatRoughness: 0.68,
    vertexColors: true,
  });
  const reverseMaterial = new THREE.MeshPhysicalMaterial({
    map: reverseBaseColor,
    bumpMap: reverseSurfaceData,
    bumpScale: 0.026,
    roughnessMap: reverseSurfaceData,
    metalness: 0.92,
    roughness: 0.52,
    clearcoat: 0.04,
    clearcoatRoughness: 0.72,
    vertexColors: true,
  });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    map: edgeBaseColor,
    bumpMap: edgeSurfaceData,
    bumpScale: 0.018,
    roughnessMap: edgeSurfaceData,
    metalness: 0.9,
    roughness: 0.64,
    vertexColors: true,
  });
  frontMaterial.name = 'QianlongCoin.FrontMaterial';
  reverseMaterial.name = 'QianlongCoin.ReverseMaterial';
  edgeMaterial.name = 'QianlongCoin.EdgeAndHoleMaterial';

  const textures = [
    frontBaseColor,
    frontSurfaceData,
    reverseBaseColor,
    reverseSurfaceData,
    edgeBaseColor,
    edgeSurfaceData,
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
    baseColorTextures: [frontBaseColor, reverseBaseColor, edgeBaseColor],
    dataTextures: [frontSurfaceData, reverseSurfaceData, edgeSurfaceData],
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
