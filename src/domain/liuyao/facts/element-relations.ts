import type { Element } from '../model.js';
import { deepFreeze } from '../rules/tables.js';
import { WENWANG_NAJIA_V2_ARTIFACT } from '../rules/wenwang-najia-v2.js';

export type ElementRelation = 'generates' | 'controls' | 'same-element';

export const ELEMENTS = deepFreeze(['木', '火', '土', '金', '水'] as const satisfies readonly Element[]);

const GENERATES = new Set(
  WENWANG_NAJIA_V2_ARTIFACT.generates.map(({ source, target }) => `${source}:${target}`),
);
const CONTROLS = new Set(
  WENWANG_NAJIA_V2_ARTIFACT.controls.map(({ source, target }) => `${source}:${target}`),
);

export function elementRelation(source: Element, target: Element): ElementRelation | null {
  if (source === target) return 'same-element';
  if (GENERATES.has(`${source}:${target}`)) return 'generates';
  if (CONTROLS.has(`${source}:${target}`)) return 'controls';
  return null;
}
