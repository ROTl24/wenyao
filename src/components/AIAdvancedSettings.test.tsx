import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import catalogJson from '../../config/ai-providers.json';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, AIProviderCatalog } from '../types/desktop';
import { AIAdvancedSettings } from './AIAdvancedSettings';

const catalog = catalogJson as unknown as AIProviderCatalog;
const status: AIConfigStatus = {
  status: 'ready', message: '已就绪', activeFingerprint: 'fp', corpusCount: 1263,
  consentAcceptedAt: new Date().toISOString(), usage: [], draft: null,
  connections: [{
    id: 'active-stack', providerId: 'siliconflow', presetId: 'siliconflow-cn-quality', label: '当前完整方案', region: '中国大陆',
    baseUrl: 'https://api.siliconflow.cn/v1', fields: {}, hasApiKey: true,
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-current' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-current', dimensions: 1024 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-current', path: '/rerank' },
    },
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  }],
  activePipeline: {
    generation: { connectionId: 'active-stack' },
    embedding: { connectionId: 'active-stack' },
    rerank: { connectionId: 'active-stack' },
  },
  activeCapabilities: {
    generation: { connectionId: 'active-stack', providerId: 'siliconflow', label: '当前完整方案', model: 'chat-current' },
    embedding: { connectionId: 'active-stack', providerId: 'siliconflow', label: '当前完整方案', model: 'embed-current' },
    rerank: { connectionId: 'active-stack', providerId: 'siliconflow', label: '当前完整方案', model: 'rerank-current' },
  },
};

describe('AI 高级设置', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('adds a generation-only preset while preserving the active embedding and rerank connections', async () => {
    const saveDraft = vi.spyOn(desktop.aiConfig, 'saveDraft').mockResolvedValue({ ok: true, status });
    vi.spyOn(desktop.aiConfig, 'testDraft').mockResolvedValue({ ok: true, status });
    vi.spyOn(desktop.aiConfig, 'buildAndActivate').mockResolvedValue({ ok: true, status });
    render(<AIAdvancedSettings catalog={catalog} status={status} onStatus={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /DeepSeek 官方/ }));
    expect(screen.getByLabelText('解读模型')).toHaveValue('deepseek-v4-pro');
    fireEvent.change(screen.getByLabelText('访问密钥'), { target: { value: 'deepseek-test-key' } });
    fireEvent.click(screen.getByRole('button', { name: '保存草稿并验证' }));

    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(1));
    const payload = saveDraft.mock.calls[0][0];
    expect(payload.connection?.providerId).toBe('deepseek');
    expect(payload.pipeline?.generation?.connectionId).toBe(payload.connection?.id);
    expect(payload.pipeline?.embedding?.connectionId).toBe('active-stack');
    expect(payload.pipeline?.rerank?.connectionId).toBe('active-stack');
  });
});
