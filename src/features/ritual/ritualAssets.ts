export type RitualHandsMode =
  | 'still-occlusion-cut'
  | 'opaque-video'
  | 'alpha-video'
  | 'image-sequence';

export type RitualAlphaMode = 'none' | 'straight' | 'premultiplied';

interface RitualHandsManifestBase {
  readonly id: string;
  readonly version: number;
  readonly mode: RitualHandsMode;
  readonly closedPoster: string;
  readonly openPoster: string;
  readonly width: number;
  readonly height: number;
  readonly colorSpace: 'srgb';
  readonly alphaMode: RitualAlphaMode;
}

export interface StillRitualHandsManifest extends RitualHandsManifestBase {
  readonly mode: 'still-occlusion-cut';
  readonly alphaMode: 'none';
}

export interface VideoRitualHandsManifest extends RitualHandsManifestBase {
  readonly mode: 'opaque-video' | 'alpha-video';
  readonly source: string;
  readonly duration: number;
  readonly mimeType?: string;
}

export interface ImageSequenceRitualHandsManifest extends RitualHandsManifestBase {
  readonly mode: 'image-sequence';
  readonly frames: readonly string[];
  readonly frameRate: number;
}

export type RitualHandsManifest =
  | StillRitualHandsManifest
  | VideoRitualHandsManifest
  | ImageSequenceRitualHandsManifest;

export const DEFAULT_RITUAL_HANDS_MANIFEST: StillRitualHandsManifest = {
  id: 'wenyao-ritual-stills-v1',
  version: 1,
  mode: 'still-occlusion-cut',
  closedPoster: '/images/ritual-hands-closed.png',
  openPoster: '/images/ritual-hands.png',
  width: 1672,
  height: 941,
  colorSpace: 'srgb',
  alphaMode: 'none',
};

export const DEFAULT_RITUAL_HANDS_MANIFEST_URL = '/ritual/manifest.json';

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('ritual manifest must be an object');
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

function positiveNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive number`);
  }
  return value;
}

function alphaMode(value: unknown): RitualAlphaMode {
  if (value !== 'none' && value !== 'straight' && value !== 'premultiplied') {
    throw new TypeError('alphaMode must be none, straight, or premultiplied');
  }
  return value;
}

function colorSpace(value: unknown): 'srgb' {
  if (value !== 'srgb') throw new TypeError('colorSpace must be srgb');
  return value;
}

export function parseRitualHandsManifest(value: unknown): RitualHandsManifest {
  const input = record(value);
  const mode = input.mode;
  if (
    mode !== 'still-occlusion-cut'
    && mode !== 'opaque-video'
    && mode !== 'alpha-video'
    && mode !== 'image-sequence'
  ) {
    throw new TypeError('mode must name a supported ritual hands adapter');
  }

  const common = {
    id: nonEmptyString(input.id, 'id'),
    version: positiveNumber(input.version, 'version'),
    mode,
    closedPoster: nonEmptyString(input.closedPoster, 'closedPoster'),
    openPoster: nonEmptyString(input.openPoster, 'openPoster'),
    width: positiveNumber(input.width, 'width'),
    height: positiveNumber(input.height, 'height'),
    colorSpace: colorSpace(input.colorSpace),
    alphaMode: alphaMode(input.alphaMode),
  } as const;

  if (mode === 'still-occlusion-cut') {
    if (common.alphaMode !== 'none') {
      throw new TypeError('alphaMode must be none for still-occlusion-cut');
    }
    return { ...common, mode, alphaMode: 'none' };
  }

  if (mode === 'opaque-video' || mode === 'alpha-video') {
    if (mode === 'opaque-video' && common.alphaMode !== 'none') {
      throw new TypeError('alphaMode must be none for opaque-video');
    }
    if (mode === 'alpha-video' && common.alphaMode === 'none') {
      throw new TypeError('alphaMode must preserve alpha for alpha-video');
    }
    const mimeType = input.mimeType === undefined
      ? undefined
      : nonEmptyString(input.mimeType, 'mimeType');
    return {
      ...common,
      mode,
      source: nonEmptyString(input.source, 'source'),
      duration: positiveNumber(input.duration, 'duration'),
      ...(mimeType === undefined ? {} : { mimeType }),
    };
  }

  if (!Array.isArray(input.frames) || input.frames.length === 0) {
    throw new TypeError('frames must contain at least one image');
  }
  return {
    ...common,
    mode,
    frames: input.frames.map((frame, index) => nonEmptyString(frame, `frames[${index}]`)),
    frameRate: positiveNumber(input.frameRate, 'frameRate'),
  };
}
