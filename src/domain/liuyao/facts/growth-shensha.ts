import type {
  Branch,
  DerivedFact,
  Element,
  EntityRef,
  PillarKind,
  PlateV2,
  SixSpirit,
  Stem,
  TwelveStage,
} from '../model.js';
import { assertPlateV2RuntimeShape } from '../plate-runtime.js';
import { BASE_RULE_CONTEXT } from '../rules/default-context.js';
import type { RuleContext } from '../rules/model.js';
import { canonicalStringify, deepFreeze } from '../rules/tables.js';
import {
  GROWTH_SHENSHA_CORE_V1_ARTIFACT,
} from './growth-shensha-core-v1.js';
import {
  assertProjectEnabledGrowthShenShaContext,
} from './growth-shensha-registry.js';
import { createFactId, stableFacts } from './model.js';

type GrowthProfile = RuleContext['growthProfile'];
type SixSpiritProfile = RuleContext['sixSpiritProfile'];
type ShenShaProfile = RuleContext['shenShaProfile'];
type LineEntityRef = Extract<EntityRef, { type: 'line' }>;
type PillarEntityRef = Extract<EntityRef, { type: 'pillar' }>;
type ShenShaId = ShenShaProfile['enabled'][number];
type ShenShaArtifact = typeof GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha;
type ShenShaRule = ShenShaArtifact[ShenShaId]['rule'];
type ShenShaInputKey = 'dayStem' | 'dayBranch' | 'monthBranch';

interface ShenShaDescriptorSpec<Value extends Stem | Branch> {
  readonly label: string;
  readonly inputKey: ShenShaInputKey;
  readonly sourceKind: 'day' | 'month';
  readonly accepts: (value: unknown) => value is Value;
  readonly inputFromPlate: (plate: PlateV2) => Value;
  readonly lookupBranches: (value: Value) => readonly Branch[];
  readonly rule: ShenShaRule;
}

interface ShenShaDescriptor {
  readonly label: string;
  readonly inputKey: ShenShaInputKey;
  readonly sourceKind: 'day' | 'month';
  readonly inputFromPlate: (plate: PlateV2) => Stem | Branch;
  readonly lookupBranches: (value: unknown) => readonly Branch[];
  readonly rule: ShenShaRule;
}

export type ShenShaBranchInput =
  | { readonly id: 'tianyi'; readonly dayStem: Stem }
  | { readonly id: 'lushen'; readonly dayStem: Stem }
  | { readonly id: 'yima'; readonly dayBranch: Branch }
  | { readonly id: 'tianxi'; readonly monthBranch: Branch };

export interface DeriveGrowthShenShaFactsInput {
  readonly plate: PlateV2;
  readonly ruleContext: RuleContext;
}

const PILLAR_ORDER = ['year', 'month', 'day', 'hour'] as const satisfies readonly PillarKind[];
const ELEMENTS = new Set<string>(['木', '火', '土', '金', '水']);
const BRANCHES = new Set<string>(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
const STEMS = new Set<string>(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
const PRIMARY_STAGES = new Set<TwelveStage>(
  GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.rule.primaryInterpretationStages,
);

const EXPECTED_GROWTH_PROFILE = canonicalStringify(BASE_RULE_CONTEXT.growthProfile);
const EXPECTED_SIX_SPIRIT_PROFILE = canonicalStringify(BASE_RULE_CONTEXT.sixSpiritProfile);
const EXPECTED_SHEN_SHA_PROFILE = canonicalStringify(BASE_RULE_CONTEXT.shenShaProfile);

function profileMatches(actual: unknown, expected: string): boolean {
  try {
    return canonicalStringify(actual) === expected;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isElement(value: unknown): value is Element {
  return typeof value === 'string' && ELEMENTS.has(value);
}

function isBranch(value: unknown): value is Branch {
  return typeof value === 'string' && BRANCHES.has(value);
}

function isStem(value: unknown): value is Stem {
  return typeof value === 'string' && STEMS.has(value);
}

function defineShenShaDescriptor<Value extends Stem | Branch>(
  spec: ShenShaDescriptorSpec<Value>,
): ShenShaDescriptor {
  return {
    label: spec.label,
    inputKey: spec.inputKey,
    sourceKind: spec.sourceKind,
    inputFromPlate: spec.inputFromPlate,
    lookupBranches(value: unknown): readonly Branch[] {
      if (!spec.accepts(value)) throw new Error('神煞输入无效');
      return spec.lookupBranches(value);
    },
    rule: spec.rule,
  };
}

const SHEN_SHA_DESCRIPTORS = deepFreeze({
  tianyi: defineShenShaDescriptor({
    label: '天乙贵人',
    inputKey: 'dayStem',
    sourceKind: 'day',
    accepts: isStem,
    inputFromPlate: (plate) => plate.calendar.pillars.day.stem.value,
    lookupBranches: (dayStem) => (
      GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianyi.branchesByDayStem[dayStem]
    ),
    rule: GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianyi.rule,
  }),
  lushen: defineShenShaDescriptor({
    label: '禄神',
    inputKey: 'dayStem',
    sourceKind: 'day',
    accepts: isStem,
    inputFromPlate: (plate) => plate.calendar.pillars.day.stem.value,
    lookupBranches: (dayStem) => (
      GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.lushen.branchesByDayStem[dayStem]
    ),
    rule: GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.lushen.rule,
  }),
  yima: defineShenShaDescriptor({
    label: '驿马',
    inputKey: 'dayBranch',
    sourceKind: 'day',
    accepts: isBranch,
    inputFromPlate: (plate) => plate.calendar.pillars.day.branch.value,
    lookupBranches: (dayBranch) => (
      GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.yima.branchesByDayBranch[dayBranch]
    ),
    rule: GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.yima.rule,
  }),
  tianxi: defineShenShaDescriptor({
    label: '天喜',
    inputKey: 'monthBranch',
    sourceKind: 'month',
    accepts: isBranch,
    inputFromPlate: (plate) => plate.calendar.pillars.month.branch.value,
    lookupBranches: (monthBranch) => (
      GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianxi.branchesByMonthBranch[monthBranch]
    ),
    rule: GROWTH_SHENSHA_CORE_V1_ARTIFACT.shenSha.tianxi.rule,
  }),
} as const satisfies Readonly<Record<ShenShaId, ShenShaDescriptor>>);

function hasOwn(object: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isShenShaId(value: unknown): value is ShenShaId {
  return typeof value === 'string' && hasOwn(SHEN_SHA_DESCRIPTORS, value);
}

function descriptorForInput(input: Record<string, unknown>) {
  const id = input.id;
  if (
    !hasOwn(input, 'id')
    || !isShenShaId(id)
  ) throw new Error('神煞输入无效');

  const descriptor = SHEN_SHA_DESCRIPTORS[id];
  const ownKeys = Reflect.ownKeys(input);
  if (
    !hasOwn(input, descriptor.inputKey)
    || ownKeys.length !== 2
    || ownKeys.some((key) => key !== 'id' && key !== descriptor.inputKey)
  ) throw new Error('神煞输入无效');
  return descriptor;
}

function assertGrowthProfile(profile: unknown): asserts profile is GrowthProfile {
  if (!profileMatches(profile, EXPECTED_GROWTH_PROFILE)) {
    throw new Error('十二长生 profile 不匹配');
  }
}

function assertSixSpiritProfile(profile: unknown): asserts profile is SixSpiritProfile {
  if (!profileMatches(profile, EXPECTED_SIX_SPIRIT_PROFILE)) {
    throw new Error('六神 profile 不匹配');
  }
}

function assertShenShaProfile(profile: unknown): asserts profile is ShenShaProfile {
  if (!profileMatches(profile, EXPECTED_SHEN_SHA_PROFILE)) {
    throw new Error('神煞 profile 不匹配');
  }
}

function assertPlateDependency(plate: PlateV2): void {
  if (
    plate.rulePackRef.id !== 'wenwang_najia_v2'
    || plate.rulePackRef.version !== '2.0.0'
    || plate.rulePackRef.artifactHash
      !== GROWTH_SHENSHA_CORE_V1_ARTIFACT.dependsOnWenwangArtifactHash
  ) throw new Error('长生神煞事实排盘依赖不匹配');
}

function lineRef(lineId: string, side: 'base' | 'changed'): LineEntityRef {
  return { type: 'line', id: lineId, side };
}

function pillarRef(kind: PillarKind): PillarEntityRef {
  return { type: 'pillar', id: kind };
}

function entityKey(ref: LineEntityRef | PillarEntityRef): string {
  return ref.type === 'pillar'
    ? `pillar:${ref.id}`
    : `line:${ref.id}:${ref.side}`;
}

function makeFactId(
  scope: DerivedFact['scope'],
  source: LineEntityRef | PillarEntityRef,
  relation: DerivedFact['relation'],
  target: LineEntityRef,
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

export function twelveStage(
  element: Element,
  branch: Branch,
  profile?: GrowthProfile,
): TwelveStage;
export function twelveStage(
  element: unknown,
  branch: unknown,
  profile?: unknown,
): TwelveStage;
export function twelveStage(
  element: unknown,
  branch: unknown,
  profile: unknown = BASE_RULE_CONTEXT.growthProfile,
): TwelveStage {
  if (!isElement(element) || !isBranch(branch)) {
    throw new Error(`十二长生输入无效：${String(element)}/${String(branch)}`);
  }
  assertGrowthProfile(profile);
  const row = GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.matrix[element];
  const branchIndex = GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.branchOrder.indexOf(branch);
  const stage = row?.[branchIndex];
  if (!stage) throw new Error(`十二长生输入无效：${String(element)}/${String(branch)}`);
  return stage;
}

export function sixSpiritsForDayStem(
  dayStem: Stem,
  profile?: SixSpiritProfile,
): readonly SixSpirit[];
export function sixSpiritsForDayStem(
  dayStem: unknown,
  profile?: unknown,
): readonly SixSpirit[];
export function sixSpiritsForDayStem(
  dayStem: unknown,
  profile: unknown = BASE_RULE_CONTEXT.sixSpiritProfile,
): readonly SixSpirit[] {
  if (!isStem(dayStem)) throw new Error(`六神输入无效：${String(dayStem)}`);
  assertSixSpiritProfile(profile);
  const sequence = GROWTH_SHENSHA_CORE_V1_ARTIFACT.sixSpirit.sequence;
  const start = GROWTH_SHENSHA_CORE_V1_ARTIFACT.sixSpirit.startByDayStem[dayStem];
  const startIndex = sequence.indexOf(start);
  if (startIndex < 0) throw new Error(`六神输入无效：${String(dayStem)}`);
  return deepFreeze(sequence.map((_, index) => sequence[(startIndex + index) % sequence.length]));
}

export function shenShaBranches(
  input: ShenShaBranchInput,
  profile?: ShenShaProfile,
): readonly Branch[];
export function shenShaBranches(
  input: unknown,
  profile?: unknown,
): readonly Branch[];
export function shenShaBranches(
  input: unknown,
  profile: unknown = BASE_RULE_CONTEXT.shenShaProfile,
): readonly Branch[] {
  if (!isPlainObject(input)) throw new Error('神煞输入无效');
  assertShenShaProfile(profile);
  const descriptor = descriptorForInput(input);
  return descriptor.lookupBranches(input[descriptor.inputKey]);
}

function growthFact(
  source: LineEntityRef | PillarEntityRef,
  target: LineEntityRef,
  scope: 'calendar' | 'transition',
  element: Element,
  branch: Branch,
  extraValues: Readonly<Record<string, string | number>>,
): DerivedFact {
  const rule = GROWTH_SHENSHA_CORE_V1_ARTIFACT.growth.rule;
  const stage = twelveStage(element, branch);
  return {
    id: makeFactId(scope, source, 'is-growth-stage', target, rule.ruleId, rule.profileId),
    relation: 'is-growth-stage',
    source,
    target,
    scope,
    authority: rule.authority,
    ruleId: rule.ruleId,
    profileId: rule.profileId,
    certainty: rule.certaintyByElement[element],
    conditions: element === '土' ? ['default-earth-follows-water-disputed'] : [],
    values: {
      stage,
      element,
      branch,
      interpretationWeight: PRIMARY_STAGES.has(stage) ? 'primary' : 'display-only',
      ...extraValues,
    },
    sourceRefs: rule.sourceRefs,
  };
}

function deriveGrowthFactsValidated(
  plate: PlateV2,
): readonly DerivedFact[] {
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const facts: DerivedFact[] = [];

  for (const pillarKind of PILLAR_ORDER) {
    const pillar = plate.calendar.pillars[pillarKind];
    const source = pillarRef(pillarKind);
    for (const line of lines) {
      for (const side of ['base', 'changed'] as const) {
        const facet = line[side];
        facts.push(growthFact(
          source,
          lineRef(line.id, side),
          'calendar',
          facet.branchElement,
          pillar.branch.value,
          {
            pillarKind,
            linePosition: line.position,
            side,
          },
        ));
      }
    }
  }

  for (const line of lines) {
    if (!line.moving) continue;
    facts.push(growthFact(
      lineRef(line.id, 'base'),
      lineRef(line.id, 'changed'),
      'transition',
      line.base.branchElement,
      line.changed.branch,
      {
        linePosition: line.position,
        side: 'transition',
        fromBranch: line.base.branch,
        changedBranch: line.changed.branch,
      },
    ));
  }

  return stableFacts(facts);
}

function deriveSixSpiritFactsValidated(
  plate: PlateV2,
): readonly DerivedFact[] {
  const rule = GROWTH_SHENSHA_CORE_V1_ARTIFACT.sixSpirit.rule;
  const dayStem = plate.calendar.pillars.day.stem.value;
  const spirits = sixSpiritsForDayStem(dayStem);
  const source = pillarRef('day');
  const facts = [...plate.lines]
    .sort((left, right) => left.position - right.position)
    .map((line, index): DerivedFact => {
      const target = lineRef(line.id, 'base');
      return {
        id: makeFactId('auxiliary', source, 'is-six-beast', target, rule.ruleId, rule.profileId),
        relation: 'is-six-beast',
        source,
        target,
        scope: 'auxiliary',
        authority: 'secondary',
        ruleId: rule.ruleId,
        profileId: rule.profileId,
        certainty: 'computed',
        conditions: [],
        values: {
          sixSpirit: spirits[index],
          dayStem,
          linePosition: line.position,
        },
        sourceRefs: rule.sourceRefs,
      };
    });
  return stableFacts(facts);
}

function deriveShenShaFactsValidated(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly DerivedFact[] {
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const facts: DerivedFact[] = [];
  for (const id of ruleContext.shenShaProfile.enabled) {
    const descriptor = SHEN_SHA_DESCRIPTORS[id];
    const branches = descriptor.lookupBranches(descriptor.inputFromPlate(plate));
    const source = pillarRef(descriptor.sourceKind);
    for (const line of lines) {
      if (!branches.includes(line.base.branch)) continue;
      const target = lineRef(line.id, 'base');
      facts.push({
        id: makeFactId(
          'auxiliary',
          source,
          'is-shen-sha',
          target,
          descriptor.rule.ruleId,
          descriptor.rule.profileId,
        ),
        relation: 'is-shen-sha',
        source,
        target,
        scope: 'auxiliary',
        authority: 'secondary',
        ruleId: descriptor.rule.ruleId,
        profileId: descriptor.rule.profileId,
        certainty: 'conditional',
        conditions: ['auxiliary-only', 'does-not-override-use-god-strength'],
        values: {
          shenShaId: id,
          label: descriptor.label,
          matchedBranch: line.base.branch,
          sourceKind: descriptor.sourceKind,
          linePosition: line.position,
        },
        sourceRefs: descriptor.rule.sourceRefs,
      });
    }
  }
  return stableFacts(facts);
}

export function deriveGrowthShenShaFacts(
  input: DeriveGrowthShenShaFactsInput,
): readonly DerivedFact[];
export function deriveGrowthShenShaFacts(input: unknown): readonly DerivedFact[] {
  const candidate = input !== null && typeof input === 'object' && !Array.isArray(input)
    ? input as Partial<DeriveGrowthShenShaFactsInput>
    : {};
  assertPlateV2RuntimeShape(candidate.plate);
  assertPlateDependency(candidate.plate);
  assertProjectEnabledGrowthShenShaContext(candidate.ruleContext);
  return stableFacts([
    ...deriveGrowthFactsValidated(candidate.plate),
    ...deriveSixSpiritFactsValidated(candidate.plate),
    ...deriveShenShaFactsValidated(candidate.plate, candidate.ruleContext),
  ]);
}
