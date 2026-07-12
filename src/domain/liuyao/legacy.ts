import type { HashPort } from './canonical.js';
import { strictCanonicalStringify } from './canonical.js';
import {
  buildDivinationCase,
  normalizeCaseRuleContext,
} from './case.js';
import type {
  DivinationCaseV2,
  PlateV2,
  QuestionCategory,
  QuestionIntentId,
  UseGodSubjectRelation,
  UseGodTargetSelector,
} from './model.js';
import type { RuleContext } from './rules/model.js';
import { deepFreeze } from './rules/tables.js';

export interface LegacyMigrationInput {
  readonly plateId: string;
  readonly builtAt: string;
  readonly ruleContext: RuleContext;
  readonly explicitIntentId: QuestionIntentId | null;
  readonly subjectRelation?: UseGodSubjectRelation;
  readonly explicitTarget?: UseGodTargetSelector;
}

export interface LegacyMigrationAudit {
  readonly legacyDifferences: readonly string[];
  readonly reason: 'migrated' | 'already-current' | 'invalid-legacy' | 'legacy-conflict';
}

export interface LegacyUnverifiedAnalysis extends Readonly<Record<string, unknown>> {
  readonly validation: Readonly<{ status: 'legacy-unverified' }>;
}

export interface MigratedLegacySession extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly question: string;
  readonly category: QuestionCategory;
  readonly castAt: string;
  readonly status: 'casting' | 'complete';
  readonly tosses: readonly Readonly<Record<string, unknown>>[];
  readonly caseSnapshot?: DivinationCaseV2;
  readonly ruleContext: RuleContext;
  readonly migrationVersion: 2;
  readonly migrationState: 'clean';
  readonly analysis?: LegacyUnverifiedAnalysis;
}

export type LegacyMigrationResult =
  | Readonly<{
    state: 'migrated';
    session: MigratedLegacySession;
    audit: LegacyMigrationAudit;
  }>
  | Readonly<{
    state: 'unchanged';
    session: MigratedLegacySession;
    audit: LegacyMigrationAudit;
  }>
  | Readonly<{
    state: 'needs-review';
    original: unknown;
    audit: LegacyMigrationAudit;
  }>;

const MIGRATION_REQUIRED_KEYS = [
  'plateId', 'builtAt', 'ruleContext', 'explicitIntentId',
] as const;
const MIGRATION_OPTIONAL_KEYS = ['subjectRelation', 'explicitTarget'] as const;
const MIGRATION_KEYS = new Set<string>([
  ...MIGRATION_REQUIRED_KEYS,
  ...MIGRATION_OPTIONAL_KEYS,
]);
const CATEGORIES = new Set<QuestionCategory>([
  'career', 'wealth', 'relationship', 'health', 'study', 'lost_item', 'travel', 'other',
]);
const TOSS_VALUES = new Set([6, 7, 8, 9]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalClone<T>(value: unknown): T {
  return JSON.parse(strictCanonicalStringify(value)) as T;
}

function tryOwnedClone(value: unknown): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: canonicalClone(value) };
  } catch {
    return { ok: false };
  }
}

function exactIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function nonEmptyTrimmed(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function snapshotMigrationInput(input: unknown) {
  if (!isPlainRecord(input)) throw new TypeError('旧会话迁移输入无效');
  const keys = Reflect.ownKeys(input);
  if (
    keys.some((key) => typeof key !== 'string' || !MIGRATION_KEYS.has(key))
    || MIGRATION_REQUIRED_KEYS.some((key) => !keys.includes(key))
  ) throw new TypeError('旧会话迁移输入无效');
  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      descriptor === undefined
      || !descriptor.enumerable
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) throw new TypeError('旧会话迁移输入无效');
    snapshot[key] = descriptor.value;
  }
  if (!nonEmptyTrimmed(snapshot.plateId)) throw new TypeError('旧会话迁移 plateId 无效');
  if (!exactIso(snapshot.builtAt)) throw new TypeError('旧会话迁移 builtAt 无效');
  if (!(snapshot.explicitIntentId === null || typeof snapshot.explicitIntentId === 'string')) {
    throw new TypeError('旧会话迁移问意无效');
  }
  const hasSubjectRelation = Object.prototype.hasOwnProperty.call(snapshot, 'subjectRelation');
  const hasExplicitTarget = Object.prototype.hasOwnProperty.call(snapshot, 'explicitTarget');
  if (hasSubjectRelation && typeof snapshot.subjectRelation !== 'string') {
    throw new TypeError('旧会话迁移他人关系无效');
  }
  const explicitTarget = hasExplicitTarget
    ? canonicalClone<UseGodTargetSelector>(snapshot.explicitTarget)
    : undefined;
  return {
    plateId: snapshot.plateId,
    builtAt: snapshot.builtAt,
    ruleContext: normalizeCaseRuleContext(snapshot.ruleContext),
    explicitIntentId: snapshot.explicitIntentId as QuestionIntentId | null,
    ...(hasSubjectRelation
      ? { subjectRelation: snapshot.subjectRelation as UseGodSubjectRelation }
      : {}),
    ...(hasExplicitTarget ? { explicitTarget } : {}),
  };
}

function audit(
  reason: LegacyMigrationAudit['reason'],
  legacyDifferences: readonly string[],
): LegacyMigrationAudit {
  return deepFreeze({
    reason,
    legacyDifferences: [...new Set(legacyDifferences)].sort(),
  });
}

function needsReview(
  original: unknown,
  reason: LegacyMigrationAudit['reason'],
  differences: readonly string[],
): LegacyMigrationResult {
  return Object.freeze({
    state: 'needs-review',
    original,
    audit: audit(reason, differences),
  });
}

function expectedTossFields(value: number) {
  return {
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 7 || value === 6,
  };
}

function validateFaces(record: Record<string, unknown>, value: number): boolean {
  if (!Object.prototype.hasOwnProperty.call(record, 'faces')) return true;
  if (
    !Array.isArray(record.faces)
    || record.faces.length !== 3
    || record.faces.some((face) => face !== 'text' && face !== 'reverse')
  ) return false;
  const total = record.faces.reduce<number>(
    (sum, face) => sum + (face === 'text' ? 2 : 3),
    0,
  );
  return total === value;
}

function validateDerivedTossFields(record: Record<string, unknown>, value: number): boolean {
  const expected = expectedTossFields(value);
  return (record.moving === undefined || record.moving === expected.moving)
    && (record.baseYang === undefined || record.baseYang === expected.baseYang)
    && (record.changedYang === undefined || record.changedYang === expected.changedYang);
}

function confirmedTossValues(
  session: Record<string, unknown>,
): { valid: true; values: PlateV2['rawTosses'] | readonly (6 | 7 | 8 | 9)[] }
  | { valid: false } {
  if (!Array.isArray(session.tosses)) return { valid: false };
  const values: Array<6 | 7 | 8 | 9> = [];
  const ids = new Set<string>();
  for (let index = 0; index < session.tosses.length; index += 1) {
    const record = session.tosses[index];
    if (
      !isPlainRecord(record)
      || record.lineIndex !== index + 1
      || typeof record.value !== 'number'
      || !TOSS_VALUES.has(record.value)
      || !validateFaces(record, record.value)
      || !validateDerivedTossFields(record, record.value)
    ) return { valid: false };
    if (Object.prototype.hasOwnProperty.call(record, 'id')) {
      if (!nonEmptyTrimmed(record.id) || ids.has(record.id)) return { valid: false };
      ids.add(record.id);
    }
    values.push(record.value as 6 | 7 | 8 | 9);
  }
  return { valid: true, values };
}

function validPendingToss(session: Record<string, unknown>, confirmedCount: number): boolean {
  if (!Object.prototype.hasOwnProperty.call(session, 'currentToss')) return true;
  const pending = session.currentToss;
  return isPlainRecord(pending)
    && pending.lineIndex === confirmedCount + 1
    && typeof pending.value === 'number'
    && TOSS_VALUES.has(pending.value)
    && validateFaces(pending, pending.value)
    && validateDerivedTossFields(pending, pending.value);
}

function baseSessionValid(session: Record<string, unknown>): session is Record<string, unknown> & {
  id: string;
  question: string;
  category: QuestionCategory;
  castAt: string;
  status: 'casting' | 'complete';
} {
  return nonEmptyTrimmed(session.id)
    && nonEmptyTrimmed(session.question)
    && session.question.length <= 500
    && typeof session.category === 'string'
    && CATEGORIES.has(session.category as QuestionCategory)
    && exactIso(session.castAt)
    && (session.status === 'casting' || session.status === 'complete');
}

function sameCanonical(left: unknown, right: unknown): boolean {
  try {
    return strictCanonicalStringify(left) === strictCanonicalStringify(right);
  } catch {
    return false;
  }
}

function legacyPlateDifferences(
  session: Record<string, unknown>,
  caseSnapshot: DivinationCaseV2,
  tossValues: PlateV2['rawTosses'],
): string[] {
  const differences: string[] = [];
  const plate = session.plate;
  if (!isPlainRecord(plate)) return [
    'baseHexagram.name', 'castAt', 'changedHexagram.name', 'movingLines', 'tosses.values',
  ];
  const base = plate.baseHexagram;
  if (!isPlainRecord(base) || base.name !== caseSnapshot.plate.baseHexagram.name) {
    differences.push('baseHexagram.name');
  }
  const changed = plate.changedHexagram;
  if (!isPlainRecord(changed) || changed.name !== caseSnapshot.plate.changedHexagram.name) {
    differences.push('changedHexagram.name');
  }
  if (!sameCanonical(plate.movingLines, caseSnapshot.plate.movingLines)) {
    differences.push('movingLines');
  }
  if (plate.castAt !== session.castAt) differences.push('castAt');
  if (
    !Array.isArray(plate.lines)
    || plate.lines.length !== 6
    || plate.lines.some((line, index) => (
      !isPlainRecord(line) || line.value !== tossValues[index]
    ))
  ) differences.push('tosses.values');
  return differences;
}

function legacyAnalysis(
  session: Record<string, unknown>,
): LegacyUnverifiedAnalysis | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(session, 'analysis')) return undefined;
  if (!isPlainRecord(session.analysis)) return null;
  return {
    ...session.analysis,
    validation: { status: 'legacy-unverified' },
  };
}

function buildFromSession(
  session: Record<string, unknown> & {
    id: string;
    question: string;
    category: QuestionCategory;
    castAt: string;
  },
  tossValues: PlateV2['rawTosses'],
  input: ReturnType<typeof snapshotMigrationInput>,
  hashPort: HashPort,
  builtAt = input.builtAt,
): DivinationCaseV2 {
  return buildDivinationCase({
    sessionId: session.id,
    plateId: input.plateId,
    question: session.question,
    category: session.category,
    explicitIntentId: input.explicitIntentId,
    ...(Object.prototype.hasOwnProperty.call(input, 'subjectRelation')
      ? { subjectRelation: input.subjectRelation }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, 'explicitTarget')
      ? { explicitTarget: input.explicitTarget }
      : {}),
    castAt: session.castAt,
    builtAt,
    tossValues,
    ruleContext: input.ruleContext,
  }, hashPort);
}

function migratedSession(
  legacy: Record<string, unknown> & {
    id: string;
    question: string;
    category: QuestionCategory;
    castAt: string;
    status: 'casting' | 'complete';
  },
  input: ReturnType<typeof snapshotMigrationInput>,
  caseSnapshot?: DivinationCaseV2,
): MigratedLegacySession | null {
  const analysis = legacyAnalysis(legacy);
  if (analysis === null) return null;
  const session = {
    ...legacy,
    ...(caseSnapshot ? { caseSnapshot } : {}),
    ruleContext: caseSnapshot?.ruleContext ?? input.ruleContext,
    migrationVersion: 2 as const,
    migrationState: 'clean' as const,
    ...(analysis ? { analysis } : {}),
  };
  return deepFreeze(session) as MigratedLegacySession;
}

function verifyCurrentSession(
  session: Record<string, unknown> & {
    id: string;
    question: string;
    category: QuestionCategory;
    castAt: string;
    status: 'casting' | 'complete';
  },
  original: unknown,
  tossValues: readonly (6 | 7 | 8 | 9)[],
  input: ReturnType<typeof snapshotMigrationInput>,
  hashPort: HashPort,
): LegacyMigrationResult {
  if (session.migrationState !== 'clean' || !sameCanonical(session.ruleContext, input.ruleContext)) {
    return needsReview(original, 'legacy-conflict', ['migrationState']);
  }
  const analysis = legacyAnalysis(session);
  if (
    analysis === null
    || (analysis !== undefined && !sameCanonical(session.analysis, analysis))
  ) return needsReview(original, 'legacy-conflict', ['analysis.validation']);

  if (session.status === 'casting') {
    if (
      tossValues.length >= 6
      || Object.prototype.hasOwnProperty.call(session, 'caseSnapshot')
      || Object.prototype.hasOwnProperty.call(session, 'plate')
    ) {
      return needsReview(original, 'legacy-conflict', ['caseSnapshot']);
    }
    return deepFreeze({
      state: 'unchanged',
      session: deepFreeze(session) as MigratedLegacySession,
      audit: audit('already-current', []),
    });
  }

  if (tossValues.length !== 6 || !isPlainRecord(session.caseSnapshot)) {
    return needsReview(original, 'legacy-conflict', ['caseSnapshot']);
  }
  const builtAt = session.caseSnapshot.builtAt;
  if (!exactIso(builtAt)) return needsReview(original, 'legacy-conflict', ['caseSnapshot.builtAt']);
  const expected = buildFromSession(
    session,
    tossValues as PlateV2['rawTosses'],
    input,
    hashPort,
    builtAt,
  );
  if (!sameCanonical(session.caseSnapshot, expected)) {
    return needsReview(original, 'legacy-conflict', ['caseSnapshot']);
  }
  return deepFreeze({
    state: 'unchanged',
    session: deepFreeze(session) as MigratedLegacySession,
    audit: audit('already-current', []),
  });
}

export function migrateLegacySession(
  legacy: unknown,
  input: LegacyMigrationInput,
  hashPort: HashPort,
): LegacyMigrationResult;
export function migrateLegacySession(
  legacy: unknown,
  input: unknown,
  hashPort: HashPort,
): LegacyMigrationResult {
  const normalizedInput = snapshotMigrationInput(input);
  if (
    hashPort === null
    || typeof hashPort !== 'object'
    || typeof hashPort.sha256 !== 'function'
  ) throw new TypeError('旧会话迁移需要同步 SHA-256 HashPort');

  const owned = tryOwnedClone(legacy);
  if (!owned.ok || !isPlainRecord(owned.value)) {
    return needsReview(owned.ok ? owned.value : legacy, 'invalid-legacy', ['session.shape']);
  }
  const session = owned.value;
  const original = deepFreeze(owned.value);
  if (!baseSessionValid(session)) {
    return needsReview(original, 'invalid-legacy', ['session.shape']);
  }
  const tosses = confirmedTossValues(session);
  if (!tosses.valid || !validPendingToss(session, tosses.valid ? tosses.values.length : 0)) {
    return needsReview(original, 'invalid-legacy', ['tosses.values']);
  }
  if (session.status === 'complete' && Object.prototype.hasOwnProperty.call(session, 'currentToss')) {
    return needsReview(original, 'legacy-conflict', ['currentToss']);
  }

  if (session.migrationVersion === 2) {
    return verifyCurrentSession(session, original, tosses.values, normalizedInput, hashPort);
  }
  if (
    Object.prototype.hasOwnProperty.call(session, 'migrationVersion')
    || Object.prototype.hasOwnProperty.call(session, 'caseSnapshot')
    || Object.prototype.hasOwnProperty.call(session, 'ruleContext')
  ) return needsReview(original, 'legacy-conflict', ['migrationState']);

  if (session.status === 'casting') {
    if (
      tosses.values.length >= 6
      || Object.prototype.hasOwnProperty.call(session, 'plate')
    ) {
      return needsReview(original, 'legacy-conflict', ['tosses.values']);
    }
    const migrated = migratedSession(session, normalizedInput);
    if (!migrated) return needsReview(original, 'invalid-legacy', ['analysis']);
    return deepFreeze({
      state: 'migrated',
      session: migrated,
      audit: audit('migrated', []),
    });
  }

  if (tosses.values.length !== 6) {
    return needsReview(original, 'legacy-conflict', ['tosses.values']);
  }
  const tossValues = tosses.values as PlateV2['rawTosses'];
  const caseSnapshot = buildFromSession(session, tossValues, normalizedInput, hashPort);
  const differences = legacyPlateDifferences(session, caseSnapshot, tossValues);
  if (differences.length > 0) {
    return needsReview(original, 'legacy-conflict', differences);
  }
  const migrated = migratedSession(session, normalizedInput, caseSnapshot);
  if (!migrated) return needsReview(original, 'invalid-legacy', ['analysis']);
  return deepFreeze({
    state: 'migrated',
    session: migrated,
    audit: audit('migrated', []),
  });
}
