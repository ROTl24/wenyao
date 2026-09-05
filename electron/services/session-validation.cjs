const { Solar } = require('lunar-javascript');
const { sanitizeCastingBasis } = require('./ipc-payload.cjs');
const { sanitizeSessionReview, sanitizeGenerationDraft } = require('../../shared/session-records.cjs');

const CASTING_METHODS = new Set(['digital', 'physical', 'random', 'time']);
const LINE_VALUES = new Set([6, 7, 8, 9]);
const SESSION_CATEGORIES = new Set([
  'career', 'wealth', 'relationship', 'health', 'study', 'lost_item', 'travel', 'other',
]);
const SESSION_STATUSES = new Set(['casting', 'complete']);
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

const shanghaiFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

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

function tossFromFaces(faces) {
  if (!Array.isArray(faces) || faces.length !== 3) throw new TypeError('每一爻必须使用三枚铜钱');
  if (faces.some((face) => face !== 'text' && face !== 'reverse')) throw new TypeError('钱面无效');
  const value = faces.reduce((sum, face) => sum + (face === 'text' ? 2 : 3), 0);
  const map = {
    6: { label: '老阴', moving: true, baseYang: false, changedYang: true },
    7: { label: '少阳', moving: false, baseYang: true, changedYang: true },
    8: { label: '少阴', moving: false, baseYang: false, changedYang: false },
    9: { label: '老阳', moving: true, baseYang: true, changedYang: false },
  };
  return { faces: [...faces], value, ...map[value] };
}

function defaultBasis(method) {
  if (method === 'digital') return { kind: 'digital', algorithm: 'three_coin_secure_v1' };
  if (method === 'physical') return { kind: 'physical', algorithm: 'three_coin_manual_v1' };
  if (method === 'random') return { kind: 'random', algorithm: 'three_coin_secure_batch_v1' };
  throw new TypeError('时间起卦必须保存完整推导依据');
}

function legacyLine(toss, index) {
  const expected = tossFromFaces(toss?.faces);
  if (expected.value !== toss?.value) throw new TypeError('投币历史冲突');
  return {
    id: String(toss.id || ''),
    lineIndex: Number(toss.lineIndex || index + 1),
    value: expected.value,
    recordedAt: String(toss.confirmedAt || ''),
    coin: {
      faces: expected.faces,
      ...(typeof toss.visualSeed === 'string' ? { visualSeed: toss.visualSeed } : {}),
    },
  };
}

function normalizeStoredSession(input) {
  const normalized = structuredClone(input);
  if (!isRecord(normalized)) return normalized;
  const castingMethod = storedCastingMethod(normalized);
  if (isRecord(normalized.analysis) && normalized.analysis.mode === 'local') delete normalized.analysis;
  if (normalized.schemaVersion === 2 && Array.isArray(normalized.lines)) return normalized;

  const lines = Array.isArray(normalized.tosses)
    ? normalized.tosses.map(legacyLine)
    : [];
  let currentLine;
  if (isRecord(normalized.currentToss)) {
    currentLine = {
      ...tossFromFaces(normalized.currentToss.faces),
      id: String(normalized.currentToss.id || ''),
      lineIndex: Number(normalized.currentToss.lineIndex),
      visualSeed: String(normalized.currentToss.visualSeed || ''),
    };
  }
  delete normalized.tosses;
  delete normalized.currentToss;
  return {
    ...normalized,
    schemaVersion: 2,
    castingMethod,
    castingBasis: defaultBasis(castingMethod),
    lines,
    ...(currentLine ? { currentLine } : {}),
  };
}

function validCoin(value, lineValue, visualSeedRequired) {
  if (!isRecord(value)) return false;
  let expected;
  try { expected = tossFromFaces(value.faces); } catch { return false; }
  if (expected.value !== lineValue) return false;
  return visualSeedRequired
    ? nonEmptyString(value.visualSeed)
    : !Object.hasOwn(value, 'visualSeed');
}

function validLine(value, expectedLineIndex, method) {
  if (
    !isRecord(value)
    || !nonEmptyString(value.id)
    || value.lineIndex !== expectedLineIndex
    || !LINE_VALUES.has(value.value)
    || !exactIso(value.recordedAt)
  ) return false;
  if (method === 'time') return !Object.hasOwn(value, 'coin');
  return validCoin(value.coin, value.value, method === 'digital');
}

function validCurrentLine(value, expectedLineIndex) {
  if (!isRecord(value) || !nonEmptyString(value.id) || value.lineIndex !== expectedLineIndex) return false;
  let expected;
  try { expected = tossFromFaces(value.faces); } catch { return false; }
  return nonEmptyString(value.visualSeed)
    && value.value === expected.value
    && value.label === expected.label
    && value.moving === expected.moving
    && value.baseYang === expected.baseYang
    && value.changedYang === expected.changedYang;
}

function validateLineSequence(session) {
  const seenIds = new Set();
  for (const [index, line] of session.lines.entries()) {
    if (!validLine(line, index + 1, session.castingMethod) || seenIds.has(line?.id)) {
      throw new TypeError('六爻记录冲突');
    }
    seenIds.add(line.id);
  }
  if (session.currentLine !== undefined) {
    if (
      session.castingMethod !== 'digital'
      || !validCurrentLine(session.currentLine, session.lines.length + 1)
      || seenIds.has(session.currentLine?.id)
    ) throw new TypeError('当前投币状态冲突');
  }
}

function shanghaiParts(instant) {
  const entries = shanghaiFormatter.formatToParts(instant)
    .filter((part) => part.type !== 'literal')
    .map((part) => [part.type, Number(part.value)]);
  return Object.fromEntries(entries);
}

function shiftDate(parts, days) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

function pad(value) { return String(value).padStart(2, '0'); }

function deriveTimeBasis(castAt) {
  const instant = new Date(castAt);
  const shanghai = shanghaiParts(instant);
  const date = shanghai.hour === 23 ? shiftDate(shanghai, 1) : shanghai;
  if (date.year < 1900 || date.year > 2100) throw new RangeError('时间起卦超出支持范围');
  const lunar = Solar.fromYmd(date.year, date.month, date.day).getLunar();
  const monthValue = lunar.getMonth();
  const yearBranch = lunar.getYearZhi();
  const yearNumber = EARTHLY_BRANCHES.indexOf(yearBranch) + 1;
  const hourNumber = shanghai.hour === 23 || shanghai.hour === 0
    ? 1
    : Math.floor((shanghai.hour + 1) / 2) + 1;
  const numbers = { year: yearNumber, month: Math.abs(monthValue), day: lunar.getDay(), hour: hourNumber };
  const upperTotal = numbers.year + numbers.month + numbers.day;
  const fullTotal = upperTotal + numbers.hour;
  const remainder = (total, divisor) => total % divisor || divisor;
  return {
    kind: 'time',
    algorithm: 'time_meihua_lunar_v1',
    castAt,
    calendar: {
      timezone: 'Asia/Shanghai',
      rule: 'zi_hour_23_next_day_v1',
      traditionalDate: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
      lunarYearGanZhi: lunar.getYearInGanZhi(),
      lunarYearBranch: yearBranch,
      lunarMonth: Math.abs(monthValue),
      leapMonth: monthValue < 0,
      lunarDay: lunar.getDay(),
      lunarLabel: `农历${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      timeBranch: EARTHLY_BRANCHES[hourNumber - 1],
      numbers,
    },
    upperTrigramNumber: remainder(upperTotal, 8),
    lowerTrigramNumber: remainder(fullTotal, 8),
    movingLine: remainder(fullTotal, 6),
  };
}

function validateCastingBasis(value, method, castAt) {
  if (!isRecord(value) || value.kind !== method) throw new TypeError('起卦依据与方式不一致');
  const algorithms = {
    digital: 'three_coin_secure_v1', physical: 'three_coin_manual_v1', random: 'three_coin_secure_batch_v1',
  };
  if (method !== 'time') {
    if (value.algorithm !== algorithms[method]) throw new TypeError('起卦算法版本无效');
    return;
  }
  if (value.algorithm !== 'time_meihua_lunar_v1' || value.castAt !== castAt) {
    throw new TypeError('时间起卦依据无效');
  }
  const expected = deriveTimeBasis(castAt);
  if (JSON.stringify(sanitizeCastingBasis(value)) !== JSON.stringify(sanitizeCastingBasis(expected))) {
    throw new TypeError('时间起卦依据无法重放');
  }
}

const TRIGRAM_LINES_BY_NUMBER = {
  1: [true, true, true],
  2: [true, true, false],
  3: [true, false, true],
  4: [true, false, false],
  5: [false, true, true],
  6: [false, true, false],
  7: [false, false, true],
  8: [false, false, false],
};

function timeLineValues(basis) {
  return [
    ...TRIGRAM_LINES_BY_NUMBER[basis.lowerTrigramNumber],
    ...TRIGRAM_LINES_BY_NUMBER[basis.upperTrigramNumber],
  ].map((baseYang, index) => {
    const moving = basis.movingLine === index + 1;
    if (moving) return baseYang ? 9 : 6;
    return baseYang ? 7 : 8;
  });
}

function validateSessionForSave(input, existing = null) {
  if (
    !isRecord(input)
    || input.schemaVersion !== 2
    || !nonEmptyString(input.id)
    || input.id !== input.id.trim()
    || !nonEmptyString(input.question)
    || !SESSION_CATEGORIES.has(input.category)
    || !exactIso(input.castAt)
    || !exactIso(input.updatedAt)
    || !SESSION_STATUSES.has(input.status)
    || !Array.isArray(input.lines)
    || !Array.isArray(input.messages)
  ) throw new TypeError('会话数据无效');
  if (!CASTING_METHODS.has(input.castingMethod)) throw new TypeError('起卦方式无效');
  if (
    Object.hasOwn(input, 'analysis')
    && input.analysis !== undefined
    && (!isRecord(input.analysis) || input.analysis.mode !== 'cloud')
  ) throw new TypeError('仅允许保存云端 AI 解读');
  if (existing && storedCastingMethod(existing) !== input.castingMethod) {
    throw new TypeError('起卦方式不可更改');
  }

  validateCastingBasis(input.castingBasis, input.castingMethod, input.castAt);
  if (input.castingMethod !== 'digital') {
    if (input.status !== 'complete' || input.lines.length !== 6 || input.currentLine !== undefined) {
      const methodLabel = input.castingMethod === 'physical'
        ? '线下'
        : input.castingMethod === 'random'
          ? '随机'
          : '时间';
      throw new TypeError(`${methodLabel}起卦只能保存完整六爻`);
    }
  } else if (
    (input.status === 'complete' && (input.lines.length !== 6 || input.currentLine !== undefined))
    || (input.status === 'casting' && input.lines.length >= 6)
  ) throw new TypeError('在线起卦状态冲突');
  validateLineSequence(input);
  if (input.castingMethod === 'time') {
    const expectedValues = timeLineValues(deriveTimeBasis(input.castAt));
    if (input.lines.some((line, index) => (
      line.value !== expectedValues[index] || line.recordedAt !== input.castAt
    ))) throw new TypeError('时间起卦爻值与推导依据不一致');
  }
  if (input.status === 'complete' && !isRecord(input.plate)) throw new TypeError('完整会话缺少排盘');
  const safe = structuredClone(input);
  if (input.generationDraft !== undefined) safe.generationDraft = sanitizeGenerationDraft(input.generationDraft);
  if (input.review !== undefined) safe.review = sanitizeSessionReview(input.review);
  return safe;
}

module.exports = {
  deriveTimeBasis,
  normalizeStoredSession,
  storedCastingMethod,
  validateSessionForSave,
};
