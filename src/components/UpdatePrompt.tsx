import { Download, RefreshCw, RotateCw, X } from 'lucide-react';
import type { UpdateState } from '../types/desktop';
import { useModalDialog } from '../lib/useModalDialog';

export type PromptUpdateState = Extract<
  UpdateState,
  { status: 'available' | 'downloading' | 'downloaded' | 'error' }
>;

interface Props {
  state: PromptUpdateState;
  onDownload(): void;
  onInstall(): void;
  onDismiss(): void;
}

export function UpdatePrompt({
  state,
  onDownload,
  onInstall,
  onDismiss,
}: Props) {
  const version = state.availableVersion || '新版本';
  const dialogRef = useModalDialog<HTMLElement>(onDismiss);
  const isDownloadError = state.status === 'error' && state.operation === 'download';

  return (
    <div className="update-overlay" role="presentation">
      <section ref={dialogRef} tabIndex={-1} className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
        <button className="update-dialog__close" type="button" aria-label="关闭更新提示" onClick={onDismiss}>
          <X size={18} />
        </button>
        <div className="update-dialog__seal" aria-hidden="true">新</div>

        {state.status === 'available' && (
          <>
            <p className="update-dialog__eyebrow">问爻软件更新</p>
            <h2 id="update-dialog-title">发现新版本</h2>
            <p>版本 <strong>v{version}</strong> 已经可以下载。确认后才会开始，不影响当前保存的起卦与历史记录。</p>
            <div className="update-dialog__actions">
              <button className="update-primary-action" type="button" onClick={onDownload}><Download size={16} />下载更新</button>
              <button type="button" onClick={onDismiss}>稍后</button>
            </div>
          </>
        )}

        {state.status === 'downloading' && (
          <>
            <p className="update-dialog__eyebrow">正在获取 v{version}</p>
            <h2 id="update-dialog-title">下载更新</h2>
            <p>可以收起此窗口继续使用问爻，下载完成后会再次提醒。</p>
            <div
              className="update-progress"
              role="progressbar"
              aria-label="更新下载进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={state.progress}
            >
              <span style={{ transform: `scaleX(${state.progress / 100})` }} />
            </div>
            <strong className="update-progress__label">{state.progress.toFixed(1)}%</strong>
            <div className="update-dialog__actions">
              <button type="button" onClick={onDismiss}>收起并继续使用</button>
            </div>
          </>
        )}

        {state.status === 'downloaded' && (
          <>
            <p className="update-dialog__eyebrow">v{version} 已下载</p>
            <h2 id="update-dialog-title">更新已经就绪</h2>
            <p>立即重启即可完成安装；选择稍后时，会在您正常退出问爻后自动安装。</p>
            <div className="update-dialog__actions">
              <button className="update-primary-action" type="button" onClick={onInstall}><RotateCw size={16} />立即重启安装</button>
              <button type="button" onClick={onDismiss}>稍后，退出时安装</button>
            </div>
          </>
        )}

        {state.status === 'error' && (
          <>
            <p className="update-dialog__eyebrow">更新未完成</p>
            <h2 id="update-dialog-title">{isDownloadError ? '下载遇到问题' : '检查遇到问题'}</h2>
            <p role="alert">{state.message}</p>
            <div className="update-dialog__actions">
              {isDownloadError && <button className="update-primary-action" type="button" onClick={onDownload}><RefreshCw size={16} />重试下载</button>}
              <button type="button" onClick={onDismiss}>关闭</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
