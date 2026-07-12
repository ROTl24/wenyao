import { describe, expect, it } from 'vitest';
import type {
  PlateV2,
  QuestionCategory,
  QuestionIntentId,
  SixRelation,
  UseGodSubjectRelation,
  UseGodTargetSelector,
} from './model.js';
import { buildPlateV2 } from './plate.js';
import {
  BASE_RULE_CONTEXT,
  DEFAULT_RULE_CONTEXT,
} from './rules/default-context.js';
import { USE_GOD_CORE_V1_MANIFEST } from './rules/use-god-core-v1.js';
import {
  assertProjectEnabledUseGodBundle,
  assertProjectEnabledUseGodContext,
} from './rules/use-god-registry.js';
import * as useGodModule from './use-god.js';
import { resolveUseGod } from './use-god.js';

type Tosses = PlateV2['rawTosses'];

const DEFAULT_TOSSES: Tosses = [9, 8, 7, 6, 7, 8];
const buildPlate = (tossValues: Tosses = DEFAULT_TOSSES) => buildPlateV2({
  plateId: 'use-god-test',
  sessionId: 'use-god-test',
  castAt: '2026-07-11T04:00:00.000Z',
  tossValues,
  ruleContext: DEFAULT_RULE_CONTEXT,
});

function request(
  category: QuestionCategory,
  explicitIntentId: QuestionIntentId | null,
  extras: Readonly<Record<string, unknown>> = {},
) {
  return resolveUseGod({
    question: '测试占问',
    category,
    explicitIntentId,
    plate: buildPlate(),
    ruleContext: DEFAULT_RULE_CONTEXT,
    ...extras,
  });
}

function expectDeeplyFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value as Record<string, unknown>)) {
    expectDeeplyFrozen(child, seen);
  }
}

const intentCases: readonly {
  intentId: QuestionIntentId;
  category: QuestionCategory;
  selector: UseGodTargetSelector;
  relatedRelations: readonly SixRelation[];
  extras?: Readonly<Record<string, unknown>>;
}[] = [
  { intentId: 'career.rank-or-office', category: 'career', selector: { kind: 'six-relation', relation: '官鬼' }, relatedRelations: ['父母'] },
  { intentId: 'career.contract-or-approval', category: 'career', selector: { kind: 'six-relation', relation: '父母' }, relatedRelations: ['官鬼'] },
  { intentId: 'career.project-profit', category: 'career', selector: { kind: 'six-relation', relation: '妻财' }, relatedRelations: ['子孙', '兄弟'] },
  { intentId: 'study.learning-or-documents', category: 'study', selector: { kind: 'six-relation', relation: '父母' }, relatedRelations: [] },
  { intentId: 'study.exam-rank-or-admission', category: 'study', selector: { kind: 'six-relation', relation: '官鬼' }, relatedRelations: ['父母'] },
  { intentId: 'wealth.money-or-valuables', category: 'wealth', selector: { kind: 'six-relation', relation: '妻财' }, relatedRelations: ['子孙', '兄弟'] },
  { intentId: 'relationship.female-partner', category: 'relationship', selector: { kind: 'six-relation', relation: '妻财' }, relatedRelations: [] },
  { intentId: 'relationship.male-partner', category: 'relationship', selector: { kind: 'six-relation', relation: '官鬼' }, relatedRelations: [] },
  { intentId: 'relationship.relationship-dynamic', category: 'relationship', selector: { kind: 'shi-ying-pair' }, relatedRelations: [] },
  { intentId: 'health.self', category: 'health', selector: { kind: 'role', role: '世' }, relatedRelations: ['官鬼', '子孙'] },
  { intentId: 'health.other-person', category: 'health', selector: { kind: 'six-relation', relation: '父母' }, relatedRelations: ['官鬼', '子孙'], extras: { subjectRelation: '父母' } },
  { intentId: 'lost-item.money-or-valuables', category: 'lost_item', selector: { kind: 'six-relation', relation: '妻财' }, relatedRelations: [] },
  { intentId: 'lost-item.documents-or-vehicle', category: 'lost_item', selector: { kind: 'six-relation', relation: '父母' }, relatedRelations: [] },
  { intentId: 'lost-item.animal', category: 'lost_item', selector: { kind: 'six-relation', relation: '子孙' }, relatedRelations: [] },
  { intentId: 'travel.self', category: 'travel', selector: { kind: 'role', role: '世' }, relatedRelations: [] },
  { intentId: 'travel.other-person', category: 'travel', selector: { kind: 'six-relation', relation: '父母' }, relatedRelations: [], extras: { subjectRelation: '父母' } },
  { intentId: 'other.explicit', category: 'other', selector: { kind: 'six-relation', relation: '兄弟' }, relatedRelations: [], extras: { explicitTarget: { kind: 'six-relation', relation: '兄弟' } } },
];

describe('intent-first use-god selection', () => {
  it('maps all 17 explicit intents to canonical selectors and related relations', () => {
    expect(intentCases).toHaveLength(17);
    for (const testCase of intentCases) {
      const selection = request(testCase.category, testCase.intentId, testCase.extras);
      expect(selection.intent?.id, testCase.intentId).toBe(testCase.intentId);
      expect(selection.intent?.selectedBy, testCase.intentId).toBe('explicit-user-choice');
      expect(selection.targetSelector, testCase.intentId).toEqual(testCase.selector);
      expect(selection.relatedRelations, testCase.intentId).toEqual(testCase.relatedRelations);
    }
  });

  it.each([
    ['career', ['career.rank-or-office', 'career.contract-or-approval', 'career.project-profit']],
    ['relationship', ['relationship.female-partner', 'relationship.male-partner', 'relationship.relationship-dynamic']],
    ['health', ['health.self', 'health.other-person']],
    ['study', ['study.learning-or-documents', 'study.exam-rank-or-admission']],
    ['lost_item', ['lost-item.money-or-valuables', 'lost-item.documents-or-vehicle', 'lost-item.animal']],
    ['travel', ['travel.self', 'travel.other-person']],
  ] as const)('asks for typed intent clarification for %s', (category, expectedIntentIds) => {
    const selection = request(category, null);
    expect(selection).toMatchObject({
      status: 'needs-user-input',
      intent: null,
      targetSelector: null,
      primary: null,
      clarification: { reason: 'intent-required' },
    });
    if (selection.status !== 'needs-user-input') throw new Error('expected clarification');
    expect(selection.clarification.options.map(({ id }) => id)).toEqual(expectedIntentIds);
    expect(selection.clarification.options.map(({ patch }) => patch.explicitIntentId)).toEqual(expectedIntentIds);
  });

  it('selects the sole wealth intent deterministically when explicit intent is absent', () => {
    const selection = request('wealth', null);
    expect(selection.intent).toMatchObject({
      id: 'wealth.money-or-valuables',
      selectedBy: 'deterministic-rule',
    });
    expect(selection.targetSelector).toEqual({ kind: 'six-relation', relation: '妻财' });
  });

  it('requires an explicit target for the sole other intent and then accepts it', () => {
    const pending = request('other', null);
    expect(pending).toMatchObject({
      status: 'needs-user-input',
      intent: { id: 'other.explicit', selectedBy: 'deterministic-rule' },
      clarification: { reason: 'explicit-target-required', options: [] },
    });

    const selected = request('other', null, {
      explicitTarget: { kind: 'six-relation', relation: '妻财' },
    });
    expect(selected.intent).toMatchObject({
      id: 'other.explicit',
      selectedBy: 'deterministic-rule',
      explicitTarget: { kind: 'six-relation', relation: '妻财' },
    });
    expect(selected.targetSelector).toEqual({ kind: 'six-relation', relation: '妻财' });
    expect(selected.ruleIds).toContain('use-god:explicit-target/v1');
    expect(selected.candidates.every(({ reasonRuleIds }) => (
      reasonRuleIds.includes('use-god:explicit-target/v1')
    ))).toBe(true);
  });

  it('clones an explicit target instead of freezing caller-owned input', () => {
    const explicitTarget = {
      kind: 'explicit-entity',
      entity: { type: 'line', id: 'line:1', side: 'base' },
    } as const;
    const selection = request('other', 'other.explicit', { explicitTarget });
    expect(selection.status).toBe('resolved');
    expect(selection.intent?.explicitTarget).toEqual(explicitTarget);
    expect(selection.intent?.explicitTarget).not.toBe(explicitTarget);
    expect(Object.isFrozen(explicitTarget)).toBe(false);
    expect(Object.isFrozen(explicitTarget.entity)).toBe(false);
  });

  it.each(['health.other-person', 'travel.other-person'] as const)(
    'requires subject relation for %s and maps all six values',
    (intentId) => {
      const category = intentId.startsWith('health') ? 'health' : 'travel';
      const pending = request(category, intentId);
      expect(pending).toMatchObject({
        status: 'needs-user-input',
        clarification: { reason: 'subject-relation-required' },
      });
      if (pending.status !== 'needs-user-input') throw new Error('expected subject clarification');
      expect(pending.clarification.options.map(({ patch }) => patch.subjectRelation)).toEqual([
        '父母', '兄弟', '子孙', '妻财', '官鬼', 'distant-other',
      ]);

      for (const subjectRelation of [
        '父母', '兄弟', '子孙', '妻财', '官鬼', 'distant-other',
      ] as const satisfies readonly UseGodSubjectRelation[]) {
        const selection = request(category, intentId, { subjectRelation });
        expect(selection.intent?.subjectRelation).toBe(subjectRelation);
        expect(selection.targetSelector).toEqual(subjectRelation === 'distant-other'
          ? { kind: 'role', role: '应' }
          : { kind: 'six-relation', relation: subjectRelation });
        expect(selection.ruleIds).toContain('use-god:subject-relation/v1');
      }
    },
  );
});

describe('candidate tiers use real PlateV2 fixtures', () => {
  it('prefers a base-visible candidate over matching moving changed lines', () => {
    const selection = resolveUseGod({
      question: '合同如何？', category: 'career',
      explicitIntentId: 'career.contract-or-approval',
      plate: buildPlate([6, 6, 6, 6, 6, 6]), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved',
      primary: { entity: { id: 'line:2', side: 'base' }, candidateSource: 'base-visible', sourceTier: 0 },
    });
  });

  it('retains two visible candidates as stable ambiguity without ranking or a score', () => {
    const selection = resolveUseGod({
      question: '兄弟之事如何？', category: 'other', explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'six-relation', relation: '兄弟' },
      plate: buildPlate([6, 6, 6, 6, 6, 6]), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection.status).toBe('ambiguous');
    expect(selection.primary).toBeNull();
    expect(selection.candidates).toMatchObject([
      { entity: { id: 'line:1', side: 'base' }, candidateSource: 'base-visible', sourceTier: 0 },
      { entity: { id: 'line:4', side: 'base' }, candidateSource: 'base-visible', sourceTier: 0 },
    ]);
    expect(JSON.stringify(selection)).not.toContain('"score"');
  });

  it('uses a moving true-changed candidate before an available hidden candidate', () => {
    const selection = resolveUseGod({
      question: '财物如何？', category: 'wealth', explicitIntentId: 'wealth.money-or-valuables',
      plate: buildPlate([6, 6, 7, 6, 6, 6]), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved',
      primary: { entity: { id: 'line:2', side: 'changed' }, candidateSource: 'true-changed', sourceTier: 1 },
    });
  });

  it('does not treat a static changed facet as a true changed candidate', () => {
    const plate = buildPlate([9, 8, 7, 6, 6, 6]);
    expect(plate.lines.some((line) => !line.moving && line.changed.relationToBasePalace === '妻财')).toBe(true);
    const selection = resolveUseGod({
      question: '项目收益如何？', category: 'career', explicitIntentId: 'career.project-profit',
      plate, ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved',
      primary: { entity: { id: 'line:4', side: 'changed' }, candidateSource: 'true-changed', sourceTier: 1 },
    });
  });

  it('uses a palace-head hidden candidate only as a disputed last resort', () => {
    const selection = resolveUseGod({
      question: '考试能否录取？', category: 'study', explicitIntentId: 'study.exam-rank-or-admission',
      plate: buildPlate([7, 7, 7, 8, 7, 7]), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved',
      primary: {
        candidateSource: 'palace-head-hidden', sourceTier: 2, certainty: 'disputed',
        entity: { type: 'hidden-spirit', id: 'hidden:line:3:官鬼' },
        conditions: ['visible-and-true-changed-tiers-empty', 'hidden-use-disputed'],
      },
    });
  });
});

describe('role, pair, and explicit entity selection', () => {
  const roleTosses: Tosses = [6, 6, 6, 6, 6, 7];

  it('selects roles only from the base side even when changed roles moved positions', () => {
    const plate = buildPlate(roleTosses);
    expect([plate.baseHexagram.shiLine, plate.baseHexagram.yingLine]).toEqual([5, 2]);
    expect([plate.changedHexagram.shiLine, plate.changedHexagram.yingLine]).toEqual([6, 3]);

    const self = resolveUseGod({
      question: '本人健康', category: 'health', explicitIntentId: 'health.self',
      plate, ruleContext: DEFAULT_RULE_CONTEXT,
    });
    const otherRole = resolveUseGod({
      question: '应方', category: 'other', explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'role', role: '应' }, plate, ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(self.primary).toMatchObject({ entity: { id: 'line:5', side: 'base' }, features: { role: '世' } });
    expect(otherRole.primary).toMatchObject({ entity: { id: 'line:2', side: 'base' }, features: { role: '应' } });
  });

  it('represents relationship dynamics as a base-side shi-ying pair without a primary', () => {
    const selection = resolveUseGod({
      question: '双方互动', category: 'relationship',
      explicitIntentId: 'relationship.relationship-dynamic',
      plate: buildPlate(roleTosses), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved', selectionMode: 'shi-ying-pair', primary: null, candidates: [],
      targetSelector: { kind: 'shi-ying-pair' },
      focusEntities: [
        { type: 'line', id: 'line:5', side: 'base' },
        { type: 'line', id: 'line:2', side: 'base' },
      ],
    });
  });

  it.each([
    [{ type: 'line', id: 'line:2', side: 'base' }, 'base-visible', 0],
    [{ type: 'line', id: 'line:1', side: 'changed' }, 'true-changed', 1],
    [{ type: 'hidden-spirit', id: 'hidden:line:3:妻财' }, 'palace-head-hidden', 2],
  ] as const)('accepts an explicit current-plate entity %#', (entity, candidateSource, sourceTier) => {
    const selection = resolveUseGod({
      question: '指定此爻', category: 'other', explicitIntentId: 'other.explicit',
      explicitTarget: { kind: 'explicit-entity', entity },
      plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection).toMatchObject({
      status: 'resolved',
      primary: { entity, candidateSource, sourceTier },
    });
  });

  it('rejects static changed facets and forged line or hidden ids', () => {
    for (const entity of [
      { type: 'line', id: 'line:2', side: 'changed' },
      { type: 'line', id: 'line:99', side: 'base' },
      { type: 'line', id: 'line:99', side: 'changed' },
      { type: 'hidden-spirit', id: 'hidden:line:99:妻财' },
    ] as const) {
      expect(() => resolveUseGod({
        question: '伪造实体', category: 'other', explicitIntentId: 'other.explicit',
        explicitTarget: { kind: 'explicit-entity', entity },
        plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
      })).toThrow('显式用神实体不在当前排盘');
    }
  });
});

describe('runtime validation and deterministic immutable output', () => {
  it('opens only the reviewed production resolver and removes the review fixture', () => {
    expect(() => resolveUseGod({
      question: '正式门禁', category: 'wealth', explicitIntentId: null,
      plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
    })).not.toThrow();
    expect(useGodModule).not.toHaveProperty('resolveUseGodForReviewFixture');
  });

  it('rejects mismatched categories, unknown intents, and disallowed supplemental fields', () => {
    expect(() => request('study', 'career.rank-or-office')).toThrow('问意与类别不匹配');
    expect(() => request('study', 'not-an-intent' as QuestionIntentId)).toThrow('问意标识无效');
    expect(() => request('wealth', 'wealth.money-or-valuables', { subjectRelation: '父母' })).toThrow('当前问意不接受他人关系');
    expect(() => request('wealth', 'wealth.money-or-valuables', { explicitTarget: { kind: 'role', role: '世' } })).toThrow('当前问意不接受显式目标');
  });

  it('rejects top-level extra fields and malformed primitive input', () => {
    const valid = {
      question: '测试', category: 'wealth', explicitIntentId: null,
      plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
    };
    expect(() => resolveUseGod({ ...valid, forged: true } as unknown)).toThrow('用神取用输入无效');
    expect(() => resolveUseGod(null as unknown)).toThrow('用神取用输入无效');
    expect(() => resolveUseGod({ ...valid, question: '   ' } as unknown)).toThrow('用神取用输入无效');
  });

  it.each([
    { kind: 'six-relation', relation: '学业功名' },
    { kind: 'six-relation', relation: '父母', forged: true },
    { kind: 'role', role: '主' },
    { kind: 'role', role: '世', forged: true },
    { kind: 'shi-ying-pair', forged: true },
    { kind: 'explicit-entity', entity: { type: 'line', id: 'line:1', side: 'base', forged: true } },
    { kind: 'explicit-entity', entity: { type: 'line', id: 'line:1', side: 'neither' } },
    { kind: 'explicit-entity', entity: { type: 'hidden-spirit', id: 'hidden:line:3:妻财', forged: true } },
    { kind: 'unknown' },
    null,
  ])('rejects malformed or extra-field explicit target %#', (explicitTarget) => {
    expect(() => resolveUseGod({
      question: '非法目标', category: 'other', explicitIntentId: 'other.explicit',
      explicitTarget: explicitTarget as UseGodTargetSelector,
      plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
    })).toThrow('显式用神目标无效');
  });

  it('deep-freezes stable results and never emits scores or a 学业功名 relation', () => {
    const input = {
      question: '今年学业功名如何？', category: 'study' as const,
      explicitIntentId: null, plate: buildPlate(), ruleContext: DEFAULT_RULE_CONTEXT,
    };
    const first = resolveUseGod(input);
    const second = resolveUseGod(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expectDeeplyFrozen(first);

    const everyIntent = intentCases.map((testCase) => request(
      testCase.category, testCase.intentId, testCase.extras,
    ));
    const serialized = JSON.stringify([first, ...everyIntent]);
    expect(serialized).not.toContain('"score"');
    expect(serialized).not.toContain('"relation":"学业功名"');
  });

  it('binds every selection state to the exact plate identity', () => {
    const targetPlate = buildPlate();
    const selection = resolveUseGod({
      question: '身份绑定', category: 'study', explicitIntentId: null,
      plate: targetPlate, ruleContext: DEFAULT_RULE_CONTEXT,
    });
    expect(selection.plateRef).toMatchObject({
      id: targetPlate.id,
      sessionId: targetPlate.sessionId,
      castAt: targetPlate.castAt,
      rawTosses: targetPlate.rawTosses,
      rulePackRef: targetPlate.rulePackRef,
    });
    expect(Object.isFrozen(selection.plateRef)).toBe(true);
  });
});

describe('use_god_core_v1 reviewed production gate', () => {
  const enabledManifest = () => structuredClone(USE_GOD_CORE_V1_MANIFEST) as any;

  it('accepts only the exact reviewed manifest and registered production context', () => {
    expect(() => assertProjectEnabledUseGodBundle()).not.toThrow();
    expect(() => assertProjectEnabledUseGodContext(DEFAULT_RULE_CONTEXT)).not.toThrow();
    expect(() => assertProjectEnabledUseGodContext(BASE_RULE_CONTEXT))
      .toThrow('用神规则上下文未通过项目运行门');
  });

  it.each([
    ['unverified', (manifest: any) => { manifest.verificationLevel = 'unverified'; }],
    ['fixture-only', (manifest: any) => { manifest.runtimeStatus = 'fixture-only'; }],
    ['one review', (manifest: any) => { manifest.reviews.pop(); }],
    ['duplicate reviewer', (manifest: any) => {
      manifest.reviews[1].reviewerId = manifest.reviews[0].reviewerId;
    }],
    ['duplicate run', (manifest: any) => {
      manifest.reviews[1].independentRunId = manifest.reviews[0].independentRunId;
    }],
    ['wrong hash', (manifest: any) => { manifest.artifactHash = '0'.repeat(64); }],
    ['disputed outcome', (manifest: any) => { manifest.reviews[0].outcome = 'disputed'; }],
    ['missing source', (manifest: any) => { manifest.sourceRefs.pop(); }],
    ['wrong report', (manifest: any) => { manifest.reviews[0].reportPath = 'forged.md'; }],
    ['missing claim', (manifest: any) => { manifest.reviews[0].checkedClaims.pop(); }],
  ])('rejects manifest mutation: %s', (_label, mutate) => {
    const manifest = enabledManifest();
    mutate(manifest);
    expect(() => assertProjectEnabledUseGodBundle(manifest))
      .toThrow('用神规则包未通过项目运行门');
  });

  it('rejects profile or registered-source tampering', () => {
    const profile = structuredClone(DEFAULT_RULE_CONTEXT) as any;
    profile.useGodProfile.multipleCandidates = 'retain-ranked-candidates';
    expect(() => assertProjectEnabledUseGodContext(profile))
      .toThrow('用神规则上下文未通过项目运行门');

    const source = structuredClone(DEFAULT_RULE_CONTEXT) as any;
    const index = source.sources.findIndex((item: any) => (
      item.id === 'WS-ZENGSHAN-USE-GOD-2100700'
    ));
    source.sources[index].contentHash = 'f'.repeat(64);
    expect(() => assertProjectEnabledUseGodContext(source))
      .toThrow('用神规则上下文未通过项目运行门');

    const extra = structuredClone(DEFAULT_RULE_CONTEXT) as any;
    extra.sources[index].forged = true;
    expect(() => assertProjectEnabledUseGodContext(extra))
      .toThrow('用神规则上下文未通过项目运行门');
  });

  it.each([
    ['schema version', (context: any) => { context.schemaVersion = 'forged'; }],
    ['rule pack id', (context: any) => { context.rulePackId = 'forged'; }],
    ['rule pack version', (context: any) => { context.rulePackVersion = '999'; }],
    ['relation dependency', (context: any) => {
      context.relationProfile.bundle.artifactHash = '0'.repeat(64);
    }],
    ['growth dependency', (context: any) => {
      context.growthProfile.bundle.artifactHash = '1'.repeat(64);
    }],
    ['effects dependency', (context: any) => {
      context.effectsProfile.bundle.artifactHash = '2'.repeat(64);
    }],
  ])('rejects forged upstream context: %s', (_label, mutate) => {
    const context = structuredClone(DEFAULT_RULE_CONTEXT) as any;
    mutate(context);
    expect(() => assertProjectEnabledUseGodContext(context))
      .toThrow('用神规则上下文未通过项目运行门');
    expect(() => resolveUseGod({
      question: '上游依赖门', category: 'wealth', explicitIntentId: null,
      plate: buildPlate(), ruleContext: context,
    })).toThrow('用神规则上下文未通过项目运行门');
  });
});
