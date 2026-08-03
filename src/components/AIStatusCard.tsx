import { AlertTriangle, Bot, CheckCircle2, LoaderCircle, Settings2 } from 'lucide-react';
import type { AIConfigStatus } from '../types/desktop';

interface Props {
  status: AIConfigStatus;
  onConfigure(): void;
  onAdvanced(): void;
}

const statusLabel: Record<AIConfigStatus['status'], string> = {
  unconfigured: '未连接',
  'needs-consent': '需要确认',
  'needs-setup': '需要处理',
  'index-required': '需要构建索引',
  testing: '正在检测',
  building: '正在准备',
  paused: '已暂停',
  error: '发生错误',
  ready: '已就绪',
};

export function AIStatusCard({ status, onConfigure, onAdvanced }: Props) {
  const progress = status.draft?.indexTask?.progress ?? 0;
  const busy = status.status === 'testing' || status.status === 'building';
  const Icon = status.status === 'ready' ? CheckCircle2 : busy ? LoaderCircle : status.status === 'error' ? AlertTriangle : Bot;
  return (
    <div className={`ai-status-card ai-status-card--${status.status}`}>
      <div className="ai-status-card__icon"><Icon className={busy ? 'is-spinning' : undefined} /></div>
      <div className="ai-status-card__copy">
        <div className="ai-status-card__title"><strong>AI 服务</strong><span>{statusLabel[status.status]}</span></div>
        <p>{status.message}</p>
        {status.status === 'building' || status.status === 'paused' ? (
          <div className="ai-status-card__progress" aria-label={`向量索引进度 ${progress.toFixed(1)}%`}>
            <span style={{ transform: `scaleX(${Math.max(0, Math.min(100, progress)) / 100})` }} />
          </div>
        ) : null}
        {status.activeCapabilities ? (
          <div className="ai-capability-summary">
            <span>解读 · {status.activeCapabilities.generation.model}</span>
            <span>向量 · {status.activeCapabilities.embedding.model}</span>
            <span>重排 · {status.activeCapabilities.rerank.model}</span>
          </div>
        ) : null}
      </div>
      <div className="ai-status-card__actions">
        <button type="button" onClick={onConfigure}>{status.status === 'ready' ? '更换方案' : status.status === 'building' ? '查看进度' : '连接服务'}</button>
        <button type="button" onClick={onAdvanced}><Settings2 size={15} />高级</button>
      </div>
    </div>
  );
}
