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
  harmonyForm: 'six-harmony' | 'six-clash' | 'neither';
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
  growthByPillar: Record<PillarKind, TwelveStage>;
}

export interface HiddenSpiritV2 {
  id: string;
  hostLineId: string;
  relation: SixRelation;
  stem: Stem;
  branch: Branch;
  ganZhi: string;
  element: Element;
  sourceHexagram: string;
}

export interface PlateLineV2 {
  id: string;
  position: 1 | 2 | 3 | 4 | 5 | 6;
  tossValue: 6 | 7 | 8 | 9;
  moving: boolean;
  beast: '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武';
  base: LineFacetV2;
  changed: LineFacetV2;
  transition: null | {
    fromLineId: string;
    toLineId: string;
    growthIntoChanged: TwelveStage;
  };
  hiddenSpirits: readonly HiddenSpiritV2[];
}

export interface PlateV2 {
  schemaVersion: '2.0.0';
  id: string;
  sessionId: string;
  castAt: string;
  calendar: CalendarSnapshot;
  ruleContextHash: string;
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
  | 'is-void' | 'is-month-break' | 'is-day-break' | 'is-dark-moving'
  | 'returns-generate' | 'returns-control' | 'returns-clash' | 'returns-combine'
  | 'advances' | 'retreats' | 'forms-three-harmony'
  | 'is-six-harmony' | 'is-six-clash' | 'is-fan-yin' | 'is-fu-yin'
  | 'is-growth-stage' | 'is-shen-sha'
  | 'is-source-spirit' | 'is-avoid-spirit' | 'is-enemy-spirit'
  | 'flying-generates-hidden' | 'flying-controls-hidden'
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
  | 'career.project-or-contract'
  | 'study.learning-or-documents'
  | 'study.exam-rank-or-admission'
  | 'wealth.income-or-asset'
  | 'relationship.female-partner'
  | 'relationship.male-partner'
  | 'relationship.relationship-dynamic'
  | 'health.self'
  | 'lost-item.money-or-valuables'
  | 'lost-item.documents-or-vehicle'
  | 'lost-item.animal'
  | 'travel.self'
  | 'travel.other-person'
  | 'other.explicit';

export interface UseGodCandidate {
  entity: UseGodEntityRef;
  relation: SixRelation;
  role: 'primary' | 'secondary' | 'supporting';
  score: number;
  reasonRuleIds: readonly string[];
}

export interface UseGodSelection {
  status: 'resolved' | 'ambiguous' | 'needs-user-input';
  intent: {
    id: QuestionIntentId;
    label: string;
    selectedBy: 'explicit-user-choice' | 'deterministic-rule';
  } | null;
  primary: UseGodCandidate | null;
  candidates: readonly UseGodCandidate[];
  relatedRelations: readonly SixRelation[];
  clarification?: {
    prompt: string;
    options: readonly { intentId: QuestionIntentId; label: string }[];
  };
  ruleIds: readonly string[];
}

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
