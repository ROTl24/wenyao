import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { desktop } from './lib/desktop';
import { buildPlate, createTossFromValue } from './lib/divination';
import type { EvidenceEntry, RetrievalDiagnostics } from './lib/retrieval';
import type { DivinationSession } from './lib/session';
import type { AIConfigStatus } from './types/desktop';

const readyAIStatus: AIConfigStatus = {
  status: 'ready',
  message: 'AI 服务已就绪',
  activeCapabilities: {
    generation: { connectionId: 'test', providerId: 'test', label: '测试服务', model: 'chat-test' },
    embedding: { connectionId: 'test', providerId: 'test', label: '测试服务', model: 'embedding-test' },
    rerank: { connectionId: 'test', providerId: 'test', label: '测试服务', model: 'rerank-test' },
  },
  activeFingerprint: 'test-index',
  corpusCount: 2,
  consentAcceptedAt: new Date('2026-07-14T08:00:00.000Z').toISOString(),
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};

function completedHistorySession(question: string): DivinationSession {
  const castAt = new Date('2026-07-14T08:00:00.000Z');
  const values = [7, 8, 7, 8, 7, 8] as const;
  return {
    schemaVersion: 2,
    id: 'saved-session',
    question,
    category: 'career',
    castingMethod: 'digital',
    castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1' },
    castAt: castAt.toISOString(),
    updatedAt: castAt.toISOString(),
    status: 'complete',
    lines: values.map((value, index) => ({
      id: `saved-line-${index + 1}`,
      lineIndex: index + 1,
      value,
      recordedAt: castAt.toISOString(),
      coin: {
        faces: createTossFromValue(value).faces,
        visualSeed: `seed-${index + 1}`,
      },
    })),
    plate: buildPlate(values, castAt),
    messages: [],
  };
}

function reachPhysicalReview(question = '线下事业如何发展') {
  fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: question } });
  fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
  fireEvent.click(screen.getByRole('button', { name: /线下起卦/ }));
  fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

  for (let index = 0; index < 6; index += 1) {
    fireEvent.click(screen.getByRole('button', { name: /三字，老阴 6/ }));
    fireEvent.click(screen.getByRole('button', { name: '定此爻' }));
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
  desktop.runtime = {
    kind: 'electron',
    platform: 'win32',
    arch: 'x64',
    isPackaged: true,
    updateMode: 'native',
    secureStorage: 'dpapi',
    capabilities: {
      ai: true,
      corpusImport: true,
    },
  };
  vi.spyOn(desktop.aiConfig, 'getStatus').mockResolvedValue(structuredClone(readyAIStatus));
  localStorage.clear();
  Object.defineProperty(window, 'wenyao', { value: undefined, configurable: true });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    configurable: true,
  });
});

afterEach(() => {
  desktop.runtime = {
    kind: 'web',
    platform: 'browser',
    arch: 'web',
    isPackaged: false,
    updateMode: 'none',
    secureStorage: 'memory',
    capabilities: {
      ai: false,
      corpusImport: false,
    },
  };
});

describe('问爻桌面体验', () => {
  it('keeps a saved outcome review when an already running analysis finishes later', async () => {
    const original = completedHistorySession('复盘不会被稍后完成的解读覆盖');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([original]));
    let finish: (value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void = () => {};
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText(original.question)).closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '开始解读' }));
    await waitFor(() => expect(desktop.ai.analyze).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: `复盘：${original.question}` }));
    fireEvent.change(screen.getByRole('combobox', { name: '验证状态' }), { target: { value: 'happened' } });
    fireEvent.change(screen.getByRole('textbox', { name: '实际结果与个人备注' }), { target: { value: '实际进展已记录。' } });
    fireEvent.click(screen.getByRole('button', { name: '保存复盘' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '占后复盘' })).not.toBeInTheDocument());
    await act(async () => finish({ ok: true, report: { mode: 'cloud', markdown: '## 9. 综合结论\n\n条件仍需确认。', generatedAt: new Date().toISOString() } }));
    await waitFor(async () => expect((await desktop.sessions.get(original.id))?.analysis?.markdown).toContain('条件仍需确认'));
    expect((await desktop.sessions.get(original.id))?.review).toMatchObject({ status: 'happened', note: '实际进展已记录。' });
  });
  it('accepts a three-character question then enters the first casting line', async () => {
    render(<App />);
    const start = screen.getByRole('button', { name: '开始起卦' });
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '事业' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '问事业' } });
    fireEvent.click(screen.getByRole('button', { name: /在线起卦/ }));
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(await screen.findByRole('heading', { name: '第一爻' })).toBeVisible();
    expect(screen.getAllByLabelText(/乾隆古币/)).toHaveLength(3);
  });

  it('does not analyze an online cast until the complete session is saved, and can retry that save', async () => {
    let rejectCompleteSave = true;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation(async (next) => {
      if (next.status === 'complete' && rejectCompleteSave) {
        rejectCompleteSave = false;
        throw new Error('磁盘暂时不可写');
      }
      return next;
    });
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '在线事业是否顺利' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    fireEvent.click(screen.getByRole('button', { name: /在线起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

    for (let line = 1; line <= 6; line += 1) {
      expect(await screen.findByRole('heading', { name: `第${['一', '二', '三', '四', '五', '六'][line - 1]}爻` })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: '定此爻' }));
    }

    expect(await screen.findByRole('alert')).toHaveTextContent('本次排盘尚未保存');
    expect(analyze).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const completeSaves = save.mock.calls
      .map(([saved]) => saved)
      .filter((saved) => saved.status === 'complete');
    expect(completeSaves).toHaveLength(2);
    expect(completeSaves[1].id).toBe(completeSaves[0].id);
  });

  it('generates a random cast in one batch and retries the exact same result after a save failure', async () => {
    const save = vi.spyOn(desktop.sessions, 'save')
      .mockRejectedValueOnce(new Error('随机卦保存失败'))
      .mockImplementation(async (next) => next);
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '随机起卦能否顺利完成' } });
    fireEvent.click(screen.getByRole('button', { name: '其他' }));
    fireEvent.click(screen.getByRole('button', { name: /随机起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('随机卦保存失败');
    expect(analyze).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: '第一爻' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const [first, second] = save.mock.calls.map(([saved]) => saved);
    expect(second.id).toBe(first.id);
    expect(second.lines.map((line) => line.id)).toEqual(first.lines.map((line) => line.id));
    expect(second).toMatchObject({
      castingMethod: 'random',
      castingBasis: { kind: 'random', algorithm: 'three_coin_secure_batch_v1' },
      status: 'complete',
    });
    expect(second.lines).toHaveLength(6);
    expect(await screen.findByText('AI 解读')).toBeVisible();
  });

  it('derives a time cast at zi hour, persists its basis and passes that source to AI', async () => {
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation(async (next) => next);
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '时间起卦能否顺利完成' } });
    fireEvent.click(screen.getByRole('button', { name: '其他' }));
    fireEvent.click(screen.getByRole('button', { name: /时间起卦/ }));
    const timeField = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    fireEvent.change(within(timeField).getByLabelText('日期'), { target: { value: '2026-08-03' } });
    fireEvent.change(within(timeField).getByLabelText('时刻'), { target: { value: '23:00' } });
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved.castingMethod).toBe('time');
    expect(saved.lines.map((line) => line.value)).toEqual([7, 8, 8, 7, 8, 9]);
    expect(saved.lines.every((line) => !Object.hasOwn(line, 'coin'))).toBe(true);
    expect(saved.castingBasis).toMatchObject({
      kind: 'time',
      upperTrigramNumber: 3,
      lowerTrigramNumber: 4,
      movingLine: 6,
      calendar: { traditionalDate: '2026-08-04', timeBranch: '子' },
    });
    expect(analyze.mock.calls[0][0]).toMatchObject({
      castingMethod: 'time',
      castingBasis: saved.castingBasis,
    });
    expect(await screen.findByRole('region', { name: '时间起卦依据' })).toHaveTextContent('上卦数 3');
  });

  it('opens calendar, history and settings from the desktop chrome', async () => {
    render(<App />);
    expect(screen.getByRole('region', { name: '作者链接' })).toHaveTextContent('孤独的数字游民');
    fireEvent.click(screen.getByRole('button', { name: '日历' }));
    expect(await screen.findByRole('main', { name: '问爻日历' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    expect(await screen.findByRole('heading', { name: '问爻占簿' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '关闭历史记录' }));
    fireEvent.click(screen.getByRole('button', { name: '应用设置' }));
    expect(await screen.findByRole('heading', { name: '应用设置' })).toBeVisible();
    expect(screen.getByRole('region', { name: '找到作者' })).toHaveTextContent('问爻由「孤独的数字游民」开源制作');
  });

  it('opens Mac settings from the native application menu and links manual updates', async () => {
    desktop.runtime = {
      ...desktop.runtime,
      platform: 'darwin',
      arch: 'arm64',
      updateMode: 'manual',
      secureStorage: 'keychain',
    };
    let openSettings = () => {};
    vi.spyOn(desktop.application, 'onOpenSettings').mockImplementation((listener) => {
      openSettings = listener;
      return () => {};
    });
    const openLink = vi.spyOn(desktop.externalLinks, 'open').mockResolvedValue(true);
    render(<App />);

    act(() => openSettings());
    expect(await screen.findByRole('heading', { name: '应用设置' })).toBeVisible();
    expect(screen.getByText(/macOS 开源版通过 GitHub Releases 手动更新/)).toBeVisible();
    expect(screen.getByText(/macOS 钥匙串保护/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /查看最新版本/ }));
    expect(openLink).toHaveBeenCalledWith('releases');
  });

  it('keeps an in-progress casting intact while consulting the calendar', async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '日历往返不应丢失起卦' } });
    fireEvent.click(screen.getByRole('button', { name: '事业工作' }));
    fireEvent.click(screen.getByRole('button', { name: /在线起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    expect(await screen.findByRole('heading', { name: '第一爻' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '日历' }));
    expect(screen.getByRole('main', { name: '问爻日历' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));

    expect(screen.getByRole('heading', { name: '第一爻' })).toBeVisible();
    expect(screen.getAllByLabelText(/乾隆古币/)).toHaveLength(3);
  });

  it('prompts before downloading an available desktop update and cleans up the subscription', async () => {
    const download = vi.spyOn(desktop.updates, 'download').mockResolvedValue({
      status: 'downloading',
      currentVersion: '0.3.0',
      availableVersion: '0.3.1',
      progress: 0,
    });
    vi.spyOn(desktop.updates, 'getState').mockResolvedValue({
      status: 'available',
      currentVersion: '0.3.0',
      availableVersion: '0.3.1',
    });
    const unsubscribe = vi.fn();
    vi.spyOn(desktop.updates, 'onState').mockReturnValue(unsubscribe);

    const view = render(<App />);
    expect(await screen.findByRole('heading', { name: '发现新版本' })).toBeVisible();
    expect(download).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '下载更新' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('0.0%')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '收起并继续使用' }));
    expect(screen.queryByRole('heading', { name: '下载更新' })).not.toBeInTheDocument();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('opens a completed history record without starting a new AI analysis', async () => {
    const savedSession = completedHistorySession('历史记录是否应保持原样');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    const analyze = vi.spyOn(desktop.ai, 'analyze');
    const retrieve = vi.spyOn(desktop.retrieval, 'search');

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('历史记录是否应保持原样')).closest('button')!);

    expect(await screen.findByText('AI 解读')).toBeVisible();
    expect(screen.getByRole('button', { name: '开始解读' })).toBeVisible();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
  });

  it('shows provider progress while one long analysis request remains in flight', async () => {
    const savedSession = completedHistorySession('长解读需要持续显示进度');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    let reportProgress: Parameters<typeof desktop.ai.analyze>[1];
    vi.spyOn(desktop.ai, 'analyze').mockImplementation((_payload, onProgress) => {
      reportProgress = onProgress;
      return new Promise(() => {});
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('长解读需要持续显示进度')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));

    await waitFor(() => expect(reportProgress).toBeTypeOf('function'));
    expect(screen.getByText(/古籍证据已就绪，正在连接解读模型/)).toBeVisible();

    act(() => reportProgress?.({ stage: 'reasoning' }));
    await waitFor(() => expect(screen.getByText(/模型正在推理/)).toBeVisible());

    act(() => reportProgress?.({ stage: 'writing' }));
    await waitFor(() => expect(screen.getByText(/模型正在生成完整解读/)).toBeVisible());
  });

  it('shows an explicit AI error without creating a local substitute report', async () => {
    const savedSession = completedHistorySession('没有密钥时不生成替代解读');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.ai, 'analyze').mockResolvedValue({
      ok: false,
      error: {
        code: 'AI_NOT_CONFIGURED',
        message: '尚未配置 DeepSeek AI 解读服务。',
        dataSafe: true,
        nextAction: '请先在“设置”中完成配置。',
      },
    });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('没有密钥时不生成替代解读')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('尚未配置 DeepSeek AI 解读服务');
    expect(screen.queryByText('本地基础推演')).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'AI 解读' })).not.toBeInTheDocument();
    const [stored] = JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]') as DivinationSession[];
    expect(stored.analysis).toBeUndefined();
  });

  it('keeps a generated analysis visible and retries only the failed save', async () => {
    const savedSession = completedHistorySession('解读保存失败时怎么办');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockResolvedValue({
      ok: true,
      report: {
        mode: 'cloud',
        markdown: '## 1. 占问主题\n\n云端解读已经生成。',
        generatedAt: new Date().toISOString(),
      },
    });
    const save = vi.spyOn(desktop.sessions, 'save')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (next) => next);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('解读保存失败时怎么办')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));

    expect(await screen.findByRole('heading', { name: '1. 占问主题' })).toBeVisible();
    expect(await screen.findByText('解读已生成，但自动保存失败')).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '重试保存' }));

    expect(await screen.findByText('已自动保存')).toBeVisible();
    expect(save).toHaveBeenCalledTimes(2);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect a deleted session when an older analysis finishes later', async () => {
    const savedSession = completedHistorySession('删除后不得被后台解读恢复');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    let resolveAnalysis: ((value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void) | undefined;
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => (
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
    ));
    const save = vi.spyOn(desktop.sessions, 'save');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('删除后不得被后台解读恢复')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：删除后不得被后台解读恢复' }));
    expect(await screen.findByRole('heading', { name: '心有所问' })).toBeVisible();

    await act(async () => {
      resolveAnalysis?.({
        ok: true,
        report: {
          mode: 'cloud',
          markdown: '## 迟到的解读',
          generatedAt: new Date().toISOString(),
        },
      });
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: '心有所问' })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]')).toEqual([]);
  });

  it('waits for a complete report before allowing a follow-up on the same session', async () => {
    const savedSession = completedHistorySession('主报告完成后再追问');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    let finish: ((value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void) | undefined;
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const follow = vi.spyOn(desktop.ai, 'followUp').mockResolvedValue({ ok: true, answer: { content: '### 追问答复\n\n保留追问结果。' } });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('主报告完成后再追问')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    fireEvent.change(screen.getByRole('textbox', { name: '你的追问' }), { target: { value: '下一步该注意什么？' } });
    expect(screen.getByRole('button', { name: '继续追问' })).toBeDisabled();
    await waitFor(() => expect(finish).toBeTypeOf('function'));
    await act(async () => { finish?.({ ok: true, report: { mode: 'cloud', markdown: '## 主报告\n\n完整正文。', generatedAt: new Date().toISOString() } }); });
    await waitFor(() => expect(screen.getByRole('button', { name: '继续追问' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));
    await waitFor(() => expect(follow).toHaveBeenCalledOnce());
    expect(follow.mock.calls[0][0].session.analysis?.markdown).toContain('完整正文');
    expect(await screen.findByRole('heading', { name: '追问答复' })).toBeVisible();
    const [stored] = JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]');
    expect(stored.analysis.markdown).toContain('主报告');
    expect(stored.messages).toHaveLength(2);
  });

  it('reuses the latest evidence snapshot for clarification and runs full retrieval for a new concern', async () => {
    const savedSession = completedHistorySession('当前工作是否适合继续');
    const snapshotEvidence: EvidenceEntry[] = [
      { id: 'E1', title: '官鬼用神', source: '易隐', location: '卷一', text: '事业占以官鬼为用神。', tags: ['事业', '官鬼'], sourceType: 'original' },
      { id: 'E2', title: '世爻旺衰', source: '增删卜易', location: '卷二', text: '世爻代表占问者自身。', tags: ['世爻'], sourceType: 'original' },
    ];
    const diagnostics: RetrievalDiagnostics = {
      mode: 'hybrid-reranked', lexicalCandidates: 40, vectorCandidates: 40, fusedCandidates: 30,
      rerankedCandidates: 16, selectedCandidates: 2, vectorUsed: true, rerankUsed: true,
      stages: ['BM25 召回 40'], warnings: [], corpusVersion: 'corpus-1',
      rankings: { bm25: [], vector: [], fusion: [], rerank: [], final: snapshotEvidence.map((item, index) => ({ id: item.id, rank: index + 1, score: 1 - index * 0.1 })) },
    };
    savedSession.analysis = {
      mode: 'cloud', analysisId: 'analysis-1', markdown: '## 当前解读\n\n官鬼代表事业。', generatedAt: new Date().toISOString(),
      evidenceSnapshot: { capturedAt: new Date().toISOString(), appVersion: '0.5.1', corpusVersion: 'corpus-1', category: 'career', evidence: snapshotEvidence, retrieval: diagnostics },
    };
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    const newEvidence = [{ ...snapshotEvidence[1], id: 'E3', title: '换工作判断' }];
    const retrieve = vi.spyOn(desktop.retrieval, 'search').mockResolvedValue({ evidence: newEvidence, diagnostics: { ...diagnostics, selectedCandidates: 1 } });
    const follow = vi.spyOn(desktop.ai, 'followUp').mockResolvedValue({ ok: true, answer: { content: '### 追问答复\n\n已回答。' } });

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('当前工作是否适合继续')).closest('button')!);
    const input = await screen.findByRole('textbox', { name: '你的追问' });
    fireEvent.change(input, { target: { value: '你说的官鬼具体是什么意思' } });
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));
    await waitFor(() => expect(follow).toHaveBeenCalledTimes(1));
    expect(retrieve).not.toHaveBeenCalled();
    expect(follow.mock.calls[0][0].evidence[0].id).toBe('E1');

    fireEvent.change(input, { target: { value: '明年换到另一家公司会怎样' } });
    await waitFor(() => expect(screen.getByRole('button', { name: '继续追问' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));
    await waitFor(() => expect(retrieve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(follow).toHaveBeenCalledTimes(2));
    expect(retrieve).toHaveBeenCalledWith(expect.objectContaining({ query: '明年换到另一家公司会怎样' }));
    expect(follow.mock.calls[1][0].evidence[0].id).toBe('E3');
  });

  it('unlocks follow-up and reports the error when its save fails', async () => {
    const savedSession = completedHistorySession('追问失败后仍可继续操作');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.sessions, 'save').mockRejectedValueOnce(new Error('磁盘写入失败'));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('追问失败后仍可继续操作')).closest('button')!);
    const input = await screen.findByRole('textbox', { name: '你的追问' });
    fireEvent.change(input, { target: { value: '失败后还能重试吗？' } });
    fireEvent.click(screen.getByRole('button', { name: '继续追问' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('追问未完成');
    expect(screen.getByRole('alert')).toHaveTextContent('磁盘写入失败');
    expect(input).toBeEnabled();
  });

  it('keeps a session visible and rolls back its tombstone when deletion fails', async () => {
    const savedSession = completedHistorySession('删除失败不能从界面消失');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.sessions, 'delete').mockRejectedValueOnce(new Error('文件被占用'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('删除失败不能从界面消失')).closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：删除失败不能从界面消失' }));

    await waitFor(() => expect(alert).toHaveBeenCalledWith('删除失败：文件被占用'));
    expect(screen.getByRole('heading', { name: '删除失败不能从界面消失' })).toBeVisible();
    expect(screen.getByRole('button', { name: '删除：删除失败不能从界面消失' })).toBeVisible();
  });

  it('waits for an in-flight save and performs one final delete', async () => {
    const savedSession = completedHistorySession('保存完成后只删除一次');
    localStorage.setItem('wenyao-browser-sessions', JSON.stringify([savedSession]));
    vi.spyOn(desktop.ai, 'analyze').mockResolvedValue({
      ok: true,
      report: {
        mode: 'cloud',
        markdown: '## 等待保存\n\n用于删除竞态测试。',
        generatedAt: new Date().toISOString(),
      },
    });
    let resolveSave: ((saved: DivinationSession) => void) | undefined;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation((next) => (
      new Promise((resolve) => {
        resolveSave = () => resolve(next);
      })
    ));
    const remove = vi.spyOn(desktop.sessions, 'delete').mockResolvedValue(true);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click((await screen.findByText('保存完成后只删除一次')).closest('button')!);
    fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
    fireEvent.click(await screen.findByRole('button', { name: '删除：保存完成后只删除一次' }));
    expect(remove).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.(save.mock.calls[0][0]);
    });

    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('heading', { name: '心有所问' })).toBeVisible();
  });

  it('keeps offline lines in memory until review, then saves one complete physical session', async () => {
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation(async (next) => next);
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();

    expect(await screen.findByRole('heading', { name: '六爻已成，请核对' })).toBeVisible();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /确认并生成排盘/ }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const saved = save.mock.calls[0][0];
    expect(saved).toMatchObject({
      castingMethod: 'physical',
      status: 'complete',
    });
    expect(saved.lines).toHaveLength(6);
    expect(saved.lines.every((line) => line.coin && !Object.hasOwn(line.coin, 'visualSeed'))).toBe(true);
    expect(saved.plate).toBeDefined();
    expect(await screen.findByText('AI 解读')).toBeVisible();
  });

  it('locks the complete physical review while its single session is being saved', async () => {
    let resolveSave: ((saved: DivinationSession) => void) | undefined;
    const save = vi.spyOn(desktop.sessions, 'save').mockImplementation((next) => (
      new Promise<DivinationSession>((resolve) => {
        resolveSave = () => resolve(next);
      })
    ));
    const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: '历史记录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '应用设置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '放弃本次起卦' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '修改初爻' })).toBeDisabled();
    const timeField = screen.getByRole('group', { name: '起卦时间（北京时间）' });
    expect(within(timeField).getByLabelText('日期')).toBeDisabled();
    expect(within(timeField).getByLabelText('时刻')).toBeDisabled();
    expect(within(timeField).getByRole('button', { name: '使用当前北京时间' })).toBeDisabled();
    expect(analyze).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.(save.mock.calls[0][0]);
    });

    expect(await screen.findByText('AI 解读')).toBeVisible();
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('retries a failed physical save with the exact same complete session id', async () => {
    const save = vi.spyOn(desktop.sessions, 'save')
      .mockRejectedValueOnce(new Error('disk full'))
      .mockImplementation(async (next) => next);
    vi.spyOn(desktop.ai, 'analyze').mockImplementation(() => new Promise(() => {}));

    render(<App />);
    reachPhysicalReview();
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
    fireEvent.click(screen.getByRole('button', { name: '确认并生成排盘' }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0].id).toBe(save.mock.calls[0][0].id);
    expect(save.mock.calls[1][0].lines.map((line) => line.id)).toEqual(
      save.mock.calls[0][0].lines.map((line) => line.id),
    );
    expect(await screen.findByText('AI 解读')).toBeVisible();
  });

  it('asks before abandoning recorded offline lines and never creates history', () => {
    const save = vi.spyOn(desktop.sessions, 'save');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);

    render(<App />);
    fireEvent.change(screen.getByLabelText('所占之事'), { target: { value: '线下问题是否顺利' } });
    fireEvent.click(screen.getByRole('button', { name: '其他' }));
    fireEvent.click(screen.getByRole('button', { name: /线下起卦/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始起卦' }));
    fireEvent.click(screen.getByRole('button', { name: /两字一背，少阳 7/ }));
    fireEvent.click(screen.getByRole('button', { name: '定此爻' }));

    fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '第二爻' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: '心有所问' })).toBeVisible();
    expect(screen.getByLabelText('所占之事')).toHaveValue('');
    expect(screen.getByRole('button', { name: /在线起卦/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /线下起卦/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '开始起卦' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
});

it('keeps streamed text across navigation and saves a stopped draft instead of a late report', async () => {
  const saved = completedHistorySession('切页后继续阅读这次解读');
  localStorage.setItem('wenyao-browser-sessions', JSON.stringify([saved]));
  let progress: Parameters<typeof desktop.ai.analyze>[1];
  let finish: ((value: Awaited<ReturnType<typeof desktop.ai.analyze>>) => void) | undefined;
  const analyze = vi.spyOn(desktop.ai, 'analyze').mockImplementation((_payload, onProgress) => {
    progress = onProgress;
    return new Promise((resolve) => { finish = resolve; });
  });
  const cancel = vi.spyOn(desktop.ai, 'cancel').mockResolvedValue({ stopped: true });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
  fireEvent.click((await within(await screen.findByRole('dialog', { name: '问爻占簿' })).findByText(saved.question)).closest('button')!);
  fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
  await waitFor(() => expect(progress).toBeTypeOf('function'));
  act(() => progress?.({ stage: 'writing', delta: '## 第一段\n条件仍待补充。' }));
  expect(await screen.findByText(/条件仍待补充/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: '返回问事' }));
  fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
  fireEvent.click((await within(await screen.findByRole('dialog', { name: '问爻占簿' })).findByText(saved.question)).closest('button')!);
  expect(await screen.findByText(/条件仍待补充/)).toBeVisible();
  expect(screen.queryByRole('button', { name: '开始解读' })).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('region', { name: '未完成正文' })).getByRole('button', { name: '停止接收' }));
  expect(cancel).toHaveBeenCalledWith(analyze.mock.calls[0][0].requestId);
  await act(async () => {
    progress?.({ stage: 'writing', delta: '停止后的迟到片段' });
    finish?.({ ok: true, report: { mode: 'cloud', markdown: '迟到完整报告', generatedAt: new Date().toISOString() } });
  });
  expect(await screen.findByText('已停止 · 未完成草稿')).toBeVisible();
  const [stored] = JSON.parse(localStorage.getItem('wenyao-browser-sessions') || '[]');
  expect(stored.analysis).toBeUndefined();
  expect(stored.generationDraft).toMatchObject({ status: 'stopped', content: '## 第一段\n条件仍待补充。' });
  expect(analyze).toHaveBeenCalledOnce();
});

it('stopping during retrieval prevents a later paid generation', async () => {
  const saved = completedHistorySession('检索中停止');
  localStorage.setItem('wenyao-browser-sessions', JSON.stringify([saved]));
  let finish: ((value: Awaited<ReturnType<typeof desktop.retrieval.search>>) => void) | undefined;
  vi.spyOn(desktop.retrieval, 'search').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const analyze = vi.spyOn(desktop.ai, 'analyze');
  vi.spyOn(desktop.ai, 'cancel').mockResolvedValue({ stopped: false });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: '历史记录' }));
  fireEvent.click((await within(await screen.findByRole('dialog', { name: '问爻占簿' })).findByText(saved.question)).closest('button')!);
  fireEvent.click(await screen.findByRole('button', { name: '开始解读' }));
  fireEvent.click(within(screen.getByRole('region', { name: '未完成正文' })).getByRole('button', { name: '停止接收' }));
  await act(async () => { finish?.({ evidence: [], diagnostics: { mode: 'lexical-fallback', lexicalCandidates: 0, vectorCandidates: 0, fusedCandidates: 0, rerankedCandidates: 0, vectorUsed: false, rerankUsed: false, stages: [], warnings: [] } }); });
  expect(await screen.findByText('已停止 · 未完成草稿')).toBeVisible();
  expect(analyze).not.toHaveBeenCalled();
});
