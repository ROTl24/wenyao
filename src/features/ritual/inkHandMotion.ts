export type InkHandSide = 'left' | 'right';

export interface InkHandPose {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
  /** 0 = fully open, 1 = fully curled. */
  readonly curl: number;
}

interface InkHandKeyframe {
  readonly at: number;
  readonly separation: number;
  readonly lift: number;
  readonly depth: number;
  readonly openingAngle: number;
  readonly palmRoll: number;
  readonly scale: number;
  readonly curl: number;
}

// Twelve reviewed story poses: breathing, gathering, compression, anticipation,
// release, overlapping finger opening, sleeve follow-through, and settle.
const KEYFRAMES: readonly InkHandKeyframe[] = [
  { at: 0, separation: 0.56, lift: -0.65, depth: -0.58, openingAngle: 0.03, palmRoll: 0.02, scale: 0.98, curl: 0.78 },
  { at: 0.06, separation: 0.54, lift: -0.61, depth: -0.56, openingAngle: 0.04, palmRoll: 0.02, scale: 1, curl: 0.79 },
  { at: 0.16, separation: 0.5, lift: -0.58, depth: -0.54, openingAngle: 0.05, palmRoll: 0.015, scale: 1.01, curl: 0.82 },
  { at: 0.25, separation: 0.46, lift: -0.56, depth: -0.52, openingAngle: 0.07, palmRoll: 0.01, scale: 0.99, curl: 0.86 },
  { at: 0.34, separation: 0.42, lift: -0.54, depth: -0.5, openingAngle: 0.1, palmRoll: 0.01, scale: 0.95, curl: 0.9 },
  { at: 0.42, separation: 0.48, lift: -0.72, depth: -0.48, openingAngle: -0.03, palmRoll: 0.03, scale: 0.98, curl: 0.92 },
  { at: 0.49, separation: 0.8, lift: -0.34, depth: -0.43, openingAngle: 0.18, palmRoll: 0.045, scale: 1.02, curl: 0.72 },
  { at: 0.58, separation: 1.3, lift: -0.04, depth: -0.38, openingAngle: 0.36, palmRoll: 0.04, scale: 1.035, curl: 0.52 },
  { at: 0.68, separation: 1.82, lift: 0.08, depth: -0.34, openingAngle: 0.52, palmRoll: 0.045, scale: 1.01, curl: 0.32 },
  { at: 0.78, separation: 2.22, lift: 0.15, depth: -0.32, openingAngle: 0.64, palmRoll: 0.05, scale: 1, curl: 0.2 },
  { at: 0.88, separation: 2.52, lift: 0.05, depth: -0.34, openingAngle: 0.72, palmRoll: 0.055, scale: 1.012, curl: 0.16 },
  { at: 1, separation: 2.36, lift: 0, depth: -0.35, openingAngle: 0.62, palmRoll: 0.05, scale: 1, curl: 0.22 },
] as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smootherstep(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function sampleKeyframes(progress: number): InkHandKeyframe {
  const clamped = clamp01(progress);
  if (clamped === 1) return KEYFRAMES[KEYFRAMES.length - 1];

  const endIndex = KEYFRAMES.findIndex((keyframe) => keyframe.at > clamped);
  const end = KEYFRAMES[endIndex];
  const start = KEYFRAMES[Math.max(0, endIndex - 1)];
  const local = smootherstep((clamped - start.at) / (end.at - start.at));

  return {
    at: clamped,
    separation: lerp(start.separation, end.separation, local),
    lift: lerp(start.lift, end.lift, local),
    depth: lerp(start.depth, end.depth, local),
    openingAngle: lerp(start.openingAngle, end.openingAngle, local),
    palmRoll: lerp(start.palmRoll, end.palmRoll, local),
    scale: lerp(start.scale, end.scale, local),
    curl: lerp(start.curl, end.curl, local),
  };
}

export function sampleInkHandPose(side: InkHandSide, progress: number): InkHandPose {
  const keyframe = sampleKeyframes(progress);
  const direction = side === 'left' ? -1 : 1;

  return {
    position: [
      direction * keyframe.separation,
      keyframe.lift,
      keyframe.depth,
    ],
    rotation: [
      0,
      direction * keyframe.palmRoll,
      direction * keyframe.openingAngle,
    ],
    scale: keyframe.scale,
    curl: keyframe.curl,
  };
}

export function inkHandMotionKeyframes(): readonly number[] {
  return KEYFRAMES.map((keyframe) => keyframe.at);
}
