import { describe, expect, it } from 'vitest';
import type { Branch, Element, PlateV2 } from '../model.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import { BRANCHES, branchRelationMatches } from './branch-relations.js';
import { deriveEffectsFacts, deriveRelationFactsForInternalPipeline } from './derive.js';
import { ELEMENTS, elementRelation } from './element-relations.js';
import { LIUYAO_EFFECTS_V1_ARTIFACT } from './effects-core-v1.js';
import { twelveStage } from './growth-shensha.js';
import {
  advanceRetreatRelation,
} from './moving-effects.js';

const BUILD_INPUT = {
  plateId: 'plate-effects-moving',
  sessionId: 'session-effects-moving',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const REPRESENTATIVE_BRANCH: Readonly<Record<Element, Branch>> = {
  木: '卯', 火: '午', 土: '辰', 金: '酉', 水: '子',
};

function setFacetBranch(
  plate: PlateV2,
  side: 'base' | 'changed',
  branch: Branch,
): void {
  const facet = plate.lines[0][side];
  facet.branch = branch;
  facet.branchElement = BRANCH_ELEMENT[branch];
  facet.ganZhi = `${facet.stem}${branch}`;
}

function movingFixture(base: Branch, changed: Branch): PlateV2 {
  const plate = structuredClone(buildPlateV2({
    ...BUILD_INPUT,
    tossValues: [9, 7, 8, 8, 7, 8],
  }));
  setFacetBranch(plate, 'base', base);
  setFacetBranch(plate, 'changed', changed);
  return plate;
}

function deriveMovingEffects(plate: PlateV2) {
  return deriveEffectsFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT })
    .filter(({ scope }) => scope === 'transition');
}

describe('liuyao_effects_v1 production moving facts', () => {
  it('locks the default seven advance and seven retreat directions', () => {
    expect([
      ['亥', '子'], ['寅', '卯'], ['巳', '午'], ['申', '酉'],
      ['丑', '辰'], ['辰', '未'], ['未', '戌'],
    ].map(([base, changed]) => advanceRetreatRelation(base as never, changed as never)))
      .toEqual(Array(7).fill('advances'));
    expect(advanceRetreatRelation('戌', '丑')).toBeNull();
  });

  it('keeps the eighth pair disabled in production but available to the named audit oracle', () => {
    let defaultAdvances = 0;
    let defaultRetreats = 0;
    let auditAdvances = 0;
    let auditRetreats = 0;
    for (const base of BRANCHES) {
      for (const changed of BRANCHES) {
        const defaultRelation = advanceRetreatRelation(base, changed);
        const auditRelation = advanceRetreatRelation(base, changed, 'bushi-eight-pair-audit-v1');
        if (defaultRelation === 'advances') defaultAdvances += 1;
        if (defaultRelation === 'retreats') defaultRetreats += 1;
        if (auditRelation === 'advances') auditAdvances += 1;
        if (auditRelation === 'retreats') auditRetreats += 1;
      }
    }
    expect({ defaultAdvances, defaultRetreats, auditAdvances, auditRetreats })
      .toEqual({ defaultAdvances: 7, defaultRetreats: 7, auditAdvances: 8, auditRetreats: 8 });
    expect(advanceRetreatRelation('戌', '丑', 'bushi-eight-pair-audit-v1')).toBe('advances');
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.moving.auditProfile.enabled).toBe(false);
  });

  it('only derives moving effects for true transitions and binds Task4 basis ids', () => {
    const plate = buildPlateV2({ ...BUILD_INPUT, tossValues: [9, 7, 8, 6, 7, 8] });
    const facts = deriveMovingEffects(plate);
    expect(facts.every(({ scope }) => scope === 'transition')).toBe(true);
    expect(facts.every(({ values }) => Array.isArray(values.basisFactIds))).toBe(true);
    expect(facts.every(({ source, target }) => (
      source.type === 'line'
      && target?.type === 'line'
      && source.id === target.id
    ))).toBe(true);
  });

  it('matches the complete changed-to-base 5x5 element oracle without reversing return direction', () => {
    for (const baseElement of ELEMENTS) {
      for (const changedElement of ELEMENTS) {
        const plate = movingFixture(
          REPRESENTATIVE_BRANCH[baseElement],
          REPRESENTATIVE_BRANCH[changedElement],
        );
        const facts = deriveMovingEffects(plate)
          .filter(({ relation }) => relation === 'returns-generate' || relation === 'returns-control');
        const expectedPrimitive = elementRelation(changedElement, baseElement);
        const expected = expectedPrimitive === 'generates'
          ? ['returns-generate']
          : expectedPrimitive === 'controls' ? ['returns-control'] : [];
        expect(facts.map(({ relation }) => relation), `${changedElement}→${baseElement}`)
          .toEqual(expected);
      }
    }
  });

  it('matches every changed-to-base 12x12 clash/combine cell and retains overlaps', () => {
    let clashes = 0;
    let combines = 0;
    for (const base of BRANCHES) {
      for (const changed of BRANCHES) {
        const facts = deriveMovingEffects(movingFixture(base, changed));
        const actual = facts.map(({ relation }) => relation);
        const primitives = branchRelationMatches(
          changed,
          base,
          DEFAULT_RULE_CONTEXT.relationProfile,
        ).map(({ relation }) => relation);
        expect(actual.includes('returns-clash'), `${changed}→${base} clash`)
          .toBe(primitives.includes('clashes'));
        expect(actual.includes('returns-combine'), `${changed}→${base} combine`)
          .toBe(primitives.includes('combines'));
        if (actual.includes('returns-clash')) clashes += 1;
        if (actual.includes('returns-combine')) combines += 1;
      }
    }
    expect({ clashes, combines }).toEqual({ clashes: 12, combines: 12 });
  });

  it('references only exact current Task4 transition facts and never emits a second raw primitive', () => {
    const plate = movingFixture('子', '丑');
    const relationFacts = deriveRelationFactsForInternalPipeline(plate, DEFAULT_RULE_CONTEXT);
    const relationIds = new Set(relationFacts.map(({ id }) => id));
    const effects = deriveMovingEffects(plate);
    const returnFacts = effects.filter(({ relation }) => relation.startsWith('returns-'));
    expect(returnFacts.length).toBeGreaterThan(0);
    for (const fact of returnFacts) {
      expect(fact.values.basisFactIds).toHaveLength(1);
      expect((fact.values.basisFactIds as readonly string[]).every((id) => relationIds.has(id))).toBe(true);
    }
    expect(effects.some(({ relation }) => (
      relation === 'generates' || relation === 'controls'
      || relation === 'clashes' || relation === 'combines'
    ))).toBe(false);
  });

  it('delegates all 5x12 tomb/absolute decisions to twelveStage and yields exactly five of each', () => {
    let tombs = 0;
    let absolutes = 0;
    for (const element of ELEMENTS) {
      for (const changed of BRANCHES) {
        const facts = deriveMovingEffects(
          movingFixture(REPRESENTATIVE_BRANCH[element], changed),
        );
        const stage = twelveStage(element, changed, DEFAULT_RULE_CONTEXT.growthProfile);
        expect(facts.some(({ relation }) => relation === 'changes-to-tomb'), `${element}/${changed}`)
          .toBe(stage === '墓');
        expect(facts.some(({ relation }) => relation === 'changes-to-absolute'), `${element}/${changed}`)
          .toBe(stage === '绝');
        if (stage === '墓') tombs += 1;
        if (stage === '绝') absolutes += 1;
      }
    }
    expect({ tombs, absolutes }).toEqual({ tombs: 5, absolutes: 5 });
  });

  it('inherits disputed earth certainty and preserves earth-to-Si absolute plus return-generate overlap', () => {
    const facts = deriveMovingEffects(movingFixture('辰', '巳'));
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'changes-to-absolute', certainty: 'disputed' }),
      expect.objectContaining({ relation: 'returns-generate', certainty: 'computed' }),
    ]));
    expect(facts.find(({ relation }) => relation === 'changes-to-absolute')?.values)
      .toMatchObject({
        evaluator: 'twelveStage',
        dependencyArtifactHash: 'e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129',
      });
  });

  it('is stable under deep clone and traversal order with sorted unique deeply frozen facts', () => {
    const plate = buildPlateV2({ ...BUILD_INPUT, tossValues: [9, 6, 8, 9, 7, 8] });
    const reordered = structuredClone(plate);
    reordered.lines = [...reordered.lines].reverse() as unknown as PlateV2['lines'];
    const first = deriveMovingEffects(plate);
    const second = deriveMovingEffects(reordered);
    expect(second).toEqual(first);
    expect(first.map(({ id }) => id)).toEqual([...first.map(({ id }) => id)].sort());
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(first.every((fact) => (
      Object.isFrozen(fact)
      && fact.ruleId.length > 0
      && fact.profileId === 'yehe_effects_v1'
      && fact.sourceRefs.length > 0
      && Array.isArray(fact.values.basisFactIds)
    ))).toBe(true);
  });
});
