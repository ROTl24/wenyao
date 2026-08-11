function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pickOwn(input, fields) {
  const output = {};
  if (!isRecord(input)) return output;
  for (const field of fields) {
    if (Object.hasOwn(input, field)) output[field] = structuredClone(input[field]);
  }
  return output;
}

function sanitizeCoin(value) {
  return isRecord(value) ? pickOwn(value, ['faces', 'visualSeed']) : undefined;
}

function sanitizeLine(value) {
  const line = pickOwn(value, ['id', 'lineIndex', 'value', 'recordedAt']);
  if (isRecord(value)) {
    const coin = sanitizeCoin(value.coin);
    if (coin) line.coin = coin;
  }
  return line;
}

function sanitizeCurrentLine(value) {
  return pickOwn(value, [
    'id', 'lineIndex', 'visualSeed', 'faces', 'value', 'label', 'moving', 'baseYang', 'changedYang',
  ]);
}

function sanitizeCastingBasis(value) {
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

function sanitizeRendererSession(value) {
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

module.exports = { sanitizeCastingBasis, sanitizeRendererSession };
