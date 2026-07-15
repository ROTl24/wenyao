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
  {
    analyzing = false,
    onAnalyze = vi.fn(),
    targetEvidence = evidence,
    analysisSaveStatus = targetSession.analysis ? 'saved' : 'idle',
    analysisSaveError = '',
    onRetryAnalysisSave = vi.fn(),
  }: {
    analyzing?: boolean;
    onAnalyze?: () => void;
    targetEvidence?: EvidenceEntry[];
    analysisSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    analysisSaveError?: string;
    onRetryAnalysisSave?: () => void;
  } = {},
) {
  const view = render(
    <ResultScreen
      session={targetSession}
      evidence={targetEvidence}
      retrievalDiagnostics={null}
      analyzing={analyzing}
      analysisError=""
      analysisSaveStatus={analysisSaveStatus}
      analysisSaveError={analysisSaveError}
      chatting={false}
      onAnalyze={onAnalyze}
      onRetryAnalysisSave={onRetryAnalysisSave}
      onFollowUp={vi.fn()}
      onBack={vi.fn()}
    />,
  );
  return { ...view, onAnalyze, onRetryAnalysisSave };
}

describe('ResultScreen Markdown 解读', () => {
  it('presents a static cast as a single-hexagram opening and keeps analysis, plate and evidence in reading order', () => {
    const { container } = renderResult();
    const opening = screen.getByRole('banner', { name: '成卦卷首' });
    const workspace = container.querySelector('.result-workspace');

    expect(opening).toHaveAttribute('data-state', 'static');
    expect(screen.getByRole('heading', { level: 1, name: '问事业发展' })).toBeVisible();
    expect(within(opening).getByText('静卦')).toBeVisible();
    expect(within(opening).queryByText(/^变卦/)).not.toBeInTheDocument();
    expect(Array.from(workspace?.children || []).map((element) => element.classList[0])).toEqual([
      'analysis-column',
      'plate-column',
      'evidence-rail',
      'result-spine',
    ]);
  });

  it('shows the changed hexagram and cinnabar moving line for a moving cast', () => {
    const movingSession: DivinationSession = {
      ...session,
      plate: buildPlate([6, 8, 7, 8, 7, 8], castAt),
    };

    renderResult(movingSession);
    const opening = screen.getByRole('banner', { name: '成卦卷首' });

    expect(opening).toHaveAttribute('data-state', 'moving');
    expect(within(opening).getByLabelText(/^变卦/)).toBeVisible();
    expect(opening.querySelectorAll('.hex-line--moving')).toHaveLength(1);
  });

  it('presents twelve stages and shen sha as concrete 六爻 line facts instead of Bazi pillar decorations', () => {
    const movingSession: DivinationSession = {
      ...session,
      plate: buildPlate([6, 7, 8, 9, 7, 8], new Date('2026-07-11T12:00:00+08:00')),
    };

    renderResult(movingSession);

    const calendar = screen.getByLabelText('四柱历法');
    expect(within(calendar).queryByText('十二长生')).not.toBeInTheDocument();
    expect(screen.getByLabelText('初爻六爻状态')).toHaveTextContent('月令·墓');
    expect(screen.getByLabelText('初爻六爻状态')).toHaveTextContent('日辰·养');
    expect(screen.getByLabelText('二爻六爻状态')).toHaveTextContent('暗动');
    expect(screen.getByLabelText('初爻变爻状态')).toHaveTextContent('化病');
    expect(screen.getByLabelText('四爻变爻状态')).toHaveTextContent('回头生');
    expect(screen.getByLabelText('驿马神煞')).toHaveTextContent('变四爻');
    expect(screen.getByLabelText('桃花神煞')).toHaveTextContent('未入卦');
    expect(screen.getByLabelText('天乙贵人神煞')).toHaveTextContent('本卦四、五爻');
  });

  it('keeps all six base and changed line facts together in each accessible line group', () => {
    const movingSession: DivinationSession = {
      ...session,
      plate: buildPlate([9, 9, 9, 7, 7, 7], new Date('2026-02-13T12:00:00+08:00')),
    };

    renderResult(movingSession);

    const lineGroups = screen.getAllByRole('group', { name: /爻排盘$/ });
    expect(lineGroups).toHaveLength(6);
    for (const [index, group] of lineGroups.entries()) {
      const position = ['上', '五', '四', '三', '二', '初'][index];
      expect(within(group).getByLabelText(`${position}爻六爻状态`)).toBeVisible();
      expect(within(group).getByLabelText(`${position}爻变爻状态`)).toBeVisible();
    }
    expect(screen.getByText('六冲变六合')).toBeVisible();
  });

  it('keeps every evidence source and its full text visible without disclosure controls', () => {
    const { container } = renderResult();
    const evidenceEntries = Array.from(container.querySelectorAll<HTMLElement>('article.evidence-entry'));

    expect(evidenceEntries).toHaveLength(2);
    expect(screen.getByText('命中 2 条依据，涉及 2 个古籍来源')).toBeVisible();
    expect(container.querySelector('details.evidence-entry')).not.toBeInTheDocument();
    expect(within(evidenceEntries[0]).getByText('完整古籍内容一。')).toBeVisible();
    expect(within(evidenceEntries[1]).getByText('完整古籍内容二。')).toBeVisible();
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
    const citedEvidence = container.querySelector<HTMLElement>('#evidence-evidence-1');
    const otherEvidence = container.querySelector<HTMLElement>('#evidence-evidence-2');

    expect(screen.getByRole('heading', { name: '趋势判断' })).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(container.querySelector('.claim')).toBeNull();
    expect(screen.queryByRole('heading', { name: '逐条判断' })).not.toBeInTheDocument();
    expect(citedEvidence).not.toHaveClass('is-citation-target');

    fireEvent.click(screen.getByRole('link', { name: '《火珠林》·卷一' }));

    expect(citedEvidence).toHaveClass('is-citation-target');
    expect(citedEvidence).toHaveFocus();
    expect(otherEvidence).not.toHaveClass('is-citation-target');
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

  it('keeps a generated report visible while offering a save-only retry', () => {
    const markdownSession: DivinationSession = {
      ...session,
      analysis: {
        mode: 'cloud',
        markdown: '## 主报告\n\n解读已经生成。',
        generatedAt: castAt.toISOString(),
      },
    };
    const onRetryAnalysisSave = vi.fn();

    renderResult(markdownSession, {
      analysisSaveStatus: 'error',
      analysisSaveError: '磁盘暂时不可写。',
      onRetryAnalysisSave,
    });

    expect(screen.getByRole('alert')).toHaveTextContent('解读已生成，但自动保存失败');
    expect(screen.getByText('解读已经生成。')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));
    expect(onRetryAnalysisSave).toHaveBeenCalledTimes(1);
  });

  it('states clearly when no traceable evidence is available', () => {
    renderResult(session, { targetEvidence: [] });

    expect(screen.getByText('当前知识库没有找到足够证据，因此不会编造古籍引用。')).toBeVisible();
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
