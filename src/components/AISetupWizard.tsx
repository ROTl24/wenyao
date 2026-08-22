import { ArrowLeft, Check, ExternalLink, KeyRound, Pause, Play, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import { connectionFromPreset, usesBundledVectorPack, validateWebConnection } from '../lib/webAI/security';
import type { AIConfigStatus, AIProviderCatalog } from '../types/desktop';

interface Props {
  catalog: AIProviderCatalog;
  status: AIConfigStatus;
  onStatus(status: AIConfigStatus): void;
  onReady(): void;
  onClose(): void;
}

export function AISetupWizard({ catalog, status, onStatus, onReady, onClose }: Props) {
  const [step, setStep] = useState(status.draft ? 2 : 0);
  const [presetId, setPresetId] = useState(status.draft?.connection.presetId || catalog.defaultPresetId);
  const [apiKey, setApiKey] = useState('');
  const [fields, setFields] = useState<Record<string, string>>(() => Object.fromEntries(
    Object.entries(status.draft?.connection.fields || {}).map(([key, value]) => [key, String(value || '')]),
  ));
  const [consent, setConsent] = useState(Boolean(status.consentAcceptedAt));
  const [bulkConsent, setBulkConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fullStackPresets = useMemo(() => catalog.presets.filter((preset) => (
    preset.capabilities.generation && preset.capabilities.embedding && preset.capabilities.rerank
  )), [catalog]);
  const selected = fullStackPresets.find((preset) => preset.id === presetId) || fullStackPresets[0];
  const isWeb = desktop.runtime.kind === 'web';
  const webConnection = useMemo(() => {
    if (!isWeb || !selected) return null;
    try { return validateWebConnection(connectionFromPreset(selected, fields)); }
    catch { return null; }
  }, [fields, isWeb, selected]);
  const needsBulkEmbedding = Boolean(isWeb && webConnection && !usesBundledVectorPack(webConnection.connection));
  const batchRequests = webConnection
    ? Math.ceil(status.corpusCount / Math.max(1, Number(webConnection.connection.capabilities.embedding?.batchSize || 10)))
    : 0;

  useEffect(() => {
    if (status.status === 'ready') setStep(3);
    else if (status.status === 'testing' || status.status === 'building' || status.status === 'paused' || status.draft) setStep(2);
  }, [status]);

  const openOfficial = async (url: string) => {
    try {
      const opened = await desktop.aiConfig.openExternal(url);
      if (!opened) setError('无法打开未经验证的外部地址。');
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : '无法打开服务商官方页面。');
    }
  };

  const connect = async () => {
    if (!selected || !consent || !apiKey.trim() || (isWeb && (!webConnection || (needsBulkEmbedding && !bulkConsent)))) return;
    setBusy(true);
    setError('');
    const submittedKey = apiKey;
    if (isWeb) setApiKey('');
    try {
      const saved = await desktop.aiConfig.saveDraft({
        presetId: selected.id,
        apiKey: submittedKey,
        fields,
        consentAccepted: consent,
        ...(isWeb && webConnection ? {
          webSecurity: {
            confirmedOrigins: webConnection.origins,
            bulkEmbeddingAccepted: bulkConsent,
          },
        } : {}),
      });
      if (!saved.ok || !saved.status) { setError(`${saved.error?.message || '配置保存失败'} ${saved.error?.nextAction || ''}`.trim()); return; }
      onStatus(saved.status);
      setApiKey('');
      setStep(2);
      const tested = await desktop.aiConfig.testDraft();
      if (!tested.ok) { setError(`${tested.error?.message || '连接检测失败'} ${tested.error?.nextAction || ''}`.trim()); return; }
      if (tested.status) onStatus(tested.status);
      const built = await desktop.aiConfig.buildAndActivate();
      if (!built.ok) { setError(`${built.error?.message || '向量索引构建失败'} ${built.error?.nextAction || ''}`.trim()); return; }
      if (built.status) onStatus(built.status);
      setStep(3);
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : 'AI 连接操作未完成，请重试。');
    } finally { setBusy(false); }
  };

  const resume = async () => onStatus(await desktop.aiConfig.resumeBuild());
  const pause = async () => onStatus(await desktop.aiConfig.pauseBuild());
  const retry = async () => {
    setBusy(true);
    setError('');
    try {
      if (status.draft?.testResult?.status !== 'passed') {
        const tested = await desktop.aiConfig.testDraft();
        if (!tested.ok) { setError(`${tested.error?.message || '检测失败'} ${tested.error?.nextAction || ''}`.trim()); return; }
        if (tested.status) onStatus(tested.status);
      }
      const built = await desktop.aiConfig.buildAndActivate();
      if (!built.ok) setError(`${built.error?.message || '向量索引构建失败'} ${built.error?.nextAction || ''}`.trim());
      if (built.status) onStatus(built.status);
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : 'AI 配置重试未完成。');
    } finally { setBusy(false); }
  };

  const progress = status.draft?.indexTask?.progress ?? 0;
  const taskError = status.draft?.indexTask?.error || status.draft?.testResult?.error;

  return (
    <div className="ai-setup-overlay" role="presentation">
      <section className="ai-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-setup-title">
        <button className="ai-setup-close" type="button" aria-label="关闭 AI 连接向导" onClick={onClose}><X /></button>
        <div className="ai-setup-steps" aria-label="连接步骤">
          {['选择服务', '取得密钥', '检测与建库', '完成'].map((label, index) => <span key={label} className={index <= step ? 'is-active' : ''}>{index + 1}<small>{label}</small></span>)}
        </div>

        {step === 0 ? (
          <>
            <header><p>连接 AI 服务</p><h2 id="ai-setup-title">选择一套完整方案</h2><span>问爻会自动配置解读、向量召回和重排；三项能力缺一不可。</span></header>
            <div className="ai-provider-options">
              {fullStackPresets.map((preset) => (
                <button type="button" key={preset.id} className={presetId === preset.id ? 'is-selected' : ''} onClick={() => { setPresetId(preset.id); setFields({}); }}>
                  <strong>{preset.name}{preset.recommended ? <em>推荐</em> : null}</strong>
                  <span>{preset.region}</span><p>{preset.description}</p>
                  <small>{Object.values(preset.capabilities).map((item) => item?.model).filter(Boolean).join(' · ')}</small>
                </button>
              ))}
            </div>
            <div className="ai-setup-actions"><button className="primary" type="button" onClick={() => setStep(1)}>继续</button></div>
          </>
        ) : null}

        {step === 1 && selected ? (
          <>
            <header><p>{selected.name}</p><h2 id="ai-setup-title">创建并粘贴访问密钥</h2><span>访问密钥相当于这项 AI 服务的专用密码，不是登录密码。</span></header>
            <div className="ai-key-guide">
              <ol><li>注册或登录服务商官方账号</li><li>充值或确认账号具有可用额度</li><li>创建访问密钥，复制后回到这里粘贴</li></ol>
              <div><button type="button" onClick={() => void openOfficial(selected.setup.apiKeyUrl)}>打开官方密钥页面 <ExternalLink size={14} /></button><button type="button" onClick={() => void openOfficial(selected.setup.billingUrl)}>查看余额 / 充值 <ExternalLink size={14} /></button></div>
            </div>
            {(selected.requiredFields || []).map((field) => (
              <label className="ai-setup-field" key={field.id}>{field.label}<input value={fields[field.id] || ''} onChange={(event) => setFields((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.description} /></label>
            ))}
            <label className="ai-setup-field">访问密钥<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={isWeb ? '仅在当前页面会话中使用，刷新即清除' : '粘贴后由 Windows 加密保存'} /></label>
            <div className="ai-data-boundary">
              <ShieldCheck /><div><strong>发送范围</strong><p>{isWeb ? '密钥不会写入浏览器存储；当前页会把密钥、检测内容、当前问题、排盘和命中的证据直接发送给下列服务商域名。刷新、关闭页面或应用更新会清除密钥。费用由服务商收取。' : '初次建库发送内置古籍片段；解卦时发送当前问题、排盘与命中的证据；不会发送全部历史。费用由服务商收取，问爻不会代扣。'}</p>{isWeb && webConnection ? <ul>{webConnection.origins.map((origin) => <li key={origin}><code>{origin}</code></li>)}</ul> : null}</div>
            </div>
            <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我已核对服务域名，并了解上述数据发送范围和第三方费用</span></label>
            {needsBulkEmbedding ? <label className="ai-consent"><input type="checkbox" checked={bulkConsent} onChange={(event) => setBulkConsent(event.target.checked)} /><span>此模型没有匹配的内置索引。我确认首次建库会分批发送 {status.corpusCount} 段古籍，约 {batchRequests} 次向量请求；问爻不会自动重试，费用由服务商收取。</span></label> : isWeb && webConnection ? <p className="ai-billing-note">向量模型与随应用发布的本地索引匹配，不会批量上传古籍建库；连接检测仍会各调用一次三项能力。</p> : null}
            {error ? <p className="ai-setup-error" role="alert">{error}</p> : null}
            <div className="ai-setup-actions"><button type="button" onClick={() => setStep(0)}><ArrowLeft size={15} />返回</button><button className="primary" type="button" disabled={busy || !consent || !apiKey.trim() || (needsBulkEmbedding && !bulkConsent) || (isWeb && !webConnection) || (selected.requiredFields || []).some((field) => !fields[field.id]?.trim())} onClick={() => void connect()}><KeyRound size={15} />{busy ? '正在检测…' : '保存并检测三项能力'}</button></div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <header><p>准备知识库</p><h2 id="ai-setup-title">检测与构建正在进行</h2><span>{isWeb ? '可以关闭此窗口继续等待，但不要刷新或关闭页面；否则访问密钥会立即清除。' : '窗口可以关闭，任务会继续在后台运行；退出应用后也能从已完成批次继续。'}</span></header>
            <div className="ai-build-status">
              {(['generation', 'embedding', 'rerank'] as const).map((capability) => <div key={capability}><Check className={status.draft?.testResult?.capabilities?.[capability]?.ok ? 'is-complete' : ''} /><span>{capability === 'generation' ? '解读模型' : capability === 'embedding' ? '向量模型' : '重排模型'}</span><strong>{status.draft?.testResult?.capabilities?.[capability]?.ok ? '通过' : status.draft?.testResult?.status === 'failed' ? '未通过' : '检测中'}</strong></div>)}
            </div>
            <div className="ai-build-progress"><span style={{ transform: `scaleX(${progress / 100})` }} /></div>
            <p className="ai-build-progress-label">{status.status === 'paused' ? '已暂停' : status.status === 'error' ? '需要处理' : `向量索引 ${progress.toFixed(1)}%`} · {status.draft?.indexTask?.completed || 0}/{status.draft?.indexTask?.total || status.corpusCount}</p>
            {error || taskError ? <div className="ai-setup-error" role="alert"><strong>{error || taskError?.message}</strong>{taskError?.nextAction ? <p>{taskError.nextAction}</p> : null}{taskError?.technicalDetails ? <details><summary>技术详情</summary><pre>{taskError.technicalDetails}</pre></details> : null}</div> : null}
            <div className="ai-setup-actions">
              {status.status === 'building' ? <button type="button" onClick={() => void pause()}><Pause size={15} />暂停</button> : null}
              {status.status === 'paused' ? <button type="button" onClick={() => void resume()}><Play size={15} />继续</button> : null}
              {status.status === 'error' || status.draft?.testResult?.status === 'failed' ? <button className="primary" type="button" disabled={busy} onClick={() => void retry()}>{busy ? '重试中…' : '修复后重试'}</button> : null}
              {status.status === 'error' || status.draft?.testResult?.status === 'failed' ? <button type="button" disabled={busy} onClick={() => { setError(''); setStep(1); }}><ArrowLeft size={15} />修改连接信息</button> : null}
              <button type="button" onClick={onClose}>{status.status === 'testing' || status.status === 'building' ? '后台继续' : '关闭'}</button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <div className="ai-setup-complete"><Check /><p>AI 服务已就绪</p><h2 id="ai-setup-title">三项能力和向量索引均已通过</h2><span>{isWeb ? '现在可以使用 AI 解读；刷新或关闭页面后需要重新输入密钥。' : '现在可以使用带古籍向量召回与重排的 AI 解读。'}</span><button type="button" onClick={onReady}>开始解读</button></div>
        ) : null}
      </section>
    </div>
  );
}
