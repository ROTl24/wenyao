import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { desktop } from '../lib/desktop';
import type { AnalysisEvidenceSnapshot, AnalysisReport } from '../lib/types';
import { FeedbackControl } from './FeedbackControl';

const snapshot: AnalysisEvidenceSnapshot = {
  capturedAt: '2026-08-24T00:00:00.000Z', appVersion: '0.5.1', corpusVersion: 'corpus-1', category: 'career',
  evidence: [{ id: 'E1', title: '事业', source: '易隐', location: '卷一', text: '官鬼为用。', tags: ['官鬼'], sourceType: 'original' }],
  retrieval: {
    mode: 'hybrid-reranked', lexicalCandidates: 40, vectorCandidates: 40, fusedCandidates: 30,
    rerankedCandidates: 16, selectedCandidates: 1, serializedCharacters: 10, vectorUsed: true, rerankUsed: true,
    stages: ['BM25 召回 40'], warnings: [], rankings: { bm25: [], vector: [], fusion: [], rerank: [], final: [{ id: 'E1', rank: 1, score: 0.9 }] },
  },
};
const report: AnalysisReport = {
  mode: 'cloud', analysisId: 'analysis-1', markdown: '回答', generatedAt: '2026-08-24T00:00:00.000Z', evidenceSnapshot: snapshot,
  provider: {
    generation: { providerId: 'provider', connectionLabel: '不得上传的连接名', model: 'chat-model' },
    embedding: { providerId: 'provider', connectionLabel: '不得上传的连接名', model: 'embed-model' },
    rerank: { providerId: 'provider', connectionLabel: '不得上传的连接名', model: 'rerank-model' },
  },
};

describe('解读反馈', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('saves problem reasons locally before asking for technical upload consent', async () => {
    const records: any[] = [];
    vi.spyOn(desktop.feedback, 'getState').mockImplementation(async () => ({ consent: { technicalUpload: null }, records: structuredClone(records) }));
    const submit = vi.spyOn(desktop.feedback, 'submit').mockImplementation(async (input) => {
      const record = { ...input, feedbackId: 'feedback-1', deletionCredential: 'credential', uploadStatus: 'local', createdAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z', reasons: input.reasons || [], note: input.note || '', contentOptIn: Boolean(input.contentOptIn) } as any;
      records.push(record);
      return record;
    });

    render(<FeedbackControl sessionId="session-1" targetType="analysis" targetId="analysis-1" report={report} snapshot={snapshot} question="会升职吗" answer="回答" />);
    fireEvent.click(await screen.findByRole('button', { name: /有问题/ }));
    fireEvent.click(screen.getByLabelText('问非所答'));
    fireEvent.change(screen.getByLabelText('补充说明（选填）'), { target: { value: '没有回答问题' } });
    fireEvent.click(screen.getByRole('button', { name: '保存反馈' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toMatchObject({ sentiment: 'problematic', reasons: ['问非所答'], contentOptIn: false });
    expect(submit.mock.calls[0][0].technical.modelIds).toEqual({ generation: 'chat-model', embedding: 'embed-model', rerank: 'rerank-model' });
    expect(submit.mock.calls[0][0].technical.retrievalMode).toBe('full-hybrid');
    expect(await screen.findByRole('dialog', { name: '反馈上传授权' })).toBeVisible();
  });
});
