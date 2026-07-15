import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { QIANLONG_FRONT_TEXTURE, QIANLONG_REVERSE_TEXTURE } from '../assets/qianlongTextures';
import type { CoinFace } from '../lib/divination';

export type CoinScenePhase = 'gathering' | 'casting' | 'settling' | 'revealed';

const COIN_RADIUS = 0.78;
const COIN_DEPTH = 0.145;
const HOLE_HALF_SIZE = 0.205;
// ExtrudeGeometry 的倒角会越过名义厚度；面层必须高于倒角顶点才能正确显示钱文。
const FACE_OFFSET = COIN_DEPTH / 2 + 0.017;

const PHYSICAL_COIN_SCALE = 0.72;
const COIN_COLLIDER_RADIUS = COIN_RADIUS * PHYSICAL_COIN_SCALE;
const COIN_COLLIDER_HALF_DEPTH = (COIN_DEPTH * PHYSICAL_COIN_SCALE) / 2;
const PLATE_FLOOR_Y = -1.18;
const PLATE_RADIUS = 3.08;
const CAMERA_CAST_POSITION = new THREE.Vector3(0, 4.55, 8.75);
const CAMERA_REVEAL_POSITION = new THREE.Vector3(0, 3.25, 5.9);
const CAMERA_CAST_TARGET = new THREE.Vector3(0, -0.72, 0.35);
const CAMERA_REVEAL_TARGET = new THREE.Vector3(0, -1.02, 0);

type Vector3Tuple = [number, number, number];

interface CoinLaunch {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  linearVelocity: Vector3Tuple;
  angularVelocity: Vector3Tuple;
}

interface CoinArtProfile {
  body: string;
  edge: string;
  faceTint: string;
  glint: string;
  patina: string;
  patinaSecondary: string;
  rim: string;
  metalness: number;
  patinaOpacity: number;
  roughness: number;
}

const COIN_ART_PROFILES: readonly CoinArtProfile[] = [
  {
    body: '#4e3423',
    edge: '#6f5032',
    faceTint: '#aeb897',
    glint: '#f6d59b',
    patina: '#38584f',
    patinaSecondary: '#76512f',
    rim: '#9a7543',
    metalness: 0.38,
    patinaOpacity: 0.86,
    roughness: 0.84,
  },
  {
    body: '#5d3c20',
    edge: '#835e32',
    faceTint: '#d6b477',
    glint: '#ffe0a1',
    patina: '#53644d',
    patinaSecondary: '#8a542b',
    rim: '#b48a4f',
    metalness: 0.52,
    patinaOpacity: 0.54,
    roughness: 0.66,
  },
  {
    body: '#3f3024',
    edge: '#624b34',
    faceTint: '#9ba68e',
    glint: '#ecc582',
    patina: '#314c48',
    patinaSecondary: '#68452f',
    rim: '#8b693f',
    metalness: 0.42,
    patinaOpacity: 0.82,
    roughness: 0.78,
  },
] as const;

const COIN_TEXTURES = [
  QIANLONG_FRONT_TEXTURE,
  QIANLONG_REVERSE_TEXTURE,
];

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashVisualSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomBetween(random: () => number, min: number, max: number) {
  return min + (max - min) * random();
}

export function createLaunchPlan(visualSeed: string): readonly CoinLaunch[] {
  const random = seededRandom(hashVisualSeed(visualSeed));
  // 纵深和高度共同拉开中心距，在镜头里仍像掌心聚拢，碰撞体却不会在启动帧穿插。
  const origins = [
    [-0.68, 1.18, 2.55],
    [0, 1.58, 3.55],
    [0.68, 1.18, 2.55],
  ] as const;
  const landingCenters = [-0.96, 0, 0.96] as const;

  return origins.map(([originX, originY, originZ], index) => {
    const positionX = originX + randomBetween(random, -0.035, 0.035);
    const positionY = originY + randomBetween(random, -0.035, 0.035);
    const positionZ = originZ + randomBetween(random, -0.045, 0.045);
    const flightTime = randomBetween(random, 1.31, 1.43);
    const landingX = landingCenters[index] + randomBetween(random, -0.2, 0.2);
    const landingZ = randomBetween(random, -0.34, 0.34) + (index === 1 ? 0.24 : -0.12);

    return {
      position: [positionX, positionY, positionZ],
      rotation: [
        randomBetween(random, -0.38, 0.38),
        randomBetween(random, -Math.PI, Math.PI),
        randomBetween(random, -0.42, 0.42),
      ],
      linearVelocity: [
        (landingX - positionX) / flightTime,
        randomBetween(random, 4.08, 4.48) + index * 0.08,
        (landingZ - positionZ) / flightTime,
      ],
      angularVelocity: [
        randomBetween(random, 8.5, 13.5) * (index === 1 ? -1 : 1),
        randomBetween(random, -5.2, 5.2),
        randomBetween(random, 7.2, 12.8) * (index === 2 ? -1 : 1),
      ],
    } satisfies CoinLaunch;
  });
}

function cubicBezierCoordinate(t: number, control1: number, control2: number) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * control1 + 3 * inverse * t * t * control2 + t * t * t;
}

// 将 CSS cubic-bezier(.77, 0, .175, 1) 的时间轴反解为进度，保持镜头运动与界面动效同一节奏。
function cinematicEase(progress: number) {
  let low = 0;
  let high = 1;
  let parameter = progress;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    parameter = (low + high) / 2;
    if (cubicBezierCoordinate(parameter, 0.77, 0.175) < progress) low = parameter;
    else high = parameter;
  }
  return cubicBezierCoordinate(parameter, 0, 1);
}

function createCoinBody(variant: number) {
  const random = seededRandom(0x9e37 + variant * 131);
  const shape = new THREE.Shape();
  const segments = 96;
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    const irregularity = 1 + Math.sin(angle * 5 + variant) * 0.004 + (random() - 0.5) * 0.012;
    const radius = COIN_RADIUS * irregularity;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  const cornerOffsets = Array.from({ length: 4 }, () => (random() - 0.5) * 0.008);
  hole.moveTo(-HOLE_HALF_SIZE + cornerOffsets[0], -HOLE_HALF_SIZE);
  hole.lineTo(-HOLE_HALF_SIZE, HOLE_HALF_SIZE + cornerOffsets[1]);
  hole.lineTo(HOLE_HALF_SIZE + cornerOffsets[2], HOLE_HALF_SIZE);
  hole.lineTo(HOLE_HALF_SIZE, -HOLE_HALF_SIZE + cornerOffsets[3]);
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: COIN_DEPTH,
    steps: 1,
    curveSegments: 96,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.014,
    bevelThickness: 0.012,
  });
  geometry.translate(0, 0, -COIN_DEPTH / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createCoinAlphaMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建乾隆通宝方穿遮罩');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = '#000';
  context.fillRect(95, 95, 66, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function colorWithAlpha(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function createPatinaTexture(variant: number, profile: CoinArtProfile) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建古币铜锈纹理');
  const random = seededRandom(0x51f2 + variant * 701);

  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 34; index += 1) {
    const x = 52 + random() * 408;
    const y = 52 + random() * 408;
    const radius = 18 + random() * 76;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const color = random() > 0.38 ? profile.patina : profile.patinaSecondary;
    gradient.addColorStop(0, colorWithAlpha(color, 0.26 + random() * 0.28));
    gradient.addColorStop(0.5, colorWithAlpha(color, 0.1 + random() * 0.13));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.scale(0.55 + random() * 1.1, 0.42 + random() * 0.7);
    context.translate(-x, -y);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (let index = 0; index < 130; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * 206;
    const x = 256 + Math.cos(angle) * distance;
    const y = 256 + Math.sin(angle) * distance;
    const radius = 0.7 + random() * 3.8;
    const color = random() > 0.28 ? profile.patina : profile.patinaSecondary;
    context.fillStyle = colorWithAlpha(color, 0.08 + random() * 0.32);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function SquareRim({ profile, side }: { profile: CoinArtProfile; side: 1 | -1 }) {
  const z = side * (FACE_OFFSET + 0.007);
  const rotation = side === 1 ? 0 : Math.PI;
  return (
    <group position-z={z} rotation-y={rotation}>
      <mesh position-y={0.226}>
        <boxGeometry args={[0.49, 0.035, 0.022]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.06} />
      </mesh>
      <mesh position-y={-0.226}>
        <boxGeometry args={[0.49, 0.035, 0.022]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.06} />
      </mesh>
      <mesh position-x={0.226}>
        <boxGeometry args={[0.035, 0.49, 0.022]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.06} />
      </mesh>
      <mesh position-x={-0.226}>
        <boxGeometry args={[0.035, 0.49, 0.022]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.06} />
      </mesh>
    </group>
  );
}

function CoinFaceSurface({
  alphaMap,
  patinaTexture,
  profile,
  revealed,
  rubbingMaterial,
  side,
  texture,
}: {
  alphaMap: THREE.Texture;
  patinaTexture: THREE.Texture;
  profile: CoinArtProfile;
  revealed: boolean;
  rubbingMaterial: THREE.MeshBasicMaterial;
  side: 1 | -1;
  texture: THREE.Texture;
}) {
  const rotation = side === 1 ? 0 : Math.PI;
  return (
    <group>
      <mesh position-z={side * FACE_OFFSET} rotation-y={rotation}>
        <circleGeometry args={[COIN_RADIUS - 0.012, 96]} />
        <meshPhysicalMaterial
          map={texture}
          bumpMap={texture}
          alphaMap={alphaMap}
          color={revealed ? profile.faceTint : '#817e70'}
          bumpScale={-0.038}
          roughness={revealed ? profile.roughness : 0.96}
          metalness={revealed ? profile.metalness : 0.12}
          clearcoat={0.08}
          clearcoatRoughness={0.82}
          alphaTest={0.25}
          transparent
        />
      </mesh>
      <mesh position-z={side * (FACE_OFFSET + 0.011)} rotation-y={rotation}>
        <circleGeometry args={[COIN_RADIUS - 0.016, 96]} />
        <meshStandardMaterial
          map={patinaTexture}
          alphaMap={alphaMap}
          transparent
          opacity={profile.patinaOpacity}
          roughness={1}
          metalness={0.08}
          alphaTest={0.025}
          depthWrite={false}
        />
      </mesh>
      <mesh position-z={side * (FACE_OFFSET + 0.017)} rotation-y={rotation} material={rubbingMaterial}>
        <circleGeometry args={[COIN_RADIUS - 0.018, 96]} />
      </mesh>
    </group>
  );
}

function QianlongCoin({
  face,
  index,
  phase,
  scale = PHYSICAL_COIN_SCALE,
  upwardSide = 1,
}: {
  face: CoinFace;
  index: number;
  phase: CoinScenePhase;
  scale?: number;
  upwardSide?: 1 | -1;
}) {
  const glint = useRef<THREE.Group>(null);
  const phaseStartedAt = useRef<number | null>(null);
  const profile = COIN_ART_PROFILES[index];
  const revealed = phase === 'revealed';
  const [frontTexture, reverseTexture] = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return COIN_TEXTURES.map((source) => loader.load(source));
  }, []);
  const body = useMemo(() => createCoinBody(index), [index]);
  const alphaMap = useMemo(createCoinAlphaMask, []);
  const patinaTexture = useMemo(() => createPatinaTexture(index, profile), [index, profile]);
  const sideTextures = useMemo(() => {
    if (!revealed) return [frontTexture, reverseTexture] as const;
    const resultTexture = face === 'text' ? frontTexture : reverseTexture;
    const oppositeTexture = face === 'text' ? reverseTexture : frontTexture;
    return upwardSide === 1
      ? [resultTexture, oppositeTexture] as const
      : [oppositeTexture, resultTexture] as const;
  }, [face, frontTexture, revealed, reverseTexture, upwardSide]);
  const rubbingMaterials = useMemo(() => sideTextures.map((texture) => new THREE.MeshBasicMaterial({
    alphaMap,
    color: '#25302b',
    depthWrite: false,
    map: texture,
    opacity: 0,
    toneMapped: false,
    transparent: true,
  })), [alphaMap, sideTextures]);
  const glintMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: profile.glint,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  }), [profile.glint]);

  useEffect(() => {
    phaseStartedAt.current = null;
  }, [phase]);

  useEffect(() => {
    for (const texture of [frontTexture, reverseTexture]) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
    }
  }, [frontTexture, reverseTexture]);

  useEffect(() => () => {
    body.dispose();
    alphaMap.dispose();
    frontTexture.dispose();
    glintMaterial.dispose();
    patinaTexture.dispose();
    reverseTexture.dispose();
  }, [alphaMap, body, frontTexture, glintMaterial, patinaTexture, reverseTexture]);

  useEffect(() => () => {
    for (const material of rubbingMaterials) material.dispose();
  }, [rubbingMaterials]);

  useFrame((state) => {
    phaseStartedAt.current ??= state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - phaseStartedAt.current;
    if (!revealed) {
      glintMaterial.opacity = 0;
      for (const material of rubbingMaterials) material.opacity = 0.42;
      return;
    }

    const progress = THREE.MathUtils.clamp(elapsed / 0.9, 0, 1);
    glintMaterial.opacity = Math.sin(progress * Math.PI) * (index === 1 ? 0.68 : 0.48);
    for (const material of rubbingMaterials) {
      material.opacity = 0.34 * (1 - THREE.MathUtils.clamp(elapsed / 0.2, 0, 1));
    }
    if (glint.current) glint.current.rotation.z = -1.4 + progress * 2.35 + index * 0.31;
  });

  return (
    <group scale={scale}>
      <mesh geometry={body}>
        <meshPhysicalMaterial
          color={profile.body}
          metalness={profile.metalness}
          roughness={Math.min(1, profile.roughness + 0.08)}
          clearcoat={0.04}
        />
      </mesh>
      <CoinFaceSurface alphaMap={alphaMap} patinaTexture={patinaTexture} profile={profile} revealed={revealed} rubbingMaterial={rubbingMaterials[0]} texture={sideTextures[0]} side={1} />
      <CoinFaceSurface alphaMap={alphaMap} patinaTexture={patinaTexture} profile={profile} revealed={revealed} rubbingMaterial={rubbingMaterials[1]} texture={sideTextures[1]} side={-1} />
      <mesh position-z={FACE_OFFSET + 0.006}>
        <torusGeometry args={[0.726, 0.034, 10, 96]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.08} />
      </mesh>
      <mesh position-z={-(FACE_OFFSET + 0.006)} rotation-y={Math.PI}>
        <torusGeometry args={[0.726, 0.034, 10, 96]} />
        <meshPhysicalMaterial color={profile.rim} metalness={profile.metalness} roughness={profile.roughness} clearcoat={0.08} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.771, 0.012, 7, 96]} />
        <meshStandardMaterial color={profile.edge} metalness={0.34} roughness={0.94} />
      </mesh>
      <SquareRim profile={profile} side={1} />
      <SquareRim profile={profile} side={-1} />
      {index === 1 ? (
        <group rotation-z={2.34}>
          <mesh position-z={FACE_OFFSET + 0.019}>
            <torusGeometry args={[0.724, 0.021, 7, 34, Math.PI * 0.34]} />
            <meshPhysicalMaterial
              color="#8f241d"
              emissive="#45100d"
              emissiveIntensity={0.18}
              metalness={0.12}
              roughness={0.58}
              clearcoat={0.22}
            />
          </mesh>
          <mesh position-z={-(FACE_OFFSET + 0.019)} rotation-y={Math.PI}>
            <torusGeometry args={[0.724, 0.021, 7, 34, Math.PI * 0.34]} />
            <meshPhysicalMaterial
              color="#8f241d"
              emissive="#45100d"
              emissiveIntensity={0.18}
              metalness={0.12}
              roughness={0.58}
              clearcoat={0.22}
            />
          </mesh>
        </group>
      ) : null}
      <group ref={glint}>
        <mesh position-z={FACE_OFFSET + 0.026} material={glintMaterial}>
          <torusGeometry args={[0.727, 0.014, 6, 42, Math.PI * 0.58]} />
        </mesh>
        <mesh position-z={-(FACE_OFFSET + 0.026)} rotation-y={Math.PI} material={glintMaterial}>
          <torusGeometry args={[0.727, 0.014, 6, 42, Math.PI * 0.58]} />
        </mesh>
      </group>
    </group>
  );
}

const PLATE_OUTER_RADIUS_X = 3.46;
const PLATE_OUTER_RADIUS_Z = 3.22;
const PLATE_INNER_RADIUS_X = 3.02;
const PLATE_INNER_RADIUS_Z = 2.82;

function organicPlatePoints(radiusX: number, radiusZ: number, phase: number, clockwise = false) {
  const points = Array.from({ length: 128 }, (_, index) => {
    const progress = index / 128;
    const angle = (clockwise ? -1 : 1) * progress * Math.PI * 2;
    const wobble = 1
      + Math.sin(angle * 3 + phase) * 0.028
      + Math.sin(angle * 5 - phase * 0.7) * 0.014
      + Math.sin(angle * 11 + 0.8) * 0.005;
    return new THREE.Vector2(
      Math.cos(angle) * radiusX * wobble + Math.sin(angle * 2.1 + phase) * 0.035,
      Math.sin(angle) * radiusZ * wobble + Math.cos(angle * 2.7 - phase) * 0.028,
    );
  });
  return points;
}

function closedPlatePath(points: readonly THREE.Vector2[]) {
  const path = new THREE.Path();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return path;
}

function plateShape(radiusX: number, radiusZ: number, phase: number) {
  const shape = new THREE.Shape();
  const points = organicPlatePoints(radiusX, radiusZ, phase);
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  return shape;
}

function plateRingShape(
  outerRadiusX: number,
  outerRadiusZ: number,
  innerRadiusX: number,
  innerRadiusZ: number,
  phase: number,
) {
  const shape = plateShape(outerRadiusX, outerRadiusZ, phase);
  shape.holes.push(closedPlatePath(organicPlatePoints(innerRadiusX, innerRadiusZ, phase + 0.42, true)));
  return shape;
}

function normalizePlateUvs(geometry: THREE.BufferGeometry, radiusX: number, radiusZ: number) {
  const positions = geometry.getAttribute('position');
  const uvs = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index += 1) {
    uvs[index * 2] = THREE.MathUtils.clamp((positions.getX(index) + radiusX) / (radiusX * 2), 0, 1);
    uvs[index * 2 + 1] = THREE.MathUtils.clamp((positions.getY(index) + radiusZ) / (radiusZ * 2), 0, 1);
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

function createMoonGlazeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建玄釉盘纹理');
  const random = seededRandom(0x6a09e667);

  const porcelain = context.createRadialGradient(486, 438, 40, 512, 512, 690);
  porcelain.addColorStop(0, '#d7dbd2');
  porcelain.addColorStop(0.46, '#b9c2b7');
  porcelain.addColorStop(0.76, '#879a8d');
  porcelain.addColorStop(1, '#4e6a5d');
  context.fillStyle = porcelain;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(302, 590);
  context.rotate(-0.26);
  context.scale(1.45, 0.72);
  const inkPool = context.createRadialGradient(0, 0, 12, 0, 0, 292);
  inkPool.addColorStop(0, 'rgba(17, 31, 27, .58)');
  inkPool.addColorStop(0.38, 'rgba(27, 48, 41, .34)');
  inkPool.addColorStop(0.72, 'rgba(40, 61, 51, .12)');
  inkPool.addColorStop(1, 'rgba(40, 61, 51, 0)');
  context.fillStyle = inkPool;
  context.beginPath();
  context.arc(0, 0, 292, 0, Math.PI * 2);
  context.fill();
  context.restore();

  for (let index = 0; index < 18; index += 1) {
    const x = 140 + random() * 560;
    const y = 360 + random() * 390;
    const radius = 34 + random() * 118;
    const wash = context.createRadialGradient(x, y, 0, x, y, radius);
    wash.addColorStop(0, `rgba(20, 42, 35, ${0.035 + random() * 0.07})`);
    wash.addColorStop(1, 'rgba(20, 42, 35, 0)');
    context.fillStyle = wash;
    context.beginPath();
    context.ellipse(x, y, radius * (0.7 + random() * 0.8), radius * (0.35 + random() * 0.45), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  context.save();
  context.globalCompositeOperation = 'multiply';
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(246, 816);
  context.bezierCurveTo(372, 738, 458, 558, 566, 438);
  context.strokeStyle = 'rgba(102, 28, 23, .34)';
  context.lineWidth = 30;
  context.stroke();
  context.beginPath();
  context.moveTo(566, 438);
  context.bezierCurveTo(650, 344, 734, 282, 842, 194);
  context.strokeStyle = 'rgba(102, 28, 23, .28)';
  context.lineWidth = 14;
  context.stroke();
  context.beginPath();
  context.moveTo(270, 806);
  context.bezierCurveTo(398, 704, 474, 548, 578, 426);
  context.bezierCurveTo(670, 320, 744, 270, 828, 204);
  context.strokeStyle = 'rgba(188, 78, 57, .24)';
  context.lineWidth = 5;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = '#526057';
  context.lineWidth = 1;
  for (let branch = 0; branch < 42; branch += 1) {
    let x = random() * canvas.width;
    let y = random() * canvas.height;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 4 + Math.floor(random() * 4); segment += 1) {
      x += (random() - 0.5) * 72;
      y += 26 + random() * 54;
      context.lineTo(x, y);
    }
    context.stroke();
  }
  context.restore();

  context.save();
  context.translate(774, 696);
  context.rotate(0.07);
  context.strokeStyle = 'rgba(116, 29, 24, .72)';
  context.lineWidth = 8;
  context.strokeRect(-46, -46, 92, 92);
  context.beginPath();
  context.moveTo(-26, -22);
  context.lineTo(25, -22);
  context.lineTo(25, 2);
  context.lineTo(-10, 2);
  context.lineTo(-10, 27);
  context.moveTo(-27, 27);
  context.lineTo(27, 27);
  context.stroke();
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function orientPlateGeometry<T extends THREE.BufferGeometry>(geometry: T, y: number) {
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function pushPlateQuad(
  positions: number[],
  first: readonly [number, number, number],
  second: readonly [number, number, number],
  third: readonly [number, number, number],
  fourth: readonly [number, number, number],
) {
  positions.push(...first, ...second, ...third, ...first, ...third, ...fourth);
}

function createSculptedRimGeometry() {
  const outer = organicPlatePoints(PLATE_OUTER_RADIUS_X, PLATE_OUTER_RADIUS_Z, 0.34);
  const inner = organicPlatePoints(PLATE_OUTER_RADIUS_X - 0.22, PLATE_OUTER_RADIUS_Z - 0.18, 0.76);
  const positions: number[] = [];

  // The rear crescent is intentionally the only raised wall: the open foreground
  // keeps the vessel from reading as a heavy tray and frames the settled coins.
  for (let index = 68; index < 124; index += 1) {
    const next = index + 1;
    const outerPoint = outer[index];
    const outerNext = outer[next];
    const innerPoint = inner[index];
    const innerNext = inner[next];
    const topY = (point: THREE.Vector2, pointIndex: number) => {
      const backRise = Math.pow(
        THREE.MathUtils.clamp(-point.y / PLATE_OUTER_RADIUS_Z, 0, 1),
        0.72,
      );
      return PLATE_FLOOR_Y + 0.045 + backRise * 0.19
        + Math.sin((pointIndex / outer.length) * Math.PI * 6) * 0.008;
    };
    const outerTop = [outerPoint.x, topY(outerPoint, index), outerPoint.y] as const;
    const outerTopNext = [outerNext.x, topY(outerNext, next), outerNext.y] as const;
    const innerTop = [innerPoint.x, topY(innerPoint, index) - 0.018, innerPoint.y] as const;
    const innerTopNext = [innerNext.x, topY(innerNext, next) - 0.018, innerNext.y] as const;
    const outerBottom = [outerPoint.x, PLATE_FLOOR_Y - 0.005, outerPoint.y] as const;
    const outerBottomNext = [outerNext.x, PLATE_FLOOR_Y - 0.005, outerNext.y] as const;
    const innerBottom = [innerPoint.x, PLATE_FLOOR_Y + 0.002, innerPoint.y] as const;
    const innerBottomNext = [innerNext.x, PLATE_FLOOR_Y + 0.002, innerNext.y] as const;

    pushPlateQuad(positions, outerTop, outerTopNext, innerTopNext, innerTop);
    pushPlateQuad(positions, outerBottom, outerBottomNext, outerTopNext, outerTop);
    pushPlateQuad(positions, innerBottomNext, innerBottom, innerTop, innerTopNext);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createPlateArt() {
  const base = orientPlateGeometry(new THREE.ExtrudeGeometry(
    plateShape(PLATE_OUTER_RADIUS_X, PLATE_OUTER_RADIUS_Z, 0.34),
    { depth: 0.08, steps: 1, bevelEnabled: true, bevelSegments: 4, bevelSize: 0.045, bevelThickness: 0.02, curveSegments: 96 },
  ), PLATE_FLOOR_Y - 0.125);
  const foot = orientPlateGeometry(new THREE.ExtrudeGeometry(
    plateRingShape(2.56, 2.36, 2.22, 2.04, 1.2),
    { depth: 0.055, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.025, bevelThickness: 0.018, curveSegments: 72 },
  ), PLATE_FLOOR_Y - 0.16);
  const rim = createSculptedRimGeometry();
  const edge = orientPlateGeometry(new THREE.ExtrudeGeometry(
    plateRingShape(
      PLATE_OUTER_RADIUS_X + 0.015,
      PLATE_OUTER_RADIUS_Z + 0.015,
      PLATE_OUTER_RADIUS_X - 0.085,
      PLATE_OUTER_RADIUS_Z - 0.08,
      0.34,
    ),
    { depth: 0.026, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.014, bevelThickness: 0.009, curveSegments: 96 },
  ), PLATE_FLOOR_Y + 0.006);
  const basin = new THREE.ShapeGeometry(plateShape(PLATE_INNER_RADIUS_X + 0.01, PLATE_INNER_RADIUS_Z + 0.01, 0.76), 96);
  normalizePlateUvs(basin, PLATE_INNER_RADIUS_X + 0.01, PLATE_INNER_RADIUS_Z + 0.01);
  orientPlateGeometry(basin, PLATE_FLOOR_Y + 0.018);
  return { base, basin, edge, foot, glazeTexture: createMoonGlazeTexture(), rim };
}

function Plate() {
  const art = useMemo(createPlateArt, []);
  const rimSegments = useMemo(() => Array.from({ length: 18 }, (_, index) => {
    const angle = (index / 18) * Math.PI * 2;
    return {
      angle,
      position: [Math.cos(angle) * PLATE_RADIUS, PLATE_FLOOR_Y + 0.28, Math.sin(angle) * PLATE_RADIUS] as const,
    };
  }), []);

  useEffect(() => () => {
    art.base.dispose();
    art.basin.dispose();
    art.edge.dispose();
    art.foot.dispose();
    art.glazeTexture.dispose();
    art.rim.dispose();
  }, [art]);

  return (
    <RigidBody type="fixed" colliders={false} name="ritual-plate">
      <CylinderCollider
        args={[0.08, PLATE_RADIUS + 0.08]}
        position={[0, PLATE_FLOOR_Y - 0.08, 0]}
        friction={0.9}
        restitution={0.16}
      />
      {rimSegments.map(({ angle, position }, index) => (
        <CuboidCollider
          args={[0.54, 0.34, 0.13]}
          friction={0.86}
          key={index}
          position={position}
          restitution={0.12}
          rotation={[0, Math.PI / 2 - angle, 0]}
        />
      ))}
      <group>
        <mesh geometry={art.foot} receiveShadow>
          <meshPhysicalMaterial color="#24362f" roughness={0.8} metalness={0.02} clearcoat={0.12} clearcoatRoughness={0.7} />
        </mesh>
        <mesh geometry={art.base} receiveShadow>
          <meshPhysicalMaterial color="#4a6054" roughness={0.72} metalness={0.02} clearcoat={0.2} clearcoatRoughness={0.56} />
        </mesh>
        <mesh geometry={art.basin} receiveShadow>
          <meshPhysicalMaterial
            map={art.glazeTexture}
            bumpMap={art.glazeTexture}
            bumpScale={0.018}
            color="#f3f6ef"
            roughness={0.72}
            metalness={0.015}
            clearcoat={0.24}
            clearcoatRoughness={0.54}
          />
        </mesh>
        <mesh geometry={art.rim} receiveShadow>
          <meshPhysicalMaterial
            color="#51695c"
            roughness={0.68}
            metalness={0.015}
            clearcoat={0.2}
            clearcoatRoughness={0.54}
            iridescence={0.05}
            iridescenceIOR={1.24}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh geometry={art.edge} receiveShadow>
          <meshPhysicalMaterial
            color="#52695c"
            roughness={0.68}
            metalness={0.01}
            clearcoat={0.18}
            clearcoatRoughness={0.58}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}

function CameraRig({ phase, reducedMotion }: { phase: CoinScenePhase; reducedMotion: boolean }) {
  const camera = useThree((state) => state.camera);
  const revealStartedAt = useRef<number | null>(null);
  const target = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    revealStartedAt.current = null;
  }, [phase]);

  useFrame((state) => {
    if (phase !== 'revealed') {
      camera.position.copy(CAMERA_CAST_POSITION);
      camera.lookAt(CAMERA_CAST_TARGET);
      return;
    }

    if (reducedMotion) {
      camera.position.copy(CAMERA_REVEAL_POSITION);
      camera.lookAt(CAMERA_REVEAL_TARGET);
      return;
    }

    revealStartedAt.current ??= state.clock.elapsedTime;
    const progress = THREE.MathUtils.clamp((state.clock.elapsedTime - revealStartedAt.current) / 0.9, 0, 1);
    const eased = cinematicEase(progress);
    camera.position.lerpVectors(CAMERA_CAST_POSITION, CAMERA_REVEAL_POSITION, eased);
    target.lerpVectors(CAMERA_CAST_TARGET, CAMERA_REVEAL_TARGET, eased);
    camera.lookAt(target);
  });

  return null;
}

function PhysicalCoin({
  face,
  index,
  launch,
  onCollision,
  onSleep,
  phase,
}: {
  face: CoinFace;
  index: number;
  launch: CoinLaunch;
  onCollision(): void;
  onSleep(index: number): void;
  phase: CoinScenePhase;
}) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const collisionObserved = useRef(false);
  const sleepReported = useRef(false);
  const [upwardSide, setUpwardSide] = useState<1 | -1>(1);

  const handleSleep = useCallback(() => {
    if (sleepReported.current) return;
    sleepReported.current = true;
    const rotation = rigidBody.current?.rotation();
    if (rotation) {
      const orientation = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      const positiveFaceNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation);
      setUpwardSide(positiveFaceNormal.y >= 0 ? 1 : -1);
    }
    onSleep(index);
  }, [index, onSleep]);

  const handleCollision = useCallback(() => {
    const body = rigidBody.current;
    if (body) {
      collisionObserved.current = true;
      // 空中保留低阻尼的翻飞；首次接触后模拟盘面与古币粗糙表面的快速耗能，避免互相斜靠时长期微颤。
      body.setLinearDamping(0.9);
      body.setAngularDamping(3);
    }
    onCollision();
  }, [onCollision]);

  useFrame(() => {
    const body = rigidBody.current;
    if (!body || !collisionObserved.current || body.isSleeping() || sleepReported.current) return;
    const linearVelocity = body.linvel();
    const angularVelocity = body.angvel();
    const linearEnergy = linearVelocity.x ** 2 + linearVelocity.y ** 2 + linearVelocity.z ** 2;
    const angularEnergy = angularVelocity.x ** 2 + angularVelocity.y ** 2 + angularVelocity.z ** 2;
    if (linearEnergy > 0.0144 || angularEnergy > 0.09) return;

    // 接触求解器可能在视觉静止后保留极小抖动；以不可感知的物理能量阈值结束刚体，而不是按时间揭晓。
    body.sleep();
    handleSleep();
  });

  return (
    <RigidBody
      ref={rigidBody}
      type="dynamic"
      colliders={false}
      position={launch.position}
      rotation={launch.rotation}
      linearVelocity={launch.linearVelocity}
      angularVelocity={launch.angularVelocity}
      linearDamping={0.18}
      angularDamping={0.42}
      ccd
      canSleep
      onCollisionEnter={handleCollision}
      onSleep={handleSleep}
    >
      <CylinderCollider
        args={[COIN_COLLIDER_HALF_DEPTH, COIN_COLLIDER_RADIUS]}
        friction={0.82}
        restitution={0.16}
      />
      <group rotation-x={-Math.PI / 2}>
        <QianlongCoin face={face} index={index} phase={phase} upwardSide={upwardSide} />
      </group>
    </RigidBody>
  );
}

function PhysicalThrow({
  faces,
  onSettled,
  onSettling,
  phase,
  visualSeed,
}: CoinSceneProps) {
  const launchPlan = useMemo(() => createLaunchPlan(visualSeed), [visualSeed]);
  const sleepingCoins = useRef(new Set<number>());
  const settledReported = useRef(false);
  const settlingReported = useRef(false);

  useEffect(() => {
    sleepingCoins.current.clear();
    settledReported.current = false;
    settlingReported.current = false;
  }, [visualSeed]);

  const handleCollision = useCallback(() => {
    if (settlingReported.current) return;
    settlingReported.current = true;
    onSettling?.();
  }, [onSettling]);

  const handleSleep = useCallback((index: number) => {
    if (settledReported.current || sleepingCoins.current.has(index)) return;
    sleepingCoins.current.add(index);
    if (sleepingCoins.current.size !== faces.length) return;
    settledReported.current = true;
    onSettled();
  }, [faces.length, onSettled]);

  return (
    <Physics gravity={[0, -8.8, 0]} timeStep={1 / 60} colliders={false} paused={phase === 'gathering' || phase === 'revealed'} maxCcdSubsteps={4}>
      <Plate />
      {faces.map((face, index) => (
        <PhysicalCoin
          face={face}
          index={index}
          key={index}
          launch={launchPlan[index]}
          onCollision={handleCollision}
          onSleep={handleSleep}
          phase={phase}
        />
      ))}
    </Physics>
  );
}

function ReducedMotionResults({ faces }: { faces: readonly CoinFace[] }) {
  const positions = [
    [-1.18, PLATE_FLOOR_Y + 0.12, 0.18] as const,
    [0.02, PLATE_FLOOR_Y + 0.13, -0.22] as const,
    [1.2, PLATE_FLOOR_Y + 0.12, 0.24] as const,
  ];
  return faces.map((face, index) => (
    <group key={index} position={positions[index]} rotation={[-Math.PI / 2, 0, (index - 1) * 0.18]}>
      <QianlongCoin face={face} index={index} phase="revealed" upwardSide={1} />
    </group>
  ));
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
}

interface CoinSceneProps {
  faces: readonly CoinFace[];
  phase: CoinScenePhase;
  visualSeed: string;
  onSettled(): void;
  onSettling?(): void;
}

export default function CoinScene({ faces, onSettled, onSettling, phase, visualSeed }: CoinSceneProps) {
  const reducedMotion = usePrefersReducedMotion();
  if (import.meta.env.MODE === 'test') {
    return <div className={`coin-test-stage coin-test-stage--${phase}`}>{faces.map((face, index) => <span key={index}>{face}</span>)}</div>;
  }
  return (
    <Canvas
      className="coin-canvas"
      camera={{ position: CAMERA_CAST_POSITION.toArray(), fov: 36 }}
      dpr={[1, 1.35]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <ambientLight intensity={0.5} color="#e7ebe3" />
      <hemisphereLight color="#fff3dc" groundColor="#28332e" intensity={0.76} />
      <directionalLight position={[4.9, 7.2, 5.8]} intensity={3.35} color="#f6ead3" />
      <directionalLight position={[-4.6, 1.8, 3.2]} intensity={0.72} color="#74877b" />
      <pointLight position={[0.4, -0.2, 4.6]} intensity={1.1} distance={9} color="#c5854f" />
      <CameraRig phase={phase} reducedMotion={reducedMotion} />
      {reducedMotion ? (
        <>
          <Physics gravity={[0, -8.8, 0]} timeStep={1 / 60} colliders={false} paused>
            <Plate />
          </Physics>
          <ReducedMotionResults faces={faces} />
        </>
      ) : (
        <PhysicalThrow faces={faces} onSettled={onSettled} onSettling={onSettling} phase={phase} visualSeed={visualSeed} />
      )}
    </Canvas>
  );
}
