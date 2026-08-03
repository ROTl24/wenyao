import { Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
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
  const connectionsByCapability = useMemo(() => Object.fromEntries((['generation', 'embedding', 'rerank'] as const).map((capability) => [capability, status.connections.filter((connection) => connection.capabilities[capability])])) as Record<AICapability, AIConnection[]>, [status.connections]);
  const editingPreset = catalog.presets.find((preset) => preset.id === editing?.presetId);

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
  };

  const newCustom = () => setEditing({
    id: `custom-${crypto.randomUUID()}`,
    providerId: 'custom',
    presetId: null,
    label: '自定义服务',
    region: '',
    baseUrl: 'https://',
    fields: {},
    capabilities: {
      generation: { protocol: 'openai-chat', model: '' },
      embedding: { protocol: 'openai-embeddings', model: '', dimensions: 1024, batchSize: 10 },
      rerank: { protocol: 'cohere-rerank', model: '', path: '/rerank' },
    },
    hasApiKey: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

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
    try {
      const saved = await desktop.aiConfig.saveDraft({ connection, pipeline: targetPipeline, apiKey: apiKey || undefined, consentAccepted: true });
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
          <div className="ai-advanced-heading"><strong>已保存连接</strong><button type="button" onClick={newCustom}><Plus size={14} />自定义连接</button></div>
          <div className="ai-preset-add-list" aria-label="从内置预设添加连接">
            {catalog.presets.map((preset) => <button type="button" key={preset.id} onClick={() => editPreset(preset)}><Plus size={13} />{preset.name}</button>)}
          </div>
          <div className="ai-connection-list">
            {status.connections.map((connection) => (
              <div key={connection.id}><div><strong>{connection.label}</strong><span>{connection.baseUrl}</span><small>{Object.entries(connection.capabilities).map(([capability, definition]) => `${capabilityLabels[capability as AICapability]}：${definition?.model}`).join(' · ')}</small></div><button type="button" onClick={() => { setEditing(structuredClone(connection)); setApiKey(''); }}>编辑</button><button type="button" aria-label={`删除 ${connection.label}`} onClick={async () => { try { const result = await desktop.aiConfig.removeConnection(connection.id); if (result.status) onStatus(result.status); if (!result.ok) setMessage(result.error?.message || '删除失败'); } catch (unexpected) { setMessage(unexpected instanceof Error ? unexpected.message : '删除连接失败'); } }}><Trash2 size={14} /></button></div>
            ))}
          </div>
        </section>

        {editing ? (
          <section className="ai-connection-editor">
            <div className="ai-advanced-heading"><strong>{status.connections.some((item) => item.id === editing.id) ? '编辑连接' : '新建连接'}</strong><button type="button" onClick={() => setEditing(null)}><X size={14} />取消</button></div>
            <label>名称<input value={editing.label} onChange={(event) => setEditing({ ...editing, label: event.target.value })} /></label>
            <label>基础 API 地址<input value={editing.baseUrl} onChange={(event) => setEditing({ ...editing, baseUrl: event.target.value })} /></label>
            {(editingPreset?.requiredFields || []).map((field) => <label key={field.id}>{field.label}<input value={String(editing.fields[field.id] || '')} onChange={(event) => changePresetField(field.id, event.target.value)} placeholder={field.description} /></label>)}
            <label>访问密钥<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={editing.hasApiKey ? '已加密保存；留空表示不修改' : editing.baseUrl.startsWith('http://localhost') || editing.baseUrl.startsWith('http://127.0.0.1') ? '本机服务可以留空' : '请输入访问密钥'} /></label>
            <div className="ai-model-editor-grid">
              <label>解读模型<input value={editing.capabilities.generation?.model || ''} onChange={(event) => changeCapability('generation', { protocol: 'openai-chat', model: event.target.value })} /></label>
              <label>向量模型<input value={editing.capabilities.embedding?.model || ''} onChange={(event) => changeCapability('embedding', { protocol: 'openai-embeddings', model: event.target.value })} /></label>
              <label>向量维度<input type="number" min="1" value={editing.capabilities.embedding?.dimensions || 1024} onChange={(event) => changeCapability('embedding', { dimensions: Number(event.target.value) })} /></label>
              <label>重排协议<select value={editing.capabilities.rerank?.protocol || 'cohere-rerank'} onChange={(event) => changeCapability('rerank', { protocol: event.target.value as AIProtocol })}>{catalog.customProtocols.rerank.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}</select></label>
              <label>重排模型<input value={editing.capabilities.rerank?.model || ''} onChange={(event) => changeCapability('rerank', { model: event.target.value })} /></label>
              <label>重排路径或完整地址<input value={editing.capabilities.rerank?.url || editing.capabilities.rerank?.path || '/rerank'} onChange={(event) => changeCapability('rerank', event.target.value.startsWith('http') ? { url: event.target.value, path: undefined } : { path: event.target.value, url: undefined })} /></label>
            </div>
            <button className="index-button" type="button" disabled={busy || (!editing.hasApiKey && !apiKey.trim() && !editing.baseUrl.startsWith('http://localhost') && !editing.baseUrl.startsWith('http://127.0.0.1')) || (editingPreset?.requiredFields || []).some((field) => !String(editing.fields[field.id] || '').trim())} onClick={() => {
              const nextPipeline = structuredClone(pipeline);
              for (const capability of ['generation', 'embedding', 'rerank'] as const) {
                if (editing.capabilities[capability]?.model.trim()) nextPipeline[capability] = { connectionId: editing.id };
              }
              setPipeline(nextPipeline);
              void validateAndBuild(editing, nextPipeline);
            }}>保存草稿并验证</button>
          </section>
        ) : null}
        {message ? <p className="settings-status" role="status">{message}</p> : null}
      </section>
    </div>
  );
}
