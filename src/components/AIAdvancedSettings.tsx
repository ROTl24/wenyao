import { Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import { confirmationPhrase, usesBundledVectorPack, validateWebConnection } from '../lib/webAI/security';
import type { AICapability, AIConfigStatus, AIConnection, AIPipeline, AIProviderCatalog, AIProtocol, AIProviderPreset } from '../types/desktop';

interface Props {
  catalog: AIProviderCatalog;
  status: AIConfigStatus;
  onStatus(status: AIConfigStatus): void;
  onClose(): void;
}

const capabilityLabels: Record<AICapability, string> = { generation: '解读', embedding: '向量', rerank: '重排' };

export function AIAdvancedSettings({ catalog, status, onStatus, onClose }: Props) {
  const [pipeline, setPipeline] = useState<AIPipeline>(status.activePipeline || { generation: null, embedding: null, rerank: null });
  const [editing, setEditing] = useState<AIConnection | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [originConfirmation, setOriginConfirmation] = useState('');
  const [webConsent, setWebConsent] = useState(false);
  const [bulkConsent, setBulkConsent] = useState(false);
  const isWeb = desktop.runtime.kind === 'web';
  const connectionsByCapability = useMemo(() => Object.fromEntries((['generation', 'embedding', 'rerank'] as const).map((capability) => [capability, status.connections.filter((connection) => connection.capabilities[capability])])) as Record<AICapability, AIConnection[]>, [status.connections]);
  const editingPreset = catalog.presets.find((preset) => preset.id === editing?.presetId);
  const editingValidation = useMemo(() => {
    if (!editing) return null;
    try { return validateWebConnection(editing); }
    catch { return null; }
  }, [editing]);
  const expectedConfirmation = editingValidation ? confirmationPhrase(editingValidation.origins) : '';
  const needsBulkEmbedding = Boolean(editingValidation?.connection.capabilities.embedding && !usesBundledVectorPack(editingValidation.connection));
  const batchRequests = editingValidation
    ? Math.ceil(status.corpusCount / Math.max(1, Number(editingValidation.connection.capabilities.embedding?.batchSize || 10)))
    : 0;

  const resetWebConfirmation = () => {
    setOriginConfirmation('');
    setWebConsent(false);
    setBulkConsent(false);
  };

  const editPreset = (preset: AIProviderPreset) => {
    const capabilities = structuredClone(preset.capabilities);
    if (capabilities.rerank?.urlTemplate) capabilities.rerank.url = '';
    setEditing({
      id: `preset-${preset.providerId}-${crypto.randomUUID()}`,
      providerId: preset.providerId,
      presetId: preset.id,
      label: preset.name,
      region: preset.region,
      baseUrl: preset.baseUrl,
      fields: {},
      capabilities,
      hasApiKey: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setApiKey('');
    resetWebConfirmation();
  };

  const newCustom = () => {
    setEditing({
      id: `custom-${crypto.randomUUID()}`,
      providerId: 'custom',
      presetId: null,
      label: '手动配置 API',
      region: '',
      baseUrl: 'https://',
      fields: {},
      capabilities: {
        generation: { protocol: 'openai-chat', model: '', path: '/chat/completions' },
        embedding: { protocol: 'openai-embeddings', model: '', dimensions: 1024, batchSize: 10, path: '/embeddings' },
        rerank: { protocol: 'cohere-rerank', model: '', path: '/rerank' },
      },
      hasApiKey: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setApiKey('');
    resetWebConfirmation();
  };

  const changeCapability = (capability: AICapability, patch: Record<string, unknown>) => {
    setEditing((current) => current ? ({ ...current, capabilities: { ...current.capabilities, [capability]: { ...current.capabilities[capability], ...patch } } }) : current);
  };

  const changePresetField = (fieldId: string, value: string) => {
    setEditing((current) => {
      if (!current) return current;
      const next = { ...current, fields: { ...current.fields, [fieldId]: value } };
      const rerank = current.capabilities.rerank;
      if (fieldId === 'workspaceId' && rerank?.urlTemplate) {
        next.capabilities = {
          ...current.capabilities,
          rerank: { ...rerank, url: rerank.urlTemplate.replace('{workspaceId}', encodeURIComponent(value.trim())) },
        };
      }
      return next;
    });
  };

  const validateAndBuild = async (connection: AIConnection, targetPipeline: AIPipeline) => {
    setBusy(true);
    setMessage('正在保存草稿…');
    const submittedKey = apiKey || undefined;
    if (isWeb) setApiKey('');
    try {
      const saved = await desktop.aiConfig.saveDraft({
        connection,
        pipeline: targetPipeline,
        apiKey: submittedKey,
        consentAccepted: true,
        ...(isWeb && editingValidation ? {
          webSecurity: {
            confirmedOrigins: editingValidation.origins,
            bulkEmbeddingAccepted: bulkConsent,
          },
        } : {}),
      });
      if (!saved.ok || !saved.status) { setMessage(`${saved.error?.message || '保存失败'} ${saved.error?.nextAction || ''}`.trim()); return; }
      onStatus(saved.status);
      setApiKey('');
      setMessage('正在检测解读、向量和重排…');
      const tested = await desktop.aiConfig.testDraft();
      if (!tested.ok) { setMessage(`${tested.error?.message || '检测失败'} ${tested.error?.nextAction || ''}`.trim()); return; }
      if (tested.status) onStatus(tested.status);
      setMessage('检测通过，正在构建独立向量索引…');
      void desktop.aiConfig.buildAndActivate().then((result) => {
        if (result.status) onStatus(result.status);
        setMessage(result.ok ? '新能力组合已原子启用。' : `${result.error?.message || '构建失败'} ${result.error?.nextAction || ''}`.trim());
      }).catch((unexpected) => setMessage(unexpected instanceof Error ? unexpected.message : '向量索引构建未完成。'));
      setEditing(null);
    } catch (unexpected) {
      setMessage(unexpected instanceof Error ? unexpected.message : 'AI 能力组合验证未完成。');
    } finally { setBusy(false); }
  };

  const preparePipeline = async () => {
    const anchorId = pipeline.generation?.connectionId || '';
    const anchor = status.connections.find((connection) => connection.id === anchorId);
    if (!anchor || (['generation', 'embedding', 'rerank'] as const).some((capability) => !pipeline[capability])) { setMessage('请为三项能力分别选择连接。'); return; }
    await validateAndBuild(anchor, pipeline);
  };

  return (
    <div className="ai-advanced-overlay" role="presentation">
      <section className="ai-advanced-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-advanced-title">
        <header><div><p>高级设置</p><h2 id="ai-advanced-title">AI 能力与连接</h2></div><button type="button" aria-label="关闭高级设置" onClick={onClose}><X /></button></header>
        <p className="ai-advanced-warning">修改模型或向量维度会创建新索引。新组合全部验证成功前，当前可用方案不会被覆盖。</p>
        <section>
          <div className="ai-advanced-heading"><strong>当前能力组合</strong><span>允许三项能力来自不同服务商</span></div>
          <div className="ai-pipeline-grid">
            {(['generation', 'embedding', 'rerank'] as const).map((capability) => (
              <label key={capability}>{capabilityLabels[capability]}
                <select value={pipeline[capability]?.connectionId || ''} onChange={(event) => setPipeline((current) => ({ ...current, [capability]: event.target.value ? { connectionId: event.target.value } : null }))}>
                  <option value="">请选择</option>
                  {connectionsByCapability[capability].map((connection) => <option key={connection.id} value={connection.id}>{connection.label} · {connection.capabilities[capability]?.model}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button className="index-button" type="button" disabled={busy} onClick={() => void preparePipeline()}>验证并准备此组合</button>
        </section>

        <section>
          <div className="ai-advanced-heading"><strong>已保存连接</strong><button type="button" onClick={newCustom}><Plus size={14} />手动配置 API</button></div>
          <p className="ai-manual-note">已有 API 地址和 API Key 时，优先使用“连接服务”里的自定义 API 自动识别。这里只用于接口无法识别或需要跨服务商组合时。</p>
          <div className="ai-preset-add-list" aria-label="从内置预设添加连接">
            {catalog.presets.map((preset) => <button type="button" key={preset.id} onClick={() => editPreset(preset)}><Plus size={13} />{preset.name}</button>)}
          </div>
          <div className="ai-connection-list">
            {status.connections.map((connection) => (
              <div key={connection.id}><div><strong>{connection.label}</strong><span>{connection.baseUrl}</span><small>{Object.entries(connection.capabilities).map(([capability, definition]) => `${capabilityLabels[capability as AICapability]}：${definition?.model}`).join(' · ')}</small></div><button type="button" onClick={() => { setEditing(structuredClone(connection)); setApiKey(''); resetWebConfirmation(); }}>编辑</button><button type="button" aria-label={`删除 ${connection.label}`} onClick={async () => { try { const result = await desktop.aiConfig.removeConnection(connection.id); if (result.status) onStatus(result.status); if (!result.ok) setMessage(result.error?.message || '删除失败'); } catch (unexpected) { setMessage(unexpected instanceof Error ? unexpected.message : '删除连接失败'); } }}><Trash2 size={14} /></button></div>
            ))}
          </div>
        </section>

        {editing ? (
          <section className="ai-connection-editor">
            <div className="ai-advanced-heading"><strong>{status.connections.some((item) => item.id === editing.id) ? '编辑连接' : '手动配置模型与能力'}</strong><button type="button" onClick={() => setEditing(null)}><X size={14} />取消</button></div>
            <label>名称<input value={editing.label} onChange={(event) => setEditing({ ...editing, label: event.target.value })} /></label>
            <label>基础 API 地址<input value={editing.baseUrl} onChange={(event) => setEditing({ ...editing, baseUrl: event.target.value })} /></label>
            {(editingPreset?.requiredFields || []).map((field) => <label key={field.id}>{field.label}<input value={String(editing.fields[field.id] || '')} onChange={(event) => changePresetField(field.id, event.target.value)} placeholder={field.description} /></label>)}
            <label>访问密钥<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={isWeb ? (editing.hasApiKey ? '当前页面会话已有密钥；留空表示不修改' : '仅在当前页面会话中使用') : editing.hasApiKey ? '已加密保存；留空表示不修改' : editing.baseUrl.startsWith('http://localhost') || editing.baseUrl.startsWith('http://127.0.0.1') ? '本机服务可以留空' : '请输入访问密钥'} /></label>
            <div className="ai-model-editor-grid">
              <label>解读模型<input value={editing.capabilities.generation?.model || ''} onChange={(event) => changeCapability('generation', { protocol: 'openai-chat', model: event.target.value })} /></label>
              <label>解读路径<input value={editing.capabilities.generation?.path || '/chat/completions'} onChange={(event) => changeCapability('generation', { protocol: 'openai-chat', path: event.target.value })} /></label>
              <label>向量模型<input value={editing.capabilities.embedding?.model || ''} onChange={(event) => changeCapability('embedding', { protocol: 'openai-embeddings', model: event.target.value })} /></label>
              <label>向量路径<input value={editing.capabilities.embedding?.path || '/embeddings'} onChange={(event) => changeCapability('embedding', { protocol: 'openai-embeddings', path: event.target.value })} /></label>
              <label>向量维度<input type="number" min="1" value={editing.capabilities.embedding?.dimensions || 1024} onChange={(event) => changeCapability('embedding', { dimensions: Number(event.target.value) })} /></label>
              <label>重排协议<select value={editing.capabilities.rerank?.protocol || 'cohere-rerank'} onChange={(event) => changeCapability('rerank', { protocol: event.target.value as AIProtocol })}>{catalog.customProtocols.rerank.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}</select></label>
              <label>重排模型<input value={editing.capabilities.rerank?.model || ''} onChange={(event) => changeCapability('rerank', { model: event.target.value })} /></label>
              <label>重排路径或完整地址<input value={editing.capabilities.rerank?.url || editing.capabilities.rerank?.path || '/rerank'} onChange={(event) => changeCapability('rerank', event.target.value.startsWith('http') ? { url: event.target.value, path: undefined } : { path: event.target.value, url: undefined })} /></label>
            </div>
            {isWeb ? <div className="ai-data-boundary"><div><strong>自定义服务安全确认</strong>{editingValidation ? <><p>当前页只会向以下经过锁定的 HTTPS 域名发送密钥和本次 AI 数据：</p><ul>{editingValidation.origins.map((origin) => <li key={origin}><code>{origin}</code></li>)}</ul><label>请逐字输入 <code>{expectedConfirmation}</code><input value={originConfirmation} autoCapitalize="none" spellCheck={false} onChange={(event) => setOriginConfirmation(event.target.value)} /></label><label className="ai-consent"><input type="checkbox" checked={webConsent} onChange={(event) => setWebConsent(event.target.checked)} /><span>我确认这些域名由我信任；密钥刷新或关页即清除，服务商仍可看到请求并按其规则计费。</span></label>{needsBulkEmbedding ? <label className="ai-consent"><input type="checkbox" checked={bulkConsent} onChange={(event) => setBulkConsent(event.target.checked)} /><span>此向量模型没有匹配的内置索引。我确认首次建库会发送 {status.corpusCount} 段古籍，约 {batchRequests} 次请求，且失败不会自动重试。</span></label> : <p>向量模型可复用随应用发布的本地索引，不会批量上传古籍建库。</p>}</> : <p role="alert">请输入完整的公开 HTTPS 地址、三项模型和有效接口路径；本机、内网、带查询参数或片段的地址会被拒绝。</p>}</div></div> : null}
            <button className="index-button" type="button" disabled={busy || (!editing.hasApiKey && !apiKey.trim() && !editing.baseUrl.startsWith('http://localhost') && !editing.baseUrl.startsWith('http://127.0.0.1')) || (isWeb && (!editingValidation || !webConsent || originConfirmation !== expectedConfirmation || (needsBulkEmbedding && !bulkConsent))) || (editingPreset?.requiredFields || []).some((field) => !String(editing.fields[field.id] || '').trim())} onClick={() => {
              const nextPipeline = structuredClone(pipeline);
              for (const capability of ['generation', 'embedding', 'rerank'] as const) {
                if (editing.capabilities[capability]?.model.trim()) nextPipeline[capability] = { connectionId: editing.id };
              }
              setPipeline(nextPipeline);
              void validateAndBuild(editing, nextPipeline);
            }}>{isWeb ? '确认域名并验证' : '保存草稿并验证'}</button>
          </section>
        ) : null}
        {message ? <p className="settings-status" role="status">{message}</p> : null}
      </section>
    </div>
  );
}
