import { Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DivinationSession } from '../lib/session';

const categoryNames: Record<DivinationSession['category'], string> = {
  career: '事业工作',
  relationship: '感情婚姻',
  wealth: '财运投资',
  study: '学业考试',
  health: '健康调养',
  lost_item: '寻人寻物',
  travel: '出行远近',
  other: '其他',
};

interface Props { sessions: DivinationSession[]; onClose(): void; onOpen(session: DivinationSession): void; onDelete(id: string): void }

function needsReview(session: DivinationSession): boolean {
  return (session as unknown as Record<string, unknown>).migrationState === 'needs-review';
}

function reviewQuestion(session: DivinationSession): string {
  const value = (session as unknown as Record<string, unknown>).question;
  return typeof value === 'string' && value.trim() ? value : '旧记录（字段不完整）';
}

function reviewDate(session: DivinationSession): string {
  const value = (session as unknown as Record<string, unknown>).castAt;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '日期未知';
  return new Date(value).toLocaleDateString('zh-CN');
}

export function HistoryPanel({ sessions, onClose, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    if (!keyword) return sessions;
    return sessions.filter((session) => {
      if (needsReview(session)) {
        return `${reviewQuestion(session)} 需要人工复核`.toLocaleLowerCase('zh-CN').includes(keyword);
      }
      return [
        session.question,
        categoryNames[session.category],
        session.plate?.baseHexagram.name,
        session.plate?.baseHexagram.shortName,
        session.plate?.changedHexagram.name,
        session.plate?.changedHexagram.shortName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN').includes(keyword);
    });
  }, [sessions, query]);
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="side-panel history-panel" aria-modal="true" role="dialog">
        <header><div><h2>历史记录</h2><p>每一爻确认后都会自动保存</p></div><button type="button" aria-label="关闭历史记录" onClick={onClose}><X /></button></header>
        <label className="panel-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、事项或卦名" /></label>
        <div className="history-list">
          {visible.length ? visible.map((session, index) => {
            const review = needsReview(session);
            const question = review ? reviewQuestion(session) : session.question;
            const record = session as unknown as Record<string, unknown>;
            const stableId = typeof record.id === 'string' && record.id.trim() ? record.id : `review-${index}`;
            return (
              <article className="history-row" key={`${stableId}:${index}`}>
                <button className="history-main" type="button" onClick={() => onOpen(session)}>
                  <span>{review ? reviewDate(session) : new Date(session.castAt).toLocaleDateString('zh-CN')}</span>
                  <strong>{question}</strong>
                  <small>{review
                    ? '需要人工复核'
                    : session.status === 'complete'
                      ? `${session.plate?.baseHexagram.name} → ${session.plate?.changedHexagram.name}`
                      : `起卦中 · 已定 ${session.tosses.length} 爻`}</small>
                </button>
                {!review && (
                  <button className="delete-button" type="button" aria-label={`删除：${question}`} onClick={() => { if (window.confirm('确定删除这次起卦及全部对话吗？')) onDelete(stableId); }}><Trash2 size={16} /></button>
                )}
              </article>
            );
          }) : <p className="panel-empty">还没有符合条件的记录。</p>}
        </div>
      </aside>
    </div>
  );
}
