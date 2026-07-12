import type {
  Branch,
  DerivedFact,
  EntityRef,
  PlateV2,
} from '../model.js';
import type { RuleContext } from '../rules/model.js';
import { WENWANG_NAJIA_V2_ARTIFACT } from '../rules/wenwang-najia-v2.js';
import { branchRelationMatches } from './branch-relations.js';
import {
  LIUYAO_EFFECTS_V1_ARTIFACT,
  effectsRule,
  isResidualPair,
  type MonthStatus,
} from './effects-core-v1.js';
import { createFactId, stableFacts } from './model.js';

type LineRef = Extract<EntityRef, { type: 'line' }>;
type PillarRef = Extract<EntityRef, { type: 'pillar' }>;

const BRANCH_ELEMENT = new Map(
  WENWANG_NAJIA_V2_ARTIFACT.branchElements.map(({ branch, element }) => [branch, element]),
);
const BRANCHES = new Set(BRANCH_ELEMENT.keys());
const EFFECTIVE_MONTH_STATUSES = new Set<MonthStatus>(
  LIUYAO_EFFECTS_V1_ARTIFACT.monthStatus.effectiveSupportStatuses,
);

function isBranch(value: unknown): value is Branch {
  return typeof value === 'string' && BRANCHES.has(value as Branch);
}

export function monthStatusForBranches(month: Branch, line: Branch): MonthStatus;
export function monthStatusForBranches(month: unknown, line: unknown): MonthStatus;
export function monthStatusForBranches(month: unknown, line: unknown): MonthStatus {
  if (!isBranch(month) || !isBranch(line)) throw new Error('月令状态输入无效');
  if (month === line) return 'commanding';
  const monthElement = BRANCH_ELEMENT.get(month);
  const lineElement = BRANCH_ELEMENT.get(line);
  if (monthElement === lineElement) return 'same-element';
  const generated = WENWANG_NAJIA_V2_ARTIFACT.generates.some(
    ({ source, target }) => source === monthElement && target === lineElement,
  );
  if (generated) return 'generated-by-month';
  if (isResidualPair(month, line)) return 'residual-qi';
  return 'resting';
}

function lineRef(lineId: string, side: 'base' | 'changed'): LineRef {
  return { type: 'line', id: lineId, side };
}

function pillarRef(id: 'month' | 'day'): PillarRef {
  return { type: 'pillar', id };
}

function entityKey(ref: LineRef | PillarRef): string {
  return ref.type === 'pillar' ? `pillar:${ref.id}` : `line:${ref.id}:${ref.side}`;
}

function effectFact(
  relation: DerivedFact['relation'],
  source: LineRef | PillarRef,
  target: LineRef,
  values: DerivedFact['values'],
  conditions: readonly string[] = [],
): DerivedFact {
  const rule = effectsRule(relation);
  if (rule.certainty === 'delegated-twelve-stage') throw new Error('日历效果规则确定性无效');
  return {
    id: createFactId([
      'calendar',
      entityKey(source),
      relation,
      entityKey(target),
      rule.ruleId,
      rule.profileId,
    ]),
    relation,
    source,
    target,
    scope: 'calendar',
    authority: rule.authority,
    ruleId: rule.ruleId,
    profileId: rule.profileId,
    certainty: rule.certainty,
    conditions,
    values,
    sourceRefs: rule.sourceRefs,
  };
}

function comparisonId(pillar: 'month' | 'day', lineId: string): string {
  return `calendar|pillar:${pillar}|line:${lineId}:base`;
}

function factHasComparison(fact: DerivedFact, expected: string): boolean {
  return fact.values.comparisonId === expected;
}

function isLine(ref: EntityRef | undefined, lineId: string, side: 'base' | 'changed'): boolean {
  return ref?.type === 'line' && ref.id === lineId && ref.side === side;
}

function branchClashes(left: Branch, right: Branch, context: RuleContext): boolean {
  return branchRelationMatches(left, right, context.relationProfile)
    .some(({ relation }) => relation === 'clashes');
}

function exactCalendarRelation(
  facts: readonly DerivedFact[],
  pillar: 'month' | 'day',
  lineId: string,
  relation: DerivedFact['relation'],
): DerivedFact | undefined {
  const expectedComparison = comparisonId(pillar, lineId);
  return facts.find((fact) => (
    fact.scope === 'calendar'
    && fact.relation === relation
    && factHasComparison(fact, expectedComparison)
    && fact.source.type === 'pillar'
    && fact.source.id === pillar
    && isLine(fact.target, lineId, 'base')
  ));
}

function whitelistedSupportFactIds(
  plate: PlateV2,
  targetLine: PlateV2['lines'][number],
  relationFacts: readonly DerivedFact[],
): readonly string[] {
  const targetId = targetLine.id;
  const ids = new Set<string>();
  for (const fact of relationFacts) {
    if (fact.relation !== 'generates' && fact.relation !== 'same-element') continue;
    if (fact.scope === 'calendar') {
      if (
        fact.source.type === 'pillar'
        && fact.source.id === 'day'
        && isLine(fact.target, targetId, 'base')
      ) ids.add(fact.id);
      continue;
    }
    if (fact.scope === 'base') {
      if (fact.relation === 'generates') {
        if (
          fact.source.type === 'line'
          && fact.source.side === 'base'
          && fact.source.id !== targetId
          && isLine(fact.target, targetId, 'base')
          && plate.lines.some(({ id, moving }) => id === fact.source.id && moving)
        ) ids.add(fact.id);
      } else if (fact.source.type === 'line' && fact.target?.type === 'line') {
        const otherId = fact.source.id === targetId
          ? fact.target.id
          : fact.target.id === targetId ? fact.source.id : null;
        if (otherId && plate.lines.some(({ id, moving }) => id === otherId && moving)) ids.add(fact.id);
      }
      continue;
    }
  }
  return [...ids].sort();
}

function deriveValidated(
  plate: PlateV2,
  ruleContext: RuleContext,
  relationFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  const monthBranch = plate.calendar.pillars.month.branch.value;
  const dayBranch = plate.calendar.pillars.day.branch.value;
  const voids = plate.calendar.pillars.day.voidBranches;
  const monthSource = pillarRef('month');
  const daySource = pillarRef('day');
  const facts: DerivedFact[] = [];

  for (const line of [...plate.lines].sort((left, right) => left.position - right.position)) {
    const baseTarget = lineRef(line.id, 'base');
    const monthClashBasis = exactCalendarRelation(relationFacts, 'month', line.id, 'clashes');
    const monthBreak = branchClashes(monthBranch, line.base.branch, ruleContext);
    const status = monthStatusForBranches(monthBranch, line.base.branch);
    const effectiveSupport = EFFECTIVE_MONTH_STATUSES.has(status) && !monthBreak;
    const monthStatusFact = effectFact('has-month-status', monthSource, baseTarget, {
      linePosition: line.position,
      monthBranch,
      lineBranch: line.base.branch,
      status,
      effectiveSupport,
      basisFactIds: monthClashBasis ? [monthClashBasis.id] : [],
    });
    facts.push(monthStatusFact);

    if (monthBreak) {
      facts.push(effectFact('is-month-break', monthSource, baseTarget, {
        linePosition: line.position,
        monthBranch,
        lineBranch: line.base.branch,
        basisFactIds: monthClashBasis ? [monthClashBasis.id] : [],
      }));
    }
    if (voids.includes(line.base.branch)) {
      facts.push(effectFact('is-void', daySource, baseTarget, {
        linePosition: line.position,
        dayGanZhi: plate.calendar.pillars.day.ganZhi,
        lineBranch: line.base.branch,
        voidBranches: [...voids].sort(),
        basisFactIds: [],
      }));
    }

    if (line.moving) {
      const changedTarget = lineRef(line.id, 'changed');
      if (branchClashes(monthBranch, line.changed.branch, ruleContext)) {
        facts.push(effectFact('is-month-break', monthSource, changedTarget, {
          linePosition: line.position,
          monthBranch,
          lineBranch: line.changed.branch,
          basisFactIds: [],
        }));
      }
      if (voids.includes(line.changed.branch)) {
        facts.push(effectFact('is-void', daySource, changedTarget, {
          linePosition: line.position,
          dayGanZhi: plate.calendar.pillars.day.ganZhi,
          lineBranch: line.changed.branch,
          voidBranches: [...voids].sort(),
          basisFactIds: [],
        }));
      }
      continue;
    }

    const rawDayClash = exactCalendarRelation(relationFacts, 'day', line.id, 'clashes');
    if (!rawDayClash) continue;
    if (!monthBreak && effectiveSupport) {
      facts.push(effectFact('is-dark-moving', daySource, baseTarget, {
        linePosition: line.position,
        dayBranch,
        lineBranch: line.base.branch,
        monthStatus: status,
        basisFactIds: [rawDayClash.id, monthStatusFact.id].sort(),
      }, ['raw-day-clash', 'not-month-break', 'effective-month-support']));
      continue;
    }

    const monthControls = exactCalendarRelation(relationFacts, 'month', line.id, 'controls');
    const supportIds = whitelistedSupportFactIds(plate, line, relationFacts);
    if (monthBreak || (monthControls && supportIds.length === 0)) {
      const basisFactIds = [
        rawDayClash.id,
        ...(monthClashBasis ? [monthClashBasis.id] : []),
        ...(monthControls ? [monthControls.id] : []),
        ...supportIds,
      ].filter((value, index, all) => all.indexOf(value) === index).sort();
      facts.push(effectFact('is-day-break', daySource, baseTarget, {
        linePosition: line.position,
        dayBranch,
        lineBranch: line.base.branch,
        monthBreak,
        whitelistedSupportFactIds: supportIds,
        basisFactIds,
      }, monthBreak
        ? ['raw-day-clash', 'month-break']
        : ['raw-day-clash', 'month-controls', 'no-whitelisted-support']));
    }
  }

  return stableFacts(facts);
}

/** @internal 只接收领域内核同一轮产生的 Task 4 事实；不得经 barrel 或 IPC 暴露。 */
export function deriveCalendarEffectsFromTrustedFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
  relationFacts: readonly DerivedFact[],
): readonly DerivedFact[] {
  return deriveValidated(plate, ruleContext, relationFacts);
}
