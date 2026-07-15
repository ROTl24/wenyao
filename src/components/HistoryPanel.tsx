import { Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DivinationSession } from '../lib/session';
import { SESSION_CATEGORY_LABELS } from '../lib/sessionCategories';
import { HexagramLines } from './HexagramLines';

interface Props { sessions: DivinationSession[]; onClose(): void; onOpen(session: DivinationSession): void; onDelete(id: string): void }

export function HistoryPanel({ sessions, onClose, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    if (!keyword) return sessions;
    return sessions.filter((session) => [
      session.question,
      SESSION_CATEGORY_LABELS[session.category],
      session.plate?.baseHexagram.name,
      session.plate?.baseHexagram.shortName,
      session.plate?.changedHexagram.name,
      session.plate?.changedHexagram.shortName,
    ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(keyword));
  }, [sessions, query]);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel history-panel" aria-describedby="history-description" aria-labelledby="history-title" aria-modal="true" role="dialog">
        <header><div><h2 id="history-title">问爻占簿</h2><p id="history-description">按起卦时间归档，未完成的记录也会保留</p></div><button type="button" aria-label="关闭历史记录" onClick={onClose}><X /></button></header>
        <label className="panel-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索占簿" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、事项或卦名" /></label>
        <div className="history-list">
          {visible.length ? visible.map((session) => (
            <article className="history-row" key={session.id}>
              <button className="history-main" type="button" onClick={() => onOpen(session)}>
                <span className="history-date">{new Date(session.castAt).toLocaleDateString('zh-CN')}</span>
                <span className="history-copy">
                  <span className="history-category">{SESSION_CATEGORY_LABELS[session.category]}</span>
                  <strong>{session.question}</strong>
                  <small>{session.status === 'complete' ? `${session.plate?.baseHexagram.name} → ${session.plate?.changedHexagram.name}` : `起卦中 · 已定 ${session.tosses.length} 爻`}</small>
                </span>
                <span className="history-glyph" aria-hidden="true">
                  {session.plate
                    ? <HexagramLines lines={session.plate.lines.map((line) => line.baseYang).reverse()} moving={session.plate.movingLines} compact />
                    : <strong>{session.tosses.length}<small>/ 6</small></strong>}
                </span>
              </button>
              <button className="delete-button" type="button" aria-label={`删除：${session.question}`} onClick={() => { if (window.confirm('确定删除这次起卦及全部对话吗？')) onDelete(session.id); }}><Trash2 size={16} /></button>
            </article>
          )) : <p className="panel-empty">占簿中还没有符合条件的记录。</p>}
        </div>
      </aside>
    </div>
  );
}
