import { describe, expect, it } from 'vitest';
import type { ActionEffect, BranchRelation, ElementRelation, TransformationReturnFact } from './divination';
import {
  directedActionEffectLabels,
  directedElementRelationLabel,
  presentTransformationReturn,
  returnEffectLabels,
  TRANSFORMATION_RETURN_SCOPE,
} from './relationLabels';

function fact(
  elementRelation: ElementRelation,
  branchRelation: BranchRelation = 'none',
  returnEffects: ActionEffect[] = [],
): TransformationReturnFact {
  return {
    id: 'return:1',
    lineIndex: 1,
    changedGanZhi: '丁巳',
    baseGanZhi: '戊寅',
    changedToBaseElementRelation: elementRelation,
    changedToBaseBranchRelation: branchRelation,
    returnEffects,
  };
}

describe('变爻回头关系文案', () => {
  it.each([
    ['同类', '变爻与本爻同类'],
    ['生', '变爻生本爻'],
    ['克', '变爻克本爻'],
    ['被生', '本爻生变爻'],
    ['被克', '本爻克变爻'],
  ] as const)('states the subject of %s explicitly', (relation, expected) => {
    expect(presentTransformationReturn(fact(relation))).toMatchObject({
      elementRelation: relation,
      elementRelationLabel: expected,
    });
  });

  it.each([
    ['六合', '六合'],
    ['六冲', '六冲'],
    ['none', '无'],
  ] as const)('keeps branch relation %s inside the declared scope', (relation, expected) => {
    expect(presentTransformationReturn(fact('同类', relation))).toMatchObject({
      branchRelation: relation,
      branchRelationLabel: expected,
    });
    expect(TRANSFORMATION_RETURN_SCOPE.branchRelations).toEqual(['六合', '六冲']);
  });

  it('labels the complete return-effect vocabulary without inventing new terms', () => {
    expect(returnEffectLabels(['生', '克', '比和', '合', '冲'])).toEqual([
      '回头生', '回头克', '回头比和', '回头合', '回头冲',
    ]);
  });

  it('names the changed and base sides instead of relying on from/to fields', () => {
    expect(presentTransformationReturn(fact('被生'))).toMatchObject({
      direction: 'changed-line-returns-to-base-line',
      directionLabel: '变爻回头作用于本爻',
      changedLine: '丁巳',
      baseLine: '戊寅',
      elementRelation: '被生',
      elementRelationLabel: '本爻生变爻',
      returnEffects: [],
      returnEffectLabels: [],
    });
  });

  it('rejects unknown relation vocabulary instead of emitting ambiguous data', () => {
    expect(() => presentTransformationReturn(fact('未知' as ElementRelation))).toThrow('无法导出未知的五行关系');
    expect(() => presentTransformationReturn(fact('同类', '未知' as BranchRelation))).toThrow('无法导出未知的地支关系');
    expect(() => presentTransformationReturn(fact('同类', 'none', ['未知' as ActionEffect]))).toThrow('无法导出未知的回头作用关系');
  });

  it('labels directed non-return relations with explicit source and target subjects', () => {
    expect(directedElementRelationLabel('被克', '初爻', '二爻')).toBe('二爻克初爻');
    expect(directedActionEffectLabels(['克', '合'], '初爻', '二爻')).toEqual(['初爻克二爻', '初爻与二爻六合']);
    expect(() => directedActionEffectLabels(['未知' as ActionEffect], '初爻', '二爻')).toThrow('无法导出未知的作用关系');
  });
});
