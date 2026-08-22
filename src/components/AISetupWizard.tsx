import { ArrowLeft, Check, ExternalLink, KeyRound, Link2, Pause, Play, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import {
  connectionFromKnownPreset,
  customCapabilityLabel,
  inferCustomConnection,
  parseCustomApiUrl,
  presetForApiLocation,
  type InferredCustomConnection,
} from '../lib/customAIConnection';
import { connectionFromPreset, usesBundledVectorPack, validateWebConnection } from '../lib/webAI/security';
import type { AIConfigStatus, AIProviderCatalog } from '../types/desktop';

interface Props {
  catalog: AIProviderCatalog;
  status: AIConfigStatus;
  onStatus(status: AIConfigStatus): void;
  onReady(): void;
  onClose(): void;
}

const capabilityOrder = ['generation', 'embedding', 'rerank'] as const;
const apiKeyValue = (value: string) => value.trim().replace(/^Bearer\s+/i, '');

export function AISetupWizard({ catalog, status, onStatus, onReady, onClose }: Props) {
  const [step, setStep] = useState(status.draft ? 2 : 0);
  const [choice, setChoice] = useState(status.draft?.connection.presetId || catalog.defaultPresetId);
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [customResult, setCustomResult] = useState<InferredCustomConnection | null>(null);
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
  const isCustom = choice === 'custom';
  const selected = fullStackPresets.find((preset) => preset.id === choice) || fullStackPresets[0];
  const isWeb = desktop.runtime.kind === 'web';
  const secretStorageName = desktop.runtime.secureStorage === 'keychain'
    ? 'macOS 钥匙串'
    : desktop.runtime.secureStorage === 'dpapi'
      ? 'Windows DPAPI'
      : '系统安全存储';
  const candidateConnection = useMemo(() => {
    if (isCustom) return customResult?.connection || null;
    if (!selected) return null;
    try { return connectionFromPreset(selected, fields); }
    catch { return null; }
  }, [customResult, fields, isCustom, selected]);
  const webConnection = useMemo(() => {
    if (!isWeb || !candidateConnection) return null;
    try { return validateWebConnection(candidateConnection); }
    catch { return null; }
  }, [candidateConnection, isWeb]);
  const needsBulkEmbedding = Boolean(
    candidateConnection
    && (isCustom || isWeb)
    && candidateConnection.capabilities.embedding
    && !usesBundledVectorPack(candidateConnection),
  );
  const batchRequests = candidateConnection
    ? Math.ceil(status.corpusCount / Math.max(1, Number(candidateConnection.capabilities.embedding?.batchSize || 10)))
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

  const saveTestAndBuild = async (payload: Parameters<typeof desktop.aiConfig.saveDraft>[0]) => {
    setBusy(true);
    setError('');
    const submittedKey = apiKeyValue(apiKey);
    if (isWeb) setApiKey('');
    try {
      const saved = await desktop.aiConfig.saveDraft({
        ...payload,
        apiKey: submittedKey,
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

  const connectPreset = async () => {
    if (!selected) return;
    await saveTestAndBuild({ presetId: selected.id, fields });
  };

  const discoverCustom = async () => {
    setBusy(true);
    setError('');
    setCustomResult(null);
    try {
      const location = parseCustomApiUrl(apiUrl);
      const knownPreset = presetForApiLocation(location, fullStackPresets);
      const result = knownPreset
        ? connectionFromKnownPreset(knownPreset, location)
        : await desktop.aiConfig.discoverModels({ baseUrl: location.baseUrl, apiKey: apiKeyValue(apiKey) }).then((response) => {
            if (!response.ok || !response.modelIds) throw new Error(`${response.error?.message || '无法读取模型列表'} ${response.error?.nextAction || ''}`.trim());
            return inferCustomConnection(location, response.modelIds);
          });
      setCustomResult(result);
      setBulkConsent(false);
      if (result.missing.length) {
        setError(`已连接到服务，但未识别到${result.missing.map((capability) => customCapabilityLabel[capability]).join('、')}。请改用完整方案，或在高级设置中手动组合。`);
      }
    } catch (unexpected) {
      setError(unexpected instanceof Error ? unexpected.message : '自定义 API 识别失败。');
    } finally { setBusy(false); }
  };

  const connectCustom = async () => {
    if (!customResult || customResult.missing.length) return;
    const connectionId = customResult.connection.id;
    await saveTestAndBuild({
      connection: customResult.connection,
      pipeline: {
        generation: { connectionId },
        embedding: { connectionId },
        rerank: { connectionId },
      },
    });
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
  const presetFieldsReady = (selected?.requiredFields || []).every((field) => fields[field.id]?.trim());
  const hasApiKey = Boolean(apiKeyValue(apiKey));
  const connectionReady = consent
    && hasApiKey
    && (!needsBulkEmbedding || bulkConsent)
    && (!isWeb || Boolean(webConnection));

  return (
    <div className="ai-setup-overlay" role="presentation">
      <section className="ai-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-setup-title">
        <button className="ai-setup-close" type="button" aria-label="关闭 AI 连接向导" onClick={onClose}><X /></button>
        <div className="ai-setup-steps" aria-label="连接步骤">
          {['选择方式', '填写信息', '检测与建库', '完成'].map((label, index) => <span key={label} className={index <= step ? 'is-active' : ''}>{index + 1}<small>{label}</small></span>)}
        </div>

        {step === 0 ? (
          <>
            <header><p>连接 AI 服务</p><h2 id="ai-setup-title">选择最适合你的接入方式</h2><span>第一次使用可选推荐服务；已有 API 地址和 Key，直接粘贴即可。</span></header>
            <div className="ai-provider-options">
              {fullStackPresets.map((preset) => (
                <button type="button" key={preset.id} className={choice === preset.id ? 'is-selected' : ''} onClick={() => { setChoice(preset.id); setFields({}); setCustomResult(null); }}>
                  <strong>{preset.name}{preset.recommended ? <em>推荐</em> : null}</strong>
                  <span>{preset.region}</span><p>{preset.description}</p>
                  <small>API 地址和模型均已配置，只需创建 API Key</small>
                </button>
              ))}
              <button type="button" className={`ai-custom-option${isCustom ? ' is-selected' : ''}`} onClick={() => { setChoice('custom'); setFields({}); }}>
                <strong><Link2 size={17} />自定义 API</strong>
                <span>已有服务</span><p>粘贴 API 调用地址和 API Key，自动识别可用模型。</p>
                <small>兼容 Base URL 和完整 /chat/completions 地址</small>
              </button>
            </div>
            <div className="ai-setup-actions"><button className="primary" type="button" onClick={() => setStep(1)}>继续</button></div>
          </>
        ) : null}

        {step === 1 && isCustom ? (
          <>
            <header><p>自定义 API</p><h2 id="ai-setup-title">粘贴两项信息，自动完成配置</h2><span>无需先理解模型、路径或向量维度；问爻会从兼容接口中识别。</span></header>
            {!customResult ? <div className="ai-custom-guide">
              <strong>还没有 API 地址和 Key？</strong>
              <ol><li>登录你的 AI 服务商控制台</li><li>在“API 接入 / 开发者文档”复制 Base URL 或调用地址</li><li>在“API Keys / 密钥管理”创建并复制 API Key</li></ol>
              <p>API 地址不是聊天网页或控制台网址；API Key 不是登录密码，也不要带 <code>Bearer </code>。</p>
              <div>{fullStackPresets.map((preset) => <button type="button" key={preset.id} onClick={() => { setChoice(preset.id); setFields({}); setCustomResult(null); }}>{`我还没有，改用 ${preset.name}`}</button>)}</div>
            </div> : null}
            <label className="ai-setup-field">API 调用地址<input autoFocus value={apiUrl} onChange={(event) => { setApiUrl(event.target.value); setCustomResult(null); setError(''); }} placeholder="https://api.example.com/v1" /></label>
            <small className="ai-field-help">可粘贴 Base URL，也可直接粘贴以 /chat/completions 结尾的完整地址。</small>
            <label className="ai-setup-field">API Key<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={isWeb ? '仅在当前页面会话中使用，刷新即清除' : `粘贴后由${secretStorageName}加密保存`} /></label>
            {!customResult ? <div className="ai-discovery-note"><Sparkles /><p><strong>先识别，不产生对话或建库费用</strong>这一步只读取服务提供的模型目录。识别完成后，你会先看到结果和数据发送范围。</p></div> : null}
            {customResult ? <div className="ai-detection-summary" aria-label="自动识别结果"><header><Check /><div><strong>{customResult.missing.length ? '已连接，仍需补充能力' : '三项能力已自动识别'}</strong><span>{customResult.connection.baseUrl}</span></div></header>{capabilityOrder.map((capability) => <div key={capability}><span>{customCapabilityLabel[capability]}</span><strong>{customResult.detected[capability] || '未识别'}</strong></div>)}</div> : null}
            {customResult && !customResult.missing.length ? <>
              <div className="ai-data-boundary">
                <ShieldCheck /><div><strong>检测与数据发送范围</strong><p>连接时会分别发送一个很短的解读、向量和重排检测请求。{needsBulkEmbedding ? `首次建库还会分批发送 ${status.corpusCount} 段内置古籍，约 ${batchRequests} 次向量请求。` : '向量模型可复用随应用发布的本地索引，不会批量上传古籍建库。'}费用由服务商收取，问爻不会代扣。</p>{isWeb && webConnection ? <ul>{webConnection.origins.map((origin) => <li key={origin}><code>{origin}</code></li>)}</ul> : null}</div>
              </div>
              <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我已核对服务域名，并了解检测请求的数据范围和第三方费用</span></label>
              {needsBulkEmbedding ? <label className="ai-consent"><input type="checkbox" checked={bulkConsent} onChange={(event) => setBulkConsent(event.target.checked)} /><span>我确认首次建库会按上方数量发送古籍片段，并可能产生服务商费用</span></label> : null}
            </> : null}
            {error ? <p className="ai-setup-error" role="alert">{error}</p> : null}
            <div className="ai-setup-actions"><button type="button" onClick={() => { setError(''); setStep(0); }}><ArrowLeft size={15} />返回</button>{customResult && !customResult.missing.length ? <button className="primary" type="button" disabled={busy || !connectionReady} onClick={() => void connectCustom()}><KeyRound size={15} />{busy ? '正在检测…' : '确认并连接'}</button> : <button className="primary" type="button" disabled={busy || !apiUrl.trim() || !hasApiKey} onClick={() => void discoverCustom()}><Sparkles size={15} />{busy ? '正在识别…' : '识别 API'}</button>}</div>
          </>
        ) : null}

        {step === 1 && !isCustom && selected ? (
          <>
            <header><p>{selected.name}</p><h2 id="ai-setup-title">只需创建并粘贴 API Key</h2><span>API 调用地址和三项模型已经配置好；API Key 是调用服务的专用密钥，不是登录密码。</span></header>
            <div className="ai-key-guide">
              <ol><li>打开服务商官方密钥页面</li><li>注册或登录，并确认账号有可用额度</li><li>创建 API Key，复制后回到这里粘贴</li></ol>
              <div><button type="button" onClick={() => void openOfficial(selected.setup.apiKeyUrl)}>创建 API Key <ExternalLink size={14} /></button><button type="button" onClick={() => void openOfficial(selected.setup.billingUrl)}>查看余额 / 充值 <ExternalLink size={14} /></button></div>
            </div>
            {(selected.requiredFields || []).map((field) => (
              <label className="ai-setup-field" key={field.id}>{field.label}<input value={fields[field.id] || ''} onChange={(event) => setFields((current) => ({ ...current, [field.id]: event.target.value }))} placeholder={field.description} /></label>
            ))}
            <label className="ai-setup-field">API Key<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={isWeb ? '仅在当前页面会话中使用，刷新即清除' : `粘贴后由${secretStorageName}加密保存`} /></label>
            <div className="ai-data-boundary">
              <ShieldCheck /><div><strong>发送范围</strong><p>{isWeb ? '密钥不会写入浏览器存储；当前页会把密钥、检测内容、当前问题、排盘和命中的证据直接发送给下列服务商域名。刷新、关闭页面或应用更新会清除密钥。费用由服务商收取。' : '初次建库发送内置古籍片段；解卦时发送当前问题、排盘与命中的证据；不会发送全部历史。费用由服务商收取，问爻不会代扣。'}</p>{isWeb && webConnection ? <ul>{webConnection.origins.map((origin) => <li key={origin}><code>{origin}</code></li>)}</ul> : null}</div>
            </div>
            <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我已核对服务域名，并了解上述数据发送范围和第三方费用</span></label>
            {needsBulkEmbedding ? <label className="ai-consent"><input type="checkbox" checked={bulkConsent} onChange={(event) => setBulkConsent(event.target.checked)} /><span>此模型没有匹配的内置索引。我确认首次建库会分批发送 {status.corpusCount} 段古籍，约 {batchRequests} 次向量请求；问爻不会自动重试，费用由服务商收取。</span></label> : isWeb && webConnection ? <p className="ai-billing-note">向量模型与随应用发布的本地索引匹配，不会批量上传古籍建库；连接检测仍会各调用一次三项能力。</p> : null}
            {error ? <p className="ai-setup-error" role="alert">{error}</p> : null}
            <div className="ai-setup-actions"><button type="button" onClick={() => setStep(0)}><ArrowLeft size={15} />返回</button><button className="primary" type="button" disabled={busy || !connectionReady || !presetFieldsReady} onClick={() => void connectPreset()}><KeyRound size={15} />{busy ? '正在检测…' : '保存并检测三项能力'}</button></div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <header><p>准备知识库</p><h2 id="ai-setup-title">检测与构建正在进行</h2><span>{isWeb ? '可以关闭此窗口继续等待，但不要刷新或关闭页面；否则 API Key 会立即清除。' : '窗口可以关闭，任务会继续在后台运行；退出应用后也能从已完成批次继续。'}</span></header>
            <div className="ai-build-status">
              {capabilityOrder.map((capability) => <div key={capability}><Check className={status.draft?.testResult?.capabilities?.[capability]?.ok ? 'is-complete' : ''} /><span>{customCapabilityLabel[capability]}</span><strong>{status.draft?.testResult?.capabilities?.[capability]?.ok ? '通过' : status.draft?.testResult?.status === 'failed' ? '未通过' : '检测中'}</strong></div>)}
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
          <div className="ai-setup-complete"><Check /><p>AI 服务已就绪</p><h2 id="ai-setup-title">三项能力和向量索引均已通过</h2><span>{isWeb ? '现在可以使用 AI 解读；刷新或关闭页面后需要重新输入 API Key。' : '现在可以使用带古籍向量召回与重排的 AI 解读。'}</span><button type="button" onClick={onReady}>开始解读</button></div>
        ) : null}
      </section>
    </div>
  );
}
