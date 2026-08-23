import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBrowserFeedbackApi, type FeedbackSubmission } from './feedback';

const submission: FeedbackSubmission = {
  sessionId: 'session-1',
  targetType: 'analysis',
  targetId: 'analysis-1',
  sentiment: 'helpful',
  technical: {
    appVersion: '0.5.1',
    corpusVersion: 'corpus-1',
    category: 'career',
    modelIds: { generation: 'chat-model' },
    retrievalMode: 'bm25-fallback',
    stages: ['BM25 召回 40'],
    candidateRankings: { bm25: [], vector: [], fusion: [], rerank: [], final: [] },
    finalEvidenceIds: ['E1'],
  },
};

describe('浏览器反馈队列', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps feedback local until consent and retries a failed withdrawal with the same credential', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const api = createBrowserFeedbackApi('https://feedback.example/api/feedback');

    const local = await api.submit(submission);
    expect(local.uploadStatus).toBe('local');
    expect(fetchMock).not.toHaveBeenCalled();

    const sent = await api.setConsent(true);
    expect(sent.records[0].uploadStatus).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    expect(await api.delete(local.feedbackId)).toBe(false);
    const pending = await api.getState();
    expect(pending.records[0].uploadStatus).toBe('withdrawal-pending');
    const credential = pending.records[0].deletionCredential;

    expect(await api.delete(local.feedbackId)).toBe(true);
    expect((await api.getState()).records).toEqual([]);
    expect(fetchMock.mock.calls[1][1].headers.authorization).toBe(`Bearer ${credential}`);
    expect(fetchMock.mock.calls[2][1].headers.authorization).toBe(`Bearer ${credential}`);
  });
});
