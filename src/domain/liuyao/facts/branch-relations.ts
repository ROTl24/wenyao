import type { Branch } from '../model.js';
import type { RelationMatchingProfile, RuleAuthority } from '../rules/model.js';
import { deepFreeze } from '../rules/tables.js';
import {
  RELATION_CORE_V1_ARTIFACT,
  type RelationBranchRule,
} from './relation-core-v1.js';

export const BRANCHES = deepFreeze([
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
] as const satisfies readonly Branch[]);

export interface BranchRelationMatch {
  readonly relation: RelationBranchRule['relation'];
  readonly ruleId: string;
  readonly profileId: string;
  readonly authority: RuleAuthority;
  readonly certainty: 'computed' | 'disputed';
  readonly sourceRefs: readonly string[];
  readonly direction: 'symmetric' | 'forward' | 'reverse';
}

function ruleIsEnabled(rule: RelationBranchRule, profile: RelationMatchingProfile): boolean {
  if (rule.relation === 'combines' || rule.relation === 'clashes') return true;
  if (rule.relation === 'harms') return rule.profileId === profile.harmPolicy;
  if (rule.relation === 'breaks') return rule.profileId === profile.breakPolicy;
  return rule.profileId === profile.punishmentPolicy;
}

function pairDirection(
  rule: RelationBranchRule,
  source: Branch,
  target: Branch,
): BranchRelationMatch['direction'] | null {
  for (const [from, to] of rule.pairs) {
    if (from === source && to === target) {
      return rule.direction === 'symmetric' ? 'symmetric' : 'forward';
    }
  }
  for (const [from, to] of rule.pairs) {
    if (from === target && to === source) {
      return rule.direction === 'symmetric' ? 'symmetric' : 'reverse';
    }
  }
  return null;
}

export function branchRelationMatches(
  source: Branch,
  target: Branch,
  profile: RelationMatchingProfile,
): readonly BranchRelationMatch[] {
  const matches = RELATION_CORE_V1_ARTIFACT.branchRules.flatMap((rule) => {
    if (!ruleIsEnabled(rule, profile)) return [];
    const direction = pairDirection(rule, source, target);
    if (direction === null) return [];
    return [{
      relation: rule.relation,
      ruleId: rule.ruleId,
      profileId: rule.profileId,
      authority: rule.authority,
      certainty: rule.certainty,
      sourceRefs: rule.sourceRefs,
      direction,
    } satisfies BranchRelationMatch];
  });
  return deepFreeze(matches);
}
