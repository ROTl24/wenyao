import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import catalogJson from '../../config/ai-providers.json';
import { desktop } from '../lib/desktop';
import type { AICapability, AIConfigStatus, AIConnection, AIProviderCatalog } from '../types/desktop';
import { AISetupWizard } from './AISetupWizard';

const catalog = catalogJson as unknown as AIProviderCatalog;
const unconfigured: AIConfigStatus = {
  status: 'unconfigured', message: '尚未连接 AI 服务', activeCapabilities: null,
  activeFingerprint: '', corpusCount: 1263, consentAcceptedAt: '', connections: [],
  activePipeline: null, draft: null, usage: [],
};

function connection(capability: AICapability, model: string, dimensions?: number): AIConnection {
  return {
    id: capability,
    providerId: 'siliconflow',
    presetId: null,
    label: 'SiliconFlow',
    region: '',
    baseUrl: 'https://api.siliconflow.cn/v1',
    fields: {},
    capabilities: {
      [capability]: {
        protocol: capability === 'generation' ? 'openai-chat' : capability === 'embedding' ? 'openai-embeddings' : 'cohere-rerank',
        model,
        path: capability === 'generation' ? '/chat/completions' : capability === 'embedding' ? '/embeddings' : '/rerank',
        ...(dimensions ? { dimensions, batchSize: 10 } : {}),
      },
    },
    hasApiKey: true,
    createdAt: '2026-08-26T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z',
  };
}

const generation = connection('generation', 'deepseek-ai/DeepSeek-V4-Pro');
const embedding = connection('embedding', 'Qwen/Qwen3-Embedding-4B', 2560);
const rerank = connection('rerank', 'Qwen/Qwen3-Reranker-8B');

function draftStatus(selected: AICapability[]): AIConfigStatus {
  const connections = [generation, embedding, rerank].filter((item) => selected.includes(Object.keys(item.capabilities)[0] as AICapability));
  return {
    ...unconfigured,
    status: 'needs-setup',
    message: '本项最小测试通过',
    consentAcceptedAt: '2026-08-26T00:00:00.000Z',
    draft: {
      id: 'draft',
      connections,
      pipeline: {
        generation: selected.includes('generation') ? { connectionId: 'generation' } : null,
        embedding: selected.includes('embedding') ? { connectionId: 'embedding' } : null,
        rerank: selected.includes('rerank') ? { connectionId: 'rerank' } : null,
      },
      tests: Object.fromEntries(selected.map((capability) => [capability, { status: 'passed', checkedAt: '2026-08-26T00:00:00.000Z' }])),
      indexTask: null,
    },
  };
}

function readyStatus(selected: AICapability[]): AIConfigStatus {
  const draft = draftStatus(selected);
  return {
    ...draft,
    status: 'ready',
    message: '已就绪',
    activeFingerprint: selected.includes('embedding') ? 'fingerprint' : '',
    activePipeline: draft.draft!.pipeline,
    activeCapabilities: Object.fromEntries(selected.map((capability) => {
      const item = capability === 'generation' ? generation : capability === 'embedding' ? embedding : rerank;
      return [capability, { connectionId: item.id, providerId: item.providerId, label: item.label, model: item.capabilities[capability]!.model }];
    })),
    connections: draft.draft!.connections,
    draft: null,
  };
}

function Harness({ initial = unconfigured, onReady = vi.fn() }: { initial?: AIConfigStatus; onReady?: () => void }) {
  const [status, setStatus] = useState(initial);
  return <AISetupWizard catalog={catalog} status={status} onStatus={setStatus} onReady={onReady} onClose={vi.fn()} />;
}

function fillMain() {
  fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'https://api.siliconflow.cn/v1' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } });
  fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'deepseek-ai/DeepSeek-V4-Pro' } });
  fireEvent.click(screen.getByRole('checkbox'));
}

describe('AI 能力三步向导', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('刷新目录保留手填别名，列表选择与模型输入保持一致', async () => {
    vi.spyOn(desktop.aiConfig, 'listModels').mockResolvedValue({ ok: true, modelIds: ['catalog-model'] });
    render(<Harness />);
    fillMain();
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'my-private-alias' } });
    fireEvent.click(screen.getByRole('button', { name: '获取模型列表' }));
    await waitFor(() => expect(screen.getByLabelText('选择模型')).toHaveValue('my-private-alias'));
    expect(screen.getByLabelText('模型名称')).toHaveValue('my-private-alias');
    fireEvent.change(screen.getByLabelText('选择模型'), { target: { value: 'catalog-model' } });
    expect(screen.getByLabelText('模型名称')).toHaveValue('catalog-model');
  });

  it.each(['API 调用地址', 'API Key', '模型名称', '地址用法'])('修改 %s 后不能使用旧测试结果完成配置', async (label) => {
    vi.spyOn(desktop.aiConfig, 'testCapability').mockResolvedValue({ ok: true, status: draftStatus(['generation']) });
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled());
    const values: Record<string, string> = { 'API 调用地址': 'https://api.siliconflow.cn/other', 'API Key': 'replacement-key', '模型名称': 'other-model', '地址用法': 'exact' };
    fireEvent.change(screen.getByLabelText(label), { target: { value: values[label] } });
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '仅用主模型并完成' })).toBeDisabled();
  });

  it('主模型可直接完成配置，提交完整地址与手填模型且不先请求目录', async () => {
    const testCapability = vi.spyOn(desktop.aiConfig, 'testCapability').mockResolvedValue({ ok: true, status: draftStatus(['generation']) });
    const listModels = vi.spyOn(desktop.aiConfig, 'listModels');
    const completeSetup = vi.spyOn(desktop.aiConfig, 'completeSetup').mockResolvedValue({ ok: true, status: readyStatus(['generation']) });
    render(<Harness />);
    fillMain();
    fireEvent.change(screen.getByLabelText('地址用法'), { target: { value: 'exact' } });
    fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'https://gateway.example.com/tenant/invoke?api-version=2026-01' } });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: ' Bearer arbitrary-key ' } });
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'my-alias' } });
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '仅用主模型并完成' })).toBeEnabled());
    expect(testCapability).toHaveBeenCalledWith(expect.objectContaining({ apiUrl: 'https://gateway.example.com/tenant/invoke?api-version=2026-01', addressMode: 'exact', apiKey: 'arbitrary-key', model: 'my-alias' }));
    fireEvent.click(screen.getByRole('button', { name: '仅用主模型并完成' }));
    await waitFor(() => expect(completeSetup).toHaveBeenCalledWith({ capabilities: ['generation'], bulkEmbeddingAccepted: false }));
    expect(listModels).not.toHaveBeenCalled();
  });

  it('切换服务域名清除旧密钥引用，同域名更改路径仍可复用', () => {
    render(<Harness initial={readyStatus(['generation'])} />);
    fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'https://api.siliconflow.cn/tenant/chat/completions' } });
    expect(screen.getByRole('button', { name: '最小测试' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'https://other.example.com/v1' } });
    expect(screen.getByRole('button', { name: '最小测试' })).toBeDisabled();
    expect(screen.getByLabelText('API Key')).not.toHaveAttribute('placeholder', expect.stringContaining('已引用安全存储'));
  });

  it('恢复配置以草稿引用为准，旧活动连接排在前面时也不覆盖新模型', () => {
    const active = readyStatus(['generation']);
    const candidate = { ...generation, id: 'generation-candidate', capabilities: { generation: { ...generation.capabilities.generation!, model: 'new-model' } } };
    const draft = draftStatus(['generation']).draft!;
    draft.connections = [generation, candidate];
    draft.pipeline.generation = { connectionId: candidate.id };
    render(<Harness initial={{ ...active, draft }} />);
    expect(screen.getByLabelText('模型名称')).toHaveValue('new-model');
  });

  it('目录请求期间锁定输入和导航，避免迟到响应覆盖新配置', async () => {
    let resolve!: (result: { ok: boolean; modelIds: string[] }) => void;
    vi.spyOn(desktop.aiConfig, 'listModels').mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '获取模型列表' }));
    expect(screen.getByLabelText('API 调用地址')).toBeDisabled();
    expect(screen.getByLabelText('模型名称')).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭 AI 连接向导' })).toBeDisabled();
    resolve({ ok: true, modelIds: ['catalog-model'] });
    await waitFor(() => expect(screen.getByLabelText('模型名称')).toBeEnabled());
  });

  it('桌面本机免密钥连接可直接测试，包括 IPv6 回环地址', () => {
    vi.spyOn(desktop, 'runtime', 'get').mockReturnValue({ ...desktop.runtime, kind: 'electron' });
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'http://[::1]:11434/v1' } });
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'local-model' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: '最小测试' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '获取模型列表' })).toBeEnabled();
  });

  it('按主模型、向量和重排三页展示厂商示例与手动模型入口', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'AI 解读主模型' })).toBeVisible();
    expect(screen.getByRole('button', { name: /DeepSeek 官方/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /SiliconFlow/ })).toBeVisible();
    expect(screen.getByLabelText('模型名称')).toHaveAttribute('placeholder', '目录不可用时可手动填写');
  });

  it('自定义服务只填写裸域名时在界面补全 v1', () => {
    render(<Harness />);
    const apiUrl = screen.getByLabelText('API 调用地址');
    fireEvent.change(apiUrl, { target: { value: 'https://api.shuaiapi.com/' } });
    fireEvent.blur(apiUrl);
    expect(apiUrl).toHaveValue('https://api.shuaiapi.com/v1');
    expect(screen.getByText(/仅填写域名时自动补全/)).toBeVisible();
  });

  it('模型名为空时仍确认规范化后的模型目录域名', async () => {
    const listModels = vi.spyOn(desktop.aiConfig, 'listModels').mockResolvedValue({
      ok: true,
      modelIds: ['gpt-5.4'],
    });
    render(<Harness />);

    const apiUrl = screen.getByLabelText('API 调用地址');
    fireEvent.change(apiUrl, { target: { value: 'https://api.shuaiapi.com/' } });
    fireEvent.blur(apiUrl);
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'test-key' } });
    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByText('https://api.shuaiapi.com')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '获取模型列表' }));

    await waitFor(() => expect(listModels).toHaveBeenCalledWith(expect.objectContaining({
      capability: 'generation',
      apiUrl: 'https://api.shuaiapi.com/v1',
      webSecurity: { confirmedOrigins: ['https://api.shuaiapi.com'] },
    })));
    expect(screen.getByLabelText('模型名称')).toHaveValue('gpt-5.4');
  });

  it('模型目录失败时保留手动回退且不触发最小测试', async () => {
    const listModels = vi.spyOn(desktop.aiConfig, 'listModels').mockResolvedValue({
      ok: false,
      error: { code: 'CORS', message: '浏览器 CORS 限制', dataSafe: true, nextAction: '请手动填写。' },
    });
    const testCapability = vi.spyOn(desktop.aiConfig, 'testCapability');
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '获取模型列表' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('手动填写模型名称');
    expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-ai/DeepSeek-V4-Pro');
    expect(listModels).toHaveBeenCalledTimes(1);
    expect(testCapability).not.toHaveBeenCalled();
  });

  it('仅主模型测试通过后可跳过向量并完成关键词检索模式', async () => {
    vi.spyOn(desktop.aiConfig, 'testCapability').mockResolvedValue({ ok: true, status: draftStatus(['generation']) });
    const completeSetup = vi.spyOn(desktop.aiConfig, 'completeSetup').mockResolvedValue({ ok: true, status: readyStatus(['generation']) });
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('heading', { name: '向量检索模型（可选）' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '跳过向量并完成' }));
    expect(await screen.findByRole('heading', { name: '关键词检索' })).toBeVisible();
    expect(completeSetup).toHaveBeenCalledWith({ capabilities: ['generation'], bulkEmbeddingAccepted: false });
  });

  it('向量页可沿用主模型密钥，读取维度后跳过重排', async () => {
    vi.spyOn(desktop.aiConfig, 'testCapability')
      .mockResolvedValueOnce({ ok: true, status: draftStatus(['generation']) })
      .mockResolvedValueOnce({ ok: true, status: draftStatus(['generation', 'embedding']) });
    const completeSetup = vi.spyOn(desktop.aiConfig, 'completeSetup').mockResolvedValue({ ok: true, status: readyStatus(['generation', 'embedding']) });
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: /沿用主模型/ }));
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Qwen/Qwen3-Embedding-4B' } });
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByText(/真实向量维度 2560/)).toBeVisible());
    expect(desktop.aiConfig.testCapability).toHaveBeenLastCalledWith(expect.objectContaining({ capability: 'embedding', credentialSource: 'generation' }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('heading', { name: '重排检索模型（可选）' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '跳过重排并完成' }));
    expect(await screen.findByRole('heading', { name: '关键词 + 向量' })).toBeVisible();
    expect(completeSetup).toHaveBeenCalledWith({ capabilities: ['generation', 'embedding'], bulkEmbeddingAccepted: true });
  });

  it('三项最小测试都通过后完成关键词、向量与重排模式', async () => {
    vi.spyOn(desktop.aiConfig, 'testCapability')
      .mockResolvedValueOnce({ ok: true, status: draftStatus(['generation']) })
      .mockResolvedValueOnce({ ok: true, status: draftStatus(['generation', 'embedding']) })
      .mockResolvedValueOnce({ ok: true, status: draftStatus(['generation', 'embedding', 'rerank']) });
    const completeSetup = vi.spyOn(desktop.aiConfig, 'completeSetup').mockResolvedValue({ ok: true, status: readyStatus(['generation', 'embedding', 'rerank']) });
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: /沿用主模型/ }));
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Qwen/Qwen3-Embedding-4B' } });
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeVisible());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    fireEvent.click(screen.getByRole('button', { name: /沿用向量模型/ }));
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'Qwen/Qwen3-Reranker-8B' } });
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '完成配置' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '完成配置' }));
    expect(await screen.findByRole('heading', { name: '关键词 + 向量 + 重排' })).toBeVisible();
    expect(completeSetup).toHaveBeenCalledWith({ capabilities: ['generation', 'embedding', 'rerank'], bulkEmbeddingAccepted: true });
  });

  it('最小测试失败时保留当前页面并提示手动重试', async () => {
    vi.spyOn(desktop.aiConfig, 'testCapability').mockResolvedValue({
      ok: false,
      status: { ...unconfigured, status: 'error', message: '服务超时' },
      error: { code: 'AI_TIMEOUT', message: '服务超时且可能已经计费', dataSafe: true, nextAction: '确认用量后手动重试。' },
    });
    render(<Harness />);
    fillMain();
    fireEvent.click(screen.getByRole('button', { name: '最小测试' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('确认用量后手动重试');
    expect(screen.getByRole('heading', { name: 'AI 解读主模型' })).toBeVisible();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
  });

  it('重新配置会预填活动模型但不回填密钥明文，并能恢复建库进度', () => {
    const active = readyStatus(['generation']);
    const { unmount } = render(<Harness initial={active} />);
    expect(screen.getByLabelText('API 调用地址')).toHaveValue('https://api.siliconflow.cn/v1/chat/completions');
    expect(screen.getByLabelText('模型名称')).toHaveValue('deepseek-ai/DeepSeek-V4-Pro');
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('API Key')).toHaveAttribute('placeholder', expect.stringContaining('已引用安全存储'));
    unmount();

    const building = draftStatus(['generation', 'embedding']);
    building.status = 'building';
    building.draft!.indexTask = { stage: 'building', completed: 631, total: 1263, progress: 50, error: null };
    render(<Harness initial={building} />);
    expect(screen.getByRole('heading', { name: '正在准备向量检索' })).toBeVisible();
    expect(screen.getByText(/50\.0%/)).toBeVisible();
    expect(screen.getByText(/暂停后可手动继续；失败后需重新检测或改用关键词检索/)).toBeVisible();
  });

  it('建库失败后阻止原样重发，并提供重新测试或降级关键词检索', async () => {
    const failed = draftStatus(['generation', 'embedding']);
    failed.status = 'error';
    failed.draft!.tests.embedding = {
      status: 'failed',
      error: { code: 'AI_RATE_LIMITED', message: '向量服务限额已耗尽', dataSafe: true, nextAction: '确认限额恢复后重新测试。' },
    };
    failed.draft!.indexTask = {
      stage: 'error', completed: 450, total: 1263, progress: 35.6,
      failedRange: { start: 450, end: 460, total: 1263 },
      error: {
        code: 'AI_RATE_LIMITED', message: '向量服务限额已耗尽', dataSafe: true,
        nextAction: '确认限额恢复后重新测试；问爻不会自动重试。',
        technicalDetails: '{"status":400,"requestId":"request-400"}',
      },
    };
    const resumeBuild = vi.spyOn(desktop.aiConfig, 'resumeBuild');
    const completeSetup = vi.spyOn(desktop.aiConfig, 'completeSetup').mockResolvedValue({ ok: true, status: readyStatus(['generation']) });

    const { unmount } = render(<Harness initial={failed} />);
    expect(screen.queryByRole('button', { name: '手动继续' })).not.toBeInTheDocument();
    expect(screen.getByText(/失败批次：451–460/)).toBeVisible();
    fireEvent.click(screen.getByText('查看诊断信息'));
    expect(screen.getByText(/request-400/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '检查向量配置' }));
    expect(screen.getByRole('heading', { name: '向量检索模型（可选）' })).toBeVisible();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();
    expect(resumeBuild).not.toHaveBeenCalled();
    unmount();

    render(<Harness initial={failed} />);
    fireEvent.click(screen.getByRole('button', { name: '跳过向量并完成' }));
    await waitFor(() => expect(completeSetup).toHaveBeenCalledWith({ capabilities: ['generation'], bulkEmbeddingAccepted: false }));
  });
});
