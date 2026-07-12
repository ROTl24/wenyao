import type { Branch, Element, SixRelation, Stem } from '../model.js';

export type TrigramKey = '乾' | '兑' | '离' | '震' | '巽' | '坎' | '艮' | '坤';
export type LinePosition = 1 | 2 | 3 | 4 | 5 | 6;
export type HexagramGeneration = '本宫' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

export interface TrigramNajiaHalf {
  readonly stem: Stem;
  readonly branches: readonly [Branch, Branch, Branch];
}

export interface TrigramRule {
  readonly key: TrigramKey;
  readonly nature: '天' | '泽' | '火' | '雷' | '风' | '水' | '山' | '地';
  readonly element: Element;
  readonly bits: readonly [boolean, boolean, boolean];
  readonly inner: TrigramNajiaHalf;
  readonly outer: TrigramNajiaHalf;
}

export interface HexagramRule {
  readonly key: string;
  readonly name: string;
  readonly shortName: string;
  readonly upperTrigram: TrigramKey;
  readonly lowerTrigram: TrigramKey;
  readonly palace: TrigramKey;
  readonly generation: HexagramGeneration;
  readonly shiLine: LinePosition;
  readonly yingLine: LinePosition;
}

export interface WenwangNajiaArtifact {
  readonly artifactSchema: 'wenwang-najia-structural-tables/v1';
  readonly rulePackId: 'wenwang_najia_v2';
  readonly version: '2.0.0';
  readonly stemElements: readonly { readonly stem: Stem; readonly element: Element }[];
  readonly branchElements: readonly { readonly branch: Branch; readonly element: Element }[];
  readonly generates: readonly { readonly source: Element; readonly target: Element }[];
  readonly controls: readonly { readonly source: Element; readonly target: Element }[];
  readonly relationOrder: readonly SixRelation[];
  readonly trigrams: readonly TrigramRule[];
  readonly hexagrams: readonly HexagramRule[];
  readonly hiddenSpiritPolicy: {
    readonly id: 'missing-visible-relation-from-palace-head-same-position/v1';
    readonly missingFrom: 'base-visible-relations';
    readonly source: 'palace-head-hexagram';
    readonly placement: 'same-line-position';
    readonly status: 'potential';
  };
}

export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical payload 不接受非有限数字');
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => {
          if (entry === undefined) throw new TypeError('canonical payload 不接受 undefined');
          return [key, canonicalize(entry)];
        }),
    );
  }
  throw new TypeError(`canonical payload 不接受 ${typeof value}`);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
