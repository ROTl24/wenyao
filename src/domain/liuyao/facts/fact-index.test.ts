import { describe, expect, it } from 'vitest';
import type { DerivedFact, EntityRef } from '../model.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import { resolveUseGod } from '../use-god.js';
import { deriveFacts } from './derive.js';
import { createCaseFactIndex, entityRefKey } from './fact-index.js';

function fixtureFacts(): readonly DerivedFact[] {
  const plate = buildPlateV2({
    plateId: 'fact-index-plate',
    sessionId: 'fact-index-session',
    castAt: '2026-07-11T04:00:00.000Z',
    tossValues: [9, 8, 7, 6, 7, 8],
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  const useGod = resolveUseGod({
    question: '收入是否增长？',
    category: 'wealth',
    explicitIntentId: 'wealth.money-or-valuables',
    plate,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
  return deriveFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT, useGod });
}

function everyArraySorted(record: Readonly<Record<string, readonly DerivedFact[]>>): boolean {
  return Object.values(record).every((facts) => (
    facts.map(({ id }) => id).join('\0')
      === [...facts.map(({ id }) => id)].sort().join('\0')
  ));
}

describe('createCaseFactIndex', () => {
  it('creates stable frozen null-prototype indexes for all supported dimensions', () => {
    const facts = fixtureFacts();
    const index = createCaseFactIndex(facts);

    expect(Object.keys(index.byId)).toHaveLength(facts.length);
    expect(index.byEntityId).toBe(index.byEntity);
    for (const record of [
      index.byId,
      index.byEntity,
      index.byRelation,
      index.byScope,
      index.byAuthority,
      index.byRuleId,
    ]) {
      expect(Object.getPrototypeOf(record)).toBeNull();
      expect(Object.isFrozen(record)).toBe(true);
    }
    expect(everyArraySorted(index.byEntity)).toBe(true);
    expect(everyArraySorted(index.byRelation)).toBe(true);
    expect(everyArraySorted(index.byScope)).toBe(true);
    expect(everyArraySorted(index.byAuthority)).toBe(true);
    expect(everyArraySorted(index.byRuleId)).toBe(true);
    expect(Object.values(index.byId).every(Object.isFrozen)).toBe(true);

    for (const fact of Object.values(index.byId)) {
      expect(index.byRelation[fact.relation]).toContain(fact);
      expect(index.byScope[fact.scope]).toContain(fact);
      expect(index.byAuthority[fact.authority]).toContain(fact);
      expect(index.byRuleId[fact.ruleId]).toContain(fact);
      expect(index.byEntity[entityRefKey(fact.source)]).toContain(fact);
      if (fact.target) expect(index.byEntity[entityRefKey(fact.target)]).toContain(fact);
    }
  });

  it('is independent of input order and caller ownership', () => {
    const mutable = structuredClone(fixtureFacts()) as DerivedFact[];
    const expected = createCaseFactIndex(mutable);
    const reversed = createCaseFactIndex([...mutable].reverse());
    expect(reversed).toEqual(expected);

    const firstId = mutable[0].id;
    mutable[0].id = 'mutated-by-caller';
    expect(expected.byId[firstId].id).toBe(firstId);
    expect(expected.byId).not.toHaveProperty('mutated-by-caller');
  });

  it('rejects duplicate IDs, sparse input and malformed facts', () => {
    const facts = structuredClone(fixtureFacts()) as DerivedFact[];
    expect(() => createCaseFactIndex([facts[0], structuredClone(facts[0])]))
      .toThrow('事实 ID 重复');

    const sparse = [facts[0], facts[1]] as DerivedFact[];
    delete sparse[0];
    expect(() => createCaseFactIndex(sparse)).toThrow('事实索引输入无效');

    expect(() => createCaseFactIndex([{ ...facts[0], relation: 'invented' } as never]))
      .toThrow('事实索引输入无效');
    expect(() => createCaseFactIndex([{ ...facts[0], extra: true } as never]))
      .toThrow('事实索引输入无效');
    expect(() => createCaseFactIndex([{ ...facts[0], source: { type: 'line', id: '', side: 'base' } }]))
      .toThrow('事实索引输入无效');
  });

  it('rejects accessors, symbol keys and class instances without invoking them', () => {
    const [fact] = structuredClone(fixtureFacts()) as DerivedFact[];
    let invoked = false;
    const accessor = { ...fact } as Record<PropertyKey, unknown>;
    Object.defineProperty(accessor, 'id', {
      enumerable: true,
      get() {
        invoked = true;
        return fact.id;
      },
    });
    expect(() => createCaseFactIndex([accessor as never])).toThrow('事实索引输入无效');
    expect(invoked).toBe(false);

    const symbolFact = { ...fact, [Symbol('forged')]: true };
    expect(() => createCaseFactIndex([symbolFact])).toThrow('事实索引输入无效');

    class ForgedFact { constructor(readonly id: string) {} }
    expect(() => createCaseFactIndex([new ForgedFact(fact.id) as never]))
      .toThrow('事实索引输入无效');
  });
});

describe('entityRefKey', () => {
  it.each<[EntityRef, string]>([
    [{ type: 'pillar', id: 'day' }, 'pillar:day'],
    [{ type: 'hexagram', id: 'base' }, 'hexagram:base'],
    [{ type: 'line', id: 'line-1', side: 'changed' }, 'line:line-1:changed'],
    [{ type: 'hidden-spirit', id: 'hidden-1' }, 'hidden-spirit:hidden-1'],
    [{ type: 'use-god', id: 'primary' }, 'use-god:primary'],
  ])('maps %j to %s', (entity, expected) => {
    expect(entityRefKey(entity)).toBe(expected);
  });
});
