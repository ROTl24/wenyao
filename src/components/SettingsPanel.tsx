import { Database, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, AIProviderCatalog, CorpusStatus, UpdateState } from '../types/desktop';
import { AIAdvancedSettings } from './AIAdvancedSettings';
import { AIStatusCard } from './AIStatusCard';
import { CreatorLinks } from './CreatorLinks';

interface Props {
  updateState: UpdateState;
  aiStatus: AIConfigStatus;
  aiCatalog: AIProviderCatalog;
  onAIStatus(status: AIConfigStatus): void;
  onConfigureAI(): void;
  onCheckUpdate(): void;
  onOpenUpdate(): void;
  onOpenCorpus(): void;
  onClose(): void;
}

function updateStatusText(state: UpdateState) {
  switch (state.status) {
    case 'unsupported': return '浏览器预览不支持桌面应用更新';
    case 'idle': return '已启用启动检查与每 6 小时自动检查';
    case 'checking': return '正在检查新版本…';
    case 'upToDate': return '当前已经是最新版本';
    case 'available': return `发现 v${state.availableVersion}`;
    case 'downloading': return `正在下载 v${state.availableVersion} · ${state.progress.toFixed(1)}%`;
    case 'downloaded': return `v${state.availableVersion} 已下载，等待安装`;
    case 'error': return state.manual ? state.message : '上次自动检查未完成，可手动重试';
  }
}

export function SettingsPanel({
  updateState,
  aiStatus,
  aiCatalog,
  onAIStatus,
  onConfigureAI,
  onCheckUpdate,
  onOpenUpdate,
  onOpenCorpus,
  onClose,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [corpus, setCorpus] = useState<CorpusStatus>({ count: 0, bookCount: 0, builtInBookCount: 0, userBookCount: 0, enabledBookCount: 0, chunkCount: 0, deletedBookCount: 0, pendingIndexCount: 0, originalCount: 0, summaryCount: 0, ruleCount: 0, caseCount: 0, doctrineCount: 0, vectorReady: false, vectorModel: '', readyShardIds: [], ready: false });
  useEffect(() => { void desktop.corpus.status().then(setCorpus); }, [aiStatus.status, aiStatus.activeFingerprint]);
  const usage = useMemo(() => aiStatus.usage.reduce((total, item) => total + item.totalTokens, 0), [aiStatus.usage]);
  const activePresetIds = new Set(aiStatus.connections.filter((connection) => aiStatus.activeCapabilities && Object.values(aiStatus.activeCapabilities).some((capability) => capability.connectionId === connection.id)).map((connection) => connection.presetId));
  const billingLinks = aiCatalog.presets.filter((preset) => activePresetIds.has(preset.id));

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel settings-panel" aria-modal="true" role="dialog">
        <header><div><h2>应用设置</h2><p>软件更新、AI 服务与本地知识库</p></div><button type="button" aria-label="关闭设置" onClick={onClose}><X /></button></header>

        <section className="settings-section">
          <AIStatusCard status={aiStatus} onConfigure={onConfigureAI} onAdvanced={() => setAdvancedOpen(true)} />
          <p className="ai-billing-note">AI 调用费用由所选服务商收取，问爻不会代扣，也不会根据可能变化的价格自行估算金额。</p>
          {billingLinks.length ? <div className="ai-billing-links">{billingLinks.map((preset) => <button type="button" key={preset.id} onClick={() => void desktop.aiConfig.openExternal(preset.setup.billingUrl)}>{preset.name} 余额 / 充值 <ExternalLink size={13} /></button>)}</div> : null}
          {usage > 0 ? <p className="ai-usage-summary">本机已记录 {aiStatus.usage.length} 次带用量响应，共 {usage.toLocaleString('zh-CN')} Tokens；不含未返回用量的服务。</p> : null}
        </section>

        <section className="settings-section update-settings">
          <div className="settings-heading"><RefreshCw /><div><strong>软件更新</strong><span>{updateStatusText(updateState)}</span></div></div>
          <div className="update-version-row"><span>当前版本</span><strong>{updateState.currentVersion ? `v${updateState.currentVersion}` : '未知'}</strong></div>
          {updateState.status === 'error' && updateState.manual ? <p className="settings-status" role="alert">{updateState.message}</p> : null}
          <button className="index-button" type="button" disabled={updateState.status === 'unsupported' || updateState.status === 'checking' || updateState.status === 'downloading'} onClick={updateState.status === 'available' || updateState.status === 'downloaded' || (updateState.status === 'error' && updateState.operation === 'download') ? onOpenUpdate : onCheckUpdate}>
            {updateState.status === 'checking' ? '正在检查…' : updateState.status === 'downloading' ? `下载中 ${updateState.progress.toFixed(1)}%` : updateState.status === 'available' || updateState.status === 'downloaded' || (updateState.status === 'error' && updateState.operation === 'download') ? '查看更新' : updateState.status === 'error' ? '重新检查' : '检查更新'}
          </button>
          <p className="update-signing-note">当前版本尚未进行 Windows 代码签名，安装更新时仍可能出现 SmartScreen 提示；SHA-512 完整性校验不等同于发布者身份验证。</p>
        </section>

        <section className="settings-section">
          <div className="settings-heading"><Database /><div><strong>本地结构化古籍库</strong><span>{corpus.vectorReady ? `${corpus.vectorModel} 向量索引已就绪` : '向量索引尚未完成'}</span></div></div>
          <div className="corpus-stats corpus-stats--knowledge"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.ruleCount}</b>条规则</span><span><b>{corpus.caseCount}</b>条占例</span><span><b>{corpus.doctrineCount}</b>条义理</span></div>
          {corpus.vectorReady ? <p className="corpus-ready">严格检索已启用：关键词候选 + 向量召回 + 专用模型重排。</p> : <p className="corpus-warning">AI 解读必须等待向量召回和重排均可用，不会退回关键词检索生成报告。</p>}
          <button className="index-button" type="button" onClick={onOpenCorpus}>打开古籍书库</button>
        </section>

        <CreatorLinks variant="panel" />

        <div className="security-note"><ShieldCheck /><p><strong>隐私边界</strong>访问密钥由 Windows DPAPI 加密，历史和向量索引留在本机。设置中可以随时查看当前问题、排盘、证据与追问分别发送给哪一家服务商。</p></div>
      </aside>
      {advancedOpen ? <AIAdvancedSettings catalog={aiCatalog} status={aiStatus} onStatus={onAIStatus} onClose={() => setAdvancedOpen(false)} /> : null}
    </div>
  );
}
