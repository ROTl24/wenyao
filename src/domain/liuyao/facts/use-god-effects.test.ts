import { describe, expect, it } from 'vitest';
import type {
  Element,
  PlateV2,
  QuestionCategory,
  QuestionIntentId,
  UseGodSelection,
} from '../model.js';
import { buildPlateV2 } from '../plate.js';
import { DEFAULT_RULE_CONTEXT } from '../rules/default-context.js';
import { resolveUseGod } from '../use-god.js';
import { deriveFacts } from './derive.js';
import { ELEMENTS } from './element-relations.js';
import {
  deriveUseGodDependentFacts,
  deriveUseGodIndependentFacts,
  flyingHiddenRelation,
  spiritElementsForUse,
} from './use-god-effects.js';

type Tosses = PlateV2['rawTosses'];

function plate(tossValues: Tosses = [9, 8, 7, 6, 6, 6]): PlateV2 {
  return buildPlateV2({
    plateId: 'use-god-effects-test',
    sessionId: 'use-god-effects-test',
    castAt: '2026-07-11T04:00:00.000Z',
    tossValues,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
}

function selectionFor(
  targetPlate: PlateV2,
  category: QuestionCategory,
  explicitIntentId: QuestionIntentId | null,
): UseGodSelection {
  return resolveUseGod({
    question: '测试用神事实',
    category,
    explicitIntentId,
    plate: targetPlate,
    ruleContext: DEFAULT_RULE_CONTEXT,
  });
}

describe('飞伏与世应独立事实', () => {
  it('硬编码核对飞神×伏神 5×5 的唯一方向', () => {
    const oracle = [
      ['same-element', 'flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying'],
      ['hidden-generates-flying', 'same-element', 'flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying'],
      ['hidden-controls-flying', 'hidden-generates-flying', 'same-element', 'flying-generates-hidden', 'flying-controls-hidden'],
      ['flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying', 'same-element', 'flying-generates-hidden'],
      ['flying-generates-hidden', 'flying-controls-hidden', 'hidden-controls-flying', 'hidden-generates-flying', 'same-element'],
    ] as const;
    for (const [flyingIndex, flying] of ELEMENTS.entries()) {
      for (const [hiddenIndex, hidden] of ELEMENTS.entries()) {
        expect(flyingHiddenRelation(flying, hidden).relation, `${flying}->${hidden}`)
          .toBe(oracle[flyingIndex][hiddenIndex]);
      }
    }
  });

  it('每盘固定世应两条，并为每个潜在伏神生成恰好一条深冻结方向事实', () => {
    const targetPlate = plate([7, 7, 7, 8, 7, 7]);
    const facts = deriveUseGodIndependentFacts(targetPlate, DEFAULT_RULE_CONTEXT);
    const hiddenCount = targetPlate.lines.reduce(
      (sum, line) => sum + line.hiddenSpiritCandidates.length,
      0,
    );
    expect(facts.filter(({ relation }) => relation === 'holds-shi')).toHaveLength(1);
    expect(facts.filter(({ relation }) => relation === 'holds-ying')).toHaveLength(1);
    expect(facts.filter(({ relation }) => [
      'same-element',
      'flying-generates-hidden',
      'flying-controls-hidden',
      'hidden-generates-flying',
      'hidden-controls-flying',
    ].includes(relation))).toHaveLength(hiddenCount);
    expect(facts).toHaveLength(hiddenCount + 2);
    expect(new Set(facts.map(({ id }) => id)).size).toBe(facts.length);
    expect(Object.isFrozen(facts)).toBe(true);
    expect(facts.every((fact) => Object.isFrozen(fact) && fact.sourceRefs.length > 0)).toBe(true);
  });
});

describe('元神忌神仇神依具体已决用神派生', () => {
  it('硬编码核对五种用神元素的元忌仇矩阵', () => {
    const oracle: Readonly<Record<Element, { source: Element; avoid: Element; enemy: Element }>> = {
      木: { source: '水', avoid: '金', enemy: '土' },
      火: { source: '木', avoid: '水', enemy: '金' },
      土: { source: '火', avoid: '木', enemy: '水' },
      金: { source: '土', avoid: '火', enemy: '木' },
      水: { source: '金', avoid: '土', enemy: '火' },
    };
    for (const element of ELEMENTS) expect(spiritElementsForUse(element)).toEqual(oracle[element]);
  });

  it('只枚举本卦、真实化爻、月日及已选伏神，并指向真实 primary entity', () => {
    const targetPlate = plate();
    const selection = selectionFor(targetPlate, 'career', 'career.project-profit');
    expect(selection).toMatchObject({ status: 'resolved', selectionMode: 'single' });
    const facts = deriveUseGodDependentFacts(targetPlate, DEFAULT_RULE_CONTEXT, selection);
    expect(facts.length).toBeGreaterThan(0);
    const movingIds = new Set(targetPlate.lines.filter(({ moving }) => moving).map(({ id }) => id));
    for (const fact of facts) {
      expect(['is-source-spirit', 'is-avoid-spirit', 'is-enemy-spirit']).toContain(fact.relation);
      expect(fact.target).toEqual(selection.primary?.entity);
      if (fact.source.type === 'pillar') expect(['month', 'day']).toContain(fact.source.id);
      if (fact.source.type === 'line' && fact.source.side === 'changed') {
        expect(movingIds.has(fact.source.id)).toBe(true);
      }
      expect(fact.source.type).not.toBe('hexagram');
      expect(fact.sourceRefs.length).toBeGreaterThan(0);
    }
    expect(facts.some(({ source }) => source.type === 'pillar' && source.id === 'year')).toBe(false);
    expect(facts.some(({ source }) => source.type === 'pillar' && source.id === 'hour')).toBe(false);
  });

  it('即使五行命中也排除年时、静态 changed 与未选伏神', () => {
    const targetPlate = plate([9, 8, 7, 6, 6, 6]);
    const selection = resolveUseGod({
      question: '指定土爻',
      category: 'other',
      explicitIntentId: 'other.explicit',
      explicitTarget: {
        kind: 'explicit-entity',
        entity: { type: 'line', id: 'line:2', side: 'base' },
      },
      plate: targetPlate,
      ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection.primary).toMatchObject({
      entity: { type: 'line', id: 'line:2', side: 'base' },
    });
    const sourceFacts = deriveUseGodDependentFacts(
      targetPlate,
      DEFAULT_RULE_CONTEXT,
      selection,
    ).filter(({ relation }) => relation === 'is-source-spirit');
    expect(sourceFacts).toEqual(expect.arrayContaining([expect.objectContaining({
      source: { type: 'line', id: 'line:4', side: 'changed' },
    })]));
    const excluded = [
      { type: 'pillar', id: 'year' },
      { type: 'pillar', id: 'hour' },
      { type: 'line', id: 'line:2', side: 'changed' },
      { type: 'hidden-spirit', id: 'hidden:line:3:妻财' },
    ];
    for (const entity of excluded) {
      expect(sourceFacts.some(({ source }) => (
        JSON.stringify(source) === JSON.stringify(entity)
      )), JSON.stringify(entity)).toBe(false);
    }
  });

  it('needs-input、ambiguous 与 shi-ying pair 均不产生元忌仇', () => {
    const needsPlate = plate();
    const needs = selectionFor(needsPlate, 'study', null);
    const ambiguousPlate = plate([9, 6, 9, 6, 6, 6]);
    const ambiguous = selectionFor(ambiguousPlate, 'career', 'career.project-profit');
    const pairPlate = plate([9, 7, 7, 7, 7, 7]);
    const pair = selectionFor(
      pairPlate,
      'relationship',
      'relationship.relationship-dynamic',
    );
    expect(needs.status).toBe('needs-user-input');
    expect(ambiguous.status).toBe('ambiguous');
    expect(pair.selectionMode).toBe('shi-ying-pair');
    expect(deriveUseGodDependentFacts(needsPlate, DEFAULT_RULE_CONTEXT, needs)).toEqual([]);
    expect(deriveUseGodDependentFacts(ambiguousPlate, DEFAULT_RULE_CONTEXT, ambiguous)).toEqual([]);
    expect(deriveUseGodDependentFacts(pairPlate, DEFAULT_RULE_CONTEXT, pair)).toEqual([]);
  });

  it('伏神 primary 的全部元忌仇事实继承 disputed', () => {
    const targetPlate = plate([7, 7, 7, 8, 7, 7]);
    const selection = selectionFor(targetPlate, 'study', 'study.exam-rank-or-admission');
    expect(selection.primary).toMatchObject({
      entity: { type: 'hidden-spirit' },
      certainty: 'disputed',
    });
    const facts = deriveUseGodDependentFacts(targetPlate, DEFAULT_RULE_CONTEXT, selection);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every(({ certainty, conditions }) => (
      certainty === 'disputed' && conditions.includes('selected-hidden-primary-disputed')
    ))).toBe(true);
  });

  it('拒绝伪造、跨盘或附加 score 的 selection', () => {
    const targetPlate = plate();
    const selection = selectionFor(targetPlate, 'career', 'career.project-profit');
    const forged = structuredClone(selection) as UseGodSelection & Record<string, unknown>;
    forged.score = 100;
    expect(() => deriveUseGodDependentFacts(targetPlate, DEFAULT_RULE_CONTEXT, forged))
      .toThrow('用神选择与当前排盘不匹配');
    expect(() => deriveUseGodDependentFacts(
      plate([7, 7, 7, 7, 7, 7]),
      DEFAULT_RULE_CONTEXT,
      selection,
    )).toThrow('用神选择与当前排盘不匹配');

    const renamedPlate = structuredClone(targetPlate);
    renamedPlate.id = `${targetPlate.id}-renamed`;
    renamedPlate.sessionId = `${targetPlate.sessionId}-renamed`;
    expect(() => deriveUseGodDependentFacts(
      renamedPlate,
      DEFAULT_RULE_CONTEXT,
      selection,
    )).toThrow('用神选择与当前排盘不匹配');

    const otherDatePlate = buildPlateV2({
      plateId: targetPlate.id,
      sessionId: targetPlate.sessionId,
      castAt: '2026-07-12T04:00:00.000Z',
      tossValues: targetPlate.rawTosses,
      ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(() => deriveUseGodDependentFacts(
      otherDatePlate,
      DEFAULT_RULE_CONTEXT,
      selection,
    )).toThrow('用神选择与当前排盘不匹配');
  });

  it('派生时只使用重算后的 canonical selection，拒绝 getter TOCTOU', () => {
    const targetPlate = plate();
    const selection = selectionFor(targetPlate, 'career', 'career.project-profit');
    if (selection.status !== 'resolved' || selection.selectionMode !== 'single') {
      throw new Error('expected resolved single selection');
    }
    const expectedPrimary = selection.primary;
    const forged = structuredClone(selection) as any;
    let primaryReads = 0;
    Object.defineProperty(forged, 'primary', {
      enumerable: true,
      configurable: true,
      get() {
        primaryReads += 1;
        return primaryReads === 1
          ? expectedPrimary
          : {
            ...expectedPrimary,
            entity: { type: 'line', id: 'line:1', side: 'base' },
          };
      },
    });

    const facts = deriveUseGodDependentFacts(
      targetPlate,
      DEFAULT_RULE_CONTEXT,
      forged,
    );
    expect(primaryReads).toBe(1);
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every(({ target }) => (
      JSON.stringify(target) === JSON.stringify(expectedPrimary.entity)
    ))).toBe(true);
  });

  it('deriveFacts 省略 selection 时仍输出独立事实，传入 canonical selection 才合并元忌仇', () => {
    const targetPlate = plate();
    const independent = deriveFacts({ plate: targetPlate, ruleContext: DEFAULT_RULE_CONTEXT });
    expect(independent.some(({ relation }) => relation === 'holds-shi')).toBe(true);
    expect(independent.some(({ relation }) => relation === 'is-source-spirit')).toBe(false);

    const selection = selectionFor(targetPlate, 'career', 'career.project-profit');
    const combined = deriveFacts({ plate: targetPlate, ruleContext: DEFAULT_RULE_CONTEXT, useGod: selection });
    expect(combined.some(({ relation }) => relation === 'is-source-spirit')).toBe(true);
    expect(() => deriveFacts({
      plate: targetPlate,
      ruleContext: DEFAULT_RULE_CONTEXT,
      useGod: undefined,
    })).toThrow('用神选择与当前排盘不匹配');
  });
});
