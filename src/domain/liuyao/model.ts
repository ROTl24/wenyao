import type { RuleAuthority, RuleContext } from './rules/model.js';

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type Element = '木' | '火' | '土' | '金' | '水';
export type PillarKind = 'year' | 'month' | 'day' | 'hour';
export type GanZhi = `${Stem}${Branch}`;
export type XunName = '甲子旬' | '甲戌旬' | '甲申旬' | '甲午旬' | '甲辰旬' | '甲寅旬';

export interface CalendarPillar {
  kind: PillarKind;
  ganZhi: GanZhi;
  stem: { value: Stem; element: Element };
  branch: { value: Branch; element: Element };
  xun: XunName;
  voidBranches: readonly [Branch, Branch];
}

export interface CalendarSnapshot {
  timezone: 'Asia/Shanghai';
  localDateTime: string;
  pillars: {
    year: CalendarPillar;
    month: CalendarPillar;
    day: CalendarPillar;
    hour: CalendarPillar;
  };
}

export type SixRelation = '父母' | '兄弟' | '子孙' | '妻财' | '官鬼';
export type SixSpirit = '青龙' | '朱雀' | '勾陈' | '螣蛇' | '白虎' | '玄武';
export type TwelveStage =
  | '长生' | '沐浴' | '冠带' | '临官' | '帝旺' | '衰'
  | '病' | '死' | '墓' | '绝' | '胎' | '养';

export interface HexagramSideV2 {
  key: string;
  name: string;
  shortName: string;
  upperTrigram: string;
  lowerTrigram: string;
  palace: string;
  palaceElement: Element;
  generation: string;
  shiLine: 1 | 2 | 3 | 4 | 5 | 6;
  yingLine: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface LineFacetV2 {
  yang: boolean;
  stem: Stem;
  branch: Branch;
  ganZhi: string;
  stemElement: Element;
  branchElement: Element;
  relationToBasePalace: SixRelation;
  relationToOwnPalace: SixRelation;
  role: '世' | '应' | null;
}

export interface HiddenSpiritCandidateV2 {
  id: string;
  hostLineId: string;
  sourceLine: 1 | 2 | 3 | 4 | 5 | 6;
  relation: SixRelation;
  stem: Stem;
  branch: Branch;
  ganZhi: string;
  element: Element;
  sourceHexagram: string;
  status: 'potential';
}

export interface PlateLineV2 {
  id: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  tossValue: 6 | 7 | 8 | 9;
  moving: boolean;
  base: LineFacetV2;
  changed: LineFacetV2;
  transition: null | {
    fromLineId: string;
    toLineId: string;
  };
  hiddenSpiritCandidates: readonly HiddenSpiritCandidateV2[];
}

export interface PlateV2 {
  schemaVersion: '2.0.0';
  id: string;
  sessionId: string;
  castAt: string;
  calendar: CalendarSnapshot;
  rulePackRef: {
    id: 'wenwang_najia_v2';
    version: string;
    artifactHash: string;
  };
  rawTosses: readonly [6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9, 6 | 7 | 8 | 9];
  baseHexagram: HexagramSideV2;
  changedHexagram: HexagramSideV2;
  movingLines: readonly (1 | 2 | 3 | 4 | 5 | 6)[];
  lines: readonly [PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2, PlateLineV2];
}

export type EntityRef =
  | { type: 'pillar'; id: PillarKind }
  | { type: 'hexagram'; id: 'base' | 'changed' }
  | { type: 'line'; id: string; side: 'base' | 'changed' }
  | { type: 'hidden-spirit'; id: string }
  | { type: 'use-god'; id: 'primary' };

export type UseGodEntityRef = Extract<EntityRef, { type: 'line' | 'hidden-spirit' }>;

export type FactRelation =
  | 'generates' | 'controls' | 'same-element'
  | 'clashes' | 'combines' | 'punishes' | 'harms' | 'breaks'
  | 'has-month-status' | 'is-void' | 'is-month-break' | 'is-day-break' | 'is-dark-moving'
  | 'returns-generate' | 'returns-control' | 'returns-clash' | 'returns-combine'
  | 'advances' | 'retreats' | 'changes-to-tomb' | 'changes-to-absolute'
  | 'forms-three-harmony' | 'has-three-harmony-candidate'
  | 'is-six-harmony' | 'is-six-clash' | 'is-fan-yin' | 'is-fu-yin'
  | 'is-growth-stage' | 'is-six-beast' | 'is-shen-sha'
  | 'is-source-spirit' | 'is-avoid-spirit' | 'is-enemy-spirit'
  | 'flying-generates-hidden' | 'flying-controls-hidden'
  | 'hidden-generates-flying' | 'hidden-controls-flying'
  | 'holds-shi' | 'holds-ying';

export interface DerivedFact {
  id: string;
  relation: FactRelation;
  source: EntityRef;
  target?: EntityRef;
  scope: 'calendar' | 'base' | 'changed' | 'transition' | 'formation' | 'use-god' | 'auxiliary';
  authority: RuleAuthority;
  ruleId: string;
  profileId: string;
  certainty: 'computed' | 'conditional' | 'disputed';
  conditions: readonly string[];
  values: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  sourceRefs: readonly string[];
}

export type QuestionIntentId =
  | 'career.rank-or-office'
  | 'career.contract-or-approval'
  | 'career.project-profit'
  | 'study.learning-or-documents'
  | 'study.exam-rank-or-admission'
  | 'wealth.money-or-valuables'
  | 'relationship.female-partner'
  | 'relationship.male-partner'
  | 'relationship.relationship-dynamic'
  | 'health.self'
  | 'health.other-person'
  | 'lost-item.money-or-valuables'
  | 'lost-item.documents-or-vehicle'
  | 'lost-item.animal'
  | 'travel.self'
  | 'travel.other-person'
  | 'other.explicit';

export type QuestionCategory =
  | 'career'
  | 'wealth'
  | 'relationship'
  | 'health'
  | 'study'
  | 'lost_item'
  | 'travel'
  | 'other';

export type UseGodSubjectRelation = SixRelation | 'distant-other';

export type UseGodTargetSelector =
  | { kind: 'six-relation'; relation: SixRelation }
  | { kind: 'role'; role: '世' | '应' }
  | { kind: 'shi-ying-pair' }
  | { kind: 'explicit-entity'; entity: UseGodEntityRef };

export interface UseGodCandidate {
  entity: UseGodEntityRef;
  relation: SixRelation;
  candidateSource: 'base-visible' | 'true-changed' | 'palace-head-hidden';
  sourceTier: 0 | 1 | 2;
  features: Readonly<{
    moving: boolean;
    role: '世' | '应' | null;
    factIds: readonly string[];
  }>;
  authority: RuleAuthority;
  certainty: 'computed' | 'conditional' | 'disputed';
  profileId: string;
  sourceRefs: readonly string[];
  conditions: readonly string[];
  reasonRuleIds: readonly string[];
}

export interface UseGodClarificationPatch {
  explicitIntentId?: QuestionIntentId;
  subjectRelation?: UseGodSubjectRelation;
  explicitTarget?: UseGodTargetSelector;
}

export interface UseGodClarificationOption {
  id: string;
  label: string;
  patch: Readonly<UseGodClarificationPatch>;
}

export interface UseGodClarification {
  reason: 'intent-required' | 'subject-relation-required' | 'explicit-target-required';
  prompt: string;
  options: readonly UseGodClarificationOption[];
}

export interface UseGodResolvedIntent {
  id: QuestionIntentId;
  label: string;
  selectedBy: 'explicit-user-choice' | 'deterministic-rule';
  subjectRelation?: UseGodSubjectRelation;
  explicitTarget?: UseGodTargetSelector;
}

interface UseGodSelectionCommon {
  plateRef: Readonly<{
    id: string;
    sessionId: string;
    castAt: string;
    rawTosses: PlateV2['rawTosses'];
    rulePackRef: PlateV2['rulePackRef'];
  }>;
  category: QuestionCategory;
  relatedRelations: readonly SixRelation[];
  ruleIds: readonly string[];
}

export interface UseGodNeedsUserInputSelection extends UseGodSelectionCommon {
  status: 'needs-user-input';
  selectionMode: 'single';
  intent: UseGodResolvedIntent | null;
  targetSelector: null;
  primary: null;
  focusEntities: readonly [];
  candidates: readonly [];
  clarification: UseGodClarification;
}

export interface UseGodUnresolvedSelection extends UseGodSelectionCommon {
  status: 'unresolved';
  selectionMode: 'single';
  intent: UseGodResolvedIntent;
  targetSelector: Exclude<UseGodTargetSelector, { kind: 'shi-ying-pair' }>;
  primary: null;
  focusEntities: readonly [];
  candidates: readonly [];
  clarification?: never;
}

export interface UseGodAmbiguousSelection extends UseGodSelectionCommon {
  status: 'ambiguous';
  selectionMode: 'single';
  intent: UseGodResolvedIntent;
  targetSelector: Exclude<UseGodTargetSelector, { kind: 'shi-ying-pair' }>;
  primary: null;
  focusEntities: readonly UseGodEntityRef[];
  candidates: readonly [UseGodCandidate, UseGodCandidate, ...UseGodCandidate[]];
  clarification?: never;
}

export interface UseGodResolvedSingleSelection extends UseGodSelectionCommon {
  status: 'resolved';
  selectionMode: 'single';
  intent: UseGodResolvedIntent;
  targetSelector: Exclude<UseGodTargetSelector, { kind: 'shi-ying-pair' }>;
  primary: UseGodCandidate;
  focusEntities: readonly [UseGodEntityRef];
  candidates: readonly [UseGodCandidate];
  clarification?: never;
}

export interface UseGodResolvedPairSelection extends UseGodSelectionCommon {
  status: 'resolved';
  selectionMode: 'shi-ying-pair';
  intent: UseGodResolvedIntent;
  targetSelector: Extract<UseGodTargetSelector, { kind: 'shi-ying-pair' }>;
  primary: null;
  focusEntities: readonly [UseGodEntityRef, UseGodEntityRef];
  candidates: readonly [];
  clarification?: never;
}

export type UseGodSelection =
  | UseGodNeedsUserInputSelection
  | UseGodUnresolvedSelection
  | UseGodAmbiguousSelection
  | UseGodResolvedSingleSelection
  | UseGodResolvedPairSelection;

export interface DivinationCaseV2 {
  schemaVersion: '2.0.0';
  sessionId: string;
  question: string;
  category: string;
  ruleContext: RuleContext;
  plate: PlateV2;
  useGod: UseGodSelection;
  facts: readonly DerivedFact[];
  factSetHash: string;
  builtAt: string;
}
