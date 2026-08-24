import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import catalogJson from '../../config/ai-providers.json';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, AIProviderCatalog } from '../types/desktop';
import { AISetupWizard } from './AISetupWizard';

const catalog = catalogJson as unknown as AIProviderCatalog;
const unconfigured: AIConfigStatus = {
  status: 'unconfigured', message: '尚未连接 AI 服务', activeCapabilities: null,
  activeFingerprint: '', corpusCount: 1263, consentAcceptedAt: '', connections: [],
  activePipeline: null, draft: null, usage: [],
};
const ready: AIConfigStatus = {
  ...unconfigured,
  status: 'ready',
  message: '解读、向量与重排均已就绪',
  consentAcceptedAt: new Date().toISOString(),
  activeCapabilities: {
    generation: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'deepseek-ai/DeepSeek-V4-Pro' },
    embedding: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'Qwen/Qwen3-Embedding-4B' },
    rerank: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'Qwen/Qwen3-Reranker-8B' },
  },
};

describe('AI 连接向导', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('offers recommended stacks and a discoverable two-field custom API path', async () => {
    const openExternal = vi.spyOn(desktop.aiConfig, 'openExternal').mockResolvedValue(true);
    render(<AISetupWizard catalog={catalog} status={unconfigured} onStatus={vi.fn()} onReady={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /SiliconFlow/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /阿里云百炼/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /自定义 API/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /DeepSeek 官方/ })).not.toBeInTheDocument();
    expect(screen.getByText(/已有 API 地址和 Key/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByText(/不是登录密码/)).toBeVisible();
    expect(screen.getByText(/不会写入浏览器存储/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /创建 API Key/ }));
    await waitFor(() => expect(openExternal).toHaveBeenCalledWith('https://cloud.siliconflow.cn/account/ak'));
    expect(screen.getByRole('button', { name: /保存并检测三项能力/ })).toBeDisabled();
  });

  it('tests all capabilities and builds the vector index before reporting ready', async () => {
    const saveDraft = vi.spyOn(desktop.aiConfig, 'saveDraft').mockResolvedValue({ ok: true, status: unconfigured });
    const testDraft = vi.spyOn(desktop.aiConfig, 'testDraft').mockResolvedValue({ ok: true, status: unconfigured });
    const buildAndActivate = vi.spyOn(desktop.aiConfig, 'buildAndActivate').mockResolvedValue({ ok: true, status: ready });
    const onReady = vi.fn();
    render(<AISetupWizard catalog={catalog} status={unconfigured} onStatus={vi.fn()} onReady={onReady} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sf-test-key' } });
    screen.getAllByRole('checkbox').forEach((checkbox) => fireEvent.click(checkbox));
    fireEvent.click(screen.getByRole('button', { name: /保存并检测三项能力/ }));

    expect(await screen.findByRole('heading', { name: /三项能力和向量索引均已通过/ })).toBeVisible();
    expect(saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      presetId: 'siliconflow-cn-quality',
      apiKey: 'sf-test-key',
      consentAccepted: true,
      webSecurity: {
        confirmedOrigins: ['https://api.siliconflow.cn'],
        bulkEmbeddingAccepted: true,
      },
    }));
    expect(testDraft).toHaveBeenCalledTimes(1);
    expect(buildAndActivate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '开始解读' }));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('normalizes a complete call URL and auto-detects all models from only URL and key', async () => {
    const discoverModels = vi.spyOn(desktop.aiConfig, 'discoverModels').mockResolvedValue({
      ok: true,
      modelIds: ['deepseek-ai/DeepSeek-V4-Pro', 'Qwen/Qwen3-Embedding-4B', 'Qwen/Qwen3-Reranker-8B'],
    });
    render(<AISetupWizard catalog={catalog} status={unconfigured} onStatus={vi.fn()} onReady={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /自定义 API/ }));
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByText(/还没有 API 地址和 Key/)).toBeVisible();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('API 调用地址'), { target: { value: 'https://relay.example.com/v1/chat/completions' } });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'relay-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: '识别 API' }));

    await waitFor(() => expect(discoverModels).toHaveBeenCalledWith({ baseUrl: 'https://relay.example.com/v1', apiKey: 'relay-test-key' }));
    expect(await screen.findByText('三项能力已自动识别')).toBeVisible();
    expect(screen.queryByText(/还没有 API 地址和 Key/)).not.toBeInTheDocument();
    expect(screen.getByText('deepseek-ai/DeepSeek-V4-Pro')).toBeVisible();
    expect(screen.getByRole('button', { name: /确认并连接/ })).toBeDisabled();
  });

  it('recognizes an Alibaba workspace URL as the browser-compatible complete preset without probing its model catalog', async () => {
    const discoverModels = vi.spyOn(desktop.aiConfig, 'discoverModels');
    render(<AISetupWizard catalog={catalog} status={unconfigured} onStatus={vi.fn()} onReady={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /自定义 API/ }));
    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    fireEvent.change(screen.getByLabelText('API 调用地址'), {
      target: { value: 'https://llm-example123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' },
    });
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'alibaba-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: '识别 API' }));

    expect(await screen.findByText('三项能力已自动识别')).toBeVisible();
    expect(screen.getByText('qwen3.7-plus')).toBeVisible();
    expect(screen.getByText('text-embedding-v4')).toBeVisible();
    expect(screen.getByText('qwen3-rerank')).toBeVisible();
    expect(discoverModels).not.toHaveBeenCalled();
  });
});
