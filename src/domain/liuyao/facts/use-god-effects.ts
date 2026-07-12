import type {
  DerivedFact,
  Element,
  EntityRef,
  PlateV2,
  UseGodEntityRef,
  UseGodSelection,
} from '../model.js';
import { assertPlateV2RuntimeShape } from '../plate-runtime.js';
import type { RuleContext } from '../rules/model.js';
import { canonicalStringify } from '../rules/tables.js';
import {
  USE_GOD_CORE_V1_ARTIFACT,
  useGodRule,
} from '../rules/use-god-core-v1.js';
import {
  assertProjectEnabledUseGodContext,
} from '../rules/use-god-registry.js';
import {
  resolveUseGod,
  type ResolveUseGodInput,
} from '../use-god.js';
import { ELEMENTS, elementRelation } from './element-relations.js';
import { createFactId, stableFacts } from './model.js';

type LineRef = Extract<EntityRef, { type: 'line' }>;
type HiddenRef = Extract<EntityRef, { type: 'hidden-spirit' }>;
type PillarRef = Extract<EntityRef, { type: 'pillar' }>;

const PROFILE_ID = USE_GOD_CORE_V1_ARTIFACT.profileId;
const SOURCE_SPIRIT_RULE = useGodRule('use-god:source-spirit-by-element/v1');
const AVOID_SPIRIT_RULE = useGodRule('use-god:avoid-spirit-by-element/v1');
const ENEMY_SPIRIT_RULE = useGodRule('use-god:enemy-spirit-by-element/v1');

function entityKey(ref: EntityRef): string {
  switch (ref.type) {
    case 'pillar': return `pillar:${ref.id}`;
    case 'hexagram': return `hexagram:${ref.id}`;
    case 'line': return `line:${ref.id}:${ref.side}`;
    case 'hidden-spirit': return `hidden:${ref.id}`;
    case 'use-god': return `use-god:${ref.id}`;
  }
}

function makeFact(
  relation: DerivedFact['relation'],
  source: EntityRef,
  target: EntityRef | undefined,
  scope: DerivedFact['scope'],
  ruleId: string,
  authority: DerivedFact['authority'],
  certainty: DerivedFact['certainty'],
  values: DerivedFact['values'],
  sourceRefs: readonly string[],
  conditions: readonly string[] = [],
): DerivedFact {
  return {
    id: createFactId([
      scope,
      entityKey(source),
      relation,
      ...(target ? [entityKey(target)] : []),
      ruleId,
      PROFILE_ID,
    ]),
    relation,
    source,
    ...(target ? { target } : {}),
    scope,
    authority,
    ruleId,
    profileId: PROFILE_ID,
    certainty,
    conditions,
    values,
    sourceRefs,
  };
}

function lineRef(id: string, side: 'base' | 'changed'): LineRef {
  return { type: 'line', id, side };
}

function hiddenRef(id: string): HiddenRef {
  return { type: 'hidden-spirit', id };
}

function pillarRef(id: 'month' | 'day'): PillarRef {
  return { type: 'pillar', id };
}

export function flyingHiddenRelation(
  flyingElement: Element,
  hiddenElement: Element,
): {
  relation: DerivedFact['relation'];
  reverse: boolean;
  ruleId: string;
  authority: DerivedFact['authority'];
  certainty: DerivedFact['certainty'];
  sourceRefs: readonly string[];
} {
  const forward = elementRelation(flyingElement, hiddenElement);
  if (forward === 'same-element') {
    const rule = useGodRule('use-god:flying-hidden:same-element/v1');
    return {
      relation: 'same-element', reverse: false,
      ruleId: rule.ruleId,
      authority: rule.authority,
      certainty: rule.certainty,
      sourceRefs: rule.sourceRefs,
    };
  }
  if (forward === 'generates') {
    const rule = useGodRule('use-god:flying-hidden:flying-generates-hidden/v1');
    return {
      relation: 'flying-generates-hidden', reverse: false,
      ruleId: rule.ruleId, authority: rule.authority,
      certainty: rule.certainty, sourceRefs: rule.sourceRefs,
    };
  }
  if (forward === 'controls') {
    const rule = useGodRule('use-god:flying-hidden:flying-controls-hidden/v1');
    return {
      relation: 'flying-controls-hidden', reverse: false,
      ruleId: rule.ruleId, authority: rule.authority,
      certainty: rule.certainty, sourceRefs: rule.sourceRefs,
    };
  }
  const reverse = elementRelation(hiddenElement, flyingElement);
  if (reverse === 'generates') {
    const rule = useGodRule('use-god:flying-hidden:hidden-generates-flying/v1');
    return {
      relation: 'hidden-generates-flying', reverse: true,
      ruleId: rule.ruleId, authority: rule.authority,
      certainty: rule.certainty, sourceRefs: rule.sourceRefs,
    };
  }
  if (reverse === 'controls') {
    const rule = useGodRule('use-god:flying-hidden:hidden-controls-flying/v1');
    return {
      relation: 'hidden-controls-flying', reverse: true,
      ruleId: rule.ruleId, authority: rule.authority,
      certainty: rule.certainty, sourceRefs: rule.sourceRefs,
    };
  }
  throw new Error(`飞伏五行关系不完整：${flyingElement}/${hiddenElement}`);
}

function deriveUseGodIndependentFactsValidated(
  plate: PlateV2,
  _ruleContext: RuleContext,
): readonly DerivedFact[] {
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const facts: DerivedFact[] = [];

  for (const role of ['世', '应'] as const) {
    const line = lines.find(({ base }) => base.role === role);
    if (!line) throw new Error(`本卦缺少${role}爻`);
    const roleRule = useGodRule(
      role === '世' ? 'use-god:base-holds-shi/v1' : 'use-god:base-holds-ying/v1',
    );
    facts.push(makeFact(
      role === '世' ? 'holds-shi' : 'holds-ying',
      { type: 'hexagram', id: 'base' },
      lineRef(line.id, 'base'),
      'use-god',
      roleRule.ruleId,
      roleRule.authority,
      roleRule.certainty,
      { role, linePosition: line.position },
      roleRule.sourceRefs,
    ));
  }

  for (const line of lines) {
    for (const hidden of line.hiddenSpiritCandidates) {
      const flying = lineRef(line.id, 'base');
      const hiddenEntity = hiddenRef(hidden.id);
      const match = flyingHiddenRelation(line.base.branchElement, hidden.element);
      const source = match.reverse ? hiddenEntity : flying;
      const target = match.reverse ? flying : hiddenEntity;
      facts.push(makeFact(
        match.relation,
        source,
        target,
        'use-god',
        match.ruleId,
        match.authority,
        match.certainty,
        {
          hiddenSpiritId: hidden.id,
          hostLineId: line.id,
          linePosition: line.position,
          flyingElement: line.base.branchElement,
          hiddenElement: hidden.element,
          direction: match.reverse ? 'hidden-to-flying' : 'flying-to-hidden',
        },
        match.sourceRefs,
      ));
    }
  }
  return stableFacts(facts);
}

export function deriveUseGodIndependentFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
): readonly DerivedFact[] {
  assertPlateV2RuntimeShape(plate);
  assertProjectEnabledUseGodContext(ruleContext);
  return deriveUseGodIndependentFactsValidated(plate, ruleContext);
}

function canonicalSelection(
  plate: PlateV2,
  ruleContext: RuleContext,
  selection: UseGodSelection,
  resolver: (input: ResolveUseGodInput) => UseGodSelection,
): UseGodSelection {
  const intent = selection.intent;
  const explicitIntentId = intent === null || intent.selectedBy === 'deterministic-rule'
    ? null
    : intent.id;
  return resolver({
    question: '用于校验用神选择',
    category: selection.category,
    explicitIntentId,
    ...(intent?.subjectRelation ? { subjectRelation: intent.subjectRelation } : {}),
    ...(intent?.explicitTarget ? { explicitTarget: intent.explicitTarget } : {}),
    plate,
    ruleContext,
  });
}

function validatedCanonicalSelection(
  plate: PlateV2,
  ruleContext: RuleContext,
  selection: unknown,
  resolver: (input: ResolveUseGodInput) => UseGodSelection,
): UseGodSelection {
  try {
    const expected = canonicalSelection(
      plate,
      ruleContext,
      selection as UseGodSelection,
      resolver,
    );
    if (canonicalStringify(expected) !== canonicalStringify(selection)) throw new Error('mismatch');
    return expected;
  } catch {
    throw new Error('用神选择与当前排盘不匹配');
  }
}

interface EligibleEntity {
  readonly ref: Exclude<EntityRef, { type: 'hexagram' | 'use-god' }>;
  readonly element: Element;
  readonly kind: 'base-line' | 'true-changed' | 'month' | 'day' | 'selected-hidden';
}

function hiddenCandidate(plate: PlateV2, id: string) {
  return plate.lines.flatMap(({ hiddenSpiritCandidates }) => hiddenSpiritCandidates)
    .find((candidate) => candidate.id === id);
}

function entityElement(plate: PlateV2, entity: UseGodEntityRef): Element {
  if (entity.type === 'hidden-spirit') {
    const hidden = hiddenCandidate(plate, entity.id);
    if (!hidden) throw new Error('用神实体不在当前排盘');
    return hidden.element;
  }
  const line = plate.lines.find(({ id }) => id === entity.id);
  if (!line || (entity.side === 'changed' && !line.moving)) {
    throw new Error('用神实体不在当前排盘');
  }
  return line[entity.side].branchElement;
}

function eligibleEntities(
  plate: PlateV2,
  primary: UseGodEntityRef,
): readonly EligibleEntity[] {
  const lines = [...plate.lines].sort((left, right) => left.position - right.position);
  const entities: EligibleEntity[] = lines.flatMap((line): EligibleEntity[] => [
    { ref: lineRef(line.id, 'base'), element: line.base.branchElement, kind: 'base-line' },
    ...(line.moving ? [{
      ref: lineRef(line.id, 'changed'),
      element: line.changed.branchElement,
      kind: 'true-changed' as const,
    }] : []),
  ]);
  entities.push({
    ref: pillarRef('month'),
    element: plate.calendar.pillars.month.branch.element,
    kind: 'month',
  });
  entities.push({
    ref: pillarRef('day'),
    element: plate.calendar.pillars.day.branch.element,
    kind: 'day',
  });
  if (primary.type === 'hidden-spirit') {
    const hidden = hiddenCandidate(plate, primary.id);
    if (!hidden) throw new Error('用神实体不在当前排盘');
    entities.push({ ref: hiddenRef(hidden.id), element: hidden.element, kind: 'selected-hidden' });
  }
  return entities;
}

function uniqueElement(
  predicate: (element: Element) => boolean,
  label: string,
): Element {
  const matches = ELEMENTS.filter(predicate);
  if (matches.length !== 1) throw new Error(`${label}五行矩阵不完整`);
  return matches[0];
}

export function spiritElementsForUse(useGodElement: Element): Readonly<{
  source: Element;
  avoid: Element;
  enemy: Element;
}> {
  if (!ELEMENTS.includes(useGodElement)) throw new Error('用神五行无效');
  const source = uniqueElement(
    (element) => elementRelation(element, useGodElement) === 'generates',
    '元神',
  );
  const avoid = uniqueElement(
    (element) => elementRelation(element, useGodElement) === 'controls',
    '忌神',
  );
  const enemy = uniqueElement(
    (element) => (
      elementRelation(element, avoid) === 'generates'
      && elementRelation(element, source) === 'controls'
    ),
    '仇神',
  );
  return { source, avoid, enemy };
}

function deriveUseGodDependentFactsValidated(
  plate: PlateV2,
  ruleContext: RuleContext,
  selection: unknown,
  resolver: (input: ResolveUseGodInput) => UseGodSelection,
): readonly DerivedFact[] {
  const canonical = validatedCanonicalSelection(plate, ruleContext, selection, resolver);
  if (
    canonical.status !== 'resolved'
    || canonical.selectionMode !== 'single'
    || canonical.primary === null
  ) return stableFacts([]);

  const primary = canonical.primary;
  const primaryElement = entityElement(plate, primary.entity);
  const {
    source: sourceElement,
    avoid: avoidElement,
    enemy: enemyElement,
  } = spiritElementsForUse(primaryElement);
  const certainty = primary.certainty === 'disputed' ? 'disputed' : 'computed';
  const conditions = certainty === 'disputed'
    ? ['selected-hidden-primary-disputed']
    : [];
  const facts: DerivedFact[] = [];
  for (const eligible of eligibleEntities(plate, primary.entity)) {
    let relation: 'is-source-spirit' | 'is-avoid-spirit' | 'is-enemy-spirit' | null = null;
    let ruleId = '';
    let sourceRefs: readonly string[] = [];
    if (eligible.element === sourceElement) {
      relation = 'is-source-spirit';
      ruleId = SOURCE_SPIRIT_RULE.ruleId;
      sourceRefs = SOURCE_SPIRIT_RULE.sourceRefs;
    } else if (eligible.element === avoidElement) {
      relation = 'is-avoid-spirit';
      ruleId = AVOID_SPIRIT_RULE.ruleId;
      sourceRefs = AVOID_SPIRIT_RULE.sourceRefs;
    } else if (eligible.element === enemyElement) {
      relation = 'is-enemy-spirit';
      ruleId = ENEMY_SPIRIT_RULE.ruleId;
      sourceRefs = ENEMY_SPIRIT_RULE.sourceRefs;
    }
    if (!relation) continue;
    facts.push(makeFact(
      relation,
      eligible.ref,
      primary.entity,
      'use-god',
      ruleId,
      'profile-dependent',
      certainty,
      {
        eligibleKind: eligible.kind,
        sourceElement: eligible.element,
        useGodElement: primaryElement,
        sourceSpiritElement: sourceElement,
        avoidSpiritElement: avoidElement,
        enemySpiritElement: enemyElement,
        primaryEntityKey: entityKey(primary.entity),
      },
      sourceRefs,
      conditions,
    ));
  }
  return stableFacts(facts);
}

export function deriveUseGodDependentFacts(
  plate: PlateV2,
  ruleContext: RuleContext,
  selection: unknown,
): readonly DerivedFact[] {
  assertPlateV2RuntimeShape(plate);
  assertProjectEnabledUseGodContext(ruleContext);
  return deriveUseGodDependentFactsValidated(
    plate,
    ruleContext,
    selection,
    resolveUseGod,
  );
}
