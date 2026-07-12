import type {
  CalendarPillar,
  DerivedFact,
  DivinationCaseV2,
  EntityRef,
  FactRelation,
  PlateLineV2,
  UseGodCandidate,
  UseGodEntityRef,
  UseGodSelection,
} from './model.js';
import { deepFreeze } from './rules/tables.js';
import { WENWANG_NAJIA_V2_ARTIFACT } from './rules/wenwang-najia-v2.js';

export const ANALYSIS_REPORT_V2_SECTIONS = [
  'summary', 'use-god', 'calendar', 'moving', 'synthesis', 'guidance',
] as const;
export const ANALYSIS_CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const;

const CLAIM_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    section: { type: 'string', enum: [...ANALYSIS_REPORT_V2_SECTIONS] },
    text: { type: 'string', minLength: 1, maxLength: 1200 },
    factIds: { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 256 } },
    ruleIds: { type: 'array', maxItems: 16, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 256 } },
    evidenceIds: { type: 'array', maxItems: 8, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 256 } },
    confidence: { type: 'string', enum: [...ANALYSIS_CONFIDENCE_LEVELS] },
  },
  required: ['id', 'section', 'text', 'factIds', 'ruleIds', 'evidenceIds', 'confidence'],
} as const;

function rawReportJsonSchema(minItems: number, maxItems: number) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      schemaVersion: { type: 'string', const: '2.0.0' },
      caseHash: { type: 'string', pattern: '^[0-9a-f]{64}$' },
      claims: {
        type: 'array', minItems, maxItems, items: CLAIM_JSON_SCHEMA,
      },
      uncertainties: {
        type: 'array', maxItems: 12, uniqueItems: true,
        items: { type: 'string', minLength: 1, maxLength: 500 },
      },
    },
    required: ['schemaVersion', 'caseHash', 'claims', 'uncertainties'],
  } as const;
}

export const REPORT_V2_SCHEMA = deepFreeze({
  name: 'liuyao_analysis_report_v2',
  strict: true,
  schema: rawReportJsonSchema(6, 24),
});

export const FOLLOW_UP_V2_SCHEMA = deepFreeze({
  name: 'liuyao_follow_up_v2',
  strict: true,
  schema: rawReportJsonSchema(1, 8),
});

export type AnalysisSectionV2 = typeof ANALYSIS_REPORT_V2_SECTIONS[number];
export type AnalysisConfidenceV2 = typeof ANALYSIS_CONFIDENCE_LEVELS[number];
export type ContractFactProvenanceV2 = 'plate' | 'entity' | 'use-god' | 'derived';

export interface ContractFactV2 {
  readonly id: string;
  readonly provenance: ContractFactProvenanceV2;
  readonly kind: string;
  readonly label: string;
  readonly relation: string | null;
  readonly source: EntityRef | null;
  readonly target: EntityRef | null;
  readonly sourceLabels: readonly string[];
  readonly targetLabels: readonly string[];
  readonly sourceFacetTokens: readonly string[];
  readonly targetFacetTokens: readonly string[];
  readonly authority: 'structural' | 'profile-dependent' | 'secondary';
  readonly certainty: 'computed' | 'conditional' | 'disputed';
  readonly ruleIds: readonly string[];
  readonly conditions: readonly string[];
  readonly values: Readonly<Record<string, unknown>>;
  readonly claimTokens: readonly string[];
}

export interface FactContractV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly question: string;
  readonly intent: UseGodSelection['intent'];
  readonly plateSummary: {
    readonly baseHexagram: string;
    readonly changedHexagram: string;
    readonly movingLines: readonly number[];
    readonly pillars: DivinationCaseV2['plate']['calendar']['pillars'];
  };
  readonly useGod: UseGodSelection;
  readonly facts: readonly ContractFactV2[];
}

export interface ContractPredicateV2 {
  readonly factId: string;
  readonly relation: string;
  readonly direction: 'directed' | 'symmetric';
  readonly sourceLabels: readonly string[];
  readonly targetLabels: readonly string[];
}

export interface FactContractValidationContextV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly allCurrentTokens: readonly string[];
  readonly entityLabels: readonly string[];
  readonly predicates: readonly ContractPredicateV2[];
  readonly useGod: UseGodSelection;
}

export interface FactContractBundleV2 {
  readonly modelContract: FactContractV2;
  readonly validationContext: FactContractValidationContextV2;
}

export interface AnalysisClaimV2 {
  readonly id: string;
  readonly section: AnalysisSectionV2;
  readonly text: string;
  readonly factIds: readonly string[];
  readonly ruleIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidence: AnalysisConfidenceV2;
}

export interface RawAnalysisReportV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly claims: readonly AnalysisClaimV2[];
  readonly uncertainties: readonly string[];
}

export interface AnalysisValidationV2 {
  readonly status: 'validated';
  readonly factCheckPassed: true;
  readonly citationCheckPassed: true;
  readonly validatedAt: string;
}

export interface AnalysisReportV2 extends RawAnalysisReportV2 {
  readonly validation: AnalysisValidationV2;
}

export type RawFollowUpV2 = RawAnalysisReportV2;
export type ValidatedFollowUpV2 = AnalysisReportV2;

export interface CanonicalEvidenceV2 {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly sourceType: 'original' | 'summary';
  readonly location: string;
  readonly text: string;
  readonly contentHash: string;
  readonly tags: readonly string[];
  readonly knowledgeKind: 'rule' | 'case' | 'doctrine';
  readonly topics: readonly string[];
  readonly pageImage?: string;
  readonly supportsRuleIds: readonly string[];
}

export interface AnalysisRetrievalContextV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly queryTerms: readonly string[];
  readonly ruleIds: readonly string[];
}

type StrictRecord = Record<string, unknown>;

const REPORT_KEYS = new Set(['schemaVersion', 'caseHash', 'claims', 'uncertainties']);
const VALIDATED_REPORT_KEYS = new Set([
  'schemaVersion', 'caseHash', 'claims', 'uncertainties', 'validation',
]);
const VALIDATION_KEYS = new Set([
  'status', 'factCheckPassed', 'citationCheckPassed', 'validatedAt',
]);
const CLAIM_KEYS = new Set([
  'id', 'section', 'text', 'factIds', 'ruleIds', 'evidenceIds', 'confidence',
]);
const EVIDENCE_KEYS = new Set([
  'id', 'title', 'source', 'sourceType', 'location', 'text', 'contentHash',
  'tags', 'knowledgeKind', 'topics', 'pageImage', 'supportsRuleIds',
]);
const EVIDENCE_REQUIRED_KEYS = new Set([
  'id', 'title', 'source', 'sourceType', 'location', 'text', 'contentHash',
  'tags', 'knowledgeKind', 'topics', 'supportsRuleIds',
]);
const SECTION_SET = new Set<string>(ANALYSIS_REPORT_V2_SECTIONS);
const CONFIDENCE_SET = new Set<string>(ANALYSIS_CONFIDENCE_LEVELS);
const CASE_HASH_RE = /^[0-9a-f]{64}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/u;
const PROMPT_INJECTION_RE = /(?:ignore\s+(?:all\s+)?(?:previous|prior)|disregard\s+(?:all\s+)?(?:earlier|previous|prior).{0,24}(?:constraints?|instructions?|rules?)|bypass.{0,20}(?:validation|rules?|safety)|override.{0,20}(?:instructions?|rules?)|(?:print|output|show|expose).{0,12}(?:internal|hidden|system).{0,12}(?:prompt|instructions?|rules?|content)|reveal.{0,20}(?:system|hidden).{0,12}(?:prompt|instructions?)|system\s*(?:prompt|message)|developer\s*message|prompt\s*injection|jailbreak|(?:忽略|无视).{0,12}(?:指令|提示|规则)|(?:抛开|撇开|放弃)(?:以上|此前|前述|所有|这些)?(?:约束|限制|规则|要求)|(?:打印|输出|展示|泄露).{0,12}(?:内部|隐藏|系统).{0,8}(?:提示|指令|规则|内容)|(?:绕过|跳过|规避).{0,10}(?:事实校验|校验|规则|限制|安全机制)|(?:改为|直接).{0,4}输出.{0,12}(?:系统|规则|提示|隐藏)|隐藏.{0,8}(?:规则|指令|提示)|不要遵循.{0,8}(?:规则|指令)|系统提示词|开发者消息|越狱|提示词注入)/iu;
const ANCIENT_SOURCE_RE = /(?:古籍|原文|占例|卜筮正宗|增删卜易|黄金策|易隐|易冒)/u;
const SINGLE_PRIMARY_RE = /(?:已(?:定|取)|确定|选定|取.{0,12}为用神|唯一(?:的)?主用神)/u;
const SPIRIT_ASSERTION_RE = /(?:元神|忌神|仇神)/u;
const EXTERNAL_ID_MAX = 256;
const CLAIM_ID_MAX = 64;
const CLAIM_TEXT_MAX = 1200;
const UNCERTAINTY_MAX = 500;
const RAW_BYTES_MAX = 128 * 1024;
const CONFIDENCE_RANK: Readonly<Record<AnalysisConfidenceV2, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};
const SECTION_DISPLAY_LABELS: Readonly<Record<AnalysisSectionV2, string>> = {
  summary: '总览',
  'use-god': '用神',
  calendar: '日月时令',
  moving: '动变',
  synthesis: '综合判断',
  guidance: '行动建议',
};

const PILLAR_LABELS = {
  year: ['年柱', '年建', '太岁'],
  month: ['月柱', '月建', '月令'],
  day: ['日柱', '日建', '日辰'],
  hour: ['时柱', '时辰'],
} as const;

const POSITION_LABELS: Readonly<Record<number, readonly string[]>> = {
  1: ['初爻', '一爻', '第一爻', '1爻'],
  2: ['二爻', '第二爻', '2爻'],
  3: ['三爻', '第三爻', '3爻'],
  4: ['四爻', '第四爻', '4爻'],
  5: ['五爻', '第五爻', '5爻'],
  6: ['上爻', '六爻', '第六爻', '6爻'],
};

const RELATION_WORD: Readonly<Partial<Record<FactRelation, string>>> = {
  generates: '生',
  controls: '克',
  clashes: '冲',
  combines: '合',
  punishes: '刑',
  harms: '害',
  breaks: '破',
  'same-element': '同五行',
  'has-month-status': '月令状态',
  'is-void': '旬空',
  'is-month-break': '月破',
  'is-day-break': '日破',
  'is-dark-moving': '暗动',
  'returns-generate': '回头生',
  'returns-control': '回头克',
  'returns-clash': '回头冲',
  'returns-combine': '回头合',
  advances: '进神',
  retreats: '退神',
  'changes-to-tomb': '化墓',
  'changes-to-absolute': '化绝',
  'forms-three-harmony': '三合局',
  'has-three-harmony-candidate': '三合候选',
  'is-six-harmony': '六合卦',
  'is-six-clash': '六冲卦',
  'is-fan-yin': '反吟',
  'is-fu-yin': '伏吟',
  'is-growth-stage': '十二长生',
  'is-six-beast': '六神',
  'is-shen-sha': '神煞',
  'is-source-spirit': '元神',
  'is-avoid-spirit': '忌神',
  'is-enemy-spirit': '仇神',
  'flying-generates-hidden': '飞神生伏神',
  'flying-controls-hidden': '飞神克伏神',
  'hidden-generates-flying': '伏神生飞神',
  'hidden-controls-flying': '伏神克飞神',
  'holds-shi': '持世',
  'holds-ying': '持应',
};

const SPECIAL_PREDICATES: readonly { readonly pattern: RegExp; readonly relations: readonly string[]; readonly label: string }[] = [
  { pattern: /月破/u, relations: ['is-month-break'], label: '月破' },
  { pattern: /日破/u, relations: ['is-day-break'], label: '日破' },
  { pattern: /暗动/u, relations: ['is-dark-moving'], label: '暗动' },
  { pattern: /(?:旬空|空亡)/u, relations: ['is-void'], label: '旬空' },
  { pattern: /回头生/u, relations: ['returns-generate'], label: '回头生' },
  { pattern: /回头克/u, relations: ['returns-control'], label: '回头克' },
  { pattern: /回头冲/u, relations: ['returns-clash'], label: '回头冲' },
  { pattern: /回头合/u, relations: ['returns-combine'], label: '回头合' },
  { pattern: /(?:进神|化进)/u, relations: ['advances'], label: '进神' },
  { pattern: /(?:退神|化退)/u, relations: ['retreats'], label: '退神' },
  { pattern: /(?:化墓|入墓)/u, relations: ['changes-to-tomb'], label: '化墓' },
  { pattern: /(?:化绝|绝地)/u, relations: ['changes-to-absolute'], label: '化绝' },
  { pattern: /元神/u, relations: ['is-source-spirit'], label: '元神' },
  { pattern: /忌神/u, relations: ['is-avoid-spirit'], label: '忌神' },
  { pattern: /仇神/u, relations: ['is-enemy-spirit'], label: '仇神' },
  { pattern: /(?:六神|青龙|朱雀|勾陈|螣蛇|腾蛇|白虎|玄武)/u, relations: ['is-six-beast'], label: '六神' },
  { pattern: /(?:十二长生|长生|沐浴|冠带|临官|帝旺)/u, relations: ['is-growth-stage'], label: '十二长生' },
  { pattern: /神煞/u, relations: ['is-shen-sha'], label: '神煞' },
];

function fail(message: string): never {
  throw new TypeError(`AnalysisReportV2 校验失败：${message}`);
}

function isPlainRecord(value: unknown): value is StrictRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function strictClone<T>(value: T, label = '输入', ancestors = new Set<object>()): T {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${label} 含非有限数字`);
    return value;
  }
  if (typeof value !== 'object') fail(`${label} 含不可序列化值`);
  if (ancestors.has(value)) fail(`${label} 含循环引用`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        fail(`${label} 必须使用标准 Array.prototype`);
      }
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) fail(`${label} 数组不得稀疏`);
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (
          !descriptor
          || !descriptor.enumerable
          || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        ) fail(`${label}[${index}] 索引必须是可枚举 data 描述符`);
      }
      const keys = Reflect.ownKeys(value);
      for (const key of keys) {
        if (typeof key === 'symbol') fail(`${label} 数组含额外字段`);
        if (key === 'length') continue;
        if (!/^(?:0|[1-9]\d*)$/u.test(key) || String(Number(key)) !== key) {
          fail(`${label} 数组含非规范索引或额外字段`);
        }
        const numericIndex = Number(key);
        if (!Number.isSafeInteger(numericIndex) || numericIndex < 0 || numericIndex >= value.length) {
          fail(`${label} 数组索引 ${key} 超出实际 length 范围`);
        }
      }
      return value.map((entry, index) => strictClone(entry, `${label}[${index}]`, ancestors)) as T;
    }
    if (!isPlainRecord(value)) fail(`${label} 必须是普通对象`);
    const clone = Object.create(null) as StrictRecord;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail(`${label} 不得含 symbol 字段`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        fail(`${label}.${key} 不得使用访问器或非枚举字段`);
      }
      if (descriptor.value === undefined) fail(`${label}.${key} 不得为 undefined`);
      clone[key] = strictClone(descriptor.value, `${label}.${key}`, ancestors);
    }
    return clone as T;
  } finally {
    ancestors.delete(value);
  }
}

function assertExactKeys(record: StrictRecord, allowed: ReadonlySet<string>, label: string): void {
  const keys = Reflect.ownKeys(record);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) {
    fail(`${label} 含额外字段`);
  }
  if ([...allowed].some((key) => !Object.prototype.hasOwnProperty.call(record, key))) {
    fail(`${label} 缺少字段`);
  }
}

function stableUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
}

function entityKey(entity: EntityRef): string {
  if (entity.type === 'line') return `line:${entity.id}:${entity.side}`;
  return `${entity.type}:${entity.id}`;
}

function lineForEntity(caseSnapshot: DivinationCaseV2, entity: UseGodEntityRef): PlateLineV2 | undefined {
  if (entity.type === 'line') return caseSnapshot.plate.lines.find((line) => line.id === entity.id);
  return caseSnapshot.plate.lines.find((line) => (
    line.hiddenSpiritCandidates.some((candidate) => candidate.id === entity.id)
  ));
}

function labelsForEntity(caseSnapshot: DivinationCaseV2, entity: EntityRef): readonly string[] {
  if (entity.type === 'pillar') return PILLAR_LABELS[entity.id];
  if (entity.type === 'hexagram') {
    const side = entity.id === 'base' ? caseSnapshot.plate.baseHexagram : caseSnapshot.plate.changedHexagram;
    return stableUnique([
      entity.id === 'base' ? '本卦' : '变卦',
      side.name,
      `${entity.id === 'base' ? '本卦' : '变卦'}${side.name}`,
    ]);
  }
  if (entity.type === 'use-god') return ['用神', '主用神'];
  if (entity.type === 'line') {
    const line = caseSnapshot.plate.lines.find((candidate) => candidate.id === entity.id);
    if (!line) return [entity.id];
    const side = entity.side === 'base' ? '本卦' : '变卦';
    return stableUnique([
      entity.id,
      ...POSITION_LABELS[line.position],
      ...POSITION_LABELS[line.position].map((position) => `${side}${position}`),
    ]);
  }
  const hidden = caseSnapshot.plate.lines.flatMap((line) => line.hiddenSpiritCandidates)
    .find((candidate) => candidate.id === entity.id);
  return hidden
    ? stableUnique([entity.id, '伏神', `${hidden.relation}伏神`, `${POSITION_LABELS[hidden.sourceLine][0]}伏神`])
    : [entity.id, '伏神'];
}

function tokensFromValues(values: Readonly<Record<string, unknown>>): readonly string[] {
  const tokens: string[] = [];
  for (const value of Object.values(values)) {
    if (typeof value === 'string' && value.length > 0 && value.length <= 32) tokens.push(value);
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string' && entry.length > 0 && entry.length <= 32) tokens.push(entry);
      }
    }
  }
  return stableUnique(tokens);
}

function lineFacetTokens(line: PlateLineV2, side: 'base' | 'changed'): readonly string[] {
  const facet = line[side];
  const sideLabel = side === 'base' ? '本卦' : '变卦';
  return stableUnique([
    ...POSITION_LABELS[line.position],
    ...POSITION_LABELS[line.position].map((position) => `${sideLabel}${position}`),
    facet.ganZhi,
    facet.stem,
    facet.branch,
    facet.stemElement,
    facet.branchElement,
    `${facet.stemElement}行`,
    `${facet.branchElement}行`,
    facet.relationToBasePalace,
    facet.relationToOwnPalace,
    ...(facet.role ? [facet.role, `${facet.role}爻`, `持${facet.role}`] : []),
    line.moving ? '动爻' : '静爻',
    line.moving ? '发动' : '安静',
    sideLabel,
  ]);
}

function pillarTokens(pillar: CalendarPillar): readonly string[] {
  const labels = PILLAR_LABELS[pillar.kind];
  return stableUnique([
    ...labels,
    pillar.ganZhi,
    pillar.stem.value,
    pillar.branch.value,
    pillar.stem.element,
    pillar.branch.element,
    `${pillar.stem.element}行`,
    `${pillar.branch.element}行`,
    pillar.xun,
    `${pillar.voidBranches.join('')}空`,
    `${labels[0]}旬空${pillar.voidBranches.join('')}`,
    ...pillar.voidBranches,
  ]);
}

function entityFacetClaimTokens(
  caseSnapshot: DivinationCaseV2,
  entity: EntityRef,
): readonly string[] {
  if (entity.type === 'pillar') return pillarTokens(caseSnapshot.plate.calendar.pillars[entity.id]);
  if (entity.type === 'hexagram') {
    const side = entity.id === 'base'
      ? caseSnapshot.plate.baseHexagram
      : caseSnapshot.plate.changedHexagram;
    return stableUnique([
      entity.id === 'base' ? '本卦' : '变卦',
      side.name, side.shortName, side.palaceElement, `${side.palaceElement}行`,
    ]);
  }
  if (entity.type === 'use-god') return ['用神', '主用神'];
  if (entity.type === 'line') {
    const line = caseSnapshot.plate.lines.find(({ id }) => id === entity.id);
    return line ? lineFacetTokens(line, entity.side) : [];
  }
  const hidden = caseSnapshot.plate.lines.flatMap((line) => line.hiddenSpiritCandidates)
    .find(({ id }) => id === entity.id);
  return hidden
    ? stableUnique([
      '伏神', hidden.relation, `${hidden.relation}伏神`, hidden.ganZhi,
      hidden.stem, hidden.branch, hidden.element, `${hidden.element}行`,
      ...POSITION_LABELS[hidden.sourceLine],
    ])
    : ['伏神'];
}

type ContractFactInputV2 = Omit<ContractFactV2, 'sourceFacetTokens' | 'targetFacetTokens'> & {
  readonly sourceFacetTokens?: readonly string[];
  readonly targetFacetTokens?: readonly string[];
};

function createContractFact(input: ContractFactInputV2): ContractFactV2 {
  return strictClone({
    ...input,
    sourceFacetTokens: input.sourceFacetTokens ?? [],
    targetFacetTokens: input.targetFacetTokens ?? [],
  }, `contract fact ${input.id}`);
}

function structuralFacts(caseSnapshot: DivinationCaseV2): ContractFactV2[] {
  const { plate } = caseSnapshot;
  const base = plate.baseHexagram;
  const changed = plate.changedHexagram;
  const result: ContractFactV2[] = [
    createContractFact({
      id: 'contract:plate:hexagram:base', provenance: 'plate', kind: 'base-hexagram',
      label: `本卦 ${base.name}`, relation: null,
      source: { type: 'hexagram', id: 'base' }, target: null,
      sourceLabels: labelsForEntity(caseSnapshot, { type: 'hexagram', id: 'base' }), targetLabels: [],
      authority: 'structural', certainty: 'computed', ruleIds: [], conditions: [],
      values: { ...base },
      claimTokens: stableUnique([
        '本卦', base.name, base.shortName, base.upperTrigram, base.lowerTrigram,
        base.palace, base.palaceElement, base.generation,
      ]),
    }),
    createContractFact({
      id: 'contract:plate:hexagram:changed', provenance: 'plate', kind: 'changed-hexagram',
      label: `变卦 ${changed.name}`, relation: null,
      source: { type: 'hexagram', id: 'changed' }, target: null,
      sourceLabels: labelsForEntity(caseSnapshot, { type: 'hexagram', id: 'changed' }), targetLabels: [],
      authority: 'structural', certainty: 'computed', ruleIds: [], conditions: [],
      values: { ...changed },
      claimTokens: stableUnique([
        '变卦', changed.name, changed.shortName, changed.upperTrigram, changed.lowerTrigram,
        changed.palace, changed.palaceElement, changed.generation,
      ]),
    }),
    createContractFact({
      id: 'contract:plate:moving-lines', provenance: 'plate', kind: 'moving-line-set',
      label: plate.movingLines.length > 0 ? `动爻 ${plate.movingLines.join('、')}` : '无动爻',
      relation: null, source: { type: 'hexagram', id: 'base' }, target: null,
      sourceLabels: labelsForEntity(caseSnapshot, { type: 'hexagram', id: 'base' }), targetLabels: [],
      authority: 'structural', certainty: 'computed', ruleIds: [], conditions: [],
      values: { movingLines: [...plate.movingLines], count: plate.movingLines.length },
      claimTokens: stableUnique([
        '动爻', plate.movingLines.length === 0 ? '无动爻' : '有动爻',
        ...plate.movingLines.flatMap((position) => POSITION_LABELS[position]),
      ]),
    }),
  ];

  for (const kind of ['year', 'month', 'day', 'hour'] as const) {
    const pillar = plate.calendar.pillars[kind];
    result.push(createContractFact({
      id: `contract:plate:pillar:${kind}`, provenance: 'plate', kind: `${kind}-pillar`,
      label: `${PILLAR_LABELS[kind][0]} ${pillar.ganZhi}`, relation: null,
      source: { type: 'pillar', id: kind }, target: null,
      sourceLabels: labelsForEntity(caseSnapshot, { type: 'pillar', id: kind }), targetLabels: [],
      authority: 'structural', certainty: 'computed', ruleIds: [], conditions: [],
      values: { ...pillar, voidBranches: [...pillar.voidBranches] },
      claimTokens: pillarTokens(pillar),
    }));
  }
  return result;
}

function entityFacts(caseSnapshot: DivinationCaseV2): ContractFactV2[] {
  const result: ContractFactV2[] = [];
  for (const line of caseSnapshot.plate.lines) {
    for (const side of ['base', 'changed'] as const) {
      const entity: EntityRef = { type: 'line', id: line.id, side };
      const facet = line[side];
      result.push(createContractFact({
        id: `contract:entity:line:${line.id}:${side}`,
        provenance: 'entity', kind: `${side}-line`,
        label: `${side === 'base' ? '本卦' : '变卦'}${POSITION_LABELS[line.position][0]} ${facet.relationToBasePalace} ${facet.ganZhi}`,
        relation: null, source: entity, target: null,
        sourceLabels: labelsForEntity(caseSnapshot, entity), targetLabels: [],
        sourceFacetTokens: lineFacetTokens(line, side),
        authority: 'structural', certainty: 'computed', ruleIds: [], conditions: [],
        values: {
          position: line.position,
          side,
          moving: line.moving,
          tossValue: line.tossValue,
          yang: facet.yang,
          stem: facet.stem,
          branch: facet.branch,
          ganZhi: facet.ganZhi,
          stemElement: facet.stemElement,
          branchElement: facet.branchElement,
          relationToBasePalace: facet.relationToBasePalace,
          relationToOwnPalace: facet.relationToOwnPalace,
          role: facet.role ?? '',
        },
        claimTokens: lineFacetTokens(line, side),
      }));
    }
    for (const hidden of line.hiddenSpiritCandidates) {
      const entity: EntityRef = { type: 'hidden-spirit', id: hidden.id };
      result.push(createContractFact({
        id: `contract:entity:hidden:${hidden.id}`,
        provenance: 'entity', kind: 'hidden-spirit', label: `${POSITION_LABELS[line.position][0]}伏神 ${hidden.relation}${hidden.ganZhi}`,
        relation: null, source: entity, target: { type: 'line', id: line.id, side: 'base' },
        sourceLabels: labelsForEntity(caseSnapshot, entity),
        targetLabels: labelsForEntity(caseSnapshot, { type: 'line', id: line.id, side: 'base' }),
        sourceFacetTokens: stableUnique([
          '伏神', `${hidden.relation}伏神`, hidden.relation, hidden.ganZhi,
          hidden.stem, hidden.branch, hidden.element, `${hidden.element}行`,
          ...POSITION_LABELS[line.position],
        ]),
        authority: 'profile-dependent', certainty: 'disputed', ruleIds: [], conditions: ['hidden-use-disputed'],
        values: { ...hidden },
        claimTokens: stableUnique([
          '伏神', `${hidden.relation}伏神`, hidden.relation, hidden.ganZhi,
          hidden.stem, hidden.branch, hidden.element, `${hidden.element}行`,
          ...POSITION_LABELS[line.position],
        ]),
      }));
    }
  }
  return result;
}

function candidateFact(
  caseSnapshot: DivinationCaseV2,
  candidate: UseGodCandidate | null,
  entity: UseGodEntityRef,
  role: 'candidate' | 'focus',
): ContractFactV2 {
  const line = lineForEntity(caseSnapshot, entity);
  const entityLabels = labelsForEntity(caseSnapshot, entity);
  const lineTokens = entity.type === 'line' && line
    ? lineFacetTokens(line, entity.side)
    : entity.type === 'hidden-spirit' && line
      ? stableUnique([
        '伏神',
        ...line.hiddenSpiritCandidates
          .filter((hidden) => hidden.id === entity.id)
          .flatMap((hidden) => [hidden.relation, hidden.ganZhi, hidden.element, `${hidden.element}行`]),
        ...POSITION_LABELS[line.position],
      ])
      : entityLabels;
  const key = entityKey(entity).replaceAll(':', '-');
  return createContractFact({
    id: `contract:use-god:${role}:${key}`,
    provenance: 'use-god', kind: `use-god-${role}`,
    label: `${role === 'candidate' ? '用神候选' : '用神焦点'} ${entityLabels[0]}`,
    relation: null, source: { type: 'use-god', id: 'primary' }, target: entity,
    sourceLabels: ['用神', '主用神'], targetLabels: entityLabels,
    sourceFacetTokens: ['用神', '主用神'],
    targetFacetTokens: lineTokens,
    authority: candidate?.authority ?? 'profile-dependent',
    certainty: candidate?.certainty ?? (entity.type === 'hidden-spirit' ? 'disputed' : 'computed'),
    ruleIds: candidate?.reasonRuleIds ? [...candidate.reasonRuleIds] : [...caseSnapshot.useGod.ruleIds],
    conditions: candidate?.conditions ? [...candidate.conditions] : [],
    values: {
      entity: strictClone(entity),
      relation: candidate?.relation ?? '',
      candidateSource: candidate?.candidateSource ?? 'focus',
      sourceTier: candidate?.sourceTier ?? -1,
      moving: candidate?.features.moving ?? line?.moving ?? false,
      role: candidate?.features.role ?? '',
    },
    claimTokens: stableUnique([
      '用神',
      ...(candidate?.relation ? [candidate.relation] : []),
      ...entityLabels,
      ...lineTokens,
    ]),
  });
}

function useGodFacts(caseSnapshot: DivinationCaseV2): ContractFactV2[] {
  const selection = caseSnapshot.useGod;
  const selectionTokens = stableUnique([
    '用神',
    selection.status,
    selection.selectionMode,
    ...(selection.intent ? [selection.intent.id, selection.intent.label] : []),
    ...selection.relatedRelations,
    ...(selection.targetSelector?.kind === 'six-relation' ? [selection.targetSelector.relation] : []),
    ...(selection.targetSelector?.kind === 'role' ? [selection.targetSelector.role, `${selection.targetSelector.role}爻`] : []),
    ...(selection.selectionMode === 'shi-ying-pair' ? ['世应', '世爻', '应爻'] : []),
  ]);
  const result: ContractFactV2[] = [createContractFact({
    id: 'contract:use-god:selection', provenance: 'use-god', kind: 'use-god-selection',
    label: `用神状态 ${selection.status}`, relation: null,
    source: { type: 'use-god', id: 'primary' }, target: null,
    sourceLabels: ['用神', '主用神'], targetLabels: [],
    authority: 'profile-dependent',
    certainty: selection.status === 'resolved' ? 'computed' : 'conditional',
    ruleIds: [...selection.ruleIds], conditions: [],
    values: {
      status: selection.status,
      selectionMode: selection.selectionMode,
      intentId: selection.intent?.id ?? '',
      intentLabel: selection.intent?.label ?? '',
      relatedRelations: [...selection.relatedRelations],
      targetSelector: strictClone(selection.targetSelector),
    },
    claimTokens: selectionTokens,
  })];

  const candidatesByKey = new Map(selection.candidates.map((candidate) => [entityKey(candidate.entity), candidate]));
  for (const candidate of selection.candidates) {
    result.push(candidateFact(caseSnapshot, candidate, candidate.entity, 'candidate'));
  }
  for (const entity of selection.focusEntities) {
    if (!candidatesByKey.has(entityKey(entity))) {
      result.push(candidateFact(caseSnapshot, null, entity, 'focus'));
    }
  }
  if (selection.status === 'needs-user-input') {
    result.push(createContractFact({
      id: 'contract:use-god:clarification', provenance: 'use-god', kind: 'use-god-clarification',
      label: selection.clarification.prompt, relation: null,
      source: { type: 'use-god', id: 'primary' }, target: null,
      sourceLabels: ['用神'], targetLabels: [],
      authority: 'profile-dependent', certainty: 'conditional',
      ruleIds: [...selection.ruleIds], conditions: [selection.clarification.reason],
      values: {
        reason: selection.clarification.reason,
        prompt: selection.clarification.prompt,
        optionIds: selection.clarification.options.map(({ id }) => id),
      },
      claimTokens: stableUnique(['用神', selection.clarification.prompt]),
    }));
  }
  return result;
}

function derivedContractFact(caseSnapshot: DivinationCaseV2, fact: DerivedFact): ContractFactV2 {
  const sourceLabels = labelsForEntity(caseSnapshot, fact.source);
  const targetLabels = fact.target ? labelsForEntity(caseSnapshot, fact.target) : [];
  const relationLabel = RELATION_WORD[fact.relation] ?? fact.relation;
  return createContractFact({
    id: fact.id,
    provenance: 'derived',
    kind: fact.scope,
    label: [sourceLabels[0], relationLabel, targetLabels[0]].filter(Boolean).join(' '),
    relation: fact.relation,
    source: strictClone(fact.source),
    target: fact.target ? strictClone(fact.target) : null,
    sourceLabels,
    targetLabels,
    sourceFacetTokens: entityFacetClaimTokens(caseSnapshot, fact.source),
    targetFacetTokens: fact.target ? entityFacetClaimTokens(caseSnapshot, fact.target) : [],
    authority: fact.authority,
    certainty: fact.certainty,
    ruleIds: [fact.ruleId],
    conditions: [...fact.conditions],
    values: strictClone(fact.values),
    claimTokens: stableUnique([
      relationLabel,
      ...sourceLabels,
      ...targetLabels,
      ...entityFacetClaimTokens(caseSnapshot, fact.source),
      ...(fact.target ? entityFacetClaimTokens(caseSnapshot, fact.target) : []),
      ...tokensFromValues(fact.values),
    ]),
  });
}

function assertCaseHash(value: string, label = 'caseHash'): void {
  if (!CASE_HASH_RE.test(value)) fail(`${label} 必须是小写 64 位十六进制`);
}

export function createFactContractV2(caseSnapshot: DivinationCaseV2): FactContractBundleV2 {
  const ownedCase = strictClone(caseSnapshot, 'DivinationCaseV2');
  if (!isPlainRecord(ownedCase) || ownedCase.schemaVersion !== '2.0.0') fail('DivinationCaseV2 版本无效');
  assertCaseHash(ownedCase.factSetHash, 'DivinationCaseV2.factSetHash');

  const facts = [
    ...structuralFacts(ownedCase),
    ...entityFacts(ownedCase),
    ...useGodFacts(ownedCase),
    ...ownedCase.facts.map((fact) => derivedContractFact(ownedCase, fact)),
  ].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const ids = new Set<string>();
  for (const fact of facts) {
    if (ids.has(fact.id)) fail(`ContractFact ID 重复：${fact.id}`);
    ids.add(fact.id);
  }

  const modelContract: FactContractV2 = {
    schemaVersion: '2.0.0',
    caseHash: ownedCase.factSetHash,
    question: ownedCase.question,
    intent: strictClone(ownedCase.useGod.intent),
    plateSummary: {
      baseHexagram: ownedCase.plate.baseHexagram.name,
      changedHexagram: ownedCase.plate.changedHexagram.name,
      movingLines: [...ownedCase.plate.movingLines],
      pillars: strictClone(ownedCase.plate.calendar.pillars),
    },
    useGod: strictClone(ownedCase.useGod),
    facts,
  };
  const predicates: ContractPredicateV2[] = facts
    .filter((fact) => fact.relation !== null)
    .map((fact) => ({
      factId: fact.id,
      relation: fact.relation as string,
      direction: fact.values.direction === 'symmetric' ? 'symmetric' : 'directed',
      sourceLabels: [...fact.sourceLabels],
      targetLabels: [...fact.targetLabels],
    }));
  const allCurrentTokens = stableUnique(facts.flatMap((fact) => fact.claimTokens));
  const entityLabels = stableUnique(facts.flatMap((fact) => [
    ...fact.sourceLabels,
    ...fact.targetLabels,
  ]));
  const validationContext: FactContractValidationContextV2 = {
    schemaVersion: '2.0.0',
    caseHash: ownedCase.factSetHash,
    allCurrentTokens,
    entityLabels,
    predicates,
    useGod: strictClone(ownedCase.useGod),
  };
  return deepFreeze(strictClone({ modelContract, validationContext }, 'FactContractV2')) as FactContractBundleV2;
}

function assertBoundedString(
  value: unknown,
  label: string,
  maximum: number,
  options: { readonly allowEmpty?: boolean; readonly externalId?: boolean } = {},
): string {
  if (typeof value !== 'string') fail(`${label} 必须是字符串`);
  if (value !== value.trim()) fail(`${label} 不得含首尾空白`);
  if (!options.allowEmpty && value.length === 0) fail(`${label} 不得为空`);
  if (value.length > maximum) fail(`${label} 超过上限 ${maximum}`);
  if (options.externalId && CONTROL_RE.test(value)) fail(`${label} 不得含控制字符`);
  return value;
}

function assertDenseUniqueStringArray(
  value: unknown,
  label: string,
  maximumItems: number,
  maximumLength = EXTERNAL_ID_MAX,
): readonly string[] {
  if (!Array.isArray(value)) fail(`${label} 必须是数组`);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(`${label} 数组不得稀疏`);
  }
  if (value.length > maximumItems) fail(`${label} 超过上限 ${maximumItems}`);
  const result = value.map((entry, index) => assertBoundedString(
    entry, `${label}[${index}]`, maximumLength, { externalId: true },
  ));
  if (new Set(result).size !== result.length) fail(`${label} 不得重复`);
  return result;
}

function normalizeClaim(value: unknown, index: number): AnalysisClaimV2 {
  if (!isPlainRecord(value)) fail(`claims[${index}] 必须是普通对象`);
  assertExactKeys(value, CLAIM_KEYS, `claims[${index}]`);
  const id = assertBoundedString(value.id, `claims[${index}].id`, CLAIM_ID_MAX, { externalId: true });
  const text = assertBoundedString(value.text, `claims[${index}].text`, CLAIM_TEXT_MAX);
  if (typeof value.section !== 'string' || !SECTION_SET.has(value.section)) {
    fail(`claims[${index}].section 非法`);
  }
  if (typeof value.confidence !== 'string' || !CONFIDENCE_SET.has(value.confidence)) {
    fail(`claims[${index}].confidence 非法`);
  }
  if (PROMPT_INJECTION_RE.test(text)) fail(`claims[${index}] 含提示词注入或元指令`);
  return {
    id,
    section: value.section as AnalysisSectionV2,
    text,
    factIds: assertDenseUniqueStringArray(value.factIds, `claims[${index}].factIds`, 16),
    ruleIds: assertDenseUniqueStringArray(value.ruleIds, `claims[${index}].ruleIds`, 16),
    evidenceIds: assertDenseUniqueStringArray(value.evidenceIds, `claims[${index}].evidenceIds`, 8),
    confidence: value.confidence as AnalysisConfidenceV2,
  };
}

function normalizeRaw(
  raw: unknown,
  options: { readonly followUp: boolean },
): RawAnalysisReportV2 {
  const owned = strictClone(raw, options.followUp ? 'RawFollowUpV2' : 'RawAnalysisReportV2');
  if (!isPlainRecord(owned)) fail('raw 必须是普通对象');
  assertExactKeys(owned, REPORT_KEYS, 'raw');
  if (owned.schemaVersion !== '2.0.0') fail('schemaVersion 必须为 2.0.0');
  if (typeof owned.caseHash !== 'string') fail('caseHash 必须是字符串');
  assertCaseHash(owned.caseHash);
  if (!Array.isArray(owned.claims)) fail('claims 必须是数组');
  const minimum = options.followUp ? 1 : 6;
  const maximum = options.followUp ? 8 : 24;
  if (owned.claims.length < minimum || owned.claims.length > maximum) {
    fail(`claims 数量必须为 ${minimum}–${maximum}`);
  }
  const claims = owned.claims.map((claim, index) => normalizeClaim(claim, index));
  if (new Set(claims.map(({ id }) => id)).size !== claims.length) fail('claim ID 不得重复');
  if (!options.followUp) {
    for (const section of ANALYSIS_REPORT_V2_SECTIONS) {
      if (!claims.some((claim) => claim.section === section)) fail(`缺少 ${section} section`);
    }
  }
  const uncertainties = assertDenseUniqueStringArray(
    owned.uncertainties, 'uncertainties', 12, UNCERTAINTY_MAX,
  );
  for (const [index, uncertainty] of uncertainties.entries()) {
    if (PROMPT_INJECTION_RE.test(uncertainty)) fail(`uncertainties[${index}] 含提示词注入或元指令`);
  }
  const normalized: RawAnalysisReportV2 = {
    schemaVersion: '2.0.0',
    caseHash: owned.caseHash,
    claims,
    uncertainties,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(normalized)).byteLength;
  if (bytes > RAW_BYTES_MAX) fail(`raw canonical JSON 超过上限 ${RAW_BYTES_MAX}`);
  return normalized;
}

function assertEvidence(value: unknown, index: number): CanonicalEvidenceV2 {
  const owned = strictClone(value, `evidence[${index}]`);
  if (!isPlainRecord(owned)) fail(`evidence[${index}] 必须是普通对象`);
  const keys = Reflect.ownKeys(owned);
  if (keys.some((key) => typeof key !== 'string' || !EVIDENCE_KEYS.has(key))) {
    fail(`evidence[${index}] 含额外字段`);
  }
  if ([...EVIDENCE_REQUIRED_KEYS].some((key) => !Object.prototype.hasOwnProperty.call(owned, key))) {
    fail(`evidence[${index}] 缺少字段`);
  }
  const result: CanonicalEvidenceV2 = {
    id: assertBoundedString(owned.id, `evidence[${index}].id`, EXTERNAL_ID_MAX, { externalId: true }),
    title: assertBoundedString(owned.title, `evidence[${index}].title`, 500),
    source: assertBoundedString(owned.source, `evidence[${index}].source`, 500),
    sourceType: assertBoundedString(owned.sourceType, `evidence[${index}].sourceType`, 100) as CanonicalEvidenceV2['sourceType'],
    location: assertBoundedString(owned.location, `evidence[${index}].location`, 500),
    text: assertBoundedString(owned.text, `evidence[${index}].text`, 32_000),
    contentHash: assertBoundedString(owned.contentHash, `evidence[${index}].contentHash`, 64, { externalId: true }),
    tags: assertDenseUniqueStringArray(owned.tags, `evidence[${index}].tags`, 64, 256),
    knowledgeKind: assertBoundedString(owned.knowledgeKind, `evidence[${index}].knowledgeKind`, 100) as CanonicalEvidenceV2['knowledgeKind'],
    topics: assertDenseUniqueStringArray(owned.topics, `evidence[${index}].topics`, 64, 256),
    supportsRuleIds: assertDenseUniqueStringArray(
      owned.supportsRuleIds, `evidence[${index}].supportsRuleIds`, 256,
    ),
    ...(Object.prototype.hasOwnProperty.call(owned, 'pageImage')
      ? { pageImage: assertBoundedString(owned.pageImage, `evidence[${index}].pageImage`, 2000) }
      : {}),
  };
  if (!['original', 'summary'].includes(result.sourceType)) fail(`evidence[${index}].sourceType 无效`);
  if (!['rule', 'case', 'doctrine'].includes(result.knowledgeKind)) fail(`evidence[${index}].knowledgeKind 无效`);
  if (!CASE_HASH_RE.test(result.contentHash)) fail(`evidence[${index}].contentHash 无效`);
  return result;
}

function normalizeEvidence(values: readonly CanonicalEvidenceV2[]): readonly CanonicalEvidenceV2[] {
  if (!Array.isArray(values)) fail('evidence 必须是数组');
  for (let index = 0; index < values.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(values, index)) fail('evidence 数组不得稀疏');
  }
  const evidence = values.map((entry, index) => assertEvidence(entry, index));
  if (new Set(evidence.map(({ id }) => id)).size !== evidence.length) fail('evidence ID 不得重复');
  return evidence;
}

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const ALL_GANZHI = Array.from({ length: 60 }, (_, index) => (
  `${STEMS[index % STEMS.length]}${BRANCHES[index % BRANCHES.length]}`
));
const ALL_HEXAGRAM_NAMES = stableUnique(WENWANG_NAJIA_V2_ARTIFACT.hexagrams.map(({ name }) => name));
const ALL_POSITION_TOKENS = stableUnique(Object.values(POSITION_LABELS).flat());
const ALL_SIX_RELATIONS = ['父母', '兄弟', '子孙', '妻财', '官鬼'] as const;
const ALL_GROWTH_STAGES = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养',
] as const;
const ALL_SHEN_SHA_LABELS = [
  '天乙贵人', '驿马', '禄神', '天喜', '桃花', '羊刃', '文昌', '华盖',
  '劫煞', '灾煞', '将星', '贵人',
] as const;
const STATIC_CONCRETE_TOKENS = stableUnique([
  ...ALL_HEXAGRAM_NAMES,
  ...ALL_GANZHI,
  ...ALL_POSITION_TOKENS,
  ...ALL_SIX_RELATIONS,
  '本卦', '变卦', '伏神',
  '动爻', '静爻', '发动', '安静',
  '木行', '火行', '土行', '金行', '水行',
  '甲子旬', '甲戌旬', '甲申旬', '甲午旬', '甲辰旬', '甲寅旬',
  '青龙', '朱雀', '勾陈', '螣蛇', '腾蛇', '白虎', '玄武',
]);

function extractConcreteTokens(text: string, context: FactContractValidationContextV2): readonly string[] {
  const found = new Set<string>();
  for (const token of STATIC_CONCRETE_TOKENS) {
    if (text.includes(token)) found.add(token === '腾蛇' ? '螣蛇' : token);
  }
  for (const token of ['世爻', '持世', '持应', '世应'] as const) {
    if (text.includes(token)) found.add(token);
  }
  let yingLineIndex = text.indexOf('应爻');
  while (yingLineIndex >= 0) {
    if (yingLineIndex === 0 || text[yingLineIndex - 1] !== '对') found.add('应爻');
    yingLineIndex = text.indexOf('应爻', yingLineIndex + 2);
  }
  for (const match of text.matchAll(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/gu)) {
    found.add(match[0]);
  }
  for (const match of text.matchAll(/[子丑寅卯辰巳午未申酉戌亥]{2}(?:空|旬空|空亡)/gu)) {
    found.add(match[0]);
  }
  for (const match of text.matchAll(/(?:旬空|空亡)([子丑寅卯辰巳午未申酉戌亥]{2})/gu)) {
    found.add(`${match[1]}空`);
  }
  const stageAlternation = ALL_GROWTH_STAGES.join('|');
  const stageContext = new RegExp(`(?:十二长生|长生阶段|长生位)(?:为|是|见|临|处于)?(${stageAlternation})?`, 'gu');
  for (const match of text.matchAll(stageContext)) {
    found.add('十二长生');
    if (match[1]) found.add(match[1]);
  }
  for (const stage of ALL_GROWTH_STAGES.filter((candidate) => candidate.length >= 2)) {
    let offset = text.indexOf(stage);
    while (offset >= 0) {
      if (!(stage === '长生' && text.slice(Math.max(0, offset - 2), offset) === '十二')) found.add(stage);
      offset = text.indexOf(stage, offset + stage.length);
    }
  }
  const singleStages = ALL_GROWTH_STAGES.filter((candidate) => candidate.length === 1).join('|');
  const positionAlternation = [...ALL_POSITION_TOKENS]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|');
  const standaloneStage = new RegExp(
    `(?:${positionAlternation})[^。；，,]{0,8}(?:为|是|临|处于)?(${singleStages})(?:地|位|阶段)?`,
    'gu',
  );
  for (const match of text.matchAll(standaloneStage)) found.add(match[1]);
  const prefixedStage = new RegExp(
    `(${stageAlternation})(?:临|在|落于|见于|居|处于|位于)(?:本卦|变卦)?(?:${positionAlternation})`,
    'gu',
  );
  for (const match of text.matchAll(prefixedStage)) {
    if (!(match[1] === '长生' && match[0].startsWith('十二长生'))) found.add(match[1]);
  }
  for (const label of [...ALL_SHEN_SHA_LABELS].sort((left, right) => right.length - left.length)) {
    if (!text.includes(label)) continue;
    if ([...found].some((existing) => existing.length > label.length && existing.includes(label))) continue;
    found.add(label);
  }
  for (const token of context.allCurrentTokens) {
    if (
      token.length >= 2
      && token.length <= 12
      && /(?:驿马|桃花|贵人|羊刃|文昌|华盖|劫煞|灾煞|将星|禄神|神煞)$/u.test(token)
      && text.includes(token)
    ) found.add(token);
  }
  return [...found];
}

function tokenAuthorized(token: string, allowed: ReadonlySet<string>): boolean {
  if (allowed.has(token)) return true;
  if (token.endsWith('空') || token.endsWith('旬空') || token.endsWith('空亡')) {
    const branches = token.replace(/(?:旬空|空亡|空)$/u, '');
    return [...allowed].some((candidate) => candidate.includes(branches) && candidate.includes('空'));
  }
  return false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function includesNear(text: string, token: string, index: number, radius = 12): boolean {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius + token.length);
  return text.slice(start, end).includes(token);
}

function entityRefKey(entity: EntityRef | null): string | null {
  if (!entity) return null;
  if (entity.type === 'line') return `line:${entity.id}:${entity.side}`;
  return `${entity.type}:${entity.id}`;
}

function factEntityKeys(fact: ContractFactV2): readonly string[] {
  return stableUnique([
    entityRefKey(fact.source),
    entityRefKey(fact.target),
  ].filter((value): value is string => value !== null));
}

function factsTouch(left: ContractFactV2, right: ContractFactV2): boolean {
  const leftKeys = new Set(factEntityKeys(left));
  return factEntityKeys(right).some((key) => leftKeys.has(key));
}

function connectedFactComponents(facts: readonly ContractFactV2[]): readonly (readonly ContractFactV2[])[] {
  const remaining = new Set(facts.map((_, index) => index));
  const components: ContractFactV2[][] = [];
  while (remaining.size > 0) {
    const [seed] = remaining;
    remaining.delete(seed);
    const component = [facts[seed]];
    const queue = [facts[seed]];
    while (queue.length > 0) {
      const current = queue.shift() as ContractFactV2;
      for (const index of [...remaining]) {
        if (!factsTouch(current, facts[index])) continue;
        remaining.delete(index);
        component.push(facts[index]);
        queue.push(facts[index]);
      }
    }
    components.push(component);
  }
  return components;
}

interface ClauseSegment {
  readonly text: string;
  readonly inheritedPillar: keyof typeof PILLAR_LABELS | null;
  readonly sentenceId: number;
}

function pillarKindInText(text: string): keyof typeof PILLAR_LABELS | null {
  for (const kind of ['year', 'month', 'day', 'hour'] as const) {
    if (PILLAR_LABELS[kind].some((label) => text.includes(label))) return kind;
  }
  for (const [label, kind] of [
    ['年', 'year'], ['月', 'month'], ['日', 'day'], ['时', 'hour'],
  ] as const) {
    if (new RegExp(`${label}(?:柱|干|支)`, 'u').test(text)) return kind;
  }
  return null;
}

function clauseSegments(text: string): readonly ClauseSegment[] {
  const result: ClauseSegment[] = [];
  let sentenceId = 0;
  for (const sentence of text.split(/[。；;\n]+/u)) {
    let inheritedPillar: keyof typeof PILLAR_LABELS | null = null;
    for (const raw of sentence.split(/[，,]+/u)) {
      const clause = raw.trim();
      if (!clause) continue;
      const explicit = pillarKindInText(clause);
      if (explicit) inheritedPillar = explicit;
      result.push({ text: clause, inheritedPillar, sentenceId });
    }
    sentenceId += 1;
  }
  return result;
}

function calendarTokens(text: string, context: FactContractValidationContextV2): readonly string[] {
  return extractConcreteTokens(text, context).filter((token) => (
    ALL_GANZHI.includes(token)
    || token.endsWith('旬')
    || /[子丑寅卯辰巳午未申酉戌亥]{2}(?:空|旬空|空亡)$/u.test(token)
  ));
}

function factCoversTokens(fact: ContractFactV2, tokens: readonly string[]): boolean {
  const allowed = new Set(fact.claimTokens);
  return tokens.every((token) => tokenAuthorized(token, allowed));
}

interface EntityAnchorMatch {
  readonly index: number;
  readonly end: number;
  readonly label: string;
  readonly entityFactIds: readonly string[];
  readonly entityKeys: readonly string[];
}

function labelledAttributeValues(
  text: string,
  labels: readonly string[],
  values: readonly string[],
): readonly string[] {
  const labelPattern = [...labels]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|');
  const valuePattern = [...values]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join('|');
  const pattern = new RegExp(
    `(?:${labelPattern})(?:(?:为|是|属)|[:：])?\\s*(${valuePattern})`,
    'gu',
  );
  return [...text.matchAll(pattern)].map((match) => match[1]);
}

function entityAnchorMatches(
  text: string,
  allFacts: readonly ContractFactV2[],
): readonly EntityAnchorMatch[] {
  const candidates: Array<{
    index: number;
    end: number;
    label: string;
    factId: string;
    entityKey: string;
  }> = [];
  for (const fact of allFacts) {
    if (fact.provenance !== 'entity' || !fact.source) continue;
    const key = entityRefKey(fact.source);
    if (!key) continue;
    for (const label of fact.sourceLabels.filter((entry) => entry.length >= 2)) {
      let index = text.indexOf(label);
      while (index >= 0) {
        candidates.push({ index, end: index + label.length, label, factId: fact.id, entityKey: key });
        index = text.indexOf(label, index + label.length);
      }
    }
  }
  const maximal = candidates.filter((candidate) => !candidates.some((other) => (
    other.index <= candidate.index
    && other.end >= candidate.end
    && other.label.length > candidate.label.length
  )));
  const grouped = new Map<string, typeof maximal>();
  for (const candidate of maximal) {
    const key = `${candidate.index}:${candidate.end}:${candidate.label}`;
    const entries = grouped.get(key) ?? [];
    entries.push(candidate);
    grouped.set(key, entries);
  }
  return [...grouped.values()]
    .map((entries) => ({
      index: entries[0].index,
      end: entries[0].end,
      label: entries[0].label,
      entityFactIds: stableUnique(entries.map(({ factId }) => factId)),
      entityKeys: stableUnique(entries.map(({ entityKey }) => entityKey)),
    }))
    .sort((left, right) => left.index - right.index || right.label.length - left.label.length);
}

function facetTokens(text: string, context: FactContractValidationContextV2): readonly string[] {
  const labelledSingles = [
    ...labelledAttributeValues(text, ['纳干', '天干'], [...STEMS]),
    ...labelledAttributeValues(text, ['纳支', '地支'], [...BRANCHES]),
    ...labelledAttributeValues(text, ['五行'], ['木', '火', '土', '金', '水']),
    ...labelledAttributeValues(text, ['六亲'], [...ALL_SIX_RELATIONS]),
  ];
  const labelledSet = new Set(labelledSingles);
  return stableUnique([...extractConcreteTokens(text, context), ...labelledSingles]).filter((token) => (
    labelledSet.has(token)
    || token === '本卦'
    || token === '变卦'
    || token === '伏神'
    || ALL_GANZHI.includes(token)
    || ALL_POSITION_TOKENS.includes(token)
    || ALL_SIX_RELATIONS.includes(token as typeof ALL_SIX_RELATIONS[number])
    || ['世爻', '应爻', '持世', '持应', '世应', '动爻', '静爻', '发动', '安静'].includes(token)
    || /^[木火土金水]行$/u.test(token)
  ));
}

function factTouchesEntityKeys(fact: ContractFactV2, keys: readonly string[]): boolean {
  const factKeys = factEntityKeys(fact);
  return keys.some((key) => factKeys.includes(key));
}

function factCoversEntityFacet(
  fact: ContractFactV2,
  keys: readonly string[],
  tokens: readonly string[],
): boolean {
  const sourceKey = entityRefKey(fact.source);
  if (sourceKey && keys.includes(sourceKey)) {
    const allowed = new Set(fact.sourceFacetTokens);
    if (tokens.every((token) => tokenAuthorized(token, allowed))) return true;
  }
  const targetKey = entityRefKey(fact.target);
  if (targetKey && keys.includes(targetKey)) {
    const allowed = new Set(fact.targetFacetTokens);
    if (tokens.every((token) => tokenAuthorized(token, allowed))) return true;
  }
  return false;
}

function normalizeSpiritToken(token: string): string {
  return token === '腾蛇' ? '螣蛇' : token;
}

function validateEntityAssociations(
  clause: ClauseSegment,
  referencedFacts: readonly ContractFactV2[],
  allFacts: readonly ContractFactV2[],
  context: FactContractValidationContextV2,
  inheritedAnchors: readonly EntityAnchorMatch[] = [],
): void {
  const explicitAnchors = entityAnchorMatches(clause.text, allFacts);
  const anchors = explicitAnchors.length > 0
    ? explicitAnchors
    : inheritedAnchors.map((anchor) => ({ ...anchor, index: 0, end: 0, label: `继承:${anchor.label}` }));
  if (anchors.length === 0) return;
  for (let index = 0; index < anchors.length; index += 1) {
    const anchor = anchors[index];
    const next = anchors[index + 1];
    const sliceStart = index === 0 ? 0 : anchor.index;
    const slice = clause.text.slice(sliceStart, next?.index ?? clause.text.length);
    const tokens = facetTokens(slice, context);
    const supporters = referencedFacts.filter((fact) => factTouchesEntityKeys(fact, anchor.entityKeys));
    const structuralSetCoverage = referencedFacts.some((fact) => (
      fact.provenance === 'plate' && factCoversTokens(fact, tokens)
    ));
    if (
      tokens.length > 0
      && !structuralSetCoverage
      && !supporters.some((fact) => factCoversEntityFacet(fact, anchor.entityKeys, tokens))
    ) {
      fail(`当前排盘事实 clause「${slice}」的爻位、side 与实体属性不能由同一事实关联`);
    }

    const spiritTokens = extractConcreteTokens(slice, context)
      .filter((token) => ['青龙', '朱雀', '勾陈', '螣蛇', '腾蛇', '白虎', '玄武'].includes(token))
      .map(normalizeSpiritToken);
    if (slice.includes('六神') || spiritTokens.length > 0) {
      const candidates = supporters.filter(({ relation }) => relation === 'is-six-beast');
      if (!candidates.some((fact) => factCoversTokens(fact, spiritTokens))) {
        fail(`clause「${slice}」的六神与爻实体关联无效`);
      }
    }

    const stageTokens = extractConcreteTokens(slice, context)
      .filter((token) => ALL_GROWTH_STAGES.includes(token as typeof ALL_GROWTH_STAGES[number]));
    if (slice.includes('十二长生') || stageTokens.length > 0) {
      const candidates = supporters.filter((fact) => (
        fact.relation === 'is-growth-stage'
        && (!clause.inheritedPillar
          || fact.source?.type !== 'pillar'
          || fact.source.id === clause.inheritedPillar)
      ));
      if (!candidates.some((fact) => factCoversTokens(fact, stageTokens))) {
        fail(`clause「${slice}」的十二长生阶段与实体关联无效`);
      }
    }

    const shenShaTokens = extractConcreteTokens(slice, context)
      .filter((token) => ALL_SHEN_SHA_LABELS.includes(token as typeof ALL_SHEN_SHA_LABELS[number]));
    if (slice.includes('神煞') || shenShaTokens.length > 0) {
      const candidates = supporters.filter(({ relation }) => relation === 'is-shen-sha');
      if (!candidates.some((fact) => factCoversTokens(fact, shenShaTokens))) {
        fail(`clause「${slice}」的神煞与实体关联无效`);
      }
    }
  }
}

function validateStructuralAssociations(
  clause: ClauseSegment,
  referencedFacts: readonly ContractFactV2[],
  context: FactContractValidationContextV2,
): void {
  const hexagramNames = ALL_HEXAGRAM_NAMES.filter((name) => clause.text.includes(name));
  for (const [sideLabel, factId] of [
    ['本卦', 'contract:plate:hexagram:base'],
    ['变卦', 'contract:plate:hexagram:changed'],
  ] as const) {
    if (!clause.text.includes(sideLabel) || hexagramNames.length === 0) continue;
    const fact = referencedFacts.find(({ id }) => id === factId);
    if (!fact || !factCoversTokens(fact, [sideLabel, ...hexagramNames])) {
      fail(`当前排盘事实 clause「${clause.text}」的${sideLabel}与卦名不属于同一 structural fact`);
    }
  }

  const tokens = calendarTokens(clause.text, context);
  const kind = pillarKindInText(clause.text) ?? clause.inheritedPillar;
  if (tokens.length > 0 && kind) {
    const fact = referencedFacts.find(({ id }) => id === `contract:plate:pillar:${kind}`);
    if (!fact || !factCoversTokens(fact, tokens)) {
      fail(`当前排盘事实 ${tokens.join('、')} 在 clause「${clause.text}」中与${PILLAR_LABELS[kind][0]}不属于同一 pillar fact`);
    }
  }

  const kindByLabel = {
    年: 'year', 月: 'month', 日: 'day', 时: 'hour',
  } as const;
  const assertPillarSingle = (
    kindLabel: keyof typeof kindByLabel,
    facet: 'stem' | 'branch',
    expected: string,
    element: boolean,
  ) => {
    const pillarKind = kindByLabel[kindLabel];
    const fact = referencedFacts.find(({ id }) => id === `contract:plate:pillar:${pillarKind}`);
    const facetValue = fact?.values[facet];
    const actual = isPlainRecord(facetValue)
      ? facetValue[element ? 'element' : 'value']
      : undefined;
    if (actual !== expected) {
      fail(`${kindLabel}${facet === 'stem' ? '干' : '支'}单值 ${expected} 与当前 pillar fact 不匹配`);
    }
  };
  for (const kindLabel of ['年', '月', '日', '时'] as const) {
    const stemLabels = [`${kindLabel}柱天干`, `${kindLabel}天干`, `${kindLabel}柱干`, `${kindLabel}干`];
    const branchLabels = [`${kindLabel}柱地支`, `${kindLabel}地支`, `${kindLabel}柱支`, `${kindLabel}支`];
    for (const value of labelledAttributeValues(clause.text, stemLabels, [...STEMS])) {
      assertPillarSingle(kindLabel, 'stem', value, false);
    }
    for (const value of labelledAttributeValues(clause.text, branchLabels, [...BRANCHES])) {
      assertPillarSingle(kindLabel, 'branch', value, false);
    }
    for (const value of labelledAttributeValues(
      clause.text,
      stemLabels.flatMap((label) => [`${label}五行`, `${label}的五行`]),
      ['木', '火', '土', '金', '水'],
    )) assertPillarSingle(kindLabel, 'stem', value, true);
    for (const value of labelledAttributeValues(
      clause.text,
      branchLabels.flatMap((label) => [`${label}五行`, `${label}的五行`]),
      ['木', '火', '土', '金', '水'],
    )) assertPillarSingle(kindLabel, 'branch', value, true);
  }
  if (kind) {
    const kindLabel = ({ year: '年', month: '月', day: '日', hour: '时' } as const)[kind];
    for (const value of labelledAttributeValues(clause.text, ['其天干', '天干'], [...STEMS])) {
      assertPillarSingle(kindLabel, 'stem', value, false);
    }
    for (const value of labelledAttributeValues(clause.text, ['其地支', '地支'], [...BRANCHES])) {
      assertPillarSingle(kindLabel, 'branch', value, false);
    }
  }
}

function validateElementPredicates(
  claim: AnalysisClaimV2,
  referencedFacts: readonly ContractFactV2[],
): void {
  for (const match of claim.text.matchAll(/([木火土金水])(?:行)?(生|克)([木火土金水])(?:行)?/gu)) {
    const [, source, word, target] = match;
    const relation = word === '生' ? 'generates' : 'controls';
    const supported = referencedFacts.some((fact) => (
      fact.relation === relation
      && fact.values.sourceElement === source
      && fact.values.targetElement === target
    ));
    if (!supported) fail(`claim ${claim.id} 的${source}${word}${target}元素方向无事实支持`);
  }
}

function validateClauseAssociations(
  claim: AnalysisClaimV2,
  referencedFacts: readonly ContractFactV2[],
  allFacts: readonly ContractFactV2[],
  context: FactContractValidationContextV2,
): void {
  const components = connectedFactComponents(referencedFacts);
  let sentenceId = -1;
  let activeEntityAnchors: readonly EntityAnchorMatch[] = [];
  for (const clause of clauseSegments(claim.text)) {
    if (clause.sentenceId !== sentenceId) {
      sentenceId = clause.sentenceId;
      activeEntityAnchors = [];
    }
    const explicitAnchors = entityAnchorMatches(clause.text, allFacts);
    if (pillarKindInText(clause.text) && explicitAnchors.length === 0) activeEntityAnchors = [];
    validateStructuralAssociations(clause, referencedFacts, context);
    validateEntityAssociations(
      clause,
      referencedFacts,
      allFacts,
      context,
      explicitAnchors.length === 0 ? activeEntityAnchors : [],
    );
    if (explicitAnchors.length > 0) activeEntityAnchors = [explicitAnchors.at(-1) as EntityAnchorMatch];
    const tokens = extractConcreteTokens(clause.text, context);
    if (tokens.length > 0 && !components.some((component) => (
      tokens.every((token) => component.some((fact) => factCoversTokens(fact, [token])))
    ))) {
      fail(`clause「${clause.text}」的当前排盘属性不能跨事实链拼接`);
    }
  }
  validateElementPredicates(claim, referencedFacts);
}

function validateRelationPredicates(
  claim: AnalysisClaimV2,
  referencedFacts: readonly ContractFactV2[],
  allFacts: readonly ContractFactV2[],
  context: FactContractValidationContextV2,
): void {
  const bareNegative = /不(?:相)?(?:生|克|冲|合|刑|害|破)/u.test(claim.text);
  if (bareNegative) {
    const mentionedEntityKeys = stableUnique(entityAnchorMatches(claim.text, allFacts)
      .flatMap(({ entityKeys }) => entityKeys));
    const elementNegative = /[木火土金水](?:行)?不(?:相)?(?:生|克)[木火土金水]/u.test(claim.text);
    if (mentionedEntityKeys.length >= 2 || elementNegative) {
      fail(`claim ${claim.id} 含事实契约尚未建模的 bare 不负向关系断言`);
    }
  }
  if (/(?:并非|不是|不属|不为|未|无|否认)(?:相)?(?:生|克|冲|合|刑|害|破|月破|日破|暗动|回头生|回头克|回头冲|回头合|进神|退神|化墓|化绝|元神|忌神|仇神)/u.test(claim.text)) {
    fail(`claim ${claim.id} 含事实契约尚未建模的负向关系断言`);
  }
  const referencedPredicates = context.predicates.filter(({ factId }) => claim.factIds.includes(factId));
  for (const special of SPECIAL_PREDICATES) {
    const match = special.pattern.exec(claim.text);
    if (!match) continue;
    const candidates = referencedPredicates.filter(({ relation }) => special.relations.includes(relation));
    const structuralVoid = special.relations.includes('is-void') && referencedFacts.some((fact) => (
      fact.provenance === 'plate'
      && fact.kind.endsWith('-pillar')
      && extractConcreteTokens(claim.text, context)
        .filter((token) => token.includes('空'))
        .some((token) => factCoversTokens(fact, [token]))
    ));
    if (candidates.length === 0 && !structuralVoid) {
      fail(`claim ${claim.id} 的${special.label}关系无对应事实`);
    }
    if (structuralVoid && candidates.length === 0) continue;
    const nearbyLabels = context.entityLabels.filter((label) => (
      label.length >= 2 && includesNear(claim.text, label, match.index)
    ));
    const specificNearbyLabels = nearbyLabels.filter((label) => !nearbyLabels.some((other) => (
      other.length > label.length && other.includes(label)
    )));
    const structuredSpiritRole = special.relations.some((relation) => (
      relation === 'is-source-spirit' || relation === 'is-avoid-spirit' || relation === 'is-enemy-spirit'
    ));
    if (!structuredSpiritRole && specificNearbyLabels.length > 0 && !candidates.some((predicate) => specificNearbyLabels.some((label) => (
      predicate.sourceLabels.includes(label) || predicate.targetLabels.includes(label)
    )))) {
      fail(`claim ${claim.id} 的${special.label}关系实体不匹配`);
    }
  }

  const binaryRelations = [
    { word: '生', relation: 'generates' },
    { word: '克', relation: 'controls' },
    { word: '冲', relation: 'clashes' },
    { word: '合', relation: 'combines' },
    { word: '刑', relation: 'punishes' },
    { word: '害', relation: 'harms' },
    { word: '破', relation: 'breaks' },
  ] as const;
  const labels = context.entityLabels.filter((label) => label.length >= 2 && claim.text.includes(label))
    .sort((left, right) => right.length - left.length);
  for (const { word, relation } of binaryRelations) {
    if (!claim.text.includes(word)) continue;
    for (const sourceLabel of labels) {
      for (const targetLabel of labels) {
        if (sourceLabel === targetLabel) continue;
        const forward = new RegExp(`${escapeRegExp(sourceLabel)}[^。；，,]{0,10}${word}[^。；，,]{0,10}${escapeRegExp(targetLabel)}`, 'u');
        const passive = new RegExp(`${escapeRegExp(targetLabel)}[^。；，,]{0,5}(?:受|被)[^。；，,]{0,5}${escapeRegExp(sourceLabel)}[^。；，,]{0,5}${word}`, 'u');
        const postposed = new RegExp(`${escapeRegExp(sourceLabel)}[^。；，,]{0,5}(?:对|对于)[^。；，,]{0,5}${escapeRegExp(targetLabel)}[^。；，,]{0,8}(?:构成|形成|产生)?[^。；，,]{0,3}相?${word}`, 'u');
        if (!forward.test(claim.text) && !passive.test(claim.text) && !postposed.test(claim.text)) continue;
        const authorized = referencedPredicates.some((predicate) => (
          predicate.relation === relation
          && (
            (predicate.sourceLabels.includes(sourceLabel)
              && predicate.targetLabels.includes(targetLabel))
            || (predicate.direction === 'symmetric'
              && predicate.sourceLabels.includes(targetLabel)
              && predicate.targetLabels.includes(sourceLabel))
          )
        ));
        if (!authorized) fail(`claim ${claim.id} 的${sourceLabel}${word}${targetLabel}方向或关系无事实支持`);
      }
    }
  }

  // A special predicate may only be authorized by an actual derived fact, not by
  // an entity facet that happens to contain the same words in its values.
  void referencedFacts;
}

function structuredPrimaryAssertions(text: string): readonly string[] {
  const assertions = new Set<string>();
  const clauses = text.split(/[。；;，,\n]+/u).map((entry) => entry.trim()).filter(Boolean);
  const patterns = [
    /(?:主)?用神(?:就)?(?:是|为|就在|落在|落于|应取|首取|取作|定作|选定为?)([^。；，,]{1,48})/gu,
    /([^。；，,]{1,48}?)(?:就是|为|是|作为|取作|定作)(?:本次)?(?:主)?用神/gu,
    /(?:以|取|定)([^。；，,]{1,48}?)(?:作为|作|为)(?:主)?用神/gu,
  ];
  for (const clause of clauses) {
    const candidateEnumeration = /(?:候选用神|用神候选)/u.test(clause);
    const selectionSemantics = /(?:主用神|唯一|已选定|最终选定|首取|应取|确定选用)/u.test(clause);
    if (candidateEnumeration && !selectionSemantics) continue;
    for (const pattern of patterns) {
      for (const match of clause.matchAll(pattern)) {
        const before = clause.slice(Math.max(0, match.index - 3), match.index);
        if (/(?:不|非|未|无)$/u.test(before) || /(?:不设|并非|不是|不作为)/u.test(match[0])) continue;
        assertions.add(clause);
      }
    }
  }
  return [...assertions];
}

type SpiritRoleLabel = '元神' | '忌神' | '仇神';

interface SpiritRoleEntityAssertion {
  readonly role: SpiritRoleLabel;
  readonly entityKeys: readonly string[];
  readonly text: string;
}

function structuredSpiritRoleAssertions(
  text: string,
  allFacts: readonly ContractFactV2[],
): readonly SpiritRoleEntityAssertion[] {
  const result: SpiritRoleEntityAssertion[] = [];
  for (const sentence of text.split(/[。；;\n]+/u)) {
    let activeRole: SpiritRoleLabel | null = null;
    for (const rawClause of sentence.split(/[，,]+/u)) {
      const clause = rawClause.trim();
      if (!clause) continue;
      const fragments = clause.split(/(?:并且|同时|以及|而且|但是|且|但)/u)
        .map((entry) => entry.trim())
        .filter(Boolean);
      for (const fragment of fragments) {
        const roleMatches = [...fragment.matchAll(/(元神|忌神|仇神)/gu)];
        if (roleMatches.length > 0) activeRole = roleMatches.at(-1)?.[1] as SpiritRoleLabel;
        if (!activeRole) continue;

        const anchors = entityAnchorMatches(fragment, allFacts);
        const hasRoleInFragment = roleMatches.length > 0;
        const hasLocationNoun = /(?:具体位置|对应爻位|所在|位置|爻位)/u.test(fragment);
        const cueMatches: Array<{ index: number; end: number }> = [];
        for (const match of fragment.matchAll(/(?:指向|落于|位于|来自)/gu)) {
          cueMatches.push({ index: match.index, end: match.index + match[0].length });
        }
        const hasStrongLocationCue = cueMatches.length > 0;
        if (hasRoleInFragment || hasLocationNoun) {
          for (const match of fragment.matchAll(/(?:就是|为|是|在)/gu)) {
            cueMatches.push({ index: match.index, end: match.index + match[0].length });
          }
        }
        if (cueMatches.length === 0 && hasLocationNoun) {
          const noun = /(?:具体位置|对应爻位|所在|位置|爻位)/u.exec(fragment);
          if (noun) cueMatches.push({ index: noun.index, end: noun.index + noun[0].length });
        }
        if (cueMatches.length === 0) continue;
        if (anchors.length === 0 && !hasLocationNoun && !hasStrongLocationCue) continue;

        let assertedAnchors: readonly EntityAnchorMatch[] = [];
        if (anchors.length > 0) {
          let minimumDistance = Number.POSITIVE_INFINITY;
          for (const cue of cueMatches) {
            for (const anchor of anchors) {
              const distance = anchor.end <= cue.index
                ? cue.index - anchor.end
                : anchor.index >= cue.end ? anchor.index - cue.end : 0;
              if (distance < minimumDistance) {
                minimumDistance = distance;
                assertedAnchors = [anchor];
              } else if (distance === minimumDistance
                && assertedAnchors.some((candidate) => candidate.index === anchor.index)) {
                assertedAnchors = [...assertedAnchors, anchor];
              }
            }
          }
        }
        result.push({
          role: activeRole,
          entityKeys: stableUnique(assertedAnchors.flatMap(({ entityKeys }) => entityKeys)),
          text: fragment,
        });
      }
    }
  }
  return result;
}

function validateSpiritRoleEntityAssertions(
  claim: AnalysisClaimV2,
  referencedFacts: readonly ContractFactV2[],
  allFacts: readonly ContractFactV2[],
  selection: UseGodSelection,
): void {
  const assertions = structuredSpiritRoleAssertions(claim.text, allFacts);
  if (assertions.length === 0) return;
  const relationByRole: Readonly<Record<SpiritRoleLabel, FactRelation>> = {
    元神: 'is-source-spirit', 忌神: 'is-avoid-spirit', 仇神: 'is-enemy-spirit',
  };
  const primaryKey = selection.status === 'resolved' && selection.selectionMode === 'single'
    ? entityRefKey(selection.primary.entity)
    : null;
  for (const assertion of assertions) {
    const matchingFacts = referencedFacts.filter(({ relation }) => relation === relationByRole[assertion.role]);
    const valid = assertion.entityKeys.some((assertedKey) => matchingFacts.some((fact) => (
      entityRefKey(fact.source) === assertedKey
      && primaryKey !== null
      && entityRefKey(fact.target) === primaryKey
    )));
    if (!valid) {
      fail(`${assertion.role}的具体位置或实体 assertion「${assertion.text}」与对应 spirit fact source/primary target 不匹配`);
    }
  }
}

function validateUseGodClaim(
  claim: AnalysisClaimV2,
  facts: readonly ContractFactV2[],
  allFacts: readonly ContractFactV2[],
  selection: UseGodSelection,
): void {
  if (claim.section !== 'use-god') return;
  const factIds = new Set(claim.factIds);
  const selectionFactId = 'contract:use-god:selection';
  if (!factIds.has(selectionFactId)) fail(`claim ${claim.id} 必须引用用神选择事实`);
  const primaryAssertions = structuredPrimaryAssertions(claim.text);
  validateSpiritRoleEntityAssertions(claim, facts, allFacts, selection);

  if (selection.status === 'needs-user-input') {
    if (claim.confidence !== 'low') fail('needs-user-input 用神 claim 只能为 low');
    if (SINGLE_PRIMARY_RE.test(claim.text) || SPIRIT_ASSERTION_RE.test(claim.text)) {
      fail('needs-user-input 不得虚构已定用神或元忌仇');
    }
    if (primaryAssertions.length > 0) fail('needs-user-input 状态不得追加主用神 assertion');
    if (!/(?:请|需|需要|补充|明确|澄清).{0,24}(?:占问|目标|对象|关系|用神)|(?:占问|目标).{0,16}(?:待明确|待澄清)/u.test(claim.text)) {
      fail('needs-user-input 必须使用请求澄清占问目标的措辞');
    }
    return;
  }
  if (selection.status === 'unresolved') {
    if (claim.confidence !== 'low') fail('unresolved 用神 claim 只能为 low');
    if (SINGLE_PRIMARY_RE.test(claim.text) || SPIRIT_ASSERTION_RE.test(claim.text)) {
      fail('unresolved 不得虚构已定用神或元忌仇');
    }
    if (primaryAssertions.length > 0) fail('unresolved 状态不得追加主用神 assertion');
    if (!/(?:缺少|暂无|暂未|未找到|无法确定|候选不足|没有).{0,24}(?:候选|用神|条件)|(?:候选|用神).{0,16}(?:缺失|不足|未解决)/u.test(claim.text)) {
      fail('unresolved 必须明确候选或取用条件缺少的措辞');
    }
    return;
  }

  const expectedFocusIds = selection.focusEntities.map((entity) => {
    const key = entityKey(entity).replaceAll(':', '-');
    const candidate = `contract:use-god:candidate:${key}`;
    return facts.some(({ id }) => id === candidate) ? candidate : `contract:use-god:focus:${key}`;
  });
  if (expectedFocusIds.some((id) => !factIds.has(id))) {
    fail(`${selection.status === 'ambiguous' ? 'ambiguous' : 'shi-ying-pair/用神'} claim 必须覆盖全部 focusEntities`);
  }

  if (selection.status === 'ambiguous') {
    if (SINGLE_PRIMARY_RE.test(claim.text) || SPIRIT_ASSERTION_RE.test(claim.text)) {
      fail('ambiguous 用神不得自动选择单一用神或元忌仇');
    }
    if (primaryAssertions.length > 0) fail('ambiguous 状态不得追加单一主用神 assertion');
    if (
      selection.candidates.some((candidate) => (
        candidate.certainty === 'disputed' || candidate.entity.type === 'hidden-spirit'
      ))
      && claim.confidence !== 'low'
    ) fail('ambiguous 含 disputed/hidden 候选时只能 low');
    if (!/(?:保留.{0,12}全部|全部.{0,12}候选|多个.{0,12}候选.{0,12}(?:并列|保留)|不(?:自动)?选择|不择一)/u.test(claim.text)) {
      fail('ambiguous 必须明确保留全部候选且不择一');
    }
    return;
  }

  if (selection.selectionMode === 'shi-ying-pair') {
    if (SINGLE_PRIMARY_RE.test(claim.text) || SPIRIT_ASSERTION_RE.test(claim.text)) {
      fail('shi-ying-pair 不得声称单一主用神或元忌仇');
    }
    if (primaryAssertions.length > 0) fail('shi-ying-pair 状态不得追加单一主用神 assertion');
    const mentionsBoth = claim.text.includes('世应')
      || (/(?:世爻|持世|\b世\b)/u.test(claim.text) && /(?:应爻|持应|\b应\b)/u.test(claim.text));
    if (!mentionsBoth || !/(?:双端|两端|成对|同时|并看|并察|不设单一)/u.test(claim.text)) {
      fail('shi-ying-pair 必须明确世应双端且不设单一用神');
    }
    return;
  }

  if (!selection.primary) fail('resolved single 缺少 primary');
  if (selection.primary.entity.type === 'hidden-spirit' && claim.confidence !== 'low') {
    fail('resolved hidden 用神 claim 只能为 low');
  }
  if (selection.primary.entity.type === 'hidden-spirit' && !claim.text.includes('伏神')) {
    fail('resolved hidden 用神必须明确说明伏神身份');
  }
  const explicitPrimaryAssertion = primaryAssertions.length > 0
    || SINGLE_PRIMARY_RE.test(claim.text)
    || /(?:为|作|作为|取作|定作)(?:本次)?用神|用神(?:为|是|落在)/u.test(claim.text);
  if (explicitPrimaryAssertion) {
    const primaryFact = facts.find((fact) => expectedFocusIds.includes(fact.id));
    if (!primaryFact) fail('resolved single 缺少 primary contract fact');
    const assertionTexts = primaryAssertions.length > 0 ? primaryAssertions : [claim.text];
    for (const assertionText of assertionTexts) {
      const primaryTokens = facetTokens(assertionText, {
        schemaVersion: '2.0.0',
        caseHash: '',
        allCurrentTokens: [],
        entityLabels: [],
        predicates: [],
        useGod: selection,
      });
      if (primaryTokens.length > 0 && !factCoversTokens(primaryFact, primaryTokens)) {
        fail('resolved 用神断言中的本变 side、爻位、六亲、角色或实体属性与 primary 不匹配');
      }
    }
  }
  const spiritRelations: Readonly<Record<string, FactRelation>> = {
    元神: 'is-source-spirit', 忌神: 'is-avoid-spirit', 仇神: 'is-enemy-spirit',
  };
  for (const [label, relation] of Object.entries(spiritRelations)) {
    if (!claim.text.includes(label)) continue;
    const supporting = facts.filter((fact) => (
      fact.relation === relation && factIds.has(fact.id)
    ));
    if (supporting.length === 0 || supporting.some((fact) => (
      fact.ruleIds.every((ruleId) => !claim.ruleIds.includes(ruleId))
    ))) fail(`${label}断言必须引用对应事实和规则`);
  }
}

function confidenceCeiling(facts: readonly ContractFactV2[], text: string): AnalysisConfidenceV2 {
  if (facts.some(({ certainty }) => certainty === 'disputed')) return 'low';
  if (facts.some(({ certainty }) => certainty === 'conditional')) return 'medium';
  if (facts.length > 0 && facts.every(({ authority }) => authority === 'secondary')) return 'medium';
  const materialSecondary = facts.some((fact) => {
    if (fact.authority !== 'secondary') return false;
    if (fact.relation === 'is-six-beast') {
      return /(?:六神|青龙|朱雀|勾陈|螣蛇|腾蛇|白虎|玄武)/u.test(text);
    }
    if (fact.relation === 'is-shen-sha') {
      return text.includes('神煞') || ALL_SHEN_SHA_LABELS.some((label) => text.includes(label));
    }
    return fact.claimTokens.some((token) => token.length >= 2 && text.includes(token));
  });
  if (materialSecondary) return 'medium';
  return 'high';
}

function validateClaim(
  claim: AnalysisClaimV2,
  contract: FactContractBundleV2,
  factById: ReadonlyMap<string, ContractFactV2>,
  evidenceById: ReadonlyMap<string, CanonicalEvidenceV2>,
): void {
  if (claim.section !== 'guidance' && claim.factIds.length === 0) {
    fail(`非 guidance claim ${claim.id} 至少需要一个事实`);
  }
  if (claim.section === 'guidance' && claim.factIds.length === 0 && claim.confidence !== 'low') {
    fail(`零事实 guidance ${claim.id} 只能为 low`);
  }

  const facts = claim.factIds.map((id) => {
    const fact = factById.get(id);
    if (!fact) fail(`claim ${claim.id} 引用未知事实 ${id}`);
    return fact;
  });
  for (const ruleId of claim.ruleIds) {
    const supporters = facts.filter((fact) => fact.ruleIds.includes(ruleId));
    if (supporters.length === 0) {
      fail(`claim ${claim.id} 的规则 ${ruleId} 不由本 claim 事实支持`);
    }
    if (claim.section !== 'use-god' && supporters.every(({ provenance }) => provenance === 'use-god')) {
      fail(`claim ${claim.id} 不得在 ${claim.section} section 借用用神选择规则 ${ruleId}`);
    }
  }
  const evidence = claim.evidenceIds.map((id) => {
    const entry = evidenceById.get(id);
    if (!entry) fail(`claim ${claim.id} 引用未知证据 ${id}`);
    return entry;
  });
  if (ANCIENT_SOURCE_RE.test(claim.text) && evidence.length === 0) {
    fail(`claim ${claim.id} 使用古籍/原文/占例标记但没有证据`);
  }
  if (evidence.length > 0 && claim.ruleIds.length > 0) {
    const supported = new Set(evidence.flatMap(({ supportsRuleIds }) => supportsRuleIds));
    for (const ruleId of claim.ruleIds) {
      if (!supported.has(ruleId)) fail(`claim ${claim.id} 的证据未覆盖规则 ${ruleId}`);
    }
  }

  validateClauseAssociations(
    claim,
    facts,
    contract.modelContract.facts,
    contract.validationContext,
  );
  validateRelationPredicates(
    claim,
    facts,
    contract.modelContract.facts,
    contract.validationContext,
  );
  validateUseGodClaim(
    claim,
    facts,
    contract.modelContract.facts,
    contract.validationContext.useGod,
  );

  const ceiling = facts.length === 0 ? 'low' : confidenceCeiling(facts, claim.text);
  if (CONFIDENCE_RANK[claim.confidence] > CONFIDENCE_RANK[ceiling]) {
    fail(`claim ${claim.id} 的 confidence 超过 ${ceiling} 上限`);
  }
}

function assertExactUtcIso(value: unknown): string {
  if (typeof value !== 'string') fail('validatedAt 必须是字符串');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    fail('validatedAt 必须是标准 UTC ISO 时间');
  }
  return value;
}

function validateReportInternal(
  raw: unknown,
  contract: FactContractBundleV2,
  canonicalEvidence: readonly CanonicalEvidenceV2[],
  validatedAt: string,
  followUp: boolean,
): AnalysisReportV2 {
  const ownedContract = strictClone(contract, 'FactContractBundleV2');
  if (!isPlainRecord(ownedContract)
    || !isPlainRecord(ownedContract.modelContract)
    || !isPlainRecord(ownedContract.validationContext)) {
    fail('FactContractBundleV2 无效');
  }
  if (ownedContract.modelContract.caseHash !== ownedContract.validationContext.caseHash) {
    fail('FactContract model/validation caseHash 不一致');
  }
  const normalized = normalizeRaw(raw, { followUp });
  if (normalized.caseHash !== ownedContract.modelContract.caseHash) fail('caseHash 与当前卦例不一致');
  const evidence = normalizeEvidence(canonicalEvidence);
  const factById = new Map(ownedContract.modelContract.facts.map((fact) => [fact.id, fact]));
  if (factById.size !== ownedContract.modelContract.facts.length) fail('ContractFact ID 重复');
  const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
  for (const claim of normalized.claims) {
    validateClaim(claim, ownedContract as FactContractBundleV2, factById, evidenceById);
  }
  for (const [index, uncertainty] of normalized.uncertainties.entries()) {
    if (extractConcreteTokens(uncertainty, ownedContract.validationContext).length > 0) {
      fail(`uncertainties[${index}] 含当前排盘事实词元`);
    }
    const mentionedEntities = stableUnique(ownedContract.validationContext.entityLabels.filter((label) => (
      label.length >= 2 && uncertainty.includes(label)
    )));
    if (
      mentionedEntities.length >= 2
      || (mentionedEntities.length >= 1
        && /(?:相同|相异|一致|不同|强于|弱于|生|克|冲|合|刑|害|破|旺|衰)/u.test(uncertainty))
    ) {
      fail(`uncertainties[${index}] 含实体比较式具体断言`);
    }
    if (SPECIAL_PREDICATES.some(({ pattern }) => pattern.test(uncertainty))) {
      fail(`uncertainties[${index}] 含当前排盘关系断言`);
    }
  }
  const report: AnalysisReportV2 = {
    ...normalized,
    validation: {
      status: 'validated',
      factCheckPassed: true,
      citationCheckPassed: true,
      validatedAt: assertExactUtcIso(validatedAt),
    },
  };
  return deepFreeze(strictClone(report, 'AnalysisReportV2')) as AnalysisReportV2;
}

export function validateAnalysisReportV2(
  raw: unknown,
  contract: FactContractBundleV2,
  canonicalEvidence: readonly CanonicalEvidenceV2[],
  validatedAt: string,
): AnalysisReportV2 {
  return validateReportInternal(raw, contract, canonicalEvidence, validatedAt, false);
}

export function validateFollowUpV2(
  raw: unknown,
  contract: FactContractBundleV2,
  canonicalEvidence: readonly CanonicalEvidenceV2[],
  validatedAt: string,
): ValidatedFollowUpV2 {
  return validateReportInternal(raw, contract, canonicalEvidence, validatedAt, true);
}

export const validateRawFollowUpV2 = validateFollowUpV2;

function normalizeValidatedFollowUpForDisplay(value: unknown): ValidatedFollowUpV2 {
  const owned = strictClone(value, 'ValidatedFollowUpV2');
  if (!isPlainRecord(owned)) fail('ValidatedFollowUpV2 必须是普通对象');
  assertExactKeys(owned, VALIDATED_REPORT_KEYS, 'ValidatedFollowUpV2');
  const normalized = normalizeRaw({
    schemaVersion: owned.schemaVersion,
    caseHash: owned.caseHash,
    claims: owned.claims,
    uncertainties: owned.uncertainties,
  }, { followUp: true });
  if (!isPlainRecord(owned.validation)) fail('ValidatedFollowUpV2.validation 必须是普通对象');
  assertExactKeys(owned.validation, VALIDATION_KEYS, 'ValidatedFollowUpV2.validation');
  if (
    owned.validation.status !== 'validated'
    || owned.validation.factCheckPassed !== true
    || owned.validation.citationCheckPassed !== true
  ) fail('ValidatedFollowUpV2.validation 必须由 validator 标记为 validated');
  return {
    ...normalized,
    validation: {
      status: 'validated',
      factCheckPassed: true,
      citationCheckPassed: true,
      validatedAt: assertExactUtcIso(owned.validation.validatedAt),
    },
  };
}

export function deriveFollowUpContentV2(validated: ValidatedFollowUpV2): string {
  const owned = normalizeValidatedFollowUpForDisplay(validated);
  return owned.claims.map((claim, index) => (
    `### ${index + 1}. ${SECTION_DISPLAY_LABELS[claim.section]}\n${claim.text}`
  )).join('\n\n');
}

function localClaim(
  id: string,
  section: AnalysisSectionV2,
  text: string,
  factIds: readonly string[],
  confidence: AnalysisConfidenceV2,
): AnalysisClaimV2 {
  return {
    id,
    section,
    text,
    factIds: [...factIds],
    ruleIds: [],
    evidenceIds: [],
    confidence,
  };
}

function localUseGodClaim(contract: FactContractBundleV2): AnalysisClaimV2 {
  const { useGod } = contract.modelContract;
  const selectionId = 'contract:use-god:selection';
  if (useGod.status === 'needs-user-input') {
    return localClaim(
      'local:use-god', 'use-god',
      '用神仍需用户补充明确的占问目标，当前不作单一取用。',
      [selectionId, 'contract:use-god:clarification'], 'low',
    );
  }
  if (useGod.status === 'unresolved') {
    return localClaim(
      'local:use-god', 'use-god',
      '当前排盘缺少符合结构化取用条件的候选，用神暂未解决。',
      [selectionId], 'low',
    );
  }
  const focusIds = useGod.focusEntities.map((entity) => {
    const key = entityKey(entity).replaceAll(':', '-');
    const candidateId = `contract:use-god:candidate:${key}`;
    return contract.modelContract.facts.some(({ id }) => id === candidateId)
      ? candidateId
      : `contract:use-god:focus:${key}`;
  });
  if (useGod.status === 'ambiguous') {
    const low = useGod.candidates.some((candidate) => (
      candidate.certainty === 'disputed' || candidate.entity.type === 'hidden-spirit'
    ));
    return localClaim(
      'local:use-god', 'use-god',
      '用神存在多个同层候选，当前保留全部候选，不自动选择其一。',
      [selectionId, ...focusIds], low ? 'low' : 'medium',
    );
  }
  if (useGod.selectionMode === 'shi-ying-pair') {
    return localClaim(
      'local:use-god', 'use-god',
      '本次采用世应双端观察，不设单一主用神。',
      [selectionId, ...focusIds], 'high',
    );
  }
  return localClaim(
    'local:use-god', 'use-god',
    useGod.primary.entity.type === 'hidden-spirit'
      ? '本次结构化取用落在伏神候选，因伏神口径有争议，仅作低置信度参考。'
      : '本次用神已按结构化取用规则确定。',
    [selectionId, ...focusIds],
    useGod.primary.entity.type === 'hidden-spirit' ? 'low' : 'high',
  );
}

export function createLocalRawFollowUpV2(
  contract: FactContractBundleV2,
): RawFollowUpV2 {
  const owned = strictClone(contract, 'FactContractBundleV2');
  const raw: RawFollowUpV2 = {
    schemaVersion: '2.0.0',
    caseHash: owned.modelContract.caseHash,
    claims: [localClaim(
      'local:follow-up:system-notice',
      'guidance',
      '当前未配置云端解卦服务，暂不能生成针对当前记录的进一步判断；请配置服务后重试。',
      [],
      'low',
    )],
    uncertainties: [],
  };
  return deepFreeze(strictClone(raw, 'LocalRawFollowUpV2')) as RawFollowUpV2;
}

export function createLocalRawReportV2(
  contract: FactContractBundleV2,
  _canonicalEvidence: readonly CanonicalEvidenceV2[] = [],
): RawAnalysisReportV2 {
  const owned = strictClone(contract, 'FactContractBundleV2');
  const { modelContract } = owned;
  const pillars = modelContract.plateSummary.pillars;
  const moving = modelContract.plateSummary.movingLines;
  const movingText = moving.length === 0
    ? '动爻集合为空，本次无动爻。'
    : `动爻集合为${moving.map((position) => POSITION_LABELS[position][0]).join('、')}。`;
  const raw: RawAnalysisReportV2 = {
    schemaVersion: '2.0.0',
    caseHash: modelContract.caseHash,
    claims: [
      localClaim(
        'local:summary', 'summary',
        `本卦${modelContract.plateSummary.baseHexagram}，变卦${modelContract.plateSummary.changedHexagram}。`,
        ['contract:plate:hexagram:base', 'contract:plate:hexagram:changed'], 'high',
      ),
      localUseGodClaim(owned as FactContractBundleV2),
      localClaim(
        'local:calendar', 'calendar',
        `年柱${pillars.year.ganZhi}，月柱${pillars.month.ganZhi}，日柱${pillars.day.ganZhi}，时柱${pillars.hour.ganZhi}。`,
        [
          'contract:plate:pillar:year', 'contract:plate:pillar:month',
          'contract:plate:pillar:day', 'contract:plate:pillar:hour',
        ],
        'high',
      ),
      localClaim(
        'local:moving', 'moving', movingText,
        ['contract:plate:moving-lines'], 'high',
      ),
      localClaim(
        'local:synthesis', 'synthesis',
        '卦例结构与引用事实已锁定，综合判断应维持逐条事实边界。',
        ['contract:plate:hexagram:base'], 'high',
      ),
      localClaim(
        'local:guidance', 'guidance',
        '请把判断作为决策参考，并结合现实信息核验后再行动。',
        [], 'low',
      ),
    ],
    uncertainties: [],
  };
  // Local generation intentionally returns raw data. Every caller must pass it
  // through validateAnalysisReportV2 before display or persistence.
  return deepFreeze(strictClone(raw, 'LocalRawAnalysisReportV2')) as RawAnalysisReportV2;
}

function targetSelectorTerms(selection: UseGodSelection): readonly string[] {
  const selector = selection.targetSelector;
  if (!selector) return [];
  if (selector.kind === 'six-relation') return [selector.kind, selector.relation];
  if (selector.kind === 'role') return [selector.kind, selector.role, `${selector.role}爻`];
  if (selector.kind === 'shi-ying-pair') return [selector.kind, '世应'];
  return [selector.kind, entityKey(selector.entity)];
}

export function createAnalysisRetrievalContextV2(
  modelContract: FactContractV2,
): AnalysisRetrievalContextV2 {
  const owned = strictClone(modelContract, 'FactContractV2');
  assertCaseHash(owned.caseHash);
  const movingTerms = owned.facts
    .filter((fact) => (
      (fact.provenance === 'entity' && fact.values.moving === true)
      || fact.kind === 'transition'
      || fact.relation === 'is-dark-moving'
      || fact.relation?.startsWith('returns-')
      || fact.relation === 'advances'
      || fact.relation === 'retreats'
    ))
    .flatMap((fact) => [fact.label, fact.relation ?? '', ...fact.sourceLabels, ...fact.targetLabels]);
  const primaryTerms = owned.useGod.status === 'resolved' && owned.useGod.selectionMode === 'single'
    ? [
      owned.useGod.primary.relation,
      entityKey(owned.useGod.primary.entity),
      ...owned.useGod.primary.reasonRuleIds,
    ]
    : owned.useGod.focusEntities.map((entity) => entityKey(entity));
  const queryTerms = stableUnique([
    owned.question,
    ...(owned.intent ? [owned.intent.id, owned.intent.label] : []),
    ...targetSelectorTerms(owned.useGod),
    ...primaryTerms,
    ...owned.useGod.relatedRelations,
    ...movingTerms,
  ].filter((value) => value.length > 0));
  const ruleIds = stableUnique(owned.facts.flatMap((fact) => fact.ruleIds));
  return deepFreeze(strictClone({
    schemaVersion: '2.0.0',
    caseHash: owned.caseHash,
    queryTerms,
    ruleIds,
  }, 'AnalysisRetrievalContextV2')) as AnalysisRetrievalContextV2;
}
