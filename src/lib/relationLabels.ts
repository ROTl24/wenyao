import type {
  ActionEffect,
  BranchRelation,
  ElementRelation,
  TransformationReturnFact,
} from './divination';

function unsupportedRelation(value: never, label: string): never {
  throw new Error(`无法导出未知的${label}关系：${String(value)}`);
}

export function directedElementRelationLabel(
  relation: ElementRelation,
  sourceLabel: string,
  targetLabel: string,
): string {
  switch (relation) {
    case '同类': return `${sourceLabel}与${targetLabel}同类`;
    case '生': return `${sourceLabel}生${targetLabel}`;
    case '克': return `${sourceLabel}克${targetLabel}`;
    case '被生': return `${targetLabel}生${sourceLabel}`;
    case '被克': return `${targetLabel}克${sourceLabel}`;
    default: return unsupportedRelation(relation, '五行');
  }
}

export function branchRelationLabel(relation: BranchRelation): '六合' | '六冲' | '无' {
  switch (relation) {
    case '六合': return '六合';
    case '六冲': return '六冲';
    case 'none': return '无';
    default: return unsupportedRelation(relation, '地支');
  }
}

function directedActionEffectLabel(effect: ActionEffect, sourceLabel: string, targetLabel: string): string {
  switch (effect) {
    case '生': return `${sourceLabel}生${targetLabel}`;
    case '克': return `${sourceLabel}克${targetLabel}`;
    case '比和': return `${sourceLabel}与${targetLabel}比和`;
    case '合': return `${sourceLabel}与${targetLabel}六合`;
    case '冲': return `${sourceLabel}与${targetLabel}六冲`;
    default: return unsupportedRelation(effect, '作用');
  }
}

export function directedActionEffectLabels(
  effects: readonly ActionEffect[],
  sourceLabel: string,
  targetLabel: string,
): string[] {
  return effects.map((effect) => directedActionEffectLabel(effect, sourceLabel, targetLabel));
}

function returnEffectLabel(effect: ActionEffect): string {
  switch (effect) {
    case '生': return '回头生';
    case '克': return '回头克';
    case '比和': return '回头比和';
    case '合': return '回头合';
    case '冲': return '回头冲';
    default: return unsupportedRelation(effect, '回头作用');
  }
}

export function returnEffectLabels(effects: readonly ActionEffect[]): string[] {
  return effects.map(returnEffectLabel);
}

export const BRANCH_RELATION_SCOPE = ['六合', '六冲'] as const;

export const TRANSFORMATION_RETURN_SCOPE = {
  appliesTo: 'transformationReturns',
  direction: 'changed-line-returns-to-base-line',
  directionLabel: '变爻回头作用于本爻',
  elementRelationSubject: 'changed-line',
  returnEffectSubject: 'changed-line',
  branchRelations: BRANCH_RELATION_SCOPE,
} as const;

export function presentTransformationReturn(item: TransformationReturnFact) {
  return {
    direction: TRANSFORMATION_RETURN_SCOPE.direction,
    directionLabel: TRANSFORMATION_RETURN_SCOPE.directionLabel,
    changedLine: item.changedGanZhi,
    baseLine: item.baseGanZhi,
    elementRelation: item.changedToBaseElementRelation,
    elementRelationLabel: directedElementRelationLabel(item.changedToBaseElementRelation, '变爻', '本爻'),
    branchRelation: item.changedToBaseBranchRelation,
    branchRelationLabel: branchRelationLabel(item.changedToBaseBranchRelation),
    returnEffects: [...item.returnEffects],
    returnEffectLabels: returnEffectLabels(item.returnEffects),
  };
}

export type TransformationReturnPresentation = ReturnType<typeof presentTransformationReturn>;
export type TransformationReturnScope = typeof TRANSFORMATION_RETURN_SCOPE;
