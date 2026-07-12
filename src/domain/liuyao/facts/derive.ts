import type {
  Branch,
  DerivedFact,
  Element,
  EntityRef,
  PlateV2,
  UseGodSelection,
} from '../model.js';
import { assertPlateV2RuntimeShape } from '../plate-runtime.js';
import type { RuleContext } from '../rules/model.js';
import { deepFreeze, type LinePosition } from '../rules/tables.js';
import { branchRelationMatches } from './branch-relations.js';
import { elementRelation, type ElementRelation } from './element-relations.js';
import { deriveGrowthShenShaFacts } from './growth-shensha.js';
import { deriveCalendarEffectsFromTrustedFacts } from './calendar-effects.js';
import { deriveMovingEffectsFromTrustedFacts } from './moving-effects.js';
import { deriveFormationsFromTrustedFacts } from './formations.js';
import { assertProjectEnabledEffectsContext } from './effects-registry.js';
import { createFactId, stableFacts } from './model.js';
import {
  assertProjectEnabledRelationContext,
} from './relation-registry.js';
import { RELATION_CORE_V1_ARTIFACT } from './relation-core-v1.js';
import {
  deriveUseGodDependentFacts,
  deriveUseGodIndependentFacts,
} from './use-god-effects.js';

type ComparisonScope = 'calendar' | 'base' | 'transition';
type RelationEntityRef = Extract<EntityRef, { type: 'pillar' | 'line' }>;

export interface FactComparisonEntity {
  readonly ref: RelationEntityRef;
  readonly element: Element;
  readonly branch: Branch;
  readonly linePosition?: LinePosition;
}

export interface FactComparison {
  readonly id: string;
  readonly scope: ComparisonScope;
  readonly source: FactComparisonEntity;
  readonly target: FactComparisonEntity;
}

export interface DeriveFactsInput {
  readonly plate: PlateV2;
  readonly ruleContext: RuleContext;
  readonly useGod?: UseGodSelection;
}

export interface DeriveEffectsFactsInput {
  readonly plate: PlateV2;
  readonly ruleContext: RuleContext;
}

const PILLAR_ORDER = ['year', 'month', 'day', 'hour'] as const;

function entityKey(ref: RelationEntityRef): string {
  return ref.type === 'pillar'
    ? `pillar:${ref.id}`
    : `line:${ref.id}:${ref.side}`;
}

function lineEntity(
  line: PlateV2['lines'][number],
  side: 'base' | 'changed',
): FactComparisonEntity {
  const facet = line[side];
  return {
    ref: { type: 'line', id: line.id, side },
    element: facet.branchElement,
    branch: facet.branch,
    linePosition: line.position,
  };
}

function comparison(
  scope: ComparisonScope,
  source: FactComparisonEntity,
  target: FactComparisonEntity,
): FactComparison {
  return {
    id: [scope, entityKey(source.ref), entityKey(target.ref)].join('|'),
    scope,
    source,
    target,
  };
}

export function enumerateFactComparisons(plate: PlateV2): readonly FactComparison[] {
  assertPlateV2RuntimeShape(plate);
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const comparisons: FactComparison[] = [];

  for (const pillarKind of PILLAR_ORDER) {
    const pillar = plate.calendar.pillars[pillarKind];
    const pillarEntity: FactComparisonEntity = {
      ref: { type: 'pillar', id: pillarKind },
      element: pillar.branch.element,
      branch: pillar.branch.value,
    };
    for (const line of lines) {
      comparisons.push(comparison('calendar', pillarEntity, lineEntity(line, 'base')));
    }
  }

  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      const left = lines[leftIndex];
      const right = lines[rightIndex];
      if (!left.moving && !right.moving) continue;
      comparisons.push(comparison('base', lineEntity(left, 'base'), lineEntity(right, 'base')));
    }
  }

  for (const line of lines) {
    if (!line.moving) continue;
    comparisons.push(comparison(
      'transition',
      lineEntity(line, 'changed'),
      lineEntity(line, 'base'),
    ));
  }

  return deepFreeze(comparisons);
}

function orientElementRelation(
  left: FactComparisonEntity,
  right: FactComparisonEntity,
): { relation: ElementRelation; source: FactComparisonEntity; target: FactComparisonEntity } {
  const forward = elementRelation(left.element, right.element);
  if (forward !== null) return { relation: forward, source: left, target: right };
  const reverse = elementRelation(right.element, left.element);
  if (reverse === null) throw new Error(`五行关系矩阵不完整：${left.element}/${right.element}`);
  return { relation: reverse, source: right, target: left };
}

function factId(
  scope: ComparisonScope,
  source: RelationEntityRef,
  relation: string,
  target: RelationEntityRef,
  ruleId: string,
  profileId: string,
): string {
  return createFactId([
    scope,
    entityKey(source),
    relation,
    entityKey(target),
    ruleId,
    profileId,
  ]);
}

function deriveElementFact(item: FactComparison): DerivedFact {
  const oriented = orientElementRelation(item.source, item.target);
  const rule = RELATION_CORE_V1_ARTIFACT.elementRules.find(
    ({ relation }) => relation === oriented.relation,
  );
  if (!rule) throw new Error(`关系规则包缺少五行规则：${oriented.relation}`);
  return {
    id: factId(
      item.scope,
      oriented.source.ref,
      oriented.relation,
      oriented.target.ref,
      rule.ruleId,
      rule.profileId,
    ),
    relation: oriented.relation,
    source: oriented.source.ref,
    target: oriented.target.ref,
    scope: item.scope,
    authority: rule.authority,
    ruleId: rule.ruleId,
    profileId: rule.profileId,
    certainty: rule.certainty,
    conditions: [],
    values: {
      comparisonId: item.id,
      sourceElement: oriented.source.element,
      targetElement: oriented.target.element,
    },
    sourceRefs: rule.sourceRefs,
  };
}

function deriveBranchFacts(
  item: FactComparison,
  ruleContext: RuleContext,
): readonly DerivedFact[] {
  return branchRelationMatches(
    item.source.branch,
    item.target.branch,
    ruleContext.relationProfile,
  ).map((match): DerivedFact => {
    const reverse = match.direction === 'reverse';
    const source = reverse ? item.target : item.source;
    const target = reverse ? item.source : item.target;
    return {
      id: factId(
        item.scope,
        source.ref,
        match.relation,
        target.ref,
        match.ruleId,
        match.profileId,
      ),
      relation: match.relation,
      source: source.ref,
      target: target.ref,
      scope: item.scope,
      authority: match.authority,
      ruleId: match.ruleId,
      profileId: match.profileId,
      certainty: match.certainty,
      conditions: [],
      values: {
        comparisonId: item.id,
        sourceBranch: source.branch,
        targetBranch: target.branch,
        direction: match.direction === 'symmetric' ? 'symmetric' : 'forward',
      },
      sourceRefs: match.sourceRefs,
    };
  });
}

function deriveRelationFactsValidated(input: DeriveFactsInput): readonly DerivedFact[] {
  void input.useGod;
  if (
    input.plate.schemaVersion !== '2.0.0'
    || input.plate.rulePackRef.id !== 'wenwang_najia_v2'
    || input.plate.rulePackRef.version !== '2.0.0'
    || input.plate.rulePackRef.artifactHash
      !== RELATION_CORE_V1_ARTIFACT.dependsOnWenwangArtifactHash
  ) {
    throw new Error('关系事实排盘依赖不匹配');
  }
  const facts = enumerateFactComparisons(input.plate).flatMap((item) => [
    deriveElementFact(item),
    ...deriveBranchFacts(item, input.ruleContext),
  ]);
  return stableFacts(facts);
}

/** @internal 仅供同一领域内核的受信编排；不得经 barrel 或 IPC 暴露。 */
export function deriveRelationFactsForInternalPipeline(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly DerivedFact[] {
  assertPlateV2RuntimeShape(plate);
  assertProjectEnabledRelationContext(ruleContext);
  return deriveRelationFactsValidated({ plate, ruleContext });
}

function deriveEffectsFromTrustedFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
  relationFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const calendarFacts = deriveCalendarEffectsFromTrustedFacts(
    plate,
    ruleContext,
    relationFacts,
  );
  const movingFacts = deriveMovingEffectsFromTrustedFacts(
    plate,
    ruleContext,
    relationFacts,
    growthFacts,
  );
  const formationFacts = deriveFormationsFromTrustedFacts(
    plate,
    ruleContext,
    calendarFacts,
    movingFacts,
    growthFacts,
  );
  return stableFacts([...calendarFacts, ...movingFacts, ...formationFacts]);
}

interface TrustedFactPipeline {
  readonly relationFacts: readonly DerivedFact[];
  readonly growthFacts: readonly DerivedFact[];
  readonly effectsFacts: readonly DerivedFact[];
  readonly useGodIndependentFacts: readonly DerivedFact[];
}

function deriveTrustedFactPipeline(
  plate: PlateV2,
  ruleContext: RuleContext,
  useGodIndependentDeriver: ((
    targetPlate: PlateV2,
    context: RuleContext,
  ) => readonly DerivedFact[]) | null = deriveUseGodIndependentFacts,
): TrustedFactPipeline {
  const relationFacts = deriveRelationFactsForInternalPipeline(plate, ruleContext);
  const growthFacts = deriveGrowthShenShaFacts({ plate, ruleContext });
  const effectsFacts = deriveEffectsFromTrustedFacts(
    plate,
    ruleContext,
    relationFacts,
    growthFacts,
  );
  const useGodIndependentFacts = useGodIndependentDeriver === null
    ? []
    : useGodIndependentDeriver(plate, ruleContext);
  return { relationFacts, growthFacts, effectsFacts, useGodIndependentFacts };
}

function assertEffectsInput(input: unknown): asserts input is DeriveEffectsFactsInput {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('日月动变派生输入无效');
  }
  const keys = Reflect.ownKeys(input);
  if (
    keys.length !== 2
    || !keys.includes('plate')
    || !keys.includes('ruleContext')
    || keys.some((key) => key !== 'plate' && key !== 'ruleContext')
  ) throw new Error('日月动变派生输入无效');
}

export function deriveEffectsFacts(input: DeriveEffectsFactsInput): readonly DerivedFact[];
export function deriveEffectsFacts(input: unknown): readonly DerivedFact[] {
  assertEffectsInput(input);
  assertPlateV2RuntimeShape(input.plate);
  assertProjectEnabledEffectsContext(input.ruleContext);
  return deriveTrustedFactPipeline(input.plate, input.ruleContext, null).effectsFacts;
}

export function deriveFacts(input: DeriveFactsInput): readonly DerivedFact[];
export function deriveFacts(input: unknown): readonly DerivedFact[] {
  const candidate = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as Partial<DeriveFactsInput>
    : {};
  assertPlateV2RuntimeShape(candidate.plate);
  assertProjectEnabledEffectsContext(candidate.ruleContext);
  const validated = candidate as DeriveFactsInput;
  const pipeline = deriveTrustedFactPipeline(
    validated.plate,
    validated.ruleContext,
  );
  const dependentFacts = Object.prototype.hasOwnProperty.call(candidate, 'useGod')
    ? deriveUseGodDependentFacts(validated.plate, validated.ruleContext, candidate.useGod)
    : [];
  return stableFacts([
    ...pipeline.relationFacts,
    ...pipeline.growthFacts,
    ...pipeline.effectsFacts,
    ...pipeline.useGodIndependentFacts,
    ...dependentFacts,
  ]);
}
