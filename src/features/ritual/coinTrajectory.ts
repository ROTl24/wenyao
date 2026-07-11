import type { CoinFace } from '../../lib/divination';

export type { CoinFace } from '../../lib/divination';

export type Vector3Tuple = readonly [number, number, number];
export type QuaternionTuple = readonly [number, number, number, number];

export interface CoinTrajectoryInput {
  readonly tossId: string;
  readonly visualSeed: string;
  readonly faces: readonly [CoinFace, CoinFace, CoinFace];
  readonly lineIndex: number;
}

export interface CoinTrack {
  readonly coinIndex: 0 | 1 | 2;
  readonly face: CoinFace;
  readonly durationMs: number;
  readonly impactAtMs: number;
  readonly impactProgress: number;
  readonly bounceCount: 2 | 3;
  readonly startPosition: Vector3Tuple;
  readonly firstControlPoint: Vector3Tuple;
  readonly secondControlPoint: Vector3Tuple;
  readonly impactPosition: Vector3Tuple;
  readonly landingPosition: Vector3Tuple;
  readonly spinAxis: Vector3Tuple;
  readonly spinPhase: number;
  readonly spinTurns: number;
  readonly impactQuaternion: QuaternionTuple;
  readonly bounceAxis: Vector3Tuple;
  readonly bounceHeight: number;
  readonly bounceTilt: number;
  readonly wobbleAxis: Vector3Tuple;
  readonly wobbleTilt: number;
}

export interface CoinPose {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  face: CoinFace;
  contact: boolean;
}

const TRACK_DURATION_MS = 1_800;
const FIRST_IMPACT_PROGRESS = 0.72;
const BOUNCE_END_PROGRESS = 0.9;
const MIN_IMPACT_GAP_MS = 60;
const IMPACT_GAP_RANGE_MS = 80;

const TEXT_FINAL_QUATERNION: QuaternionTuple = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const REVERSE_FINAL_QUATERNION: QuaternionTuple = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function randomBetween(random: () => number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * random();
}

function normalizeVector(vector: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(...vector);
  return length === 0
    ? [1, 0, 0]
    : [vector[0] / length, vector[1] / length, vector[2] / length];
}

function quaternionFromAxisAngle(axis: Vector3Tuple, angle: number): QuaternionTuple {
  const halfAngle = angle / 2;
  const scale = Math.sin(halfAngle);
  return [axis[0] * scale, axis[1] * scale, axis[2] * scale, Math.cos(halfAngle)];
}

function normalizeQuaternion(quaternion: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(...quaternion);
  return length === 0
    ? [0, 0, 0, 1]
    : [
      quaternion[0] / length,
      quaternion[1] / length,
      quaternion[2] / length,
      quaternion[3] / length,
    ];
}

function multiplyQuaternions(
  left: QuaternionTuple,
  right: QuaternionTuple,
): QuaternionTuple {
  const [lx, ly, lz, lw] = left;
  const [rx, ry, rz, rw] = right;

  return normalizeQuaternion([
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz,
  ]);
}

function slerpQuaternion(
  start: QuaternionTuple,
  end: QuaternionTuple,
  progress: number,
): QuaternionTuple {
  if (progress <= 0) return start;
  if (progress >= 1) return end;

  let target = end;
  let dot = start[0] * end[0] + start[1] * end[1] + start[2] * end[2] + start[3] * end[3];

  if (dot < 0) {
    dot = -dot;
    target = [-end[0], -end[1], -end[2], -end[3]];
  }

  if (dot > 0.9995) {
    return normalizeQuaternion([
      start[0] + progress * (target[0] - start[0]),
      start[1] + progress * (target[1] - start[1]),
      start[2] + progress * (target[2] - start[2]),
      start[3] + progress * (target[3] - start[3]),
    ]);
  }

  const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
  const denominator = Math.sin(angle);
  const startWeight = Math.sin((1 - progress) * angle) / denominator;
  const endWeight = Math.sin(progress * angle) / denominator;

  return normalizeQuaternion([
    start[0] * startWeight + target[0] * endWeight,
    start[1] * startWeight + target[1] * endWeight,
    start[2] * startWeight + target[2] * endWeight,
    start[3] * startWeight + target[3] * endWeight,
  ]);
}

function finalQuaternion(face: CoinFace): QuaternionTuple {
  return face === 'text' ? TEXT_FINAL_QUATERNION : REVERSE_FINAL_QUATERNION;
}

function createTrack(
  seedMaterial: string,
  coinIndex: 0 | 1 | 2,
  face: CoinFace,
  impactAtMs: number,
): CoinTrack {
  const random = mulberry32(fnv1a(`${seedMaterial}|coin:${coinIndex}`));
  const landingBaseX = [-1.45, 0, 1.45] as const;
  const landingPosition: Vector3Tuple = [
    landingBaseX[coinIndex] + randomBetween(random, -0.12, 0.12),
    0,
    randomBetween(random, -0.38, 0.38),
  ];
  const impactPosition: Vector3Tuple = [
    landingPosition[0] + randomBetween(random, -0.2, 0.2),
    0,
    landingPosition[2] + randomBetween(random, -0.2, 0.2),
  ];
  const startPosition: Vector3Tuple = [
    (coinIndex - 1) * 0.32 + randomBetween(random, -0.08, 0.08),
    randomBetween(random, 0.4, 0.7),
    randomBetween(random, -0.3, -0.08),
  ];
  const firstControlPoint: Vector3Tuple = [
    startPosition[0] + randomBetween(random, -0.45, 0.45),
    startPosition[1] + randomBetween(random, 0.4, 0.5),
    startPosition[2] + randomBetween(random, -0.35, 0.35),
  ];
  const secondControlPoint: Vector3Tuple = [
    impactPosition[0] + randomBetween(random, -0.55, 0.55),
    startPosition[1] + randomBetween(random, 0.3, 0.4),
    impactPosition[2] + randomBetween(random, -0.45, 0.45),
  ];
  const spinAxis = normalizeVector([
    randomBetween(random, -1, 1),
    randomBetween(random, -0.4, 0.4),
    randomBetween(random, -1, 1),
  ]);
  const spinPhase = randomBetween(random, -Math.PI, Math.PI);
  const spinTurns = randomBetween(random, 2.5, 4.5);
  const impactQuaternion = quaternionFromAxisAngle(
    spinAxis,
    spinPhase + spinTurns * Math.PI * 2,
  );

  return {
    coinIndex,
    face,
    durationMs: TRACK_DURATION_MS,
    impactAtMs,
    impactProgress: impactAtMs / TRACK_DURATION_MS,
    bounceCount: random() < 0.5 ? 2 : 3,
    startPosition,
    firstControlPoint,
    secondControlPoint,
    impactPosition,
    landingPosition,
    spinAxis,
    spinPhase,
    spinTurns,
    impactQuaternion,
    bounceAxis: normalizeVector([
      randomBetween(random, -1, 1),
      0,
      randomBetween(random, -1, 1),
    ]),
    bounceHeight: randomBetween(random, 0.32, 0.52),
    bounceTilt: randomBetween(random, 0.18, 0.32),
    wobbleAxis: normalizeVector([
      randomBetween(random, -1, 1),
      0,
      randomBetween(random, -1, 1),
    ]),
    wobbleTilt: randomBetween(random, 0.08, 0.14),
  };
}

export function createCoinTracks(
  input: CoinTrajectoryInput,
): readonly [CoinTrack, CoinTrack, CoinTrack] {
  const seedMaterial = [
    input.tossId,
    input.visualSeed,
    String(input.lineIndex),
    input.faces.join(','),
  ].join('|');
  const staggerRandom = mulberry32(fnv1a(`${seedMaterial}|impact-stagger`));
  const firstImpactAtMs = TRACK_DURATION_MS * FIRST_IMPACT_PROGRESS;
  const secondImpactAtMs =
    firstImpactAtMs + MIN_IMPACT_GAP_MS + staggerRandom() * IMPACT_GAP_RANGE_MS;
  const thirdImpactAtMs =
    secondImpactAtMs + MIN_IMPACT_GAP_MS + staggerRandom() * IMPACT_GAP_RANGE_MS;

  return [
    createTrack(seedMaterial, 0, input.faces[0], firstImpactAtMs),
    createTrack(seedMaterial, 1, input.faces[1], secondImpactAtMs),
    createTrack(seedMaterial, 2, input.faces[2], thirdImpactAtMs),
  ];
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

function cubicBezier(
  start: Vector3Tuple,
  firstControlPoint: Vector3Tuple,
  secondControlPoint: Vector3Tuple,
  end: Vector3Tuple,
  progress: number,
): [number, number, number] {
  const inverse = 1 - progress;
  const startWeight = inverse ** 3;
  const firstWeight = 3 * inverse ** 2 * progress;
  const secondWeight = 3 * inverse * progress ** 2;
  const endWeight = progress ** 3;

  return [
    start[0] * startWeight
      + firstControlPoint[0] * firstWeight
      + secondControlPoint[0] * secondWeight
      + end[0] * endWeight,
    start[1] * startWeight
      + firstControlPoint[1] * firstWeight
      + secondControlPoint[1] * secondWeight
      + end[1] * endWeight,
    start[2] * startWeight
      + firstControlPoint[2] * firstWeight
      + secondControlPoint[2] * secondWeight
      + end[2] * endWeight,
  ];
}

function smoothstep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function flightPose(track: CoinTrack, progress: number): CoinPose {
  const flightProgress = progress / track.impactProgress;
  const spinAngle = track.spinPhase + track.spinTurns * Math.PI * 2 * flightProgress;

  return {
    position: cubicBezier(
      track.startPosition,
      track.firstControlPoint,
      track.secondControlPoint,
      track.impactPosition,
      flightProgress,
    ),
    quaternion: [...quaternionFromAxisAngle(track.spinAxis, spinAngle)],
    face: track.face,
    contact: false,
  };
}

function bouncePose(track: CoinTrack, progress: number): CoinPose {
  const bounceProgress =
    (progress - track.impactProgress) / (BOUNCE_END_PROGRESS - track.impactProgress);
  const travelProgress = smoothstep(bounceProgress);
  const oscillation = Math.sin(Math.PI * track.bounceCount * bounceProgress);
  const height = track.bounceHeight * Math.exp(-2.8 * bounceProgress) * Math.abs(oscillation);
  const baseQuaternion = slerpQuaternion(
    track.impactQuaternion,
    finalQuaternion(track.face),
    travelProgress,
  );
  const tiltQuaternion = quaternionFromAxisAngle(
    track.bounceAxis,
    track.bounceTilt * Math.exp(-3 * bounceProgress) * oscillation,
  );

  return {
    position: [
      lerp(track.impactPosition[0], track.landingPosition[0], travelProgress),
      height,
      lerp(track.impactPosition[2], track.landingPosition[2], travelProgress),
    ],
    quaternion: [...multiplyQuaternions(tiltQuaternion, baseQuaternion)],
    face: track.face,
    contact: true,
  };
}

function wobblePose(track: CoinTrack, progress: number): CoinPose {
  const wobbleProgress =
    (progress - BOUNCE_END_PROGRESS) / (1 - BOUNCE_END_PROGRESS);
  const angle =
    track.wobbleTilt
    * Math.exp(-4 * wobbleProgress)
    * Math.sin(Math.PI * 6 * wobbleProgress);
  const wobbleQuaternion = quaternionFromAxisAngle(track.wobbleAxis, angle);

  return {
    position: [...track.landingPosition],
    quaternion: [...multiplyQuaternions(wobbleQuaternion, finalQuaternion(track.face))],
    face: track.face,
    contact: true,
  };
}

export function sampleCoinTrack(track: CoinTrack, progress: number): CoinPose {
  const clampedProgress = clampProgress(progress);

  if (clampedProgress === 1) {
    return {
      position: [...track.landingPosition],
      quaternion: [...finalQuaternion(track.face)],
      face: track.face,
      contact: true,
    };
  }

  if (clampedProgress < track.impactProgress) return flightPose(track, clampedProgress);
  if (clampedProgress < BOUNCE_END_PROGRESS) return bouncePose(track, clampedProgress);
  return wobblePose(track, clampedProgress);
}
