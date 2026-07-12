import type { DerivedFact } from '../model.js';
import { deepFreeze } from '../rules/tables.js';

export type { DerivedFact } from '../model.js';

export function createFactId(parts: readonly string[]): string {
  return [
    'fact',
    ...parts.map((part) => part.trim().toLowerCase().replaceAll(/\s+/g, '-')),
  ].join(':');
}

export function stableFacts(facts: readonly DerivedFact[]): readonly DerivedFact[] {
  const byId = new Map<string, DerivedFact>();
  for (const fact of facts) {
    if (byId.has(fact.id)) throw new Error('派生事实 ID 冲突');
    byId.set(fact.id, fact);
  }
  const sortedClones = [...byId.values()]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .map((fact) => structuredClone(fact));
  return deepFreeze(sortedClones);
}
