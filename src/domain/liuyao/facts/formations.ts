import type {
  DerivedFact,
  EntityRef,
  PlateV2,
} from '../model.js';
import { assertPlateV2RuntimeShape } from '../plate-runtime.js';
import { BASE_RULE_CONTEXT } from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { branchRelationMatches } from './branch-relations.js';
import {
  LIUYAO_EFFECTS_V1_ARTIFACT,
  effectsRule,
} from './effects-core-v1.js';
import { createFactId, stableFacts } from './model.js';

type HexagramRef = Extract<EntityRef, { type: 'hexagram' }>;
type LineRef = Extract<EntityRef, { type: 'line' }>;
type HexagramSide = 'base' | 'changed';
type ThreeHarmonyMemberMode = typeof LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.memberModes[number];
export type HexagramSideFormation = 'six-harmony' | 'six-clash' | null;

function hexagramRef(id: HexagramSide): HexagramRef {
  return { type: 'hexagram', id };
}

function lineRef(id: string, side: HexagramSide): LineRef {
  return { type: 'line', id, side };
}

function lineKey(ref: LineRef): string {
  return `line:${ref.id}:${ref.side}`;
}

function branchHasRelation(
  left: PlateV2['lines'][number]['base']['branch'],
  right: PlateV2['lines'][number]['base']['branch'],
  relation: 'combines' | 'clashes',
  ruleContext: RuleContext = BASE_RULE_CONTEXT,
): boolean {
  return branchRelationMatches(left, right, ruleContext.relationProfile)
    .some((match) => match.relation === relation);
}

export function hexagramSideFormation(
  plate: PlateV2,
  side: HexagramSide,
  ruleContext: RuleContext = BASE_RULE_CONTEXT,
): HexagramSideFormation {
  assertPlateV2RuntimeShape(plate);
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const pairs = LIUYAO_EFFECTS_V1_ARTIFACT.sideFormations.correspondingLinePairs;
  if (pairs.every(([left, right]) => branchHasRelation(
    lines[left - 1][side].branch,
    lines[right - 1][side].branch,
    'combines',
    ruleContext,
  ))) return 'six-harmony';
  if (pairs.every(([left, right]) => branchHasRelation(
    lines[left - 1][side].branch,
    lines[right - 1][side].branch,
    'clashes',
    ruleContext,
  ))) return 'six-clash';
  return null;
}

export interface FanFuSnapshot {
  readonly innerFan: boolean;
  readonly outerFan: boolean;
  readonly innerFu: boolean;
  readonly outerFu: boolean;
}

export function correspondingFanFu(
  plate: PlateV2,
  ruleContext: RuleContext = BASE_RULE_CONTEXT,
): FanFuSnapshot {
  assertPlateV2RuntimeShape(plate);
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const check = (indices: readonly number[], relation: 'fan' | 'fu'): boolean => (
    indices.some((index) => lines[index].moving)
    && indices.every((index) => {
      const base = lines[index].base.branch;
      const changed = lines[index].changed.branch;
      return relation === 'fu'
        ? base === changed
        : branchHasRelation(base, changed, 'clashes', ruleContext);
    })
  );
  return {
    innerFan: check([0, 1, 2], 'fan'),
    outerFan: check([3, 4, 5], 'fan'),
    innerFu: check([0, 1, 2], 'fu'),
    outerFu: check([3, 4, 5], 'fu'),
  };
}

function formationFact(
  relation: DerivedFact['relation'],
  source: HexagramRef,
  target: HexagramRef | undefined,
  discriminator: readonly string[],
  values: DerivedFact['values'],
  conditions: readonly string[] = [],
): DerivedFact {
  const rule = effectsRule(relation);
  if (rule.certainty === 'delegated-twelve-stage') throw new Error('卦局规则确定性无效');
  return {
    id: createFactId([
      'formation',
      `hexagram:${source.id}`,
      relation,
      ...(target ? [`hexagram:${target.id}`] : []),
      ...discriminator,
      rule.ruleId,
      rule.profileId,
    ]),
    relation,
    source,
    ...(target ? { target } : {}),
    scope: 'formation',
    authority: rule.authority,
    ruleId: rule.ruleId,
    profileId: rule.profileId,
    certainty: rule.certainty,
    conditions,
    values,
    sourceRefs: rule.sourceRefs,
  };
}

function blockerFactsForMembers(
  members: readonly LineRef[],
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const memberKeys = new Set(members.map(lineKey));
  return [...calendarFacts, ...movingFacts, ...growthFacts].filter((fact) => {
    const isDayGrowthTomb = fact.relation === 'is-growth-stage'
      && fact.scope === 'calendar'
      && fact.source.type === 'pillar'
      && fact.source.id === LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.dayGrowthStageBlocker.sourcePillar
      && fact.values.stage === LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.dayGrowthStageBlocker.stage;
    const isDirectBlocker = fact.relation !== 'is-growth-stage'
      && LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.blockers.includes(
        fact.relation as typeof LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.blockers[number],
      );
    if (!isDayGrowthTomb && !isDirectBlocker) return false;
    const refs = [fact.source, fact.target]
      .filter((ref): ref is LineRef => ref?.type === 'line');
    return refs.some((ref) => memberKeys.has(lineKey(ref)));
  });
}

function threeHarmonyFact(
  group: typeof LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.groups[number],
  memberMode: ThreeHarmonyMemberMode,
  half: 'whole' | 'inner' | 'outer',
  members: readonly LineRef[],
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
  alternativeMemberEntityIds: readonly string[] = [],
  candidateCombinationCount = 1,
): DerivedFact {
  const blockers = blockerFactsForMembers(members, calendarFacts, movingFacts, growthFacts);
  const relation = blockers.length > 0
    ? 'has-three-harmony-candidate'
    : 'forms-three-harmony';
  const memberEntityIds = members.map(lineKey).sort();
  const blockerFactIds = blockers.map(({ id }) => id).sort();
  return formationFact(
    relation,
    hexagramRef('base'),
    members.some(({ side }) => side === 'changed') ? hexagramRef('changed') : undefined,
    [group.id, memberMode, half, ...memberEntityIds],
    {
      trineId: group.id,
      element: group.element,
      memberMode,
      half,
      memberBranches: group.branches,
      memberEntityIds,
      alternativeMemberEntityIds,
      candidateCombinationCount,
      blockerFactIds,
      basisFactIds: [],
    },
    blockers.length > 0
      ? ['complete-membership', 'activated', 'blocked-by-void-month-break-day-break-or-tomb']
      : ['complete-membership', 'activated', 'unblocked'],
  );
}

interface HarmonyMemberCandidate {
  readonly members: readonly LineRef[];
  readonly activated: boolean;
}

function memberSetKey(members: readonly LineRef[]): string {
  return members.map(lineKey).sort().join('|');
}

function selectedThreeHarmonyFact(
  group: typeof LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.groups[number],
  memberMode: ThreeHarmonyMemberMode,
  half: 'whole' | 'inner' | 'outer',
  candidates: readonly HarmonyMemberCandidate[],
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): DerivedFact | null {
  const activated = candidates
    .filter((candidate) => candidate.activated)
    .map((candidate) => ({
      ...candidate,
      key: memberSetKey(candidate.members),
      blockers: blockerFactsForMembers(candidate.members, calendarFacts, movingFacts, growthFacts),
    }))
    .sort((left, right) => (
      left.key < right.key ? -1 : left.key > right.key ? 1 : 0
    ));
  if (activated.length === 0) return null;
  const selected = activated.find(({ blockers }) => blockers.length === 0) ?? activated[0];
  const alternatives = activated
    .filter(({ key }) => key !== selected.key)
    .map(({ key }) => key);
  return threeHarmonyFact(
    group,
    memberMode,
    half,
    selected.members,
    calendarFacts,
    movingFacts,
    growthFacts,
    alternatives,
    activated.length,
  );
}

function cartesianLineMembers(
  candidatesByBranch: readonly (readonly PlateV2['lines'][number][])[],
): readonly (readonly PlateV2['lines'][number][])[] {
  return candidatesByBranch.reduce<readonly (readonly PlateV2['lines'][number][])[]>(
    (combinations, branchCandidates) => combinations.flatMap((combination) => (
      branchCandidates.map((line) => [...combination, line])
    )),
    [[]],
  );
}

function deriveThreeHarmonyFacts(
  plate: PlateV2,
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const darkIds = new Set(calendarFacts
    .filter(({ relation }) => relation === 'is-dark-moving')
    .flatMap(({ target }) => target?.type === 'line' ? [target.id] : []));
  const facts: DerivedFact[] = [];

  for (const group of LIUYAO_EFFECTS_V1_ARTIFACT.threeHarmony.groups) {
    const baseCandidates = cartesianLineMembers(group.branches.map((branch) => (
      lines.filter((line) => line.base.branch === branch)
    ))).map((members): HarmonyMemberCandidate => ({
      members: members.map((line) => lineRef(line.id, 'base')),
      activated: members.some((line) => line.moving || darkIds.has(line.id)),
    }));
    const baseFact = selectedThreeHarmonyFact(
      group,
      'base-three-with-active-member',
      'whole',
      baseCandidates,
      calendarFacts,
      movingFacts,
      growthFacts,
    );
    if (baseFact) facts.push(baseFact);

    for (const [half, firstPosition, lastPosition, memberMode] of [
      ['inner', 1, 3, 'inner-1-3-two-base-one-own-changed'],
      ['outer', 4, 6, 'outer-4-6-two-base-one-own-changed'],
    ] as const) {
      const first = lines[firstPosition - 1];
      const last = lines[lastPosition - 1];
      if (!first.moving || !last.moving) continue;
      const halfCandidates: HarmonyMemberCandidate[] = [];
      for (const changedLine of [first, last]) {
        const branches = new Set([
          first.base.branch,
          last.base.branch,
          changedLine.changed.branch,
        ]);
        if (
          branches.size !== 3
          || !group.branches.every((branch) => branches.has(branch))
        ) continue;
        halfCandidates.push({
          members: [
            lineRef(first.id, 'base'),
            lineRef(last.id, 'base'),
            lineRef(changedLine.id, 'changed'),
          ],
          activated: true,
        });
      }
      const halfFact = selectedThreeHarmonyFact(
        group,
        memberMode,
        half,
        halfCandidates,
        calendarFacts,
        movingFacts,
        growthFacts,
      );
      if (halfFact) facts.push(halfFact);
    }
  }
  return facts;
}

function deriveValidated(
  plate: PlateV2,
  ruleContext: RuleContext,
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const facts: DerivedFact[] = [];
  const baseFormation = hexagramSideFormation(plate, 'base', ruleContext);
  if (baseFormation) {
    const relation = baseFormation === 'six-harmony' ? 'is-six-harmony' : 'is-six-clash';
    facts.push(formationFact(relation, hexagramRef('base'), undefined, ['base'], {
      side: 'base',
      hexagramKey: plate.baseHexagram.key,
      hexagramName: plate.baseHexagram.name,
      pairPositions: ['1-4', '2-5', '3-6'],
      basisFactIds: [],
    }));
  }
  if (plate.movingLines.length > 0) {
    const changedFormation = hexagramSideFormation(plate, 'changed', ruleContext);
    if (changedFormation) {
      const relation = changedFormation === 'six-harmony' ? 'is-six-harmony' : 'is-six-clash';
      facts.push(formationFact(relation, hexagramRef('changed'), undefined, ['changed'], {
        side: 'changed',
        hexagramKey: plate.changedHexagram.key,
        hexagramName: plate.changedHexagram.name,
        pairPositions: ['1-4', '2-5', '3-6'],
        basisFactIds: [],
      }));
    }
  }

  const fanFu = correspondingFanFu(plate, ruleContext);
  for (const [relation, half, matched] of [
    ['is-fan-yin', 'inner', fanFu.innerFan],
    ['is-fan-yin', 'outer', fanFu.outerFan],
    ['is-fu-yin', 'inner', fanFu.innerFu],
    ['is-fu-yin', 'outer', fanFu.outerFu],
  ] as const) {
    if (!matched) continue;
    const positions = half === 'inner' ? ['1', '2', '3'] : ['4', '5', '6'];
    facts.push(formationFact(
      relation,
      hexagramRef('base'),
      hexagramRef('changed'),
      [half],
      {
        half,
        positions,
        comparison: relation === 'is-fan-yin' ? 'all-clash' : 'all-identical',
        basisFactIds: [],
      },
      ['half-has-moving-line', relation === 'is-fan-yin' ? 'all-corresponding-branches-clash' : 'all-corresponding-branches-identical'],
    ));
  }

  facts.push(...deriveThreeHarmonyFacts(plate, calendarFacts, movingFacts, growthFacts));
  return stableFacts(facts);
}

/** @internal 只接收领域内核同一轮产生的 Task 5/6 事实；不得经 barrel 或 IPC 暴露。 */
export function deriveFormationsFromTrustedFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
  calendarFacts: readonly DerivedFact[],
  movingFacts: readonly DerivedFact[],
  growthFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  return deriveValidated(plate, ruleContext, calendarFacts, movingFacts, growthFacts);
}
