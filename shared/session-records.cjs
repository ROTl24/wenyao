function sanitizeGenerationDraft(value) {
  if (value == null) return value;
  if (!value || typeof value !== 'object' || !['analysis', 'followUp'].includes(value.kind)
    || !['stopped', 'failed'].includes(value.status) || typeof value.content !== 'string'
    || typeof value.requestId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(value.requestId)
    || typeof value.question !== 'string' || typeof value.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(value.updatedAt)) || new Date(value.updatedAt).toISOString() !== value.updatedAt) throw new TypeError('未完成草稿无效');
  return { requestId: value.requestId, kind: value.kind, status: value.status, content: value.content, question: value.question, updatedAt: value.updatedAt, ...(value.evidenceSnapshot ? { evidenceSnapshot: structuredClone(value.evidenceSnapshot) } : {}) };
}

const REVIEW_STATUSES = new Set(['pending', 'happened', 'unclear']);

function sanitizeSessionReview(value) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !REVIEW_STATUSES.has(value.status)
    || typeof value.note !== 'string' || value.note.length > 5000
    || !Array.isArray(value.tags) || value.tags.length > 8
    || value.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.length > 20)
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
    || new Date(value.updatedAt).toISOString() !== value.updatedAt) throw new TypeError('复盘记录无效');
  const observedAt = value.observedAt;
  if (typeof observedAt !== 'string' || (observedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(observedAt)
    || !Number.isFinite(Date.parse(observedAt)) || new Date(observedAt).toISOString().slice(0, 10) !== observedAt))) throw new TypeError('复盘日期无效');
  return { status: value.status, observedAt, note: value.note, tags: [...new Set(value.tags.map((tag) => tag.trim()))], updatedAt: value.updatedAt };
}

/** Validates the whole batch against current revisions before returning a detached replacement list. */
function mergeSessionImport(existing, payload, validate) {
  if (!payload || !Array.isArray(payload.sessions) || !payload.sessions.length || payload.sessions.length > 10000
    || !payload.resolutions || typeof payload.resolutions !== 'object' || Array.isArray(payload.resolutions)) throw new TypeError('占簿导入数据无效');
  const next = new Map(existing.map((session) => [session.id, session]));
  const inputIds = new Set(payload.sessions.map((input) => input?.id));
  if (inputIds.size !== payload.sessions.length) throw new TypeError('备份包含重复的记录标识');
  for (const input of payload.sessions) {
    if (!input || typeof input.id !== 'string') throw new TypeError('备份记录标识无效');
    const safe = validate(input, null);
    const current = next.get(input.id);
    const resolution = Object.hasOwn(payload.resolutions, input.id) ? payload.resolutions[input.id] : null;
    if (current || resolution) {
      if (!current || !resolution || resolution.expectedUpdatedAt !== current.updatedAt) throw new Error('占簿在预览后发生变化，请重新选择备份文件。');
      if (resolution.action === 'skip') continue;
      if (resolution.action === 'copy') {
        const id = resolution.newId;
        if (typeof id !== 'string' || !id.trim() || next.has(id) || inputIds.has(id)) throw new TypeError('新副本标识冲突');
        next.set(id, validate({ ...safe, id,
          ...(safe.analysis ? { analysis: { ...safe.analysis, analysisId: `${id}:analysis` } } : {}),
          messages: (safe.messages || []).map((message, index) => ({ ...message, id: `${id}:message:${index}` })),
        }, null));
      } else if (resolution.action === 'replace') {
        next.set(input.id, validate(safe, current));
      } else throw new TypeError('请选择重复记录的处理方式');
    } else next.set(input.id, safe);
  }
  return [...next.values()];
}

module.exports = { sanitizeGenerationDraft, sanitizeSessionReview, mergeSessionImport };
