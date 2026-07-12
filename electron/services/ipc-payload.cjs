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

function sanitizeToss(value, confirmed) {
  return pickOwn(value, [
    'id', 'lineIndex', 'visualSeed',
    ...(confirmed ? ['confirmedAt'] : []),
    'faces', 'value', 'label', 'moving', 'baseYang', 'changedYang',
  ]);
}

function sanitizeRendererSession(value) {
  const session = pickOwn(value, ['id', 'question', 'category', 'castAt', 'status']);
  if (Array.isArray(value?.tosses)) {
    session.tosses = value.tosses.map((toss) => sanitizeToss(toss, true));
  }
  if (isRecord(value?.currentToss)) session.currentToss = sanitizeToss(value.currentToss, false);
  return session;
}

function sanitizeEntity(value) {
  if (!isRecord(value)) return undefined;
  if (value.type === 'line') return pickOwn(value, ['type', 'id', 'side']);
  if (value.type === 'hidden-spirit') return pickOwn(value, ['type', 'id']);
  return undefined;
}

function sanitizeExplicitTarget(value) {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'six-relation') return pickOwn(value, ['kind', 'relation']);
  if (value.kind === 'role') return pickOwn(value, ['kind', 'role']);
  if (value.kind === 'shi-ying-pair') return { kind: 'shi-ying-pair' };
  if (value.kind === 'explicit-entity') {
    const entity = sanitizeEntity(value.entity);
    return entity ? { kind: 'explicit-entity', entity } : undefined;
  }
  return undefined;
}

function sanitizeClarification(value) {
  if (!isRecord(value)) return undefined;
  const clarification = pickOwn(value, ['explicitIntentId', 'subjectRelation']);
  if (Object.hasOwn(value, 'explicitTarget')) {
    const explicitTarget = sanitizeExplicitTarget(value.explicitTarget);
    if (explicitTarget) clarification.explicitTarget = explicitTarget;
  }
  return Object.keys(clarification).length ? clarification : undefined;
}

function sanitizeBuildCasePayload(value) {
  const payload = pickOwn(value, ['sessionId']);
  const clarification = sanitizeClarification(value?.clarification);
  if (clarification) payload.clarification = clarification;
  return payload;
}

function sanitizeSelectIntentPayload(value) {
  const payload = sanitizeBuildCasePayload(value);
  if (isRecord(value) && Object.hasOwn(value, 'expectedFactSetHash')) {
    payload.expectedFactSetHash = structuredClone(value.expectedFactSetHash);
  }
  return payload;
}

function sanitizeAnalyzePayload(value) {
  return pickOwn(value, ['sessionId', 'expectedFactSetHash']);
}

function sanitizeFollowUpPayload(value) {
  return pickOwn(value, ['sessionId', 'question', 'expectedFactSetHash']);
}

module.exports = {
  sanitizeAnalyzePayload,
  sanitizeBuildCasePayload,
  sanitizeClarification,
  sanitizeFollowUpPayload,
  sanitizeRendererSession,
  sanitizeSelectIntentPayload,
};
