import type {
  Branch,
  DerivedFact,
  EntityRef,
  PlateV2,
} from '../model.js';
import type { RuleContext } from '../rules/model.js';
import {
  LIUYAO_EFFECTS_V1_ARTIFACT,
  effectsRule,
} from './effects-core-v1.js';
import { createFactId, stableFacts } from './model.js';

type LineRef = Extract<EntityRef, { type: 'line' }>;
export type AdvanceRetreatPolicy = 'yehe-seven-pair-v1' | 'bushi-eight-pair-audit-v1';
export type AdvanceRetreatRelation = 'advances' | 'retreats';

const BRANCHES = new Set<Branch>([
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
]);

function isBranch(value: unknown): value is Branch {
  return typeof value === 'string' && BRANCHES.has(value as Branch);
}

export function advanceRetreatRelation(
  base: Branch,
  changed: Branch,
  policy?: AdvanceRetreatPolicy,
): AdvanceRetreatRelation | null;
export function advanceRetreatRelation(
  base: unknown,
  changed: unknown,
  policy?: unknown,
): AdvanceRetreatRelation | null;
export function advanceRetreatRelation(
  base: unknown,
  changed: unknown,
  policy: unknown = 'yehe-seven-pair-v1',
): AdvanceRetreatRelation | null {
  if (!isBranch(base) || !isBranch(changed)) throw new Error('进退神输入无效');
  if (policy !== 'yehe-seven-pair-v1' && policy !== 'bushi-eight-pair-audit-v1') {
    throw new Error('进退神 profile 不匹配');
  }
  const pairs = policy === 'yehe-seven-pair-v1'
    ? LIUYAO_EFFECTS_V1_ARTIFACT.moving.defaultAdvancePairs
    : LIUYAO_EFFECTS_V1_ARTIFACT.moving.auditAdvancePairs;
  if (pairs.some(([from, to]) => from === base && to === changed)) return 'advances';
  if (pairs.some(([from, to]) => from === changed && to === base)) return 'retreats';
  return null;
}

function lineRef(id: string, side: 'base' | 'changed'): LineRef {
  return { type: 'line', id, side };
}

function entityKey(ref: LineRef): string {
  return `line:${ref.id}:${ref.side}`;
}

function movingFact(
  relation: DerivedFact['relation'],
  source: LineRef,
  target: LineRef,
  values: DerivedFact['values'],
  certaintyOverride?: DerivedFact['certainty'],
  conditions: readonly string[] = [],
): DerivedFact {
  const rule = effectsRule(relation);
  return {
    id: createFactId([
      'transition',
      entityKey(source),
      relation,
      entityKey(target),
      rule.ruleId,
      rule.profileId,
    ]),
    relation,
    source,
    target,
    scope: 'transition',
    authority: rule.authority,
    ruleId: rule.ruleId,
    profileId: rule.profileId,
    certainty: certaintyOverride
      ?? (rule.certainty === 'delegated-twelve-stage' ? 'computed' : rule.certainty),
    conditions,
    values,
    sourceRefs: rule.sourceRefs,
  };
}

function isLine(ref: EntityRef | undefined, id: string, side: 'base' | 'changed'): boolean {
  return ref?.type === 'line' && ref.id === id && ref.side === side;
}

function transitionBasisFacts(
  relationFacts: readonly DerivedFact[],
  lineId: string,
): readonly DerivedFact[] {
  const comparisonId = `transition|line:${lineId}:changed|line:${lineId}:base`;
  return relationFacts.filter((fact) => (
    fact.scope === 'transition'
    && fact.values.comparisonId === comparisonId
    && isLine(fact.source, lineId, 'changed')
    && isLine(fact.target, lineId, 'base')
  ));
}

function deriveValidated(
  plate: PlateV2,
  ruleContext: RuleContext,
  relationFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const facts: DerivedFact[] = [];
  const returnMapping = LIUYAO_EFFECTS_V1_ARTIFACT.moving.returnBasisRelations;

  for (const line of [...plate.lines].sort((left, right) => left.position - right.position)) {
    if (line.transition === null) continue;
    const changed = lineRef(line.id, 'changed');
    const base = lineRef(line.id, 'base');
    const basisFacts = transitionBasisFacts(relationFacts, line.id);
    for (const basis of basisFacts) {
      if (!(basis.relation in returnMapping)) continue;
      const relation = returnMapping[basis.relation as keyof typeof returnMapping];
      facts.push(movingFact(relation, changed, base, {
        linePosition: line.position,
        baseBranch: line.base.branch,
        changedBranch: line.changed.branch,
        direction: 'changed-to-base',
        basisFactIds: [basis.id],
      }));
    }

    const advanceOrRetreat = advanceRetreatRelation(
      line.base.branch,
      line.changed.branch,
      ruleContext.effectsProfile.advanceRetreatPolicy,
    );
    if (advanceOrRetreat) {
      facts.push(movingFact(advanceOrRetreat, base, changed, {
        linePosition: line.position,
        baseBranch: line.base.branch,
        changedBranch: line.changed.branch,
        direction: 'base-to-changed',
        basisFactIds: [],
      }));
    }

    const growthBasis = growthFacts.find((fact) => (
      fact.relation === 'is-growth-stage'
      && fact.scope === 'transition'
      && isLine(fact.source, line.id, 'base')
      && isLine(fact.target, line.id, 'changed')
    ));
    if (!growthBasis || typeof growthBasis.values.stage !== 'string') {
      throw new Error(`动爻十二长生依据缺失：${line.id}`);
    }
    const stage = growthBasis.values.stage;
    if (stage === '墓' || stage === '绝') {
      const relation = stage === '墓' ? 'changes-to-tomb' : 'changes-to-absolute';
      facts.push(movingFact(
        relation,
        base,
        changed,
        {
          linePosition: line.position,
          baseElement: line.base.branchElement,
          baseBranch: line.base.branch,
          changedBranch: line.changed.branch,
          stage,
          evaluator: 'twelveStage',
          dependencyArtifactHash: LIUYAO_EFFECTS_V1_ARTIFACT.dependsOn.growthShenShaArtifactHash,
          direction: 'base-to-changed',
          basisFactIds: [growthBasis.id],
        },
        growthBasis.certainty,
        growthBasis.conditions,
      ));
    }
  }
  return stableFacts(facts);
}

/** @internal 只接收领域内核同一轮产生的 Task 4/6 事实；不得经 barrel 或 IPC 暴露。 */
export function deriveMovingEffectsFromTrustedFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
  relationFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  return deriveValidated(plate, ruleContext, relationFacts, growthFacts);
}
