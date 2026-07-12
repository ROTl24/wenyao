import type {
  PlateLineV2,
  PlateV2,
  QuestionCategory,
  QuestionIntentId,
  SixRelation,
  UseGodCandidate,
  UseGodEntityRef,
  UseGodResolvedIntent,
  UseGodSelection,
  UseGodSubjectRelation,
  UseGodTargetSelector,
} from './model.js';
import { assertPlateV2RuntimeShape } from './plate-runtime.js';
import type { RuleContext } from './rules/model.js';
import { deepFreeze } from './rules/tables.js';
import {
  USE_GOD_CORE_V1_ARTIFACT,
  type UseGodIntentRule,
  useGodRule,
} from './rules/use-god-core-v1.js';
import {
  assertProjectEnabledUseGodContext,
} from './rules/use-god-registry.js';

export interface ResolveUseGodInput {
  readonly question: string;
  readonly category: QuestionCategory;
  readonly explicitIntentId: QuestionIntentId | null;
  readonly subjectRelation?: UseGodSubjectRelation;
  readonly explicitTarget?: UseGodTargetSelector;
  readonly plate: PlateV2;
  readonly ruleContext: RuleContext;
}

type IntentRule = UseGodIntentRule;

const INTENT_RULES = Object.fromEntries(
  USE_GOD_CORE_V1_ARTIFACT.intentRules.map((rule) => [rule.intentId, rule]),
) as Readonly<Record<QuestionIntentId, IntentRule>>;

const CATEGORY_INTENTS = USE_GOD_CORE_V1_ARTIFACT.categoryIntents;

const CATEGORIES = new Set<QuestionCategory>(Object.keys(CATEGORY_INTENTS) as QuestionCategory[]);
const SUBJECT_RELATIONS = new Set<UseGodSubjectRelation>([
  '父母', '兄弟', '子孙', '妻财', '官鬼', 'distant-other',
]);
const INPUT_KEYS = new Set([
  'question', 'category', 'explicitIntentId', 'subjectRelation',
  'explicitTarget', 'plate', 'ruleContext',
]);
const CANDIDATE_TIER_RULE_ID = 'use-god:candidate-tiers/v1';
const ROLE_RULE_ID = 'use-god:base-role/v1';
const PAIR_RULE_ID = 'use-god:shi-ying-pair/v1';
const HIDDEN_RULE_ID = 'use-god:hidden-last-resort/v1';

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function sourceRefsForRuleIds(ruleIds: readonly string[]): readonly string[] {
  return uniqueStrings(ruleIds.flatMap((ruleId) => {
    const intentRule = USE_GOD_CORE_V1_ARTIFACT.intentRules.find(
      (candidate) => candidate.ruleId === ruleId,
    );
    return intentRule?.sourceRefs ?? useGodRule(ruleId).sourceRefs;
  }));
}

function selectionPlateRef(plate: PlateV2) {
  return {
    id: plate.id,
    sessionId: plate.sessionId,
    castAt: plate.castAt,
    rawTosses: [...plate.rawTosses] as unknown as PlateV2['rawTosses'],
    rulePackRef: { ...plate.rulePackRef },
  } as const;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertInput(input: unknown): asserts input is ResolveUseGodInput {
  if (!isPlainObject(input)) throw new Error('用神取用输入无效');
  if (Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !INPUT_KEYS.has(key))) {
    throw new Error('用神取用输入无效');
  }
  if (
    typeof input.question !== 'string'
    || input.question.trim().length === 0
    || typeof input.category !== 'string'
    || !CATEGORIES.has(input.category as QuestionCategory)
    || !(input.explicitIntentId === null || typeof input.explicitIntentId === 'string')
    || !isPlainObject(input.ruleContext)
  ) throw new Error('用神取用输入无效');
  assertPlateV2RuntimeShape(input.plate);
}

function entityKey(entity: UseGodEntityRef): string {
  return entity.type === 'hidden-spirit'
    ? `hidden:${entity.id}`
    : `line:${entity.id}:${entity.side}`;
}

function candidateForLine(
  line: PlateLineV2,
  side: 'base' | 'changed',
  source: 'base-visible' | 'true-changed',
  tier: 0 | 1,
  reasonRuleIds: readonly string[],
): UseGodCandidate {
  const facet = line[side];
  return {
    entity: { type: 'line', id: line.id, side },
    relation: facet.relationToBasePalace,
    candidateSource: source,
    sourceTier: tier,
    features: { moving: line.moving, role: side === 'base' ? facet.role : null, factIds: [] },
    authority: 'profile-dependent',
    certainty: 'computed',
    profileId: 'explicit_intent_first_v1',
    sourceRefs: sourceRefsForRuleIds(reasonRuleIds),
    conditions: [],
    reasonRuleIds,
  };
}

function candidateForHidden(
  candidate: PlateLineV2['hiddenSpiritCandidates'][number],
  reasonRuleIds: readonly string[],
  lastResort = true,
): UseGodCandidate {
  return {
    entity: { type: 'hidden-spirit', id: candidate.id },
    relation: candidate.relation,
    candidateSource: 'palace-head-hidden',
    sourceTier: 2,
    features: { moving: false, role: null, factIds: [] },
    authority: 'profile-dependent',
    certainty: 'disputed',
    profileId: 'yehe-last-resort-disputed-v1',
    sourceRefs: sourceRefsForRuleIds(reasonRuleIds),
    conditions: lastResort
      ? USE_GOD_CORE_V1_ARTIFACT.selection.hiddenPolicy.conditions
      : ['hidden-use-disputed'],
    reasonRuleIds,
  };
}

function sortedCandidates(candidates: readonly UseGodCandidate[]): readonly UseGodCandidate[] {
  return [...candidates].sort((left, right) => {
    if (left.sourceTier !== right.sourceTier) return left.sourceTier - right.sourceTier;
    const leftKey = entityKey(left.entity);
    const rightKey = entityKey(right.entity);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function candidatesForRelation(
  plate: PlateV2,
  relation: SixRelation,
  ruleIds: readonly string[],
): readonly UseGodCandidate[] {
  const visibleRuleIds = uniqueStrings([...ruleIds, CANDIDATE_TIER_RULE_ID]);
  const hiddenRuleIds = uniqueStrings([...visibleRuleIds, HIDDEN_RULE_ID]);
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const base = lines
    .filter((line) => line.base.relationToBasePalace === relation)
    .map((line) => candidateForLine(line, 'base', 'base-visible', 0, visibleRuleIds));
  if (base.length > 0) return sortedCandidates(base);

  const changed = lines
    .filter((line) => line.moving && line.changed.relationToBasePalace === relation)
    .map((line) => candidateForLine(line, 'changed', 'true-changed', 1, visibleRuleIds));
  if (changed.length > 0) return sortedCandidates(changed);

  return sortedCandidates(lines.flatMap((line) => line.hiddenSpiritCandidates
    .filter((candidate) => candidate.relation === relation)
    .map((candidate) => candidateForHidden(candidate, hiddenRuleIds))));
}

function candidateForRole(
  plate: PlateV2,
  role: '世' | '应',
  ruleIds: readonly string[],
): UseGodCandidate {
  const line = plate.lines.find((candidate) => candidate.base.role === role);
  if (!line) throw new Error(`本卦缺少${role}爻`);
  return candidateForLine(
    line,
    'base',
    'base-visible',
    0,
    uniqueStrings([...ruleIds, ROLE_RULE_ID]),
  );
}

function findExplicitCandidate(
  plate: PlateV2,
  entity: UseGodEntityRef,
  ruleIds: readonly string[],
): UseGodCandidate {
  const candidateRuleIds = uniqueStrings([...ruleIds, CANDIDATE_TIER_RULE_ID]);
  if (entity.type === 'hidden-spirit') {
    const hidden = plate.lines.flatMap((line) => line.hiddenSpiritCandidates)
      .find((candidate) => candidate.id === entity.id);
    if (!hidden) throw new Error('显式用神实体不在当前排盘');
    return candidateForHidden(
      hidden,
      uniqueStrings([...candidateRuleIds, HIDDEN_RULE_ID]),
      false,
    );
  }
  const line = plate.lines.find((candidate) => candidate.id === entity.id);
  if (!line || (entity.side === 'changed' && !line.moving)) {
    throw new Error('显式用神实体不在当前排盘');
  }
  return candidateForLine(
    line,
    entity.side,
    entity.side === 'base' ? 'base-visible' : 'true-changed',
    entity.side === 'base' ? 0 : 1,
    candidateRuleIds,
  );
}

function clarificationForIntent(
  category: QuestionCategory,
  plate: PlateV2,
): UseGodSelection {
  const options = CATEGORY_INTENTS[category].map((intentId) => ({
    id: intentId,
    label: INTENT_RULES[intentId].label,
    patch: { explicitIntentId: intentId },
  }));
  return deepFreeze({
    status: 'needs-user-input',
    selectionMode: 'single',
    plateRef: selectionPlateRef(plate),
    category,
    intent: null,
    targetSelector: null,
    primary: null,
    focusEntities: [] as const,
    candidates: [] as const,
    relatedRelations: [],
    ruleIds: ['use-god:clarify-intent/v1'],
    clarification: {
      reason: 'intent-required' as const,
      prompt: '请明确本次占问的具体目标',
      options,
    },
  });
}

function needsSubjectRelation(
  intent: UseGodResolvedIntent,
  rule: IntentRule,
  plate: PlateV2,
): UseGodSelection {
  const options = [...SUBJECT_RELATIONS].map((relation) => ({
    id: `subject:${relation}`,
    label: relation === 'distant-other' ? '关系疏远或不明的他人' : relation,
    patch: { subjectRelation: relation },
  }));
  return deepFreeze({
    status: 'needs-user-input', selectionMode: 'single', intent,
    plateRef: selectionPlateRef(plate),
    category: rule.category,
    targetSelector: null, primary: null,
    focusEntities: [] as const, candidates: [] as const,
    relatedRelations: rule.relatedRelations,
    ruleIds: [rule.ruleId, 'use-god:subject-relation/v1'],
    clarification: {
      reason: 'subject-relation-required' as const,
      prompt: '请说明对方与您的关系', options,
    },
  });
}

function needsExplicitTarget(
  intent: UseGodResolvedIntent,
  rule: IntentRule,
  plate: PlateV2,
): UseGodSelection {
  return deepFreeze({
    status: 'needs-user-input', selectionMode: 'single', intent,
    plateRef: selectionPlateRef(plate),
    category: rule.category,
    targetSelector: null, primary: null,
    focusEntities: [] as const, candidates: [] as const,
    relatedRelations: rule.relatedRelations,
    ruleIds: [rule.ruleId, 'use-god:explicit-target/v1'],
    clarification: {
      reason: 'explicit-target-required' as const,
      prompt: '请明确指定用神六亲、世应角色或具体爻',
      options: [],
    },
  });
}

function isUseGodEntityRef(value: unknown): value is UseGodEntityRef {
  if (!isPlainObject(value) || typeof value.type !== 'string' || typeof value.id !== 'string') return false;
  if (value.type === 'hidden-spirit') return Reflect.ownKeys(value).length === 2;
  return value.type === 'line'
    && (value.side === 'base' || value.side === 'changed')
    && Reflect.ownKeys(value).length === 3;
}

function validateTargetSelector(value: unknown): UseGodTargetSelector {
  if (!isPlainObject(value) || typeof value.kind !== 'string') throw new Error('显式用神目标无效');
  if (value.kind === 'six-relation'
    && Reflect.ownKeys(value).length === 2
    && SUBJECT_RELATIONS.has(value.relation as never)
    && value.relation !== 'distant-other') {
    return { kind: 'six-relation', relation: value.relation as SixRelation };
  }
  if (value.kind === 'role'
    && Reflect.ownKeys(value).length === 2
    && (value.role === '世' || value.role === '应')) {
    return { kind: 'role', role: value.role };
  }
  if (value.kind === 'shi-ying-pair' && Reflect.ownKeys(value).length === 1) {
    return { kind: 'shi-ying-pair' };
  }
  if (value.kind === 'explicit-entity'
    && Reflect.ownKeys(value).length === 2
    && isUseGodEntityRef(value.entity)) {
    return value.entity.type === 'hidden-spirit'
      ? {
        kind: 'explicit-entity',
        entity: { type: 'hidden-spirit', id: value.entity.id },
      }
      : {
        kind: 'explicit-entity',
        entity: { type: 'line', id: value.entity.id, side: value.entity.side },
      };
  }
  throw new Error('显式用神目标无效');
}

function selectionFromCandidates(
  intent: UseGodResolvedIntent,
  selector: Exclude<UseGodTargetSelector, { kind: 'shi-ying-pair' }>,
  candidates: readonly UseGodCandidate[],
  rule: IntentRule,
  selectorRuleIds: readonly string[],
  plate: PlateV2,
): UseGodSelection {
  const ruleIds = uniqueStrings([
    ...selectorRuleIds,
    ...candidates.flatMap((candidate) => candidate.reasonRuleIds),
    ...(candidates.length === 0 ? [CANDIDATE_TIER_RULE_ID] : []),
  ]);
  if (candidates.length === 0) {
    return deepFreeze({
      status: 'unresolved', selectionMode: 'single', intent,
      plateRef: selectionPlateRef(plate),
      category: rule.category,
      targetSelector: selector, primary: null,
      focusEntities: [] as const, candidates: [] as const,
      relatedRelations: rule.relatedRelations, ruleIds,
    });
  }
  if (candidates.length === 1) {
    const primary = candidates[0];
    return deepFreeze({
      status: 'resolved', selectionMode: 'single', intent,
      plateRef: selectionPlateRef(plate),
      category: rule.category,
      targetSelector: selector, primary,
      focusEntities: [primary.entity] as const, candidates: [primary] as const,
      relatedRelations: rule.relatedRelations, ruleIds,
    });
  }
  return deepFreeze({
    status: 'ambiguous', selectionMode: 'single', intent,
    plateRef: selectionPlateRef(plate),
    category: rule.category,
    targetSelector: selector, primary: null,
    focusEntities: candidates.map(({ entity }) => entity),
    candidates: candidates as [UseGodCandidate, UseGodCandidate, ...UseGodCandidate[]],
    relatedRelations: rule.relatedRelations, ruleIds,
  });
}

function resolveUseGodValidated(input: ResolveUseGodInput): UseGodSelection {
  const category = input.category;
  let intentId = input.explicitIntentId;
  if (intentId === null) {
    const allowed = CATEGORY_INTENTS[category];
    if (allowed.length !== 1) return clarificationForIntent(category, input.plate);
    [intentId] = allowed;
  }
  if (!Object.prototype.hasOwnProperty.call(INTENT_RULES, intentId)) {
    throw new Error('问意标识无效');
  }
  const rule = INTENT_RULES[intentId as QuestionIntentId];
  if (rule.category !== category) throw new Error('问意与类别不匹配');

  const hasSubject = Object.prototype.hasOwnProperty.call(input, 'subjectRelation');
  const hasTarget = Object.prototype.hasOwnProperty.call(input, 'explicitTarget');
  if (hasSubject && rule.selector !== 'subject-relation') throw new Error('当前问意不接受他人关系');
  if (hasTarget && rule.selector !== 'explicit-target') throw new Error('当前问意不接受显式目标');
  const validatedExplicitTarget = hasTarget
    ? validateTargetSelector(input.explicitTarget)
    : undefined;

  const intent: UseGodResolvedIntent = {
    id: intentId as QuestionIntentId,
    label: rule.label,
    selectedBy: input.explicitIntentId === null ? 'deterministic-rule' : 'explicit-user-choice',
    ...(hasSubject ? { subjectRelation: input.subjectRelation } : {}),
    ...(validatedExplicitTarget ? { explicitTarget: validatedExplicitTarget } : {}),
  };

  let selector: UseGodTargetSelector;
  if (rule.selector === 'subject-relation') {
    if (!hasSubject) return needsSubjectRelation(intent, rule, input.plate);
    if (!SUBJECT_RELATIONS.has(input.subjectRelation as UseGodSubjectRelation)) {
      throw new Error('他人关系无效');
    }
    selector = input.subjectRelation === 'distant-other'
      ? { kind: 'role', role: '应' }
      : { kind: 'six-relation', relation: input.subjectRelation as SixRelation };
  } else if (rule.selector === 'explicit-target') {
    if (!hasTarget) return needsExplicitTarget(intent, rule, input.plate);
    if (!validatedExplicitTarget) throw new Error('显式用神目标无效');
    selector = validatedExplicitTarget;
  } else {
    selector = rule.selector;
  }
  const selectorRuleIds = uniqueStrings([
    rule.ruleId,
    ...(rule.selector === 'subject-relation' ? ['use-god:subject-relation/v1'] : []),
    ...(rule.selector === 'explicit-target' ? ['use-god:explicit-target/v1'] : []),
  ]);

  if (selector.kind === 'shi-ying-pair') {
    const shi = candidateForRole(input.plate, '世', selectorRuleIds);
    const ying = candidateForRole(input.plate, '应', selectorRuleIds);
    return deepFreeze({
      status: 'resolved', selectionMode: 'shi-ying-pair', intent,
      plateRef: selectionPlateRef(input.plate),
      category: rule.category,
      targetSelector: selector, primary: null,
      focusEntities: [shi.entity, ying.entity] as const, candidates: [] as const,
      relatedRelations: rule.relatedRelations,
      ruleIds: uniqueStrings([...selectorRuleIds, PAIR_RULE_ID, ROLE_RULE_ID]),
    });
  }

  let candidates: readonly UseGodCandidate[];
  if (selector.kind === 'six-relation') {
    candidates = candidatesForRelation(input.plate, selector.relation, selectorRuleIds);
  } else if (selector.kind === 'role') {
    candidates = [candidateForRole(input.plate, selector.role, selectorRuleIds)];
  } else {
    candidates = [findExplicitCandidate(input.plate, selector.entity, selectorRuleIds)];
  }
  return selectionFromCandidates(
    intent,
    selector,
    candidates,
    rule,
    selectorRuleIds,
    input.plate,
  );
}

export function resolveUseGod(input: ResolveUseGodInput): UseGodSelection;
export function resolveUseGod(input: unknown): UseGodSelection;
export function resolveUseGod(input: unknown): UseGodSelection {
  assertInput(input);
  assertProjectEnabledUseGodContext(input.ruleContext);
  return resolveUseGodValidated(input);
}
