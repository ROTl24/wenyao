import type { AnalysisEvidenceSnapshot, AnalysisReport } from './types';

export const FEEDBACK_REASONS = [
  '问非所答',
  '盘面事实有误',
  '引用依据不相关',
  '结论前后矛盾',
  '说得太模糊',
  '内容难以理解',
  '与后来实际情况不符',
  '其他问题',
] as const;

export type FeedbackReason = typeof FEEDBACK_REASONS[number];
export type FeedbackSentiment = 'helpful' | 'problematic';
export type FeedbackRetrievalMode = 'full-hybrid' | 'bm25-reranked' | 'rrf-fallback' | 'bm25-fallback';
export type FeedbackUploadStatus = 'local' | 'pending' | 'sent' | 'failed' | 'cancelled' | 'withdrawal-pending';

export interface FeedbackTechnicalSnapshot {
  appVersion: string;
  corpusVersion: string;
  category: string;
  modelIds: Partial<Record<'generation' | 'embedding' | 'rerank', string>>;
  retrievalMode: FeedbackRetrievalMode;
  stages: AnalysisEvidenceSnapshot['retrieval']['stages'];
  candidateRankings: AnalysisEvidenceSnapshot['retrieval']['rankings'];
  finalEvidenceIds: string[];
}

export interface FeedbackContent {
  question: string;
  answer: string;
}

export interface FeedbackRecord {
  feedbackId: string;
  sessionId: string;
  targetType: 'analysis' | 'follow-up';
  targetId: string;
  sentiment: FeedbackSentiment;
  reasons: FeedbackReason[];
  note: string;
  technical: FeedbackTechnicalSnapshot;
  contentOptIn: boolean;
  content?: FeedbackContent;
  uploadStatus: FeedbackUploadStatus;
  deletionCredential: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackConsent {
  technicalUpload: boolean | null;
  decidedAt?: string;
  revokedAt?: string;
}

export interface FeedbackState {
  consent: FeedbackConsent;
  records: FeedbackRecord[];
}

export interface FeedbackSubmission {
  feedbackId?: string;
  sessionId: string;
  targetType: FeedbackRecord['targetType'];
  targetId: string;
  sentiment: FeedbackSentiment;
  reasons?: FeedbackReason[];
  note?: string;
  technical: FeedbackTechnicalSnapshot;
  contentOptIn?: boolean;
  content?: FeedbackContent;
}

export interface FeedbackApi {
  getState(): Promise<FeedbackState>;
  submit(input: FeedbackSubmission): Promise<FeedbackRecord>;
  setConsent(enabled: boolean): Promise<FeedbackState>;
  retry(feedbackId?: string): Promise<FeedbackState>;
  cancel(feedbackId: string): Promise<FeedbackRecord>;
  delete(feedbackId: string): Promise<boolean>;
}

export function technicalSnapshot(
  report: AnalysisReport,
  evidenceSnapshot: AnalysisEvidenceSnapshot,
): FeedbackTechnicalSnapshot {
  const retrievalMode: FeedbackRetrievalMode = evidenceSnapshot.retrieval.vectorUsed
    ? evidenceSnapshot.retrieval.rerankUsed ? 'full-hybrid' : 'rrf-fallback'
    : evidenceSnapshot.retrieval.rerankUsed ? 'bm25-reranked' : 'bm25-fallback';
  return {
    appVersion: evidenceSnapshot.appVersion,
    corpusVersion: evidenceSnapshot.corpusVersion,
    category: evidenceSnapshot.category,
    modelIds: Object.fromEntries(Object.entries(report.provider || {}).map(([capability, provider]) => [capability, provider.model])),
    retrievalMode,
    stages: evidenceSnapshot.retrieval.stages,
    candidateRankings: evidenceSnapshot.retrieval.rankings,
    finalEvidenceIds: evidenceSnapshot.evidence.map((item) => item.id),
  };
}

const STORAGE_KEY = 'wenyao-feedback-v1';

function emptyState(): FeedbackState {
  return { consent: { technicalUpload: null }, records: [] };
}

function browserState(): FeedbackState {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as FeedbackState | null;
    if (value && Array.isArray(value.records) && value.consent) return value;
  } catch {
    // Corrupt feedback storage is isolated from divination sessions.
  }
  return emptyState();
}

function writeBrowserState(state: FeedbackState): FeedbackState {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return structuredClone(state);
}

function randomCredential(): string {
  const values = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...values)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function uploadPayload(record: FeedbackRecord) {
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

export function createBrowserFeedbackApi(endpoint: string): FeedbackApi {
  const send = async (record: FeedbackRecord): Promise<FeedbackRecord> => {
    const pending = { ...record, uploadStatus: 'pending' as const, lastError: undefined };
    const state = browserState();
    state.records = state.records.map((item) => item.feedbackId === pending.feedbackId ? pending : item);
    writeBrowserState(state);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(uploadPayload(pending)),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`上传返回 ${response.status}`);
      return { ...pending, uploadStatus: 'sent' };
    } catch (error) {
      return { ...pending, uploadStatus: 'failed', lastError: error instanceof Error ? error.message : '上传失败' };
    }
  };

  const persistRecord = (record: FeedbackRecord): FeedbackRecord => {
    const state = browserState();
    state.records = [record, ...state.records.filter((item) => item.feedbackId !== record.feedbackId)];
    writeBrowserState(state);
    return structuredClone(record);
  };

  const api: FeedbackApi = {
    async getState() { return structuredClone(browserState()); },
    async submit(input) {
      const state = browserState();
      const existing = state.records.find((item) => item.feedbackId === input.feedbackId || (item.targetType === input.targetType && item.targetId === input.targetId));
      const now = new Date().toISOString();
      let record: FeedbackRecord = {
        feedbackId: existing?.feedbackId || input.feedbackId || crypto.randomUUID(),
        sessionId: existing?.sessionId || input.sessionId,
        targetType: existing?.targetType || input.targetType,
        targetId: existing?.targetId || input.targetId,
        sentiment: input.sentiment,
        reasons: input.sentiment === 'problematic' ? [...(input.reasons || [])] : [],
        note: String(input.note || '').slice(0, 1000),
        technical: structuredClone(input.technical),
        contentOptIn: Boolean(input.contentOptIn),
        ...(input.contentOptIn && input.content ? { content: structuredClone(input.content) } : {}),
        uploadStatus: state.consent.technicalUpload ? 'pending' : 'local',
        deletionCredential: existing?.deletionCredential || randomCredential(),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      persistRecord(record);
      if (state.consent.technicalUpload) record = await send(record);
      return persistRecord(record);
    },
    async setConsent(enabled) {
      const state = browserState();
      state.consent = enabled
        ? { technicalUpload: true, decidedAt: new Date().toISOString() }
        : { technicalUpload: false, decidedAt: state.consent.decidedAt || new Date().toISOString(), revokedAt: new Date().toISOString() };
      writeBrowserState(state);
      if (enabled) return api.retry();
      return structuredClone(state);
    },
    async retry(feedbackId) {
      let state = browserState();
      if (!state.consent.technicalUpload) return structuredClone(state);
      const targets = state.records.filter((item) => (!feedbackId || item.feedbackId === feedbackId) && ['local', 'pending', 'failed'].includes(item.uploadStatus));
      for (const target of targets) persistRecord(await send(target));
      state = browserState();
      return structuredClone(state);
    },
    async cancel(feedbackId) {
      const state = browserState();
      const record = state.records.find((item) => item.feedbackId === feedbackId);
      if (!record) throw new Error('反馈不存在');
      const cancelled = { ...record, uploadStatus: 'cancelled' as const, updatedAt: new Date().toISOString() };
      return persistRecord(cancelled);
    },
    async delete(feedbackId) {
      const state = browserState();
      const record = state.records.find((item) => item.feedbackId === feedbackId);
      if (!record) return true;
      if (record.uploadStatus === 'sent' || record.uploadStatus === 'withdrawal-pending') {
        try {
          const response = await fetch(`${endpoint}/${encodeURIComponent(feedbackId)}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${record.deletionCredential}` },
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok && response.status !== 404) throw new Error(`删除返回 ${response.status}`);
        } catch (error) {
          persistRecord({ ...record, uploadStatus: 'withdrawal-pending', lastError: error instanceof Error ? error.message : '撤回失败' });
          return false;
        }
      }
      state.records = state.records.filter((item) => item.feedbackId !== feedbackId);
      writeBrowserState(state);
      return true;
    },
  };
  return api;
}
