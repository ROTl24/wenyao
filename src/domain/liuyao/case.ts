import {
  hashCanonicalPayload,
  strictCanonicalStringify,
  type HashPort,
} from './canonical.js';
import { deriveFacts } from './facts/derive.js';
import type {
  DivinationCaseV2,
  PlateV2,
  QuestionCategory,
  QuestionIntentId,
  UseGodSubjectRelation,
  UseGodTargetSelector,
} from './model.js';
import { buildPlateV2 } from './plate.js';
import type { RuleContext } from './rules/model.js';
import { deepFreeze } from './rules/tables.js';
import { assertProjectEnabledUseGodContext } from './rules/use-god-registry.js';
import { resolveUseGod } from './use-god.js';

export interface BuildDivinationCaseInput {
  readonly sessionId: string;
  readonly plateId: string;
  readonly question: string;
  readonly category: QuestionCategory;
  readonly explicitIntentId: QuestionIntentId | null;
  readonly subjectRelation?: UseGodSubjectRelation;
  readonly explicitTarget?: UseGodTargetSelector;
  readonly castAt: string;
  readonly builtAt: string;
  readonly tossValues: PlateV2['rawTosses'];
  readonly ruleContext: RuleContext;
}

const REQUIRED_KEYS = [
  'sessionId', 'plateId', 'question', 'category', 'explicitIntentId',
  'castAt', 'builtAt', 'tossValues', 'ruleContext',
] as const;
const OPTIONAL_KEYS = ['subjectRelation', 'explicitTarget'] as const;
const ALLOWED_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const CATEGORIES = new Set<QuestionCategory>([
  'career', 'wealth', 'relationship', 'health', 'study', 'lost_item', 'travel', 'other',
]);
const TOSS_VALUES = new Set([6, 7, 8, 9]);

function reject(detail = ''): never {
  throw new TypeError(`卦例构建输入无效${detail ? `：${detail}` : ''}`);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function snapshotTopLevel(input: unknown): Record<string, unknown> {
  if (!isPlainRecord(input)) reject();
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== 'string' || !ALLOWED_KEYS.has(key))
    || REQUIRED_KEYS.some((key) => !keys.includes(key))
  ) reject();

  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      descriptor === undefined
      || !descriptor.enumerable
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) reject();
    snapshot[key] = descriptor.value;
  }
  return snapshot;
}

function canonicalClone<T>(value: unknown, label: string): T {
  try {
    return JSON.parse(strictCanonicalStringify(value)) as T;
  } catch {
    reject(label);
  }
}

function exactIso(value: unknown, field: 'castAt' | 'builtAt'): string {
  if (typeof value !== 'string') reject(`${field} 必须是 ISO 时间`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    reject(`${field} 必须是标准 UTC ISO 时间`);
  }
  return value;
}

function nonEmptyTrimmed(value: unknown, field: string, maxLength?: number): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value !== value.trim()
    || (maxLength !== undefined && value.length > maxLength)
  ) reject(`${field} 必须是无首尾空白的非空字符串`);
  return value;
}

function normalizeTosses(value: unknown): PlateV2['rawTosses'] {
  const tosses = canonicalClone<unknown[]>(value, '投币值无效');
  if (
    !Array.isArray(tosses)
    || tosses.length !== 6
    || tosses.some((entry) => typeof entry !== 'number' || !TOSS_VALUES.has(entry))
  ) reject('投币值必须是六个 6、7、8、9');
  return tosses as unknown as PlateV2['rawTosses'];
}

export function normalizeCaseRuleContext(value: unknown): RuleContext {
  const cloned = canonicalClone<RuleContext>(value, '规则上下文无效');
  let normalized = cloned;
  if (Array.isArray(cloned.sources)) {
    const sources = [...cloned.sources];
    if (sources.every((source) => isPlainRecord(source) && typeof source.id === 'string')) {
      sources.sort((left, right) => (
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      ));
    }
    normalized = { ...cloned, sources };
  }
  assertProjectEnabledUseGodContext(normalized);
  return deepFreeze(normalized) as RuleContext;
}

function normalizedInput(input: unknown) {
  const snapshot = snapshotTopLevel(input);
  const sessionId = nonEmptyTrimmed(snapshot.sessionId, 'sessionId');
  const plateId = nonEmptyTrimmed(snapshot.plateId, 'plateId');
  const question = nonEmptyTrimmed(snapshot.question, 'question', 500);
  if (typeof snapshot.category !== 'string' || !CATEGORIES.has(snapshot.category as QuestionCategory)) {
    reject('category 无效');
  }
  if (!(snapshot.explicitIntentId === null || typeof snapshot.explicitIntentId === 'string')) {
    reject('explicitIntentId 无效');
  }
  const hasSubjectRelation = Object.prototype.hasOwnProperty.call(snapshot, 'subjectRelation');
  const hasExplicitTarget = Object.prototype.hasOwnProperty.call(snapshot, 'explicitTarget');
  if (hasSubjectRelation && typeof snapshot.subjectRelation !== 'string') {
    reject('subjectRelation 无效');
  }
  const explicitTarget = hasExplicitTarget
    ? canonicalClone<UseGodTargetSelector>(snapshot.explicitTarget, 'explicitTarget 无效')
    : undefined;
  return {
    sessionId,
    plateId,
    question,
    category: snapshot.category as QuestionCategory,
    explicitIntentId: snapshot.explicitIntentId as QuestionIntentId | null,
    ...(hasSubjectRelation
      ? { subjectRelation: snapshot.subjectRelation as UseGodSubjectRelation }
      : {}),
    ...(hasExplicitTarget ? { explicitTarget } : {}),
    castAt: exactIso(snapshot.castAt, 'castAt'),
    builtAt: exactIso(snapshot.builtAt, 'builtAt'),
    tossValues: normalizeTosses(snapshot.tossValues),
    ruleContext: normalizeCaseRuleContext(snapshot.ruleContext),
  };
}

export function buildDivinationCase(
  input: BuildDivinationCaseInput,
  hashPort: HashPort,
): DivinationCaseV2;
export function buildDivinationCase(input: unknown, hashPort: HashPort): DivinationCaseV2;
export function buildDivinationCase(input: unknown, hashPort: HashPort): DivinationCaseV2 {
  const owned = normalizedInput(input);
  const plate = buildPlateV2({
    plateId: owned.plateId,
    sessionId: owned.sessionId,
    castAt: owned.castAt,
    tossValues: owned.tossValues,
    ruleContext: owned.ruleContext,
  });
  const useGod = resolveUseGod({
    question: owned.question,
    category: owned.category,
    explicitIntentId: owned.explicitIntentId,
    ...(Object.prototype.hasOwnProperty.call(owned, 'subjectRelation')
      ? { subjectRelation: owned.subjectRelation }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(owned, 'explicitTarget')
      ? { explicitTarget: owned.explicitTarget }
      : {}),
    plate,
    ruleContext: owned.ruleContext,
  });
  const facts = deriveFacts({ plate, ruleContext: owned.ruleContext, useGod });
  const ruleContextHash = hashCanonicalPayload(owned.ruleContext, hashPort);
  const intentProvenance = {
    explicitIntentId: owned.explicitIntentId,
    ...(Object.prototype.hasOwnProperty.call(owned, 'subjectRelation')
      ? { subjectRelation: owned.subjectRelation }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(owned, 'explicitTarget')
      ? { explicitTarget: owned.explicitTarget }
      : {}),
  };
  const factSetHash = hashCanonicalPayload({
    schemaVersion: '2.0.0',
    question: owned.question,
    category: owned.category,
    intentProvenance,
    tossValues: owned.tossValues,
    castAt: owned.castAt,
    ruleContext: owned.ruleContext,
    plate,
    useGod,
    facts,
  }, hashPort);

  return deepFreeze({
    schemaVersion: '2.0.0',
    sessionId: owned.sessionId,
    question: owned.question,
    category: owned.category,
    ruleContext: owned.ruleContext,
    ruleContextHash,
    plate,
    useGod,
    facts,
    factSetHash,
    builtAt: owned.builtAt,
  }) as DivinationCaseV2;
}
