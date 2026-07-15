import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildPlate } from '../lib/divination';
import type { EvidenceEntry } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import { ResultScreen } from './ResultScreen';

const castAt = new Date('2026-07-13T08:00:00.000Z');

const session: DivinationSession = {
  id: 'session-1',
  question: '问事业发展',
  category: 'career',
  castAt: castAt.toISOString(),
  updatedAt: castAt.toISOString(),
  status: 'complete',
  tosses: [],
  plate: buildPlate([7, 8, 7, 8, 7, 8], castAt),
  messages: [],
};

const evidence: EvidenceEntry[] = [
  {
    id: 'evidence-1',
    title: '占功名章',
    source: '火珠林',
    location: '卷一',
    text: '完整古籍内容一。',
    tags: ['事业'],
    sourceType: 'original',
    knowledgeKind: 'rule',
  },
  {
    id: 'evidence-2',
    title: '用神章',
    source: '增删卜易',
    location: '卷二',
    text: '完整古籍内容二。',
    tags: ['用神'],
    sourceType: 'original',
    knowledgeKind: 'doctrine',
  },
];

function renderResult(
  targetSession: DivinationSession = session,
  { analyzing = false, onAnalyze = vi.fn() }: { analyzing?: boolean; onAnalyze?: () => void } = {},
) {
  const view = render(
    <ResultScreen
      session={targetSession}
      evidence={evidence}
      retrievalDiagnostics={null}
      analyzing={analyzing}
      analysisError=""
      analysisSaveStatus={targetSession.analysis ? 'saved' : 'idle'}
      analysisSaveError=""
      chatting={false}
      onAnalyze={onAnalyze}
      onRetryAnalysisSave={vi.fn()}
      onFollowUp={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  return { ...view, onAnalyze };
}

describe('ResultScreen Markdown 解读', () => {
  it('keeps the evidence section visible while expanding each source independently', () => {
    const { container } = renderResult();
    const evidenceDisclosures = Array.from(container.querySelectorAll<HTMLDetailsElement>('details.evidence-entry'));
    const [firstEvidence, secondEvidence] = evidenceDisclosures;

    expect(evidenceDisclosures).toHaveLength(2);
    expect(screen.getByText('命中 2 条依据，涉及 2 个古籍来源')).toBeVisible();
    expect(firstEvidence).not.toHaveAttribute('open');
    expect(secondEvidence).not.toHaveAttribute('open');

    fireEvent.click(within(firstEvidence).getByText('展开原文'));

    expect(firstEvidence).toHaveAttribute('open');
    expect(secondEvidence).not.toHaveAttribute('open');
    expect(firstEvidence.querySelector('.evidence-full-text')).toBeVisible();
  });

  it('renders the cloud report as GFM without requiring fixed sections or claim cards', () => {
    const markdownSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: `## 趋势判断

当前宜稳步推进，但不宜把短期变化当成最终结果。

> **依据：** 本卦${session.plate!.baseHexagram.name}，本卦无动爻，日辰为${session.plate!.dayGanZhi}。
>
> **古籍来源：** [《火珠林》·卷一](#evidence-evidence-1)

| 观察项 | 结论 |
| --- | --- |
| 动静 | 静卦 |
`,
        generatedAt: castAt.toISOString(),
      },
    };
    const { container } = renderResult(markdownSession);
    const citedEvidence = container.querySelector<HTMLDetailsElement>('#evidence-evidence-1');
    const otherEvidence = container.querySelector<HTMLDetailsElement>('#evidence-evidence-2');

    expect(screen.getByRole('heading', { name: '趋势判断' })).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(container.querySelector('.claim')).toBeNull();
    expect(screen.queryByRole('heading', { name: '逐条判断' })).not.toBeInTheDocument();
    expect(citedEvidence).not.toHaveAttribute('open');

    fireEvent.click(screen.getByRole('link', { name: '《火珠林》·卷一' }));

    expect(citedEvidence).toHaveAttribute('open');
    expect(otherEvidence).not.toHaveAttribute('open');
  });

  it('renders a non-empty AI response even when it has no Markdown headings', () => {
    const plainTextSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: '先说结论：这次可以继续推进。\n\n这里没有编号章节，也没有引用标签。',
        generatedAt: castAt.toISOString(),
      },
    };

    renderResult(plainTextSession);

    expect(screen.getByText('先说结论：这次可以继续推进。')).toBeVisible();
    expect(screen.getByText('这里没有编号章节，也没有引用标签。')).toBeVisible();
    expect(screen.queryByText('AI 分析暂时失败')).not.toBeInTheDocument();
  });

  it('lets the user reanalyze an existing report from the AI interpretation heading', () => {
    const markdownSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: '## 主报告\n\n已有解读。',
        generatedAt: castAt.toISOString(),
      },
    };
    const onAnalyze = vi.fn();

    renderResult(markdownSession, { onAnalyze });
    fireEvent.click(screen.getByRole('button', { name: '重新解析' }));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('disables reanalysis while the current report is being regenerated', () => {
    const markdownSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: '## 主报告\n\n已有解读。',
        generatedAt: castAt.toISOString(),
      },
    };
    const onAnalyze = vi.fn();

    renderResult(markdownSession, { analyzing: true, onAnalyze });
    const reanalyzeButton = screen.getByRole('button', { name: '解析中' });

    expect(reanalyzeButton).toBeDisabled();
    fireEvent.click(reanalyzeButton);
    expect(onAnalyze).not.toHaveBeenCalled();
  });

  it('renders follow-up Markdown and rejects legacy structured messages', () => {
    const followUpSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: '## 主报告\n\n主报告正文。\n\n> **依据：** 当前排盘事实。',
        generatedAt: castAt.toISOString(),
      },
      messages: [
        {
          id: 'user-1',
          role: 'user',
          content: '什么时候有变化？',
          createdAt: castAt.toISOString(),
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          kind: 'markdown-answer',
          content: '### 应期\n\n目前不足以定具体日期。\n\n> **依据：** 原卦无动爻，触发信息不足。',
          createdAt: castAt.toISOString(),
        },
        {
          id: 'legacy-assistant',
          role: 'assistant',
          content: '旧结构回答不显示。',
          createdAt: castAt.toISOString(),
        },
      ],
    };

    renderResult(followUpSession);

    const followUpRegion = screen.getByRole('region', { name: '继续追问' });
    expect(within(followUpRegion).getByRole('article', { name: '你的追问' })).toBeVisible();
    expect(within(followUpRegion).getAllByRole('article', { name: '问爻回复' })).toHaveLength(2);
    expect(within(followUpRegion).getByRole('textbox', { name: '你的追问' })).toHaveAttribute('aria-describedby', 'follow-up-hint');
    expect(screen.getByRole('heading', { name: '应期' })).toBeVisible();
    expect(screen.getByText('目前不足以定具体日期。')).toBeVisible();
    expect(screen.queryByText('旧结构回答不显示。')).not.toBeInTheDocument();
    expect(screen.getByText('这条历史追问不是当前 Markdown 格式，已停止展示。')).toBeVisible();
  });

  it('asks for reanalysis when a saved report still uses the removed structured contract', () => {
    const legacySession = {
      ...session,
      analysis: {
        mode: 'cloud',
        summary: '旧版总断',
        claims: [],
        generatedAt: castAt.toISOString(),
      },
    } as unknown as DivinationSession;

    renderResult(legacySession);

    expect(screen.getByText('这份历史解读不是当前 Markdown 格式')).toBeVisible();
    expect(screen.getByRole('button', { name: '重新分析' })).toBeVisible();
    expect(screen.queryByText('旧版总断')).not.toBeInTheDocument();
  });
});
