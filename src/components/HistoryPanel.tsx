import { Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CASTING_METHOD_LABELS, type DivinationSession } from '../lib/session';
import { SESSION_CATEGORY_LABELS } from '../lib/sessionCategories';
import { formatShanghaiDate } from '../lib/shanghaiTime';
import { HexagramLines } from './HexagramLines';
import { useModalDialog } from '../lib/useModalDialog';
import { SessionArchiveControls } from './SessionArchiveControls';
import type { SessionImportRequest } from '../lib/sessionArchive';
import type { SessionReview } from '../lib/session';
import { REVIEW_LABELS, SessionReviewDialog } from './SessionReviewDialog';

interface Props { sessions: DivinationSession[]; onClose(): void; onOpen(session: DivinationSession): void; onDelete(id: string): void; onImport?(payload: SessionImportRequest): Promise<void>; onSaveReview?(id: string, review: SessionReview): Promise<void> }

export function HistoryPanel({ sessions, onClose, onOpen, onDelete, onImport, onSaveReview }: Props) {
  const dialogRef = useModalDialog<HTMLElement>(onClose);
  const [query, setQuery] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewSession, setReviewSession] = useState<DivinationSession | null>(null);
  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return sessions.filter((session) => (reviewFilter === 'all' || (session.review?.status || 'pending') === reviewFilter) && [
      session.question,
      SESSION_CATEGORY_LABELS[session.category],
      CASTING_METHOD_LABELS[session.castingMethod],
      session.plate?.baseHexagram.name,
      session.plate?.baseHexagram.shortName,
      session.plate?.changedHexagram.name,
      session.plate?.changedHexagram.shortName,
      session.review?.note,
      session.review?.tags.join(' '),
    ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(keyword));
  }, [sessions, query, reviewFilter]);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} tabIndex={-1} className="side-panel history-panel" aria-describedby="history-description" aria-labelledby="history-title" aria-modal="true" role="dialog">
        <header><div><h2 id="history-title">问爻占簿</h2><p id="history-description">按起卦时间归档，未完成的记录也会保留</p></div><button type="button" aria-label="关闭历史记录" onClick={onClose}><X /></button></header>
        <label className="panel-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索占簿" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、事项或卦名" /></label>
        <label className="review-filter">复盘状态<select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}><option value="all">全部记录</option>{Object.entries(REVIEW_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <SessionArchiveControls sessions={visible} existingSessions={sessions} onImport={onImport} />
        <div className="history-list">
          {visible.length ? visible.map((session) => (
            <article className="history-row" key={session.id}>
              <button className="history-main" type="button" onClick={() => onOpen(session)}>
                <span className="history-date">{formatShanghaiDate(new Date(session.castAt))}</span>
                <span className="history-copy">
                  <span className="history-category">
                    <span>{SESSION_CATEGORY_LABELS[session.category]}</span>
                    <i aria-hidden="true">·</i>
                    <span>{CASTING_METHOD_LABELS[session.castingMethod]}</span>
                  </span>
                  <strong>{session.question}</strong>
                  <small>{session.status === 'complete' ? `${session.plate?.baseHexagram.name} → ${session.plate?.changedHexagram.name}` : `起卦中 · 已定 ${session.lines.length} 爻`}</small>
                </span>
                <span className="history-glyph" aria-hidden="true">
                  {session.plate
                    ? <HexagramLines lines={session.plate.lines.map((line) => line.baseYang).reverse()} moving={session.plate.movingLines} compact />
                    : <strong>{session.lines.length}<small>/ 6</small></strong>}
                </span>
              </button>
              {onSaveReview ? <button type="button" className="history-review" onClick={() => setReviewSession(session)} aria-label={`复盘：${session.question}`}>{REVIEW_LABELS[session.review?.status || 'pending']}</button> : null}
              <button className="delete-button" type="button" aria-label={`删除：${session.question}`} onClick={() => { if (window.confirm('确定删除这次起卦及全部对话吗？')) onDelete(session.id); }}><Trash2 size={16} /></button>
            </article>
          )) : <p className="panel-empty">占簿中还没有符合条件的记录。</p>}
        </div>
        {reviewSession && onSaveReview ? <SessionReviewDialog session={reviewSession} onSave={onSaveReview} onClose={() => setReviewSession(null)} /> : null}
      </aside>
    </div>
  );
}
