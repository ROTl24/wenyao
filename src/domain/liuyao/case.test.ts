import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDivinationCase, type BuildDivinationCaseInput } from './case.js';
import { DEFAULT_RULE_CONTEXT } from './rules/default-context.js';

const HASH_PORT = {
  sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  },
};

const INPUT = {
  sessionId: 'session-fixed',
  plateId: 'plate-fixed',
  question: '这次考试能否录取？',
  category: 'study',
  explicitIntentId: 'study.exam-rank-or-admission',
  castAt: '2026-07-11T04:00:00.000Z',
  builtAt: '2026-07-12T00:00:00.000Z',
  tossValues: [9, 7, 7, 7, 7, 7],
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const satisfies BuildDivinationCaseInput;

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Reflect.ownKeys(value).every((key) => isDeeplyFrozen(
      (value as Record<PropertyKey, unknown>)[key],
      seen,
    ));
}

describe('DivinationCaseV2', () => {
  it('is deterministic, fully owned and deeply frozen', () => {
    const mutableInput = structuredClone(INPUT) as BuildDivinationCaseInput;
    const first = buildDivinationCase(mutableInput, HASH_PORT);
    const second = buildDivinationCase(structuredClone(INPUT), HASH_PORT);

    expect(first).toEqual(second);
    expect(first.ruleContextHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.factSetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(isDeeplyFrozen(first)).toBe(true);
    expect(first.facts.map(({ id }) => id)).toEqual(
      [...first.facts.map(({ id }) => id)].sort(),
    );

    (mutableInput.tossValues as unknown as Array<6 | 7 | 8 | 9>)[0] = 6;
    (mutableInput.ruleContext.sources as unknown as unknown[]).length = 0;
    expect(first.plate.rawTosses[0]).toBe(9);
    expect(first.ruleContext.sources.length).toBeGreaterThan(0);
    expect(Object.isFrozen(mutableInput)).toBe(false);
  });

  it('excludes builtAt from both hashes and includes every domain-changing input', () => {
    const base = buildDivinationCase(INPUT, HASH_PORT);
    const rebuiltLater = buildDivinationCase({
      ...INPUT,
      builtAt: '2026-07-13T00:00:00.000Z',
    }, HASH_PORT);
    const changedQuestion = buildDivinationCase({
      ...INPUT,
      question: '这次考试能否进入前三名？',
    }, HASH_PORT);
    const changedToss = buildDivinationCase({
      ...INPUT,
      tossValues: [6, 7, 7, 7, 7, 7],
    }, HASH_PORT);
    const changedCastAt = buildDivinationCase({
      ...INPUT,
      castAt: '2026-07-12T04:00:00.000Z',
    }, HASH_PORT);
    const changedIntent = buildDivinationCase({
      ...INPUT,
      explicitIntentId: 'study.learning-or-documents',
    }, HASH_PORT);

    expect(rebuiltLater.builtAt).not.toBe(base.builtAt);
    expect(rebuiltLater.ruleContextHash).toBe(base.ruleContextHash);
    expect(rebuiltLater.factSetHash).toBe(base.factSetHash);
    for (const changed of [changedQuestion, changedToss, changedCastAt, changedIntent]) {
      expect(changed.factSetHash).not.toBe(base.factSetHash);
    }
  });

  it('hashes subject and explicit-target provenance instead of only the final relation', () => {
    const deterministicWealth = buildDivinationCase({
      ...INPUT,
      category: 'wealth',
      explicitIntentId: null,
    }, HASH_PORT);
    const explicitWealth = buildDivinationCase({
      ...INPUT,
      category: 'wealth',
      explicitIntentId: 'wealth.money-or-valuables',
    }, HASH_PORT);
    expect(deterministicWealth.useGod.focusEntities).toEqual(explicitWealth.useGod.focusEntities);
    expect(deterministicWealth.factSetHash).not.toBe(explicitWealth.factSetHash);

    const parent = buildDivinationCase({
      ...INPUT,
      category: 'health',
      explicitIntentId: 'health.other-person',
      subjectRelation: '父母',
    }, HASH_PORT);
    const sibling = buildDivinationCase({
      ...INPUT,
      category: 'health',
      explicitIntentId: 'health.other-person',
      subjectRelation: '兄弟',
    }, HASH_PORT);
    const explicitRelation = buildDivinationCase({
      ...INPUT,
      category: 'other',
      explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'six-relation', relation: '兄弟' },
    }, HASH_PORT);

    expect(parent.factSetHash).not.toBe(sibling.factSetHash);
    expect(explicitRelation.useGod.intent?.explicitTarget).toEqual({
      kind: 'six-relation', relation: '兄弟',
    });
    expect(explicitRelation.factSetHash).not.toBe(sibling.factSetHash);

    const byRole = buildDivinationCase({
      ...INPUT,
      category: 'other',
      explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'role', role: '世' },
    }, HASH_PORT);
    expect(byRole.useGod.status).toBe('resolved');
    const roleEntity = byRole.useGod.focusEntities[0];
    expect(roleEntity).toBeDefined();
    if (!roleEntity) return;
    const byExactSameEntity = buildDivinationCase({
      ...INPUT,
      category: 'other',
      explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'explicit-entity', entity: roleEntity },
    }, HASH_PORT);
    expect(byExactSameEntity.useGod.focusEntities).toEqual(byRole.useGod.focusEntities);
    expect(byExactSameEntity.factSetHash).not.toBe(byRole.factSetHash);
  });

  it('normalizes the semantically unordered registered source set before hashing', () => {
    const reversedContext = {
      ...structuredClone(DEFAULT_RULE_CONTEXT),
      sources: [...DEFAULT_RULE_CONTEXT.sources].reverse(),
    };
    const base = buildDivinationCase(INPUT, HASH_PORT);
    const reordered = buildDivinationCase({ ...INPUT, ruleContext: reversedContext }, HASH_PORT);

    expect(reordered.ruleContextHash).toBe(base.ruleContextHash);
    expect(reordered.factSetHash).toBe(base.factSetHash);
    expect(reordered.ruleContext).toEqual(base.ruleContext);
  });

  it('rejects caller-supplied derived state, malformed timestamps and invalid hash ports', () => {
    for (const forbidden of [
      'plate', 'facts', 'useGod', 'factSetHash', 'ruleContextHash', 'analysis', 'caseSnapshot',
    ]) {
      expect(() => buildDivinationCase({ ...INPUT, [forbidden]: {} }, HASH_PORT))
        .toThrow('卦例构建输入无效');
    }
    expect(() => buildDivinationCase({ ...INPUT, builtAt: 'not-a-date' }, HASH_PORT))
      .toThrow('builtAt');
    expect(() => buildDivinationCase(INPUT, { sha256: () => 'not-sha256' }))
      .toThrow('SHA-256');
  });

  it('does not allow accessors, class instances, sparse tosses or input mutation through freezing', () => {
    const accessor = { ...INPUT } as Record<string, unknown>;
    Object.defineProperty(accessor, 'question', { enumerable: true, get: () => INPUT.question });
    expect(() => buildDivinationCase(accessor, HASH_PORT)).toThrow('卦例构建输入无效');

    const sparse = [9, 7, 7, 7, 7, 7] as Array<6 | 7 | 8 | 9>;
    delete sparse[2];
    expect(() => buildDivinationCase({ ...INPUT, tossValues: sparse as never }, HASH_PORT))
      .toThrow('投币');

    class ContextWrapper { constructor(readonly value: unknown) {} }
    expect(() => buildDivinationCase({
      ...INPUT,
      ruleContext: new ContextWrapper(DEFAULT_RULE_CONTEXT) as never,
    }, HASH_PORT)).toThrow();
  });

  it('rebuilds the same deep value one hundred times', () => {
    const expected = buildDivinationCase(INPUT, HASH_PORT);
    for (let index = 0; index < 100; index += 1) {
      expect(buildDivinationCase(structuredClone(INPUT), HASH_PORT)).toEqual(expected);
    }
  });
});
