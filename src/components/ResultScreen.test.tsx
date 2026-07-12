import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildPlate } from '../lib/divination';
import type { DivinationSession } from '../lib/session';
import type { ValidatedAnalysisBundleV2 } from '../lib/types';
import { ResultScreen } from './ResultScreen';

const sections = ['summary', 'use-god', 'calendar', 'moving', 'synthesis', 'guidance'] as const;

function session(): DivinationSession {
  const validatedAt = '2026-07-12T04:00:00.000Z';
  const caseHash = 'a'.repeat(64);
  const analysisBundle: ValidatedAnalysisBundleV2 = {
    schemaVersion: '2.0.0', caseHash, analysisOrigin: 'local',
    report: {
      schemaVersion: '2.0.0', caseHash,
      claims: sections.map((section, index) => ({
        id: `claim-${index}`, section, text: `${section} 判断`,
        factIds: [`fact:${section}`], ruleIds: [`rule:${section}`],
        evidenceIds: section === 'summary' ? ['E1'] : [], confidence: section === 'guidance' ? 'low' : 'high',
      })),
      uncertainties: ['仍需结合现实情况核验。'],
      validation: { status: 'validated', factCheckPassed: true, citationCheckPassed: true, validatedAt },
    },
    canonicalEvidence: [{
      id: 'E1', title: '规则原文', source: '卜筮正宗', sourceType: 'original',
      location: '卷一', text: '原文证据', contentHash: 'b'.repeat(64), tags: [],
      knowledgeKind: 'rule', topics: [], supportsRuleIds: ['rule:summary'],
    }],
    retrievalDiagnostics: {
      mode: 'lexical-fallback', lexicalCandidates: 1, vectorCandidates: 0,
      fusedCandidates: 1, vectorUsed: false, rerankUsed: false,
      requestedRuleIds: ['rule:summary'], matchedRuleIds: ['rule:summary'],
      ruleCandidateIds: ['E1'], ruleBoost: 12, warnings: ['浏览器预览'],
    },
    corpusRef: { version: 2, hash: 'c'.repeat(64) },
  };
  return {
    id: 's1', question: '事业如何', category: 'career',
    castAt: '2026-07-12T00:00:00.000Z', updatedAt: validatedAt,
    status: 'complete', tosses: [], messages: [],
    plate: buildPlate([7, 7, 7, 7, 7, 7], new Date('2026-07-12T00:00:00.000Z')),
    caseRuntimeTrust: 'browser-preview', analysisBundle,
  };
}

const callbacks = { onAnalyze: vi.fn(), onFollowUp: vi.fn(), onBack: vi.fn() };

describe('Task10 V2 过渡结果页', () => {
  it('按六个 section 展示 bundle、preview 信任边界及逐 claim 引用', () => {
    render(<ResultScreen session={session()} analyzing={false} analysisError="" chatting={false} {...callbacks} />);
    expect(screen.getAllByText(/浏览器预览/)[0]).toBeVisible();
    expect(screen.getByText(/当前 Case 引用\/词元已校验/)).toBeVisible();
    for (const title of ['卦象总览', '用神取用', '日月时令', '动爻与变卦', '综合判断', '行动建议']) {
      expect(screen.getByRole('heading', { name: title })).toBeVisible();
    }
    fireEvent.click(screen.getAllByText('引用详情')[0]);
    expect(screen.getByText('fact:summary')).toBeVisible();
    expect(screen.getByText('rule:summary')).toBeVisible();
    expect(screen.getByText('E1')).toBeVisible();
    expect(screen.getByText('规则原文')).toBeVisible();
  });

  it('只有 legacy analysis 时明确标记未验证且字段缺失不崩溃', () => {
    const legacy = session();
    delete legacy.analysisBundle;
    legacy.analysis = { mode: 'local', summary: '旧报告' } as never;
    render(<ResultScreen session={legacy} analyzing={false} analysisError="" chatting={false} {...callbacks} />);
    expect(screen.getByText(/旧版历史解读·未验证/)).toBeVisible();
    expect(screen.queryByText(/当前 Case 引用\/词元已校验/)).not.toBeInTheDocument();
    expect(screen.getByText('旧报告')).toBeVisible();
  });
});
