import { RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { desktop } from '../lib/desktop';
import { FEEDBACK_REASONS, type FeedbackReason, type FeedbackRecord, type FeedbackState } from '../lib/feedback';

interface Props { onClose(): void }

const STATUS_LABELS: Record<FeedbackRecord['uploadStatus'], string> = {
  local: '仅本机', pending: '待发送', sent: '已发送', failed: '发送失败', cancelled: '已取消', 'withdrawal-pending': '待撤回',
};

export function FeedbackPanel({ onClose }: Props) {
  const [state, setState] = useState<FeedbackState | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const refresh = () => desktop.feedback.getState().then(setState).catch((cause) => setError(cause instanceof Error ? cause.message : '反馈读取失败'));
  useEffect(() => { void refresh(); }, []);

  const update = async (record: FeedbackRecord, patch: Partial<FeedbackRecord>) => {
    setBusy(record.feedbackId);
    setError('');
    try {
      await desktop.feedback.submit({
        feedbackId: record.feedbackId,
        sessionId: record.sessionId,
        targetType: record.targetType,
        targetId: record.targetId,
        sentiment: patch.sentiment || record.sentiment,
        reasons: patch.reasons || record.reasons,
        note: patch.note ?? record.note,
        technical: record.technical,
        contentOptIn: record.contentOptIn,
        content: record.content,
      });
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '反馈更新失败'); }
    finally { setBusy(''); }
  };

  const remove = async (record: FeedbackRecord) => {
    setBusy(record.feedbackId);
    setError('');
    try { await desktop.feedback.delete(record.feedbackId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '反馈删除失败'); }
    finally { setBusy(''); }
  };

  const toggleReason = (record: FeedbackRecord, reason: FeedbackReason) => {
    const reasons = record.reasons.includes(reason) ? record.reasons.filter((item) => item !== reason) : [...record.reasons, reason];
    void update(record, { reasons });
  };

  const setConsent = async (enabled: boolean) => {
    setBusy('consent');
    setError('');
    try { setState(await desktop.feedback.setConsent(enabled)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '上传授权保存失败'); }
    finally { setBusy(''); }
  };

  const retry = async (record: FeedbackRecord) => {
    setBusy(record.feedbackId);
    setError('');
    try { setState(await desktop.feedback.retry(record.feedbackId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '反馈重试失败'); }
    finally { setBusy(''); }
  };

  const cancel = async (record: FeedbackRecord) => {
    setBusy(record.feedbackId);
    setError('');
    try { await desktop.feedback.cancel(record.feedbackId); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '取消发送失败'); }
    finally { setBusy(''); }
  };

  return (
    <div className="overlay" role="presentation">
      <aside className="side-panel feedback-panel" aria-label="反馈管理">
        <header><div><h2>反馈管理</h2><p>反馈按不可变的解读或追问 ID 保存。</p></div><button aria-label="关闭反馈管理" type="button" onClick={onClose}><X /></button></header>
        {state ? <>
          <section className="feedback-privacy">
            <strong>反馈上传：{state.consent.technicalUpload ? '已授权' : state.consent.technicalUpload === false ? '未授权' : '尚未选择'}</strong>
            {state.consent.technicalUpload ? <button type="button" onClick={() => void setConsent(false)} disabled={busy === 'consent'}>撤销后续上传授权</button> : <button type="button" onClick={() => void setConsent(true)} disabled={busy === 'consent'}>允许上传反馈和脱敏技术信息</button>}
          </section>
          {error ? <p className="feedback-error" role="alert">{error}</p> : null}
          <div className="feedback-records">
            {state.records.length ? state.records.map((record) => (
              <article key={record.feedbackId}>
                <div className="feedback-record-heading"><strong>{record.targetType === 'analysis' ? '主报告' : '追问'} · {record.targetId}</strong><span>{STATUS_LABELS[record.uploadStatus]}</span></div>
                <div className="feedback-record-sentiment"><button className={record.sentiment === 'helpful' ? 'is-active' : ''} type="button" onClick={() => void update(record, { sentiment: 'helpful', reasons: [] })}>有帮助</button><button className={record.sentiment === 'problematic' ? 'is-active' : ''} type="button" onClick={() => void update(record, { sentiment: 'problematic' })}>有问题</button></div>
                {record.sentiment === 'problematic' ? <div className="feedback-reasons">{FEEDBACK_REASONS.map((reason) => <label key={reason}><input type="checkbox" checked={record.reasons.includes(reason)} onChange={() => toggleReason(record, reason)} />{reason}</label>)}</div> : null}
                <textarea aria-label="补充说明" defaultValue={record.note} onBlur={(event) => { if (event.target.value !== record.note) void update(record, { note: event.target.value }); }} />
                {record.lastError ? <small>{record.lastError}</small> : null}
                <div className="feedback-actions">
                  {['failed', 'pending', 'local'].includes(record.uploadStatus) && state.consent.technicalUpload ? <button type="button" onClick={() => void retry(record)} disabled={busy === record.feedbackId}><RefreshCw size={14} />重试</button> : null}
                  {['failed', 'pending', 'local'].includes(record.uploadStatus) ? <button type="button" onClick={() => void cancel(record)} disabled={busy === record.feedbackId}>取消发送</button> : null}
                  <button type="button" onClick={() => void remove(record)} disabled={busy === record.feedbackId}><Trash2 size={14} />{record.uploadStatus === 'sent' || record.uploadStatus === 'withdrawal-pending' ? '撤回并删除' : '删除'}</button>
                </div>
              </article>
            )) : <p>还没有反馈记录。</p>}
          </div>
        </> : <p>正在读取反馈…</p>}
      </aside>
    </div>
  );
}
