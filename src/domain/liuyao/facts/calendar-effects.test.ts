import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as domain from '../index.js';
import * as calendarEffectsModule from './calendar-effects.js';
import * as movingEffectsModule from './moving-effects.js';
import * as formationsModule from './formations.js';
import { SIXTY_JIA_ZI_GOLDEN } from '../__fixtures__/golden-calendar.js';
import type {
  Branch,
  DerivedFact,
  Element,
  EntityRef,
  PlateV2,
  Stem,
} from '../model.js';
import { buildPlateV2 } from '../plate.js';
import {
  DEFAULT_RULE_CONTEXT,
  mergeRuleSourceRefs,
} from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { BRANCHES, branchRelationMatches } from './branch-relations.js';
import { deriveEffectsFacts, deriveFacts } from './derive.js';
import { elementRelation } from './element-relations.js';
import {
  EFFECTS_SOURCE_EVIDENCE_CAPSULES,
  LIUYAO_EFFECTS_V1_ARTIFACT,
  LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
  LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD,
  LIUYAO_EFFECTS_V1_MANIFEST,
} from './effects-core-v1.js';
import {
  EFFECTS_REVIEW_CHECKED_CLAIMS,
  EFFECTS_REVIEW_REPORT_PATHS,
} from './effects-manifest-expectations.js';
import {
  assertProjectEnabledEffectsBundle,
  assertProjectEnabledEffectsContext,
} from './effects-registry.js';
import {
  deriveCalendarEffectsFromTrustedFacts,
  monthStatusForBranches,
} from './calendar-effects.js';
import { RELATION_CORE_V1_ARTIFACT } from './relation-core-v1.js';

const BUILD_INPUT = {
  plateId: 'plate-effects-calendar',
  sessionId: 'session-effects-calendar',
  castAt: '2026-07-11T04:00:00.000Z',
  ruleContext: DEFAULT_RULE_CONTEXT,
} as const;

const BRANCH_ELEMENT: Readonly<Record<Branch, Element>> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

const STEM_ELEMENT: Readonly<Record<Stem, Element>> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

function setFacetBranch(
  plate: PlateV2,
  position: number,
  side: 'base' | 'changed',
  branch: Branch,
): void {
  const facet = plate.lines[position - 1][side];
  facet.branch = branch;
  facet.branchElement = BRANCH_ELEMENT[branch];
  facet.ganZhi = `${facet.stem}${branch}`;
}

function setPillarBranch(
  plate: PlateV2,
  kind: 'year' | 'month' | 'day' | 'hour',
  branch: Branch,
): void {
  const pillar = plate.calendar.pillars[kind];
  pillar.branch = { value: branch, element: BRANCH_ELEMENT[branch] };
  pillar.ganZhi = `${pillar.stem.value}${branch}` as typeof pillar.ganZhi;
}

function calendarFixture(
  tossValues: PlateV2['rawTosses'] = [7, 8, 7, 8, 7, 8],
): PlateV2 {
  return structuredClone(buildPlateV2({ ...BUILD_INPUT, tossValues }));
}

type RelationRef = Extract<EntityRef, { type: 'pillar' | 'line' }>;

interface RelationEntity {
  readonly ref: RelationRef;
  readonly element: Element;
  readonly branch: Branch;
}

interface RelationComparison {
  readonly id: string;
  readonly scope: 'calendar' | 'base';
  readonly source: RelationEntity;
  readonly target: RelationEntity;
}

const PILLAR_ORDER = ['year', 'month', 'day', 'hour'] as const;

function relationEntityKey(ref: RelationRef): string {
  return ref.type === 'pillar'
    ? `pillar:${ref.id}`
    : `line:${ref.id}:${ref.side}`;
}

function fixtureRelationFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly DerivedFact[] {
  const comparisons: RelationComparison[] = [];
  for (const kind of PILLAR_ORDER) {
    const pillar = plate.calendar.pillars[kind];
    for (const line of plate.lines) {
      const source: RelationEntity = {
        ref: { type: 'pillar', id: kind },
        element: pillar.branch.element,
        branch: pillar.branch.value,
      };
      const target: RelationEntity = {
        ref: { type: 'line', id: line.id, side: 'base' },
        element: line.base.branchElement,
        branch: line.base.branch,
      };
      comparisons.push({
        id: `calendar|${relationEntityKey(source.ref)}|${relationEntityKey(target.ref)}`,
        scope: 'calendar',
        source,
        target,
      });
    }
  }
  for (let leftIndex = 0; leftIndex < plate.lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < plate.lines.length; rightIndex += 1) {
      const leftLine = plate.lines[leftIndex];
      const rightLine = plate.lines[rightIndex];
      if (!leftLine.moving && !rightLine.moving) continue;
      const source: RelationEntity = {
        ref: { type: 'line', id: leftLine.id, side: 'base' },
        element: leftLine.base.branchElement,
        branch: leftLine.base.branch,
      };
      const target: RelationEntity = {
        ref: { type: 'line', id: rightLine.id, side: 'base' },
        element: rightLine.base.branchElement,
        branch: rightLine.base.branch,
      };
      comparisons.push({
        id: `base|${relationEntityKey(source.ref)}|${relationEntityKey(target.ref)}`,
        scope: 'base',
        source,
        target,
      });
    }
  }

  return comparisons.flatMap((comparison): readonly DerivedFact[] => {
    const facts: DerivedFact[] = [];
    const forward = elementRelation(comparison.source.element, comparison.target.element);
    const reverse = forward === null
      ? elementRelation(comparison.target.element, comparison.source.element)
      : null;
    const relation = forward ?? reverse;
    if (relation === null) throw new Error('测试五行关系矩阵不完整');
    const source = forward === null ? comparison.target : comparison.source;
    const target = forward === null ? comparison.source : comparison.target;
    const elementRule = RELATION_CORE_V1_ARTIFACT.elementRules.find(
      (candidate) => candidate.relation === relation,
    );
    if (!elementRule) throw new Error(`测试五行规则缺失：${relation}`);
    facts.push({
      id: `fixture:${comparison.id}:${relation}:${elementRule.ruleId}`,
      relation,
      source: source.ref,
      target: target.ref,
      scope: comparison.scope,
      authority: elementRule.authority,
      ruleId: elementRule.ruleId,
      profileId: elementRule.profileId,
      certainty: elementRule.certainty,
      conditions: [],
      values: { comparisonId: comparison.id },
      sourceRefs: elementRule.sourceRefs,
    });
    for (const match of branchRelationMatches(
      comparison.source.branch,
      comparison.target.branch,
      ruleContext.relationProfile,
    )) {
      const branchSource = match.direction === 'reverse'
        ? comparison.target
        : comparison.source;
      const branchTarget = match.direction === 'reverse'
        ? comparison.source
        : comparison.target;
      facts.push({
        id: `fixture:${comparison.id}:${match.relation}:${match.ruleId}`,
        relation: match.relation,
        source: branchSource.ref,
        target: branchTarget.ref,
        scope: comparison.scope,
        authority: match.authority,
        ruleId: match.ruleId,
        profileId: match.profileId,
        certainty: match.certainty,
        conditions: [],
        values: { comparisonId: comparison.id },
        sourceRefs: match.sourceRefs,
      });
    }
    return facts;
  });
}

function deriveCalendarEffectsFromFixture(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly import('../model.js').DerivedFact[] {
  return deriveCalendarEffectsFromTrustedFacts(
    plate,
    ruleContext,
    fixtureRelationFacts(plate, ruleContext),
  );
}

function deriveCalendarEffects(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly import('../model.js').DerivedFact[] {
  return deriveEffectsFacts({ plate, ruleContext })
    .filter(({ scope }) => scope === 'calendar');
}

describe('liuyao_effects_v1 production calendar facts', () => {
  it('locks the exact 12x12 month-status totals', () => {
    const counts = {
      commanding: 0,
      sameElement: 0,
      generatedByMonth: 0,
      residualQi: 0,
      resting: 0,
    };
    for (const month of BRANCHES) {
      for (const line of BRANCHES) {
        const status = monthStatusForBranches(month, line);
        if (status === 'same-element') counts.sameElement += 1;
        else if (status === 'generated-by-month') counts.generatedByMonth += 1;
        else if (status === 'residual-qi') counts.residualQi += 1;
        else counts[status] += 1;
      }
    }
    expect(counts).toEqual({
      commanding: 12,
      sameElement: 20,
      generatedByMonth: 28,
      residualQi: 4,
      resting: 80,
    });
  });

  it('always emits six base month statuses and never duplicates static changed facets', () => {
    const plate = buildPlateV2({ ...BUILD_INPUT, tossValues: [7, 8, 7, 8, 7, 8] });
    const facts = deriveCalendarEffects(plate, DEFAULT_RULE_CONTEXT);
    expect(facts.filter(({ relation }) => relation === 'has-month-status')).toHaveLength(6);
    expect(facts.some(({ target }) => target?.type === 'line' && target.side === 'changed')).toBe(false);
  });

  it('classifies a strong static day-clash as dark-moving and a weak unsupported one as day-break', () => {
    const strong = calendarFixture();
    setFacetBranch(strong, 1, 'base', '卯');
    setFacetBranch(strong, 1, 'changed', '卯');
    setPillarBranch(strong, 'day', '酉');
    setPillarBranch(strong, 'month', '亥');
    const strongFacts = deriveCalendarEffectsFromFixture(strong, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(strongFacts.map(({ relation }) => relation)).toContain('is-dark-moving');
    expect(strongFacts.map(({ relation }) => relation)).not.toContain('is-day-break');

    const weak = calendarFixture();
    setFacetBranch(weak, 1, 'base', '卯');
    setFacetBranch(weak, 1, 'changed', '卯');
    setPillarBranch(weak, 'day', '酉');
    setPillarBranch(weak, 'month', '申');
    const weakFacts = deriveCalendarEffectsFromFixture(weak, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(weakFacts.map(({ relation }) => relation)).toContain('is-day-break');
    expect(weakFacts.map(({ relation }) => relation)).not.toContain('is-dark-moving');
    expect(weakFacts.find(({ relation }) => relation === 'is-day-break')).toMatchObject({
      certainty: 'conditional',
      conditions: ['raw-day-clash', 'month-controls', 'no-whitelisted-support'],
    });
  });

  it('retains only the raw Task4 day clash when neither classification threshold is met', () => {
    const plate = calendarFixture();
    setFacetBranch(plate, 1, 'base', '卯');
    setFacetBranch(plate, 1, 'changed', '卯');
    setPillarBranch(plate, 'day', '酉');
    setPillarBranch(plate, 'month', '巳');
    const effects = deriveCalendarEffectsFromFixture(plate, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(effects.map(({ relation }) => relation)).not.toEqual(expect.arrayContaining([
      'is-dark-moving', 'is-day-break',
    ]));
    expect(fixtureRelationFacts(plate, DEFAULT_RULE_CONTEXT))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'clashes',
        source: { type: 'pillar', id: 'day' },
        target: { type: 'line', id: 'line:1', side: 'base' },
      })]));
  });

  it('does not treat a target line controlling the month as month controlling the target', () => {
    const plate = calendarFixture();
    setFacetBranch(plate, 1, 'base', '申');
    setFacetBranch(plate, 1, 'changed', '申');
    setPillarBranch(plate, 'day', '寅');
    setPillarBranch(plate, 'month', '卯');
    const effects = deriveCalendarEffectsFromFixture(plate, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(effects.map(({ relation }) => relation).filter((relation) => (
      relation === 'is-dark-moving' || relation === 'is-day-break'
    ))).toEqual([]);
  });

  it('lets an actual moving base line support the target but ignores year/hour and combines-only', () => {
    const plate = calendarFixture([7, 9, 8, 8, 7, 8]);
    setFacetBranch(plate, 1, 'base', '卯');
    setFacetBranch(plate, 1, 'changed', '卯');
    setFacetBranch(plate, 2, 'base', '亥');
    setPillarBranch(plate, 'day', '酉');
    setPillarBranch(plate, 'month', '申');
    const facts = deriveCalendarEffectsFromFixture(plate, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(facts.map(({ relation }) => relation).filter((relation) => (
      relation === 'is-dark-moving' || relation === 'is-day-break'
    ))).toEqual([]);
  });

  it('accepts day and other-moving-base same-element support in addition to generated support', () => {
    const daySupport = calendarFixture();
    setFacetBranch(daySupport, 1, 'base', '未');
    setFacetBranch(daySupport, 1, 'changed', '未');
    setPillarBranch(daySupport, 'day', '丑');
    setPillarBranch(daySupport, 'month', '寅');
    expect(deriveCalendarEffectsFromFixture(daySupport, DEFAULT_RULE_CONTEXT)
      .some(({ relation, target }) => (
        relation === 'is-day-break'
        && target?.type === 'line'
        && target.id === 'line:1'
      ))).toBe(false);

    const movingSameElement = calendarFixture([7, 9, 8, 8, 7, 8]);
    setFacetBranch(movingSameElement, 1, 'base', '申');
    setFacetBranch(movingSameElement, 1, 'changed', '申');
    setFacetBranch(movingSameElement, 2, 'base', '酉');
    setFacetBranch(movingSameElement, 2, 'changed', '酉');
    setPillarBranch(movingSameElement, 'day', '寅');
    setPillarBranch(movingSameElement, 'month', '午');
    expect(deriveCalendarEffectsFromFixture(movingSameElement, DEFAULT_RULE_CONTEXT)
      .some(({ relation, target }) => (
        relation === 'is-day-break'
        && target?.type === 'line'
        && target.id === 'line:1'
      ))).toBe(false);
  });

  it.each([
    ['year', '子'],
    ['hour', '亥'],
  ] as const)('rejects %s-pillar generation from the day-clash support whitelist', (kind, branch) => {
    const plate = calendarFixture();
    setFacetBranch(plate, 1, 'base', '卯');
    setFacetBranch(plate, 1, 'changed', '卯');
    setPillarBranch(plate, 'day', '酉');
    setPillarBranch(plate, 'month', '申');
    setPillarBranch(plate, kind, branch);
    expect(deriveCalendarEffectsFromFixture(plate, DEFAULT_RULE_CONTEXT))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'is-day-break',
        target: { type: 'line', id: 'line:1', side: 'base' },
      })]));
  });

  it('rejects combines-only and residual-qi as day-clash support', () => {
    const combinesOnly = calendarFixture([7, 9, 8, 8, 7, 8]);
    setFacetBranch(combinesOnly, 1, 'base', '卯');
    setFacetBranch(combinesOnly, 1, 'changed', '卯');
    setFacetBranch(combinesOnly, 2, 'base', '戌');
    setFacetBranch(combinesOnly, 2, 'changed', '戌');
    setPillarBranch(combinesOnly, 'day', '酉');
    setPillarBranch(combinesOnly, 'month', '申');
    expect(deriveCalendarEffectsFromFixture(combinesOnly, DEFAULT_RULE_CONTEXT))
      .toEqual(expect.arrayContaining([expect.objectContaining({
        relation: 'is-day-break',
        target: { type: 'line', id: 'line:1', side: 'base' },
      })]));

    const residualQi = calendarFixture();
    setFacetBranch(residualQi, 1, 'base', '巳');
    setFacetBranch(residualQi, 1, 'changed', '巳');
    setPillarBranch(residualQi, 'day', '亥');
    setPillarBranch(residualQi, 'month', '未');
    const residualFacts = deriveCalendarEffectsFromFixture(residualQi, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(residualFacts).toEqual(expect.arrayContaining([expect.objectContaining({
      relation: 'has-month-status',
      values: expect.objectContaining({ status: 'residual-qi', effectiveSupport: false }),
    })]));
    expect(residualFacts.some(({ relation }) => relation === 'is-dark-moving')).toBe(false);
  });

  it('never classifies a moving line through its own changed facet', () => {
    const movingTarget = calendarFixture([9, 8, 8, 8, 7, 8]);
    setFacetBranch(movingTarget, 1, 'base', '卯');
    setFacetBranch(movingTarget, 1, 'changed', '子');
    setPillarBranch(movingTarget, 'day', '酉');
    setPillarBranch(movingTarget, 'month', '申');
    const targetFacts = deriveCalendarEffectsFromFixture(movingTarget, DEFAULT_RULE_CONTEXT)
      .filter(({ target }) => target?.type === 'line' && target.id === 'line:1');
    expect(targetFacts.some(({ relation }) => (
      relation === 'is-dark-moving' || relation === 'is-day-break'
    ))).toBe(false);
  });

  it('checks void and month-break on base plus true changed only', () => {
    const plate = calendarFixture([9, 7, 8, 8, 7, 8]);
    setPillarBranch(plate, 'month', '子');
    plate.calendar.pillars.day.voidBranches = ['午', '未'];
    setFacetBranch(plate, 1, 'base', '寅');
    setFacetBranch(plate, 1, 'changed', '午');
    setFacetBranch(plate, 2, 'base', '巳');
    setFacetBranch(plate, 2, 'changed', '午');
    const facts = deriveCalendarEffectsFromFixture(plate, DEFAULT_RULE_CONTEXT);
    expect(facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'is-month-break', target: { type: 'line', id: 'line:1', side: 'changed' } }),
      expect.objectContaining({ relation: 'is-void', target: { type: 'line', id: 'line:1', side: 'changed' } }),
    ]));
    expect(facts.some(({ relation, target }) => (
      (relation === 'is-month-break' || relation === 'is-void')
      && target?.type === 'line'
      && target.id === 'line:2'
      && target.side === 'changed'
    ))).toBe(false);
  });

  it('matches all 60 Jia-Zi by all 12 branches against the reviewed xun-void matrix', () => {
    for (const [ganZhi, xun, voidBranches] of SIXTY_JIA_ZI_GOLDEN) {
      for (let offset = 0; offset < BRANCHES.length; offset += 6) {
        const fixture = calendarFixture();
        const day = fixture.calendar.pillars.day;
        const stem = ganZhi[0] as Stem;
        const branch = ganZhi[1] as Branch;
        day.ganZhi = ganZhi;
        day.stem = { value: stem, element: STEM_ELEMENT[stem] };
        day.branch = { value: branch, element: BRANCH_ELEMENT[branch] };
        day.xun = xun;
        day.voidBranches = voidBranches;
        const testedBranches = BRANCHES.slice(offset, offset + 6);
        testedBranches.forEach((branch, index) => {
          setFacetBranch(fixture, index + 1, 'base', branch);
          setFacetBranch(fixture, index + 1, 'changed', branch);
        });
        const facts = deriveCalendarEffectsFromFixture(fixture, DEFAULT_RULE_CONTEXT);
        testedBranches.forEach((branch, index) => {
          const isVoid = facts.some(({ relation, target }) => (
            relation === 'is-void'
            && target?.type === 'line'
            && target.id === `line:${index + 1}`
            && target.side === 'base'
          ));
          expect(isVoid, `${ganZhi}/${branch}`).toBe(
            (voidBranches as readonly Branch[]).includes(branch),
          );
        });
      }
    }
  });

  it('keeps every effects fact stable, attributed, deeply frozen and mutually exclusive', () => {
    const plate = calendarFixture([9, 7, 8, 6, 7, 8]);
    const first = deriveCalendarEffects(plate, DEFAULT_RULE_CONTEXT);
    const second = deriveCalendarEffects(structuredClone(plate), DEFAULT_RULE_CONTEXT);
    expect(second).toEqual(first);
    expect(first.map(({ id }) => id)).toEqual([...first.map(({ id }) => id)].sort());
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(first.every((fact) => (
      Object.isFrozen(fact)
      && fact.ruleId.length > 0
      && fact.profileId === 'yehe_effects_v1'
      && fact.sourceRefs.length > 0
    ))).toBe(true);
    for (const line of plate.lines) {
      const relations = first
        .filter(({ target }) => target?.type === 'line' && target.id === line.id)
        .map(({ relation }) => relation);
      expect(relations.includes('is-dark-moving') && relations.includes('is-day-break')).toBe(false);
    }
  });

  it('binds the two independent matched reviews and opens the exact production gate', () => {
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.dependsOn).toEqual({
      wenwangArtifactHash: '241c0e38175fbfaa8ff04d9c8a65249ccd896ede0e292eb3c83d60f60993ffaa',
      relationArtifactHash: '60a7d9f9e9d607c83ddfe191347c1b9e5f30a47d1ee53a3e70fe29976aea8608',
      growthShenShaArtifactHash: 'e216e1d8a854972a1c5524bc8f73162e6eb2754144fd971152b795e24318f129',
    });
    expect(createHash('sha256').update(LIUYAO_EFFECTS_V1_CANONICAL_PAYLOAD, 'utf8').digest('hex'))
      .toBe(LIUYAO_EFFECTS_V1_ARTIFACT_HASH);
    expect(LIUYAO_EFFECTS_V1_MANIFEST).toMatchObject({
      bundleId: 'liuyao_effects_v1',
      verificationLevel: 'independent-automated',
      runtimeStatus: 'project-enabled',
      reviews: [
        {
          reviewerId: 'codex-source-reviewer-effects-a-24bcce01bb0c4f31',
          reviewerKind: 'automated-agent',
          independentRunId: 'effects-a-20260712-115921-24bcce01bb0c4f318a377bbf47be82dd',
          reviewedAt: '2026-07-12T11:59:21+08:00',
          reportPath: EFFECTS_REVIEW_REPORT_PATHS[0],
          artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
          inputSourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
          checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
          outcome: 'matched',
        },
        {
          reviewerId: 'codex-corpus-matrix-effects-b',
          reviewerKind: 'automated-agent',
          independentRunId: 'liuyao-effects-v1-b-a5d7cb2f-77da-4b82-bd23-2d9a9c5454c4',
          reviewedAt: '2026-07-12T12:00:40.9619972+08:00',
          reportPath: EFFECTS_REVIEW_REPORT_PATHS[1],
          artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH,
          inputSourceRefs: EFFECTS_SOURCE_EVIDENCE_CAPSULES.map(({ ref }) => ref.id),
          checkedClaims: EFFECTS_REVIEW_CHECKED_CLAIMS,
          outcome: 'matched',
        },
      ],
    });
    expect(Object.isFrozen(LIUYAO_EFFECTS_V1_MANIFEST)).toBe(true);
    expect(Object.isFrozen(LIUYAO_EFFECTS_V1_MANIFEST.reviews)).toBe(true);
    expect(LIUYAO_EFFECTS_V1_MANIFEST.reviews.every((review) => (
      Object.isFrozen(review)
      && Object.isFrozen(review.inputSourceRefs)
      && Object.isFrozen(review.checkedClaims)
    ))).toBe(true);
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.blockers).toEqual([
      'is-void',
      'is-month-break',
      'is-day-break',
      'is-growth-stage',
      'changes-to-tomb',
    ]);
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.dayGrowthStageBlocker).toEqual({
      sourcePillar: 'day',
      stage: '墓',
      excludedPillars: ['year', 'month', 'hour'],
    });
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.duplicateMemberResolution).toEqual({
      enumeration: 'all-activated-member-combinations',
      preference: 'unblocked-first',
      tieBreak: 'code-unit-minimum-member-entity-ids',
      alternatives: 'record-non-selected-activated-member-sets',
    });
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.dayClash.supportSources).toEqual([
      'month', 'day', 'other-moving-base-line',
    ]);
    expect(LIUYAO_EFFECTS_V1_ARTIFACT.fanFu.variants[0]).toMatchObject({
      id: 'directional-trigram-fan-yin-v1',
      enabled: false,
      oppositeTrigramPairs: [
        ['乾', '巽'],
        ['坎', '离'],
        ['艮', '坤'],
        ['震', '兑'],
      ],
      sourceRefs: ['CORPUS-BUSHI-EFFECTS'],
    });
    expect(() => assertProjectEnabledEffectsBundle()).not.toThrow();
    expect(() => assertProjectEnabledEffectsContext(DEFAULT_RULE_CONTEXT))
      .not.toThrow();
    expect(domain).toHaveProperty('deriveEffectsFacts', expect.any(Function));
    expect(domain).not.toHaveProperty('deriveCalendarEffectsForReviewFixture');
    expect(domain).not.toHaveProperty('deriveMovingEffectsForReviewFixture');
    expect(domain).not.toHaveProperty('deriveFormationsForReviewFixture');
    expect(domain).not.toHaveProperty('deriveEffectsFactsForInternalPipeline');
    expect(calendarEffectsModule).not.toHaveProperty('deriveCalendarEffectsForReviewFixture');
    expect(movingEffectsModule).not.toHaveProperty('deriveMovingEffectsForReviewFixture');
    expect(formationsModule).not.toHaveProperty('deriveFormationsForReviewFixture');
  });

  it('keeps trusted dependencies out of the public API and closes every production basis id', () => {
    const deriveEffects = (domain as typeof domain & {
      deriveEffectsFacts?: (input: unknown) => readonly import('../model.js').DerivedFact[];
    }).deriveEffectsFacts;
    expect(deriveEffects).toBeTypeOf('function');
    if (!deriveEffects) return;

    const plate = buildPlateV2({
      ...BUILD_INPUT,
      tossValues: [8, 6, 6, 8, 7, 8],
    });
    expect(() => deriveEffects({
      plate,
      ruleContext: DEFAULT_RULE_CONTEXT,
      relationFacts: [],
      growthFacts: [],
    })).toThrow('日月动变派生输入无效');

    const effects = deriveEffects({ plate, ruleContext: DEFAULT_RULE_CONTEXT });
    expect(effects.some(({ scope }) => scope === 'calendar')).toBe(true);
    expect(effects.some(({ scope }) => scope === 'transition')).toBe(true);
    expect(effects.some(({ scope }) => scope === 'formation')).toBe(true);

    const allFacts = deriveFacts({ plate, ruleContext: DEFAULT_RULE_CONTEXT });
    const allFactIds = new Set(allFacts.map(({ id }) => id));
    const referencedFactIds = effects.flatMap(({ values }) => Object.entries(values)
      .filter(([key, value]) => key.endsWith('FactIds') && Array.isArray(value))
      .flatMap(([, value]) => value as readonly string[]));
    expect(referencedFactIds.every((id) => allFactIds.has(id))).toBe(true);
  });

  it('rejects forged effects profiles, registered sources and project-enabled manifests', () => {
    const fixture = calendarFixture();
    const forgedProfile = {
      ...structuredClone(DEFAULT_RULE_CONTEXT),
      effectsProfile: {
        ...structuredClone(DEFAULT_RULE_CONTEXT.effectsProfile),
        dayClashPolicy: 'forged',
      },
    } as unknown as RuleContext;
    expect(() => deriveCalendarEffects(fixture, forgedProfile))
      .toThrow('日月动变规则上下文未通过项目运行门');

    const forgedSource = structuredClone(DEFAULT_RULE_CONTEXT);
    forgedSource.sources[forgedSource.sources.length - 1].locator = 'forged';
    expect(() => deriveCalendarEffects(fixture, forgedSource))
      .toThrow('日月动变规则上下文未通过项目运行门');

    const forgedManifest = {
      ...structuredClone(LIUYAO_EFFECTS_V1_MANIFEST),
      verificationLevel: 'independent-automated',
      runtimeStatus: 'project-enabled',
      reviews: [],
    };
    expect(() => assertProjectEnabledEffectsBundle(forgedManifest))
      .toThrow('日月动变规则包未通过项目运行门');
  });

  it('binds every source capsule and merges identical ids while rejecting divergent duplicates', () => {
    for (const { ref, payload } of EFFECTS_SOURCE_EVIDENCE_CAPSULES) {
      expect(createHash('sha256').update(payload, 'utf8').digest('hex'), ref.id)
        .toBe(ref.contentHash);
    }
    expect(new Set(DEFAULT_RULE_CONTEXT.sources.map(({ id }) => id)).size)
      .toBe(DEFAULT_RULE_CONTEXT.sources.length);
    const source = EFFECTS_SOURCE_EVIDENCE_CAPSULES[0].ref;
    expect(mergeRuleSourceRefs([source], [structuredClone(source)])).toEqual([source]);
    expect(() => mergeRuleSourceRefs([source], [{ ...source, locator: 'forged' }]))
      .toThrow('规则来源 ID 冲突');
  });

  it('moves day-clash policy into effectsProfile and merges Task 5 into production deriveFacts', () => {
    expect(DEFAULT_RULE_CONTEXT.relationProfile).not.toHaveProperty('dayClashPolicy');
    expect(DEFAULT_RULE_CONTEXT.effectsProfile).toMatchObject({
      id: 'yehe_effects_v1',
      bundle: { id: 'liuyao_effects_v1', artifactHash: LIUYAO_EFFECTS_V1_ARTIFACT_HASH },
      dayClashPolicy: 'yehe-static-strength-aware-v1',
    });
    const facts = deriveFacts({
      plate: buildPlateV2({ ...BUILD_INPUT, tossValues: [9, 7, 8, 6, 7, 8] }),
      ruleContext: DEFAULT_RULE_CONTEXT,
    });
    const task5Relations = new Set([
      'has-month-status', 'is-month-break', 'is-day-break', 'is-dark-moving',
      'returns-generate', 'returns-control', 'returns-clash', 'returns-combine',
      'advances', 'retreats', 'changes-to-tomb', 'changes-to-absolute',
      'forms-three-harmony', 'has-three-harmony-candidate',
      'is-six-harmony', 'is-six-clash', 'is-fan-yin', 'is-fu-yin',
    ]);
    expect(facts.some(({ relation }) => task5Relations.has(relation))).toBe(true);
    expect(facts.some(({ relation }) => relation === 'is-growth-stage')).toBe(true);
  });
});
