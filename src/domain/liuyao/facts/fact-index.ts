import type {
  DerivedFact,
  EntityRef,
  FactRelation,
} from '../model.js';
import type { RuleAuthority } from '../rules/model.js';
import { deepFreeze } from '../rules/tables.js';
import { strictCanonicalStringify } from '../canonical.js';

const FACT_RELATIONS = {
  generates: true,
  controls: true,
  'same-element': true,
  clashes: true,
  combines: true,
  punishes: true,
  harms: true,
  breaks: true,
  'has-month-status': true,
  'is-void': true,
  'is-month-break': true,
  'is-day-break': true,
  'is-dark-moving': true,
  'returns-generate': true,
  'returns-control': true,
  'returns-clash': true,
  'returns-combine': true,
  advances: true,
  retreats: true,
  'changes-to-tomb': true,
  'changes-to-absolute': true,
  'forms-three-harmony': true,
  'has-three-harmony-candidate': true,
  'is-six-harmony': true,
  'is-six-clash': true,
  'is-fan-yin': true,
  'is-fu-yin': true,
  'is-growth-stage': true,
  'is-six-beast': true,
  'is-shen-sha': true,
  'is-source-spirit': true,
  'is-avoid-spirit': true,
  'is-enemy-spirit': true,
  'flying-generates-hidden': true,
  'flying-controls-hidden': true,
  'hidden-generates-flying': true,
  'hidden-controls-flying': true,
  'holds-shi': true,
  'holds-ying': true,
} as const satisfies Record<FactRelation, true>;

const FACT_SCOPES = {
  calendar: true,
  base: true,
  changed: true,
  transition: true,
  formation: true,
  'use-god': true,
  auxiliary: true,
} as const satisfies Record<DerivedFact['scope'], true>;

const AUTHORITIES = {
  structural: true,
  'profile-dependent': true,
  secondary: true,
} as const satisfies Record<RuleAuthority, true>;

const CERTAINTIES = {
  computed: true,
  conditional: true,
  disputed: true,
} as const satisfies Record<DerivedFact['certainty'], true>;

const FACT_KEYS = new Set([
  'id', 'relation', 'source', 'target', 'scope', 'authority', 'ruleId',
  'profileId', 'certainty', 'conditions', 'values', 'sourceRefs',
]);

export interface CaseFactIndex {
  readonly byId: Readonly<Record<string, DerivedFact>>;
  readonly byEntity: Readonly<Record<string, readonly DerivedFact[]>>;
  /** Alias retained for callers that name the normalized entity key explicitly. */
  readonly byEntityId: Readonly<Record<string, readonly DerivedFact[]>>;
  readonly byRelation: Readonly<Record<string, readonly DerivedFact[]>>;
  readonly byScope: Readonly<Record<string, readonly DerivedFact[]>>;
  readonly byAuthority: Readonly<Record<string, readonly DerivedFact[]>>;
  readonly byRuleId: Readonly<Record<string, readonly DerivedFact[]>>;
}

function reject(): never {
  throw new TypeError('事实索引输入无效');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === required.length
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function assertEntityRef(value: unknown): asserts value is EntityRef {
  if (!isRecord(value) || typeof value.type !== 'string') reject();
  switch (value.type) {
    case 'pillar':
      if (
        !hasExactKeys(value, ['type', 'id'])
        || !['year', 'month', 'day', 'hour'].includes(value.id as string)
      ) reject();
      return;
    case 'hexagram':
      if (
        !hasExactKeys(value, ['type', 'id'])
        || (value.id !== 'base' && value.id !== 'changed')
      ) reject();
      return;
    case 'line':
      if (
        !hasExactKeys(value, ['type', 'id', 'side'])
        || !isNonEmptyString(value.id)
        || (value.side !== 'base' && value.side !== 'changed')
      ) reject();
      return;
    case 'hidden-spirit':
      if (!hasExactKeys(value, ['type', 'id']) || !isNonEmptyString(value.id)) reject();
      return;
    case 'use-god':
      if (!hasExactKeys(value, ['type', 'id']) || value.id !== 'primary') reject();
      return;
    default:
      reject();
  }
}

function assertFactValues(value: unknown): void {
  if (!isRecord(value)) reject();
  for (const entry of Object.values(value)) {
    if (
      typeof entry === 'string'
      || typeof entry === 'boolean'
      || (typeof entry === 'number' && Number.isFinite(entry))
      || isStringArray(entry)
    ) continue;
    reject();
  }
}

function assertFact(value: unknown): asserts value is DerivedFact {
  if (!isRecord(value)) reject();
  const keys = Object.keys(value);
  const expectedLength = Object.prototype.hasOwnProperty.call(value, 'target') ? 12 : 11;
  if (keys.length !== expectedLength || keys.some((key) => !FACT_KEYS.has(key))) reject();
  if (
    !isNonEmptyString(value.id)
    || typeof value.relation !== 'string'
    || !Object.prototype.hasOwnProperty.call(FACT_RELATIONS, value.relation)
    || typeof value.scope !== 'string'
    || !Object.prototype.hasOwnProperty.call(FACT_SCOPES, value.scope)
    || typeof value.authority !== 'string'
    || !Object.prototype.hasOwnProperty.call(AUTHORITIES, value.authority)
    || typeof value.certainty !== 'string'
    || !Object.prototype.hasOwnProperty.call(CERTAINTIES, value.certainty)
    || !isNonEmptyString(value.ruleId)
    || !isNonEmptyString(value.profileId)
    || !isStringArray(value.conditions)
    || !isStringArray(value.sourceRefs)
  ) reject();
  assertEntityRef(value.source);
  if (Object.prototype.hasOwnProperty.call(value, 'target')) assertEntityRef(value.target);
  assertFactValues(value.values);
}

function ownedFacts(input: unknown): DerivedFact[] {
  let clone: unknown;
  try {
    clone = JSON.parse(strictCanonicalStringify(input));
  } catch {
    reject();
  }
  if (!Array.isArray(clone)) reject();
  clone.forEach(assertFact);
  return clone.sort((left, right) => (
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  ));
}

function nullRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function freezeBuckets(source: Map<string, DerivedFact[]>): Readonly<Record<string, readonly DerivedFact[]>> {
  const result = nullRecord<readonly DerivedFact[]>();
  for (const key of [...source.keys()].sort()) {
    result[key] = deepFreeze([...source.get(key)!].sort((left, right) => (
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0
    )));
  }
  return Object.freeze(result);
}

function pushBucket(target: Map<string, DerivedFact[]>, key: string, fact: DerivedFact): void {
  const bucket = target.get(key);
  if (bucket) bucket.push(fact);
  else target.set(key, [fact]);
}

export function entityRefKey(entity: EntityRef): string {
  switch (entity.type) {
    case 'pillar': return `pillar:${entity.id}`;
    case 'hexagram': return `hexagram:${entity.id}`;
    case 'line': return `line:${entity.id}:${entity.side}`;
    case 'hidden-spirit': return `hidden-spirit:${entity.id}`;
    case 'use-god': return `use-god:${entity.id}`;
  }
}

export function createCaseFactIndex(input: readonly DerivedFact[]): CaseFactIndex;
export function createCaseFactIndex(input: unknown): CaseFactIndex {
  const facts = ownedFacts(input);
  const ids = new Set<string>();
  const byId = nullRecord<DerivedFact>();
  const byEntity = new Map<string, DerivedFact[]>();
  const byRelation = new Map<string, DerivedFact[]>();
  const byScope = new Map<string, DerivedFact[]>();
  const byAuthority = new Map<string, DerivedFact[]>();
  const byRuleId = new Map<string, DerivedFact[]>();

  for (const fact of facts) {
    if (ids.has(fact.id)) throw new Error(`事实 ID 重复：${fact.id}`);
    ids.add(fact.id);
    deepFreeze(fact);
    byId[fact.id] = fact;
    const sourceKey = entityRefKey(fact.source);
    pushBucket(byEntity, sourceKey, fact);
    if (fact.target) {
      const targetKey = entityRefKey(fact.target);
      if (targetKey !== sourceKey) pushBucket(byEntity, targetKey, fact);
    }
    pushBucket(byRelation, fact.relation, fact);
    pushBucket(byScope, fact.scope, fact);
    pushBucket(byAuthority, fact.authority, fact);
    pushBucket(byRuleId, fact.ruleId, fact);
  }

  Object.freeze(byId);
  const entityBuckets = freezeBuckets(byEntity);
  return Object.freeze({
    byId,
    byEntity: entityBuckets,
    byEntityId: entityBuckets,
    byRelation: freezeBuckets(byRelation),
    byScope: freezeBuckets(byScope),
    byAuthority: freezeBuckets(byAuthority),
    byRuleId: freezeBuckets(byRuleId),
  });
}
