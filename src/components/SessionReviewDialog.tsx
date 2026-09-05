import { useState } from 'react';
import { X } from 'lucide-react';
import type { DivinationSession, SessionReview } from '../lib/session';
import { useModalDialog } from '../lib/useModalDialog';

export const REVIEW_LABELS = { pending: '待验证', happened: '已发生', unclear: '无法判断' } as const;

export function SessionReviewDialog({ session, onSave, onClose }: {
  session: DivinationSession; onSave(id: string, review: SessionReview): Promise<void>; onClose(): void;
}) {
  const [status, setStatus] = useState<SessionReview['status']>(session.review?.status || 'pending');
  const [date, setDate] = useState(session.review?.observedAt || '');
  const [note, setNote] = useState(session.review?.note || '');
  const [tags, setTags] = useState(session.review?.tags.join('，') || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useModalDialog<HTMLElement>(onClose, busy);
  const save = async () => {
    setBusy(true); setError('');
    try {
      await onSave(session.id, { status, observedAt: date, note, tags: [...new Set(tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean))], updatedAt: new Date().toISOString() });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '复盘保存失败，请重试。'); }
    finally { setBusy(false); }
  };
  return <div className="archive-overlay"><section ref={ref} tabIndex={-1} className="archive-dialog review-dialog" role="dialog" aria-modal="true" aria-labelledby="review-title">
    <header><div><h2 id="review-title">占后复盘</h2><p>{session.question}</p></div><button type="button" aria-label="关闭复盘" disabled={busy} onClick={onClose}><X /></button></header>
    <p>记录后来实际发生的事，保留最初的解读，方便回看比较。</p>
    <label>验证状态<select value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as SessionReview['status'])}>{Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>实际发生或回看日期<input type="date" value={date} disabled={busy} onChange={(event) => setDate(event.target.value)} /></label>
    <label>实际结果与个人备注<textarea rows={5} maxLength={5000} value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} placeholder="发生了什么？哪些条件兑现或改变了？还有哪些无法确认？" /></label>
    <label>个人标签<input value={tags} disabled={busy} onChange={(event) => setTags(event.target.value)} placeholder="用逗号分隔，最多 8 个，每个 20 字" /></label>
    <small>复盘保存在本机，随占簿备份导出；不会作为回答评价上传。</small>
    {error ? <p role="alert" className="archive-warning">{error}</p> : null}
    <footer><button disabled={busy} type="button" onClick={onClose}>取消</button><button disabled={busy} type="button" onClick={() => void save()}>{busy ? '保存中…' : '保存复盘'}</button></footer>
  </section></div>;
}
