import { ArrowLeft, Check, KeyRound, Link2, Pause, Play, Search, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import setupCore from '../../shared/ai-setup-core.cjs';
import { desktop } from '../lib/desktop';
import { usesBundledVectorPack, validateWebConnection } from '../lib/webAI/security';
import type { AICapability, AIConfigStatus, AIConnection, AIProviderCatalog } from '../types/desktop';

interface Props {
  catalog: AIProviderCatalog;
  status: AIConfigStatus;
  onStatus(status: AIConfigStatus): void;
  onReady(): void;
  onClose(): void;
}

interface CapabilityForm {
  apiUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  credentialSource?: AICapability;
}

const capabilityOrder = ['generation', 'embedding', 'rerank'] as const;
const labels: Record<AICapability, string> = { generation: 'AI 解读主模型', embedding: '向量检索模型', rerank: '重排检索模型' };
const descriptions: Record<AICapability, string> = {
  generation: '负责阅读古籍证据并生成最终解读，是唯一必填能力。',
  embedding: '从古籍中找出语义相关的证据，提高召回精度；没有也可以继续使用本地关键词检索。',
  rerank: '对关键词与向量召回的候选做第二次排序，进一步提高证据精度。',
};
const { capabilityConnection, normalizeCapabilityLocation } = setupCore as {
  capabilityConnection(input: { capability: AICapability; apiUrl: string; model: string; id?: string; createdAt?: string; dimensions?: number }): AIConnection;
  normalizeCapabilityLocation(capability: AICapability, apiUrl: string): { baseUrl: string };
};

function apiUrlFor(connection: AIConnection, capability: AICapability): string {
  const definition = connection.capabilities[capability];
  return definition?.url || `${connection.baseUrl}${definition?.path || ''}`;
}

function savedConnection(status: AIConfigStatus, capability: AICapability): AIConnection | null {
  const draftId = status.draft?.pipeline[capability]?.connectionId;
  const activeId = status.activePipeline?.[capability]?.connectionId;
  return [...(status.draft?.connections || []), ...status.connections]
    .find((connection) => connection.id === draftId || connection.id === activeId) || null;
}

function initialForms(status: AIConfigStatus): Record<AICapability, CapabilityForm> {
  return Object.fromEntries(capabilityOrder.map((capability) => {
    const connection = savedConnection(status, capability);
    return [capability, {
      apiUrl: connection ? apiUrlFor(connection, capability) : '',
      apiKey: '',
      model: connection?.capabilities[capability]?.model || '',
      models: [],
      ...(connection?.hasApiKey ? { credentialSource: capability } : {}),
    }];
  })) as unknown as Record<AICapability, CapabilityForm>;
}

function errorText(error?: { message: string; nextAction: string }): string {
  return error ? `${error.message} ${error.nextAction || ''}`.trim() : '操作未完成，请核对后重试。';
}

export function AISetupWizard({ catalog, status, onStatus, onReady, onClose }: Props) {
  const [forms, setForms] = useState(() => initialForms(status));
  const [step, setStep] = useState(status.draft?.indexTask ? 3 : 0);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(Boolean(status.consentAcceptedAt));
  const [bulkConsent, setBulkConsent] = useState(Boolean(status.draft?.bulkEmbeddingAccepted));
  const [notice, setNotice] = useState('');
  const isWeb = desktop.runtime.kind === 'web';
  const currentCapability = capabilityOrder[Math.min(step, 2)];
  const form = forms[currentCapability];
  const test = status.draft?.tests[currentCapability];
  const embeddingConnection = savedConnection(status, 'embedding');
  const needsBulk = Boolean(embeddingConnection && !usesBundledVectorPack(embeddingConnection));
  const batchSize = Math.max(1, Number(embeddingConnection?.capabilities.embedding?.batchSize || 10));
  const batchRequests = Math.ceil(status.corpusCount / batchSize);

  const webOrigins = useMemo(() => {
    if (!isWeb || step > 2 || !form.apiUrl.trim() || !form.model.trim()) return [];
    try {
      return validateWebConnection(capabilityConnection({ capability: currentCapability, apiUrl: form.apiUrl, model: form.model })).origins;
    } catch { return []; }
  }, [currentCapability, form.apiUrl, form.model, isWeb, step]);

  const updateForm = (capability: AICapability, update: Partial<CapabilityForm>) => {
    setForms((current) => ({ ...current, [capability]: { ...current[capability], ...update } }));
    setNotice('');
  };

  const chooseExample = (providerId: string) => {
    const example = catalog.capabilityExamples[currentCapability].find((item) => item.providerId === providerId);
    if (example) updateForm(currentCapability, { apiUrl: example.apiUrl, model: example.model, models: [] });
  };

  const reuseConnection = (source: AICapability) => {
    try {
      const sourceForm = forms[source];
      const baseUrl = normalizeCapabilityLocation(source, sourceForm.apiUrl).baseUrl;
      updateForm(currentCapability, { apiUrl: baseUrl, apiKey: '', credentialSource: source });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '无法沿用上一项连接。');
    }
  };

  const security = () => (isWeb ? { confirmedOrigins: webOrigins } : undefined);

  const listModels = async () => {
    setBusy(true); setNotice('');
    try {
      const result = await desktop.aiConfig.listModels({
        capability: currentCapability,
        apiUrl: form.apiUrl,
        apiKey: form.apiKey.trim().replace(/^Bearer\s+/i, ''),
        credentialSource: form.credentialSource,
        webSecurity: security(),
      });
      if (!result.ok) setNotice(`${errorText(result.error)} 你仍可手动填写模型名称继续。`);
      else {
        updateForm(currentCapability, { models: result.modelIds || [], model: result.modelIds?.[0] || form.model });
        setNotice(result.warning || `已获取 ${result.modelIds?.length || 0} 个可选模型。`);
      }
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : '无法获取模型列表。'} 可能是目录不支持或浏览器 CORS 限制，可手动填写模型名称。`);
    } finally { setBusy(false); }
  };

  const testCapability = async () => {
    if (!consent) { setNotice('请先确认数据发送和第三方计费边界。'); return; }
    setBusy(true); setNotice('');
    try {
      const result = await desktop.aiConfig.testCapability({
        capability: currentCapability,
        apiUrl: form.apiUrl,
        model: form.model,
        apiKey: form.apiKey.trim().replace(/^Bearer\s+/i, ''),
        credentialSource: form.credentialSource,
        consentAccepted: consent,
        webSecurity: security(),
      });
      if (result.status) onStatus(result.status);
      if (!result.ok) setNotice(errorText(result.error));
      else {
        updateForm(currentCapability, { apiKey: '', credentialSource: currentCapability });
        setNotice(currentCapability === 'embedding'
          ? `最小测试通过，已读取真实向量维度 ${savedConnection(result.status || status, 'embedding')?.capabilities.embedding?.dimensions || ''}。`
          : '最小测试通过；本次只发送了一次对应能力请求。');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '最小测试未完成。服务商仍可能已经计费，请确认用量后手动重试。');
    } finally { setBusy(false); }
  };

  const complete = async (selected: AICapability[]) => {
    if (selected.includes('embedding') && needsBulk && !bulkConsent) {
      setNotice('请先确认古籍段数、预计批次数和服务商费用边界。');
      return;
    }
    setBusy(true); setNotice(''); setStep(3);
    try {
      const result = await desktop.aiConfig.completeSetup({ capabilities: selected, bulkEmbeddingAccepted: bulkConsent });
      if (result.status) onStatus(result.status);
      if (!result.ok) setNotice(errorText(result.error));
      else setFinished(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '配置未完成；旧的活动方案仍保持不变。');
    } finally { setBusy(false); }
  };

  const abandon = async () => {
    onStatus(await desktop.aiConfig.cancelSetup());
    onClose();
  };

  const progress = status.draft?.indexTask?.progress || 0;
  const testPassed = test?.status === 'passed';
  const canTest = Boolean(form.apiUrl.trim() && form.model.trim() && (form.apiKey.trim() || form.credentialSource));
  const pageExamples = catalog.capabilityExamples[currentCapability];

  return (
    <div className="ai-setup-overlay" role="presentation">
      <section className="ai-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-setup-title">
        <button className="ai-setup-close" type="button" aria-label="关闭 AI 连接向导" onClick={onClose}><X /></button>
        <div className="ai-setup-steps" aria-label="配置步骤">
          {['主模型', '向量模型', '重排模型', '完成'].map((label, index) => <span key={label} className={index <= step ? 'is-active' : ''}>{index + 1}<small>{label}</small></span>)}
        </div>

        {step < 3 ? <>
          <header>
            <p>{step === 0 ? '必填' : '可选'}</p>
            <h2 id="ai-setup-title">{labels[currentCapability]}{step ? '（可选）' : ''}</h2>
            <span>{descriptions[currentCapability]}</span>
          </header>

          <div className="ai-capability-examples">
            {pageExamples.map((example) => (
              <button type="button" key={`${example.providerId}-${example.model}`} onClick={() => chooseExample(example.providerId)}>
                <strong>{example.providerName}</strong><code>{example.model}</code><small>{example.description}</small>
              </button>
            ))}
          </div>

          {step > 0 ? <button className="ai-reuse-connection" type="button" onClick={() => reuseConnection(step === 1 ? 'generation' : 'embedding')}>
            <Link2 size={15} />沿用{step === 1 ? '主模型' : '向量模型'}的地址与密钥
          </button> : null}

          <label className="ai-setup-field">API 调用地址
            <input value={form.apiUrl} onChange={(event) => updateForm(currentCapability, { apiUrl: event.target.value, models: [] })} placeholder="https://api.example.com/v1" />
          </label>
          <small className="ai-field-help">可填写 Base URL，也可填写该能力的完整接口地址。</small>
          <label className="ai-setup-field">API Key
            <input type="password" autoComplete="off" value={form.apiKey} onChange={(event) => updateForm(currentCapability, { apiKey: event.target.value, credentialSource: undefined })} placeholder={form.credentialSource ? '已引用安全存储中的密钥；如需更换可直接粘贴' : isWeb ? '仅保留在当前页面的隔离 Worker 内存' : '由系统安全存储加密保存'} />
          </label>
          <div className="ai-model-picker">
            <button type="button" disabled={busy || !form.apiUrl.trim() || (!form.apiKey.trim() && !form.credentialSource)} onClick={() => void listModels()}><Search size={15} />获取模型列表</button>
            {form.models.length ? <select aria-label="选择模型" value={form.model} onChange={(event) => updateForm(currentCapability, { model: event.target.value })}>{form.models.map((model) => <option key={model}>{model}</option>)}</select> : null}
          </div>
          <label className="ai-setup-field">模型名称
            <input value={form.model} onChange={(event) => updateForm(currentCapability, { model: event.target.value })} placeholder="目录不可用时可手动填写" />
          </label>

          {step === 0 ? <>
            <div className="ai-data-boundary"><ShieldCheck /><div><strong>数据与费用边界</strong><p>最小测试只发送一次极短请求，不自动重试。正式解读只发送当前问题、排盘和最终选中的少量古籍证据。第三方服务商可能收费；超时也可能已经计费。</p>{isWeb && webOrigins.length ? <ul>{webOrigins.map((origin) => <li key={origin}><code>{origin}</code></li>)}</ul> : null}</div></div>
            <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>我已核对服务域名，并了解第三方数据发送与费用边界</span></label>
          </> : null}

          {step === 1 && testPassed && needsBulk ? <label className="ai-consent ai-bulk-consent"><input type="checkbox" checked={bulkConsent} onChange={(event) => setBulkConsent(event.target.checked)} /><span>该模型没有匹配的内置索引。需发送 {status.corpusCount} 段古籍，预计约 {batchRequests} 批；每批失败后暂停，不自动重试。我已确认服务商费用边界。</span></label> : null}
          {step === 1 && testPassed && !needsBulk ? <p className="ai-billing-note">该模型与内置向量索引匹配，将直接在本地加载，无需批量发送古籍建库。</p> : null}
          {isWeb && step > 0 && webOrigins.length ? <p className="ai-billing-note">本项请求将直连：{webOrigins.join('、')}</p> : null}
          {notice ? <p className="ai-setup-error" role="alert">{notice}</p> : null}

          <div className="ai-setup-actions">
            {step > 0 ? <button type="button" onClick={() => { setNotice(''); setStep(step - 1); }}><ArrowLeft size={15} />返回</button> : null}
            {step === 1 ? <button type="button" disabled={busy} onClick={() => void complete(['generation'])}>跳过向量并完成</button> : null}
            {step === 2 ? <button type="button" disabled={busy} onClick={() => void complete(['generation', 'embedding'])}>跳过重排并完成</button> : null}
            <button type="button" disabled={busy || !canTest || !consent} onClick={() => void testCapability()}><KeyRound size={15} />{busy ? '测试中…' : testPassed ? '重新最小测试' : '最小测试'}</button>
            {step === 0 ? <button className="primary" type="button" disabled={!testPassed} onClick={() => { setNotice(''); setStep(1); }}>下一步</button> : null}
            {step === 1 ? <button className="primary" type="button" disabled={!testPassed || (needsBulk && !bulkConsent)} onClick={() => { setNotice(''); setStep(2); }}>下一步</button> : null}
            {step === 2 ? <button className="primary" type="button" disabled={!testPassed} onClick={() => void complete(['generation', 'embedding', 'rerank'])}>完成配置</button> : null}
          </div>
          <button className="ai-abandon-setup" type="button" onClick={() => void abandon()}>放弃本次配置</button>
        </> : null}

        {step === 3 && !finished ? <>
          <header><p>索引准备</p><h2 id="ai-setup-title">{status.draft?.pipeline.embedding ? '正在准备向量检索' : '正在切换配置'}</h2><span>新配置完全准备成功前，旧的活动方案不会被覆盖。失败后可手动继续，不会自动重试远程请求。</span></header>
          {status.draft?.pipeline.embedding ? <><div className="ai-build-progress"><span style={{ transform: `scaleX(${progress / 100})` }} /></div><p className="ai-build-progress-label">{progress.toFixed(1)}% · {status.draft?.indexTask?.completed || 0}/{status.draft?.indexTask?.total || status.corpusCount}</p></> : null}
          {notice || status.draft?.indexTask?.error ? <div className="ai-setup-error" role="alert">{notice || errorText(status.draft?.indexTask?.error || undefined)}</div> : null}
          <div className="ai-setup-actions">
            {status.status === 'building' ? <button type="button" onClick={() => void desktop.aiConfig.pauseBuild().then(onStatus)}><Pause size={15} />暂停</button> : null}
            {status.status === 'paused' || status.status === 'error' ? <button type="button" onClick={() => void desktop.aiConfig.resumeBuild().then(onStatus)}><Play size={15} />手动继续</button> : null}
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </> : null}

        {step === 3 && finished ? <div className="ai-setup-complete"><Check /><p>配置完成</p><h2 id="ai-setup-title">{status.activeCapabilities?.rerank ? '关键词 + 向量 + 重排' : status.activeCapabilities?.embedding ? '关键词 + 向量' : '关键词检索'}</h2><span>主模型已可生成解读；系统会按实际已配置能力使用对应检索链路。</span><button type="button" onClick={onReady}>开始解读</button></div> : null}
      </section>
    </div>
  );
}
