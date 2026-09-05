import { Database, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, AIProviderCatalog, CorpusStatus, UpdateState } from '../types/desktop';
import { AIStatusCard } from './AIStatusCard';
import { CreatorLinks } from './CreatorLinks';
import { useModalDialog } from '../lib/useModalDialog';

interface Props {
  updateState: UpdateState;
  aiStatus: AIConfigStatus;
  aiCatalog: AIProviderCatalog;
  onConfigureAI(): void;
  onCheckUpdate(): void;
  onOpenUpdate(): void;
  onOpenCorpus(): void;
  onClose(): void;
}

function updateStatusText(state: UpdateState) {
  switch (state.status) {
    case 'unsupported': return '当前平台不支持应用内更新';
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
  onConfigureAI,
  onCheckUpdate,
  onOpenUpdate,
  onOpenCorpus,
  onClose,
}: Props) {
  const runtime = desktop.runtime;
  const dialogRef = useModalDialog<HTMLElement>(onClose);
  const { capabilities } = runtime;
  const secureStorageText = runtime.secureStorage === 'keychain'
    ? '访问密钥由 macOS 钥匙串保护，历史、语料和向量索引保存在当前用户的 Application Support 中。'
    : runtime.secureStorage === 'dpapi'
      ? '访问密钥由 Windows DPAPI 加密，历史和向量索引留在本机。'
      : '访问密钥由当前系统的安全存储保护，历史和向量索引留在本机。';
  const [corpus, setCorpus] = useState<CorpusStatus>({ count: 0, bookCount: 0, builtInBookCount: 0, userBookCount: 0, enabledBookCount: 0, chunkCount: 0, deletedBookCount: 0, pendingIndexCount: 0, originalCount: 0, summaryCount: 0, ruleCount: 0, caseCount: 0, doctrineCount: 0, vectorReady: false, vectorModel: '', readyShardIds: [], ready: false });
  useEffect(() => { void desktop.corpus.status().then(setCorpus); }, [aiStatus.status, aiStatus.activeFingerprint]);
  const usage = useMemo(() => aiStatus.usage.reduce((total, item) => total + item.totalTokens, 0), [aiStatus.usage]);
  const activePresetIds = new Set(aiStatus.connections.filter((connection) => aiStatus.activeCapabilities && Object.values(aiStatus.activeCapabilities).some((capability) => capability.connectionId === connection.id)).map((connection) => connection.presetId));
  const billingLinks = aiCatalog.presets.filter((preset) => activePresetIds.has(preset.id));

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} tabIndex={-1} className="side-panel settings-panel" aria-modal="true" role="dialog" aria-label="应用设置">
        <header><div><h2>应用设置</h2><p>{capabilities.ai ? (runtime.kind === 'web' ? '会话级 AI 服务与本地知识库' : '软件更新、AI 服务与本地知识库') : '本地排盘、历史记录与内置古籍'}</p></div><button type="button" aria-label="关闭设置" onClick={onClose}><X /></button></header>

        <section className="settings-section">
          <AIStatusCard available={capabilities.ai} status={aiStatus} onConfigure={onConfigureAI} />
          {capabilities.ai ? <p className="ai-billing-note">AI 调用费用由所选服务商收取，问爻不会代扣，也不会根据可能变化的价格自行估算金额。</p> : null}
          {capabilities.ai && billingLinks.length ? <div className="ai-billing-links">{billingLinks.map((preset) => <button type="button" key={preset.id} onClick={() => void desktop.aiConfig.openExternal(preset.setup.billingUrl)}>{preset.name} 余额 / 充值 <ExternalLink size={13} /></button>)}</div> : null}
          {capabilities.ai && usage > 0 ? <p className="ai-usage-summary">本机已记录 {aiStatus.usage.length} 次带用量响应，共 {usage.toLocaleString('zh-CN')} Tokens；不含未返回用量的服务。</p> : null}
        </section>

        {runtime.updateMode === 'native' ? <section className="settings-section update-settings">
          <div className="settings-heading"><RefreshCw /><div><strong>软件更新</strong><span>{updateStatusText(updateState)}</span></div></div>
          <div className="update-version-row"><span>当前版本</span><strong>{updateState.currentVersion ? `v${updateState.currentVersion}` : '未知'}</strong></div>
          {updateState.status === 'error' && updateState.manual ? <p className="settings-status" role="alert">{updateState.message}</p> : null}
          <button className="index-button" type="button" disabled={updateState.status === 'unsupported' || updateState.status === 'checking' || updateState.status === 'downloading'} onClick={updateState.status === 'available' || updateState.status === 'downloaded' || (updateState.status === 'error' && updateState.operation === 'download') ? onOpenUpdate : onCheckUpdate}>
            {updateState.status === 'checking' ? '正在检查…' : updateState.status === 'downloading' ? `下载中 ${updateState.progress.toFixed(1)}%` : updateState.status === 'available' || updateState.status === 'downloaded' || (updateState.status === 'error' && updateState.operation === 'download') ? '查看更新' : updateState.status === 'error' ? '重新检查' : '检查更新'}
          </button>
          <p className="update-signing-note">当前版本尚未进行 Windows 代码签名，安装更新时仍可能出现 SmartScreen 提示；SHA-512 完整性校验不等同于发布者身份验证。</p>
        </section> : null}

        {runtime.updateMode === 'manual' ? <section className="settings-section update-settings">
          <div className="settings-heading"><RefreshCw /><div><strong>软件更新</strong><span>macOS 开源版通过 GitHub Releases 手动更新</span></div></div>
          <div className="update-version-row"><span>当前版本</span><strong>{updateState.currentVersion ? `v${updateState.currentVersion}` : '未知'}</strong></div>
          <button className="index-button" type="button" onClick={() => void desktop.externalLinks.open('releases')}>查看最新版本 <ExternalLink size={13} /></button>
          <p className="update-signing-note">免费发行版没有 Apple Developer ID 与公证票据。覆盖安装不会删除 Application Support 中的历史和语料；新版本首次打开时，macOS 可能再次要求在“隐私与安全性”中确认。</p>
        </section> : null}

        <section className="settings-section">
          <div className="settings-heading"><Database /><div><strong>{capabilities.ai ? '本地结构化古籍库' : '内置古籍库'}</strong><span>{capabilities.ai ? (corpus.vectorReady ? `${corpus.vectorModel} 向量索引已就绪` : '本地关键词检索可用') : '内置古籍可在本机浏览和检索'}</span></div></div>
          {capabilities.ai ? <div className="corpus-stats corpus-stats--knowledge"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.ruleCount}</b>条规则</span><span><b>{corpus.caseCount}</b>条占例</span><span><b>{corpus.doctrineCount}</b>条义理</span></div> : <div className="corpus-stats"><span><b>{corpus.bookCount}</b>本古籍</span><span><b>{corpus.count}</b>段原文</span></div>}
          {capabilities.ai ? <p className="corpus-ready">当前检索模式：{aiStatus.activeCapabilities?.rerank ? '关键词 + 向量 + 重排' : aiStatus.activeCapabilities?.embedding ? '关键词 + 向量' : '关键词检索'}。已启用古籍即使没有向量索引，也会参与本地关键词检索。</p> : <p className="corpus-ready">起卦、排盘、历史记录和内置古籍均在当前设备中使用；清除浏览器站点数据会移除本地历史。</p>}
          <button className="index-button" type="button" onClick={onOpenCorpus}>打开古籍书库</button>
        </section>

        <CreatorLinks variant="panel" />

        <div className="security-note"><ShieldCheck /><p><strong>隐私边界</strong>{runtime.kind === 'electron' ? `${secureStorageText}设置中可以随时查看当前问题、排盘、证据与追问分别发送给哪一家服务商。` : capabilities.ai ? '网页版密钥只保存在当前页面的隔离内存中，不写入浏览器存储；刷新、关页或应用更新会清除。AI 服务商会收到密钥和本次请求数据，浏览器扩展、设备或已被篡改的网页仍不属于问爻能够绝对防护的边界。' : '此预览域名不接收 AI 密钥；排盘与历史保存在当前浏览器，不需要账号，也不会同步到服务器。清除站点数据会同时删除本地历史。'}</p></div>
      </aside>
    </div>
  );
}
