import { createToss, type CoinFace, type LineValue } from './divination';
import {
  normalizeSession,
  type CastingMethod,
  type DivinationSession,
} from './session';
import { deriveTimeCasting } from './timeCasting';

type UnknownRecord = Record<string, unknown>;

const CASTING_METHODS = new Set<CastingMethod>(['digital', 'physical', 'random', 'time']);
const LINE_VALUES = new Set<LineValue>([6, 7, 8, 9]);
const SESSION_CATEGORIES = new Set([
  'career', 'wealth', 'relationship', 'health', 'study', 'lost_item', 'travel', 'other',
]);
const SESSION_STATUSES = new Set(['casting', 'complete']);

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function storedCastingMethod(value: unknown): CastingMethod {
  if (!isRecord(value) || !hasOwn(value, 'castingMethod')) return 'digital';
  if (!CASTING_METHODS.has(value.castingMethod as CastingMethod)) {
    throw new TypeError('起卦方式无效');
  }
  return value.castingMethod as CastingMethod;
}

function pickOwn(input: unknown, fields: readonly string[]): UnknownRecord {
  const output: UnknownRecord = {};
  if (!isRecord(input)) return output;
  for (const field of fields) {
    if (hasOwn(input, field)) output[field] = structuredClone(input[field]);
  }
  return output;
}

function sanitizeCoin(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  return pickOwn(value, ['faces', 'visualSeed']);
}

function sanitizeLine(value: unknown): UnknownRecord {
  const line = pickOwn(value, ['id', 'lineIndex', 'value', 'recordedAt']);
  if (isRecord(value)) {
    const coin = sanitizeCoin(value.coin);
    if (coin) line.coin = coin;
  }
  return line;
}

function sanitizeCurrentLine(value: unknown): UnknownRecord {
  return pickOwn(value, [
    'id', 'lineIndex', 'visualSeed', 'faces', 'value', 'label', 'moving', 'baseYang', 'changedYang',
  ]);
}

function sanitizeCastingBasis(value: unknown): UnknownRecord {
  if (!isRecord(value)) return {};
  if (value.kind !== 'time') return pickOwn(value, ['kind', 'algorithm']);
  const basis = pickOwn(value, [
    'kind', 'algorithm', 'castAt', 'upperTrigramNumber', 'lowerTrigramNumber', 'movingLine',
  ]);
  if (isRecord(value.calendar)) {
    const calendar = pickOwn(value.calendar, [
      'timezone', 'rule', 'traditionalDate', 'lunarYearGanZhi', 'lunarYearBranch',
      'lunarMonth', 'leapMonth', 'lunarDay', 'lunarLabel', 'timeBranch',
    ]);
    if (isRecord(value.calendar.numbers)) {
      calendar.numbers = pickOwn(value.calendar.numbers, ['year', 'month', 'day', 'hour']);
    }
    basis.calendar = calendar;
  }
  return basis;
}

/** Canonicalizes renderer-owned session data with the Electron IPC allowlist. */
export function sanitizeRendererSession(value: unknown): unknown {
  const session = pickOwn(value, [
    'schemaVersion', 'id', 'question', 'category', 'castingMethod', 'castAt', 'updatedAt',
    'status', 'plate', 'analysis', 'messages',
  ]);
  if (isRecord(value)) {
    session.castingBasis = sanitizeCastingBasis(value.castingBasis);
    if (Array.isArray(value.lines)) session.lines = value.lines.map(sanitizeLine);
    if (isRecord(value.currentLine)) session.currentLine = sanitizeCurrentLine(value.currentLine);
  }
  return session;
}

function validCoin(value: unknown, lineValue: LineValue, visualSeedRequired: boolean): boolean {
  if (!isRecord(value) || !Array.isArray(value.faces) || value.faces.length !== 3) return false;
  if (value.faces.some((face) => face !== 'text' && face !== 'reverse')) return false;
  if (createToss(value.faces as CoinFace[]).value !== lineValue) return false;
  return visualSeedRequired
    ? nonEmptyString(value.visualSeed)
    : !hasOwn(value, 'visualSeed');
}

function validLine(
  value: unknown,
  expectedLineIndex: number,
  method: CastingMethod,
): value is UnknownRecord {
  if (!isRecord(value)) return false;
  if (
    !nonEmptyString(value.id)
    || value.lineIndex !== expectedLineIndex
    || !LINE_VALUES.has(value.value as LineValue)
    || !exactIso(value.recordedAt)
  ) return false;
  if (method === 'time') return !hasOwn(value, 'coin');
  return validCoin(value.coin, value.value as LineValue, method === 'digital');
}

function validCurrentLine(value: unknown, expectedLineIndex: number): boolean {
  if (!isRecord(value) || !nonEmptyString(value.id) || value.lineIndex !== expectedLineIndex) return false;
  if (
    !Array.isArray(value.faces)
    || value.faces.length !== 3
    || value.faces.some((face) => face !== 'text' && face !== 'reverse')
    || !nonEmptyString(value.visualSeed)
  ) return false;
  const expected = createToss(value.faces as CoinFace[]);
  return value.value === expected.value
    && value.label === expected.label
    && value.moving === expected.moving
    && value.baseYang === expected.baseYang
    && value.changedYang === expected.changedYang;
}

function validateLineSequence(session: UnknownRecord & {
  castingMethod: CastingMethod;
  lines: unknown[];
}): void {
  const seenIds = new Set<string>();
  for (const [index, line] of session.lines.entries()) {
    if (!validLine(line, index + 1, session.castingMethod) || seenIds.has(line.id as string)) {
      throw new TypeError('六爻记录冲突');
    }
    seenIds.add(line.id as string);
  }
  if (session.currentLine !== undefined) {
    if (
      session.castingMethod !== 'digital'
      || !validCurrentLine(session.currentLine, session.lines.length + 1)
      || seenIds.has((session.currentLine as UnknownRecord).id as string)
    ) throw new TypeError('当前投币状态冲突');
  }
}

function validateCastingBasis(value: unknown, method: CastingMethod, castAt: string): void {
  if (!isRecord(value) || value.kind !== method) throw new TypeError('起卦依据与方式不一致');
  const expectedAlgorithms: Record<Exclude<CastingMethod, 'time'>, string> = {
    digital: 'three_coin_secure_v1',
    physical: 'three_coin_manual_v1',
    random: 'three_coin_secure_batch_v1',
  };
  if (method !== 'time') {
    if (value.algorithm !== expectedAlgorithms[method]) throw new TypeError('起卦算法版本无效');
    return;
  }
  if (value.algorithm !== 'time_meihua_lunar_v1' || value.castAt !== castAt) {
    throw new TypeError('时间起卦依据无效');
  }
  const expected = deriveTimeCasting(new Date(castAt)).basis;
  if (JSON.stringify(sanitizeCastingBasis(value)) !== JSON.stringify(sanitizeCastingBasis(expected))) {
    throw new TypeError('时间起卦依据无法重放');
  }
}

/** Normalizes legacy storage on a detached copy without rewriting the source. */
export function normalizeStoredSession(value: unknown): DivinationSession {
  const normalized = structuredClone(value);
  if (!isRecord(normalized)) return normalized as DivinationSession;
  if (isRecord(normalized.analysis) && normalized.analysis.mode === 'local') delete normalized.analysis;
  return normalizeSession(normalized);
}

/** Enforces the browser persistence contract at the storage seam. */
export function validateSessionForSave(
  value: unknown,
  existingValue: unknown = null,
): DivinationSession {
  if (
    !isRecord(value)
    || value.schemaVersion !== 2
    || !nonEmptyString(value.id)
    || value.id !== value.id.trim()
    || !nonEmptyString(value.question)
    || !SESSION_CATEGORIES.has(value.category as string)
    || !exactIso(value.castAt)
    || !exactIso(value.updatedAt)
    || !SESSION_STATUSES.has(value.status as string)
    || !Array.isArray(value.lines)
    || !Array.isArray(value.messages)
  ) throw new TypeError('会话数据无效');
  if (!CASTING_METHODS.has(value.castingMethod as CastingMethod)) throw new TypeError('起卦方式无效');
  if (
    hasOwn(value, 'analysis')
    && value.analysis !== undefined
    && (!isRecord(value.analysis) || value.analysis.mode !== 'cloud')
  ) throw new TypeError('仅允许保存云端 AI 解读');
  if (existingValue && storedCastingMethod(existingValue) !== value.castingMethod) {
    throw new TypeError('起卦方式不可更改');
  }

  const session = value as UnknownRecord & {
    castingMethod: CastingMethod;
    status: string;
    castAt: string;
    lines: unknown[];
  };
  validateCastingBasis(session.castingBasis, session.castingMethod, session.castAt);
  if (session.castingMethod !== 'digital') {
    if (session.status !== 'complete' || session.lines.length !== 6 || session.currentLine !== undefined) {
      const methodLabel = session.castingMethod === 'physical'
        ? '线下'
        : session.castingMethod === 'random'
          ? '随机'
          : '时间';
      throw new TypeError(`${methodLabel}起卦只能保存完整六爻`);
    }
  } else if (
    (session.status === 'complete' && (session.lines.length !== 6 || session.currentLine !== undefined))
    || (session.status === 'casting' && session.lines.length >= 6)
  ) throw new TypeError('在线起卦状态冲突');
  validateLineSequence(session);
  if (session.castingMethod === 'time') {
    const expectedLines = deriveTimeCasting(new Date(session.castAt)).lines;
    if (session.lines.some((line, index) => (
      !isRecord(line)
      || line.value !== expectedLines[index].value
      || line.recordedAt !== session.castAt
    ))) throw new TypeError('时间起卦爻值与推导依据不一致');
  }
  if (session.status === 'complete' && !isRecord(session.plate)) throw new TypeError('完整会话缺少排盘');

  return structuredClone(value) as unknown as DivinationSession;
}
