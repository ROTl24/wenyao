import {
  createCaseFactIndex,
  entityRefKey,
  type CaseFactIndex,
  type DerivedFact,
  type DivinationCaseV2,
  type PlateLineV2,
} from '../../domain/liuyao';

export interface LineFactView {
  readonly line: PlateLineV2;
  readonly side: 'base' | 'changed';
  readonly targetFacts: readonly DerivedFact[];
  readonly growthFacts: readonly DerivedFact[];
  readonly shenShaFacts: readonly DerivedFact[];
  readonly sixSpiritFact?: DerivedFact;
  readonly effectFacts: readonly DerivedFact[];
}

export interface ResultCaseView {
  readonly caseSnapshot: DivinationCaseV2;
  readonly factIndex: CaseFactIndex;
  readonly baseLines: readonly LineFactView[];
  readonly changedLines: readonly LineFactView[];
  readonly factsByAuthority: Readonly<Record<'structural' | 'profile-dependent' | 'secondary', readonly DerivedFact[]>>;
}

const EFFECT_RELATIONS = new Set([
  'is-void', 'is-month-break', 'is-day-break', 'is-dark-moving',
  'returns-generate', 'returns-control', 'returns-clash', 'returns-combine',
  'advances', 'retreats', 'changes-to-tomb', 'changes-to-absolute',
]);

function exactTargetFacts(index: CaseFactIndex, line: PlateLineV2, side: 'base' | 'changed'): readonly DerivedFact[] {
  const key = entityRefKey({ type: 'line', id: line.id, side });
  return (index.byEntity[key] ?? []).filter((fact) => fact.target && entityRefKey(fact.target) === key);
}

function lineView(index: CaseFactIndex, line: PlateLineV2, side: 'base' | 'changed'): LineFactView {
  const targetFacts = exactTargetFacts(index, line, side);
  const spiritFacts = side === 'base' ? targetFacts : exactTargetFacts(index, line, 'base');
  return {
    line,
    side,
    targetFacts,
    growthFacts: targetFacts.filter((fact) => fact.relation === 'is-growth-stage'),
    shenShaFacts: targetFacts.filter((fact) => fact.relation === 'is-shen-sha'),
    sixSpiritFact: spiritFacts.find((fact) => fact.relation === 'is-six-beast'),
    effectFacts: targetFacts.filter((fact) => EFFECT_RELATIONS.has(fact.relation)),
  };
}

/** Creates the strict fact index once and derives all result projections from it. */
export function selectResultCase(caseSnapshot: DivinationCaseV2): ResultCaseView {
  const factIndex = createCaseFactIndex(caseSnapshot.facts);
  const descending = [...caseSnapshot.plate.lines].sort((left, right) => right.position - left.position);
  return Object.freeze({
    caseSnapshot,
    factIndex,
    baseLines: Object.freeze(descending.map((line) => lineView(factIndex, line, 'base'))),
    changedLines: Object.freeze(descending.map((line) => lineView(factIndex, line, 'changed'))),
    factsByAuthority: Object.freeze({
      structural: factIndex.byAuthority.structural ?? [],
      'profile-dependent': factIndex.byAuthority['profile-dependent'] ?? [],
      secondary: factIndex.byAuthority.secondary ?? [],
    }),
  });
}
