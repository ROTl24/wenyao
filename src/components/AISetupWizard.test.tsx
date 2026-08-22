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

  it('only offers complete beginner stacks and explains API keys in plain language', async () => {
    const openExternal = vi.spyOn(desktop.aiConfig, 'openExternal').mockResolvedValue(true);
    render(<AISetupWizard catalog={catalog} status={unconfigured} onStatus={vi.fn()} onReady={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /SiliconFlow/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /阿里云百炼/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /DeepSeek 官方/ })).not.toBeInTheDocument();
    expect(screen.getByText(/三项能力缺一不可/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '继续' }));
    expect(screen.getByText(/不是登录密码/)).toBeVisible();
    expect(screen.getByText(/不会写入浏览器存储/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /打开官方密钥页面/ }));
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
    fireEvent.change(screen.getByLabelText('访问密钥'), { target: { value: 'sf-test-key' } });
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
});
