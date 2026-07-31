const CASTING_METHODS = new Set(['digital', 'physical']);
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
const TOSS_VALUES = new Set([6, 7, 8, 9]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactIso(value) {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function storedCastingMethod(session) {
  if (!isRecord(session) || !Object.hasOwn(session, 'castingMethod')) return 'digital';
  if (!CASTING_METHODS.has(session.castingMethod)) throw new TypeError('起卦方式无效');
  return session.castingMethod;
}

function normalizeStoredSession(session) {
  const normalized = structuredClone(session);
  if (!isRecord(normalized)) return normalized;
  if (!Object.hasOwn(normalized, 'castingMethod')) {
    normalized.castingMethod = 'digital';
  } else if (!CASTING_METHODS.has(normalized.castingMethod)) {
    throw new TypeError('起卦方式无效');
  }
  if (isRecord(normalized.analysis) && normalized.analysis.mode === 'local') {
    delete normalized.analysis;
  }
  return normalized;
}

function expectedTossFields(value) {
  return {
    label: value === 6 ? '老阴' : value === 7 ? '少阳' : value === 8 ? '少阴' : '老阳',
    moving: value === 6 || value === 9,
    baseYang: value === 7 || value === 9,
    changedYang: value === 6 || value === 7,
  };
}

function validTossFields(toss, lineIndex, { castingMethod, confirmed }) {
  if (!isRecord(toss) || !nonEmptyString(toss.id) || toss.lineIndex !== lineIndex) return false;
  if (!TOSS_VALUES.has(toss.value)) return false;
  if (
    !Array.isArray(toss.faces)
    || toss.faces.length !== 3
    || toss.faces.some((face) => face !== 'text' && face !== 'reverse')
  ) return false;

  const faceValue = toss.faces.reduce(
    (sum, face) => sum + (face === 'text' ? 2 : 3),
    0,
  );
  const expected = expectedTossFields(toss.value);
  if (
    faceValue !== toss.value
    || toss.label !== expected.label
    || toss.moving !== expected.moving
    || toss.baseYang !== expected.baseYang
    || toss.changedYang !== expected.changedYang
  ) return false;

  if (confirmed ? !exactIso(toss.confirmedAt) : Object.hasOwn(toss, 'confirmedAt')) return false;
  if (castingMethod === 'digital') return nonEmptyString(toss.visualSeed);
  return !Object.hasOwn(toss, 'visualSeed');
}

function validateTossSequence(session) {
  const seenIds = new Set();
  for (const [index, toss] of session.tosses.entries()) {
    if (!validTossFields(toss, index + 1, {
      castingMethod: session.castingMethod,
      confirmed: true,
    })) {
      throw new TypeError('投币历史冲突');
    }
    if (seenIds.has(toss.id)) throw new TypeError('投币历史冲突');
    seenIds.add(toss.id);
  }

  if (session.currentToss !== undefined) {
    if (!validTossFields(session.currentToss, session.tosses.length + 1, {
      castingMethod: session.castingMethod,
      confirmed: false,
    })) {
      throw new TypeError('当前投币状态冲突');
    }
    if (seenIds.has(session.currentToss.id)) throw new TypeError('当前投币状态冲突');
  }
}

function validateSessionForSave(input, existing = null) {
  if (
    !isRecord(input)
    || !nonEmptyString(input.id)
    || input.id !== input.id.trim()
    || !nonEmptyString(input.question)
    || !SESSION_CATEGORIES.has(input.category)
    || !exactIso(input.castAt)
    || !exactIso(input.updatedAt)
    || !SESSION_STATUSES.has(input.status)
    || !Array.isArray(input.tosses)
    || !Array.isArray(input.messages)
  ) {
    throw new TypeError('会话数据无效');
  }
  if (!CASTING_METHODS.has(input.castingMethod)) throw new TypeError('起卦方式无效');
  if (
    Object.hasOwn(input, 'analysis')
    && input.analysis !== undefined
    && (!isRecord(input.analysis) || input.analysis.mode !== 'cloud')
  ) {
    throw new TypeError('仅允许保存云端 AI 解读');
  }
  if (existing && storedCastingMethod(existing) !== input.castingMethod) {
    throw new TypeError('起卦方式不可更改');
  }

  validateTossSequence(input);

  if (input.castingMethod === 'physical') {
    if (
      input.status !== 'complete'
      || input.tosses.length !== 6
      || input.currentToss !== undefined
    ) {
      throw new TypeError('线下起卦只能保存完整六爻');
    }
  } else if (
    (input.status === 'complete' && (input.tosses.length !== 6 || input.currentToss !== undefined))
    || (input.status === 'casting' && input.tosses.length >= 6)
  ) {
    throw new TypeError('在线起卦状态冲突');
  }

  return structuredClone(input);
}

module.exports = {
  normalizeStoredSession,
  storedCastingMethod,
  validateSessionForSave,
};
