import { createToss, type CoinFace } from './divination';
import type { CastingMethod, DivinationSession } from './session';

type UnknownRecord = Record<string, unknown>;

const CASTING_METHODS = new Set<CastingMethod>(['digital', 'physical']);
const SESSION_CATEGORIES = new Set([
  'career',
  'wealth',
  'relationship',
  'health',
  'study',
  'lost_item',
  'travel',
  'other',
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

function sanitizeToss(value: unknown, confirmed: boolean): UnknownRecord {
  return pickOwn(value, [
    'id',
    'lineIndex',
    'visualSeed',
    ...(confirmed ? ['confirmedAt'] : []),
    'faces',
    'value',
    'label',
    'moving',
    'baseYang',
    'changedYang',
  ]);
}

/**
 * Canonicalizes renderer-owned session data with the same allowlist used by Electron IPC.
 */
export function sanitizeRendererSession(value: unknown): unknown {
  const session = pickOwn(value, [
    'id',
    'question',
    'category',
    'castingMethod',
    'castAt',
    'updatedAt',
    'status',
    'plate',
    'analysis',
    'messages',
  ]);
  if (isRecord(value) && Array.isArray(value.tosses)) {
    session.tosses = value.tosses.map((toss) => sanitizeToss(toss, true));
  }
  if (isRecord(value) && isRecord(value.currentToss)) {
    session.currentToss = sanitizeToss(value.currentToss, false);
  }
  return session;
}

function validToss(
  tossValue: unknown,
  expectedLineIndex: number,
  castingMethod: CastingMethod,
  confirmed: boolean,
): tossValue is UnknownRecord {
  if (!isRecord(tossValue)) return false;
  const toss = tossValue;
  if (!nonEmptyString(toss.id) || toss.lineIndex !== expectedLineIndex) return false;
  if (
    !Array.isArray(toss.faces)
    || toss.faces.length !== 3
    || toss.faces.some((face) => face !== 'text' && face !== 'reverse')
  ) return false;

  const expected = createToss(toss.faces as CoinFace[]);
  if (
    toss.value !== expected.value
    || toss.label !== expected.label
    || toss.moving !== expected.moving
    || toss.baseYang !== expected.baseYang
    || toss.changedYang !== expected.changedYang
  ) return false;

  if (confirmed ? !exactIso(toss.confirmedAt) : hasOwn(toss, 'confirmedAt')) return false;
  if (castingMethod === 'digital') return nonEmptyString(toss.visualSeed);
  return !hasOwn(toss, 'visualSeed');
}

function validateTossSequence(session: UnknownRecord & {
  castingMethod: CastingMethod;
  tosses: unknown[];
}): void {
  const seenIds = new Set<string>();
  for (const [index, toss] of session.tosses.entries()) {
    if (!validToss(toss, index + 1, session.castingMethod, true)) {
      throw new TypeError('投币历史冲突');
    }
    if (seenIds.has(toss.id as string)) throw new TypeError('投币历史冲突');
    seenIds.add(toss.id as string);
  }

  if (session.currentToss !== undefined) {
    if (!validToss(
      session.currentToss,
      session.tosses.length + 1,
      session.castingMethod,
      false,
    )) {
      throw new TypeError('当前投币状态冲突');
    }
    if (seenIds.has(session.currentToss.id as string)) {
      throw new TypeError('当前投币状态冲突');
    }
  }
}

/**
 * Normalizes the only supported legacy storage difference on a detached copy.
 */
export function normalizeStoredSession(value: unknown): DivinationSession {
  const normalized = structuredClone(value);
  if (!isRecord(normalized)) return normalized as DivinationSession;
  if (!hasOwn(normalized, 'castingMethod')) {
    normalized.castingMethod = 'digital';
  } else if (!CASTING_METHODS.has(normalized.castingMethod as CastingMethod)) {
    throw new TypeError('起卦方式无效');
  }
  return normalized as unknown as DivinationSession;
}

/**
 * Enforces the browser persistence contract at the storage seam.
 */
export function validateSessionForSave(
  value: unknown,
  existingValue: unknown = null,
): DivinationSession {
  if (
    !isRecord(value)
    || !nonEmptyString(value.id)
    || value.id !== value.id.trim()
    || !nonEmptyString(value.question)
    || !SESSION_CATEGORIES.has(value.category as string)
    || !exactIso(value.castAt)
    || !exactIso(value.updatedAt)
    || !SESSION_STATUSES.has(value.status as string)
    || !Array.isArray(value.tosses)
    || !Array.isArray(value.messages)
  ) {
    throw new TypeError('会话数据无效');
  }
  if (!CASTING_METHODS.has(value.castingMethod as CastingMethod)) {
    throw new TypeError('起卦方式无效');
  }
  if (
    existingValue
    && storedCastingMethod(existingValue) !== value.castingMethod
  ) {
    throw new TypeError('起卦方式不可更改');
  }

  const session = value as UnknownRecord & {
    castingMethod: CastingMethod;
    status: string;
    tosses: unknown[];
  };
  validateTossSequence(session);

  if (session.castingMethod === 'physical') {
    if (
      session.status !== 'complete'
      || session.tosses.length !== 6
      || session.currentToss !== undefined
    ) {
      throw new TypeError('线下起卦只能保存完整六爻');
    }
  } else if (
    (
      session.status === 'complete'
      && (session.tosses.length !== 6 || session.currentToss !== undefined)
    )
    || (session.status === 'casting' && session.tosses.length >= 6)
  ) {
    throw new TypeError('在线起卦状态冲突');
  }

  return structuredClone(value) as unknown as DivinationSession;
}
