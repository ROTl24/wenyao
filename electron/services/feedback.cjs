const crypto = require('node:crypto');

const REASONS = new Set([
  '问非所答', '盘面事实有误', '引用依据不相关', '结论前后矛盾',
  '说得太模糊', '内容难以理解', '与后来实际情况不符', '其他问题',
]);
const RETRIEVAL_MODES = new Set(['full-hybrid', 'bm25-reranked', 'rrf-fallback', 'bm25-fallback']);

function text(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function sanitizeTechnical(value) {
  const source = value && typeof value === 'object' ? value : {};
  const sourceModels = source.modelIds && typeof source.modelIds === 'object' ? source.modelIds : {};
  const rankings = source.candidateRankings && typeof source.candidateRankings === 'object'
    ? Object.fromEntries(Object.entries(source.candidateRankings).map(([stage, items]) => [stage, Array.isArray(items) ? items.slice(0, 40).map((item) => ({
      id: text(item?.id, 200), rank: Number(item?.rank) || 0, score: Number(item?.score) || 0,
    })) : []]))
    : undefined;
  return {
    appVersion: text(source.appVersion, 50),
    corpusVersion: text(source.corpusVersion, 200),
    category: text(source.category, 50),
    modelIds: Object.fromEntries(['generation', 'embedding', 'rerank'].filter((key) => sourceModels[key]).map((key) => [key, text(sourceModels[key], 200)])),
    retrievalMode: RETRIEVAL_MODES.has(source.retrievalMode) ? source.retrievalMode : '',
    stages: Array.isArray(source.stages) ? source.stages.slice(0, 10).map((item) => text(item, 200)) : undefined,
    candidateRankings: rankings,
    finalEvidenceIds: Array.isArray(source.finalEvidenceIds) ? source.finalEvidenceIds.slice(0, 16).map((item) => text(item, 200)) : [],
  };
}

function sanitizeSubmission(input, existing = null) {
  if (!input || typeof input !== 'object') throw new TypeError('反馈数据无效');
  const sentiment = input.sentiment === 'helpful' ? 'helpful' : input.sentiment === 'problematic' ? 'problematic' : '';
  if (!sentiment) throw new TypeError('反馈评价无效');
  const targetId = text(input.targetId, 100);
  if (!targetId) throw new TypeError('反馈目标无效');
  const now = new Date().toISOString();
  const contentOptIn = Boolean(input.contentOptIn);
  return {
    feedbackId: existing?.feedbackId || text(input.feedbackId, 100) || crypto.randomUUID(),
    sessionId: existing?.sessionId || text(input.sessionId, 100),
    targetType: existing?.targetType || (input.targetType === 'follow-up' ? 'follow-up' : 'analysis'),
    targetId: existing?.targetId || targetId,
    sentiment,
    reasons: sentiment === 'problematic' && Array.isArray(input.reasons)
      ? [...new Set(input.reasons.filter((reason) => REASONS.has(reason)))].slice(0, 8)
      : [],
    note: text(input.note, 1000),
    technical: sanitizeTechnical(input.technical),
    contentOptIn,
    ...(contentOptIn && input.content ? { content: { question: text(input.content.question, 5000), answer: text(input.content.answer, 30000) } } : {}),
    uploadStatus: 'local',
    deletionCredential: existing?.deletionCredential || crypto.randomBytes(24).toString('base64url'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function uploadPayload(record) {
  return {
    feedbackId: record.feedbackId,
    targetType: record.targetType,
    targetId: record.targetId,
    sentiment: record.sentiment,
    reasons: record.reasons,
    note: record.note,
    technical: record.technical,
    contentOptIn: record.contentOptIn,
    ...(record.contentOptIn ? { content: record.content } : {}),
    deletionCredential: record.deletionCredential,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

class FeedbackService {
  constructor({ store, endpoint, fetchImpl = fetch }) {
    this.store = store;
    this.endpoint = String(endpoint || '').replace(/\/$/, '');
    this.fetch = fetchImpl;
  }

  getState() {
    return this.store.getFeedbackState();
  }

  #saveRecord(record) {
    const state = this.getState();
    state.records = [record, ...state.records.filter((item) => item.feedbackId !== record.feedbackId)];
    this.store.saveFeedbackState(state);
    return structuredClone(record);
  }

  async #send(record) {
    const pending = { ...record, uploadStatus: 'pending', lastError: undefined };
    this.#saveRecord(pending);
    try {
      if (!this.endpoint) throw new Error('反馈服务地址尚未配置');
      const response = await this.fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(uploadPayload(pending)),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`上传返回 ${response.status}`);
      return { ...pending, uploadStatus: 'sent' };
    } catch (error) {
      return { ...pending, uploadStatus: 'failed', lastError: error instanceof Error ? error.message : '上传失败' };
    }
  }

  async submit(input) {
    const state = this.getState();
    const existing = state.records.find((item) => item.feedbackId === input?.feedbackId || (item.targetType === input?.targetType && item.targetId === input?.targetId));
    let record = sanitizeSubmission(input, existing);
    this.#saveRecord(record);
    if (state.consent.technicalUpload) record = await this.#send(record);
    return this.#saveRecord(record);
  }

  async setConsent(enabled) {
    const state = this.getState();
    const now = new Date().toISOString();
    state.consent = enabled
      ? { technicalUpload: true, decidedAt: now }
      : { technicalUpload: false, decidedAt: state.consent.decidedAt || now, revokedAt: now };
    this.store.saveFeedbackState(state);
    if (enabled) return this.retry();
    return this.getState();
  }

  async retry(feedbackId) {
    let state = this.getState();
    if (!state.consent.technicalUpload) return state;
    const targets = state.records.filter((item) => (!feedbackId || item.feedbackId === feedbackId) && ['local', 'pending', 'failed'].includes(item.uploadStatus));
    for (const target of targets) this.#saveRecord(await this.#send(target));
    state = this.getState();
    return state;
  }

  cancel(feedbackId) {
    const record = this.getState().records.find((item) => item.feedbackId === feedbackId);
    if (!record) throw new Error('反馈不存在');
    if (record.uploadStatus === 'sent') throw new Error('已发送反馈需要撤回，不能取消队列');
    return this.#saveRecord({ ...record, uploadStatus: 'cancelled', updatedAt: new Date().toISOString() });
  }

  async delete(feedbackId) {
    const state = this.getState();
    const record = state.records.find((item) => item.feedbackId === feedbackId);
    if (!record) return true;
    if (record.uploadStatus === 'sent' || record.uploadStatus === 'withdrawal-pending') {
      try {
        const response = await this.fetch(`${this.endpoint}/${encodeURIComponent(feedbackId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${record.deletionCredential}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok && response.status !== 404) throw new Error(`删除返回 ${response.status}`);
      } catch (error) {
        this.#saveRecord({ ...record, uploadStatus: 'withdrawal-pending', lastError: error instanceof Error ? error.message : '撤回失败' });
        return false;
      }
    }
    state.records = state.records.filter((item) => item.feedbackId !== feedbackId);
    this.store.saveFeedbackState(state);
    return true;
  }
}

module.exports = { FeedbackService, sanitizeSubmission, sanitizeTechnical };
