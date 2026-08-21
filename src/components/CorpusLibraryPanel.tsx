import { ArchiveRestore, ArrowLeft, BookOpen, CirclePause, CirclePlay, FilePlus2, Pencil, Save, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, CorpusBookDetail, CorpusBookSummary, CorpusImportBatch, CorpusStatus } from '../types/desktop';
import { CorpusImportDialog } from './CorpusImportDialog';
import './CorpusLibraryPanel.css';

interface Props { aiStatus: AIConfigStatus; onClose(): void }

const emptyStatus: CorpusStatus = {
  count: 0, bookCount: 0, builtInBookCount: 0, userBookCount: 0, enabledBookCount: 0,
  chunkCount: 0, deletedBookCount: 0, pendingIndexCount: 0, originalCount: 0, summaryCount: 0,
  ruleCount: 0, caseCount: 0, doctrineCount: 0, vectorReady: false, vectorModel: '', readyShardIds: [], ready: false,
};

function indexLabel(book: CorpusBookSummary) {
  if (!book.enabled && book.indexState !== 'local-only') return '已停用';
  switch (book.indexState) {
    case 'local-only': return '仅本地';
    case 'pending': return '待索引';
    case 'building': return `索引中 ${book.indexProgress.toFixed(1)}%`;
    case 'paused': return `已暂停 ${book.indexProgress.toFixed(1)}%`;
    case 'error': return '索引失败';
    case 'ready': return '可用于 AI';
  }
}

export function CorpusLibraryPanel({ aiStatus, onClose }: Props) {
  const [status, setStatus] = useState<CorpusStatus>(emptyStatus);
  const [books, setBooks] = useState<CorpusBookSummary[]>([]);
  const [bookTotal, setBookTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [selected, setSelected] = useState<CorpusBookDetail | null>(null);
  const [entryQuery, setEntryQuery] = useState('');
  const [entries, setEntries] = useState<Array<{ id: string; title: string; location: string; text: string }>>([]);
  const [editing, setEditing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editMetadata, setEditMetadata] = useState({ title: '', author: '', edition: '' });
  const [importBatch, setImportBatch] = useState<CorpusImportBatch | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStatus, listing] = await Promise.all([
      desktop.corpus.status(),
      desktop.corpus.books({ includeDeleted: showDeleted, query, limit: 100 }),
    ]);
    setStatus(nextStatus);
    setBooks(listing.items);
    setBookTotal(listing.total);
  }, [query, showDeleted]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => desktop.corpus.onState((next) => { setStatus(next); void refresh(); }), [refresh]);

  const openBook = async (book: CorpusBookSummary) => {
    setEntryQuery('');
    const [detail, result] = await Promise.all([
      desktop.corpus.book(book.id),
      desktop.corpus.bookEntries({ bookId: book.id, limit: 30 }),
    ]);
    setSelected(detail);
    setEditing(false);
    if (detail) setEditMetadata({ title: detail.title, author: detail.author, edition: detail.edition });
    setEntries(result.items);
  };

  const searchEntries = async (value: string) => {
    setEntryQuery(value);
    if (!selected) return;
    const result = await desktop.corpus.bookEntries({ bookId: selected.id, query: value, limit: 30 });
    setEntries(result.items);
  };

  const closeBook = () => {
    setSelected(null);
    setEntryQuery('');
    setEntries([]);
    setEditing(false);
  };

  const previewSelection = async () => {
    setError('');
    const response = await desktop.corpus.selectImportFiles();
    if (!response.ok) setError(response.error?.message || '无法选择文件');
    else if (response.batch) setImportBatch(response.batch);
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const listing = await desktop.corpus.books({ includeDeleted: showDeleted, query, offset: books.length, limit: 100 });
      setBooks((current) => [...current, ...listing.items]);
      setBookTotal(listing.total);
    } finally {
      setLoadingMore(false);
    }
  };

  const previewDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    setError('');
    const response = await desktop.corpus.previewDroppedFiles(event.dataTransfer.files);
    if (!response.ok) setError(response.error?.message || '无法读取拖入文件');
    else if (response.batch) setImportBatch(response.batch);
  };

  const toggleBook = async (book: CorpusBookSummary) => {
    let requestIndex = false;
    if (!book.enabled && book.origin === 'user' && book.indexState === 'local-only') {
      requestIndex = window.confirm('启用后需要把该书正文发送给当前向量服务建立索引。是否继续？');
      if (!requestIndex) return;
    }
    const response = await desktop.corpus.setEnabled(book.id, !book.enabled, requestIndex);
    if (!response.ok) setError(response.error?.message || '无法更新书籍状态');
    await refresh();
  };

  const trashBook = async (book: CorpusBookSummary) => {
    if (!window.confirm(`将《${book.title}》移入最近删除？30 天内可以恢复。`)) return;
    const response = await desktop.corpus.trash(book.id);
    if (!response.ok) setError(response.error?.message || '删除失败');
    if (selected?.id === book.id) setSelected(null);
    await refresh();
  };

  const restoreBook = async (book: CorpusBookSummary) => {
    const response = await desktop.corpus.restore(book.id);
    if (!response.ok) setError(response.error?.message || '恢复失败');
    await refresh();
  };

  const purgeBook = async (book: CorpusBookSummary) => {
    if (!window.confirm(`永久删除《${book.title}》及本地副本？此操作无法恢复。`)) return;
    const response = await desktop.corpus.purge(book.id);
    if (!response.ok) setError(response.error?.message || '永久删除失败');
    await refresh();
  };

  const saveMetadata = async () => {
    if (!selected) return;
    if (selected.indexRequested && editMetadata.title.trim() !== selected.title
      && !window.confirm('修改书名会重新建立该书向量分片，并可能产生向量调用费用。是否继续？')) return;
    const response = await desktop.corpus.updateMetadata({ id: selected.id, ...editMetadata });
    if (!response.ok) {
      setError(response.error?.message || '资料保存失败');
      return;
    }
    setEditing(false);
    await refresh();
    const detail = await desktop.corpus.book(selected.id);
    setSelected(detail);
  };

  const building = books.some((book) => book.indexState === 'building');
  const paused = books.some((book) => book.indexState === 'paused');
  const canManageCorpus = desktop.runtime.capabilities.corpusImport;
  const sourceSummary = useMemo(() => canManageCorpus
    ? `${status.builtInBookCount} 本内置 · ${status.userBookCount} 本用户导入 · ${status.chunkCount.toLocaleString('zh-CN')} 条证据`
    : `${status.builtInBookCount} 本内置古籍 · ${status.chunkCount.toLocaleString('zh-CN')} 段原文`, [canManageCorpus, status]);

  return (
    <div className="overlay corpus-library-overlay" role="presentation">
      <aside className="corpus-library-panel" aria-labelledby="corpus-library-title" aria-modal="true" role="dialog">
        <header className="corpus-library-header">
          <div><span className="corpus-kicker">LOCAL ARCHIVE</span><h2 id="corpus-library-title">古籍书库</h2><p>{sourceSummary}</p></div>
          <div className="corpus-header-actions">{canManageCorpus ? <button type="button" className="corpus-primary-button" onClick={() => void previewSelection()}><FilePlus2 />导入古籍</button> : null}<button type="button" aria-label="关闭古籍书库" onClick={onClose}><X /></button></div>
        </header>

        <div className="corpus-library-toolbar">
          <label className="panel-search"><Search size={16} /><input aria-label="搜索古籍书库" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索书名、作者或版本" /></label>
          <button type="button" className={showDeleted ? 'is-active' : ''} onClick={() => setShowDeleted((value) => !value)}>{showDeleted ? '返回书库' : `最近删除 ${status.deletedBookCount || ''}`}</button>
          {canManageCorpus && building ? <button type="button" onClick={() => void desktop.corpus.pauseIndex()}><CirclePause />暂停索引</button> : null}
          {canManageCorpus && paused ? <button type="button" onClick={() => void desktop.corpus.resumeIndex()}><CirclePlay />继续索引</button> : null}
          {canManageCorpus && (building || paused) ? <button type="button" onClick={() => void desktop.corpus.cancelIndex()}><X />取消任务</button> : null}
        </div>

        <div className={`corpus-library-body${selected ? ' corpus-library-body--detail' : ''}`}>
          <section className={`corpus-book-list${dragging ? ' is-dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }} onDrop={(event) => void previewDrop(event)}>
            {dragging ? <div className="corpus-drop-mask"><FilePlus2 /><strong>松开即可解析 TXT / Markdown</strong></div> : null}
            {books.length ? books.map((book) => (
              <article className={`corpus-book-row${selected?.id === book.id ? ' is-selected' : ''}`} key={book.id}>
                <button type="button" className="corpus-book-main" onClick={() => void openBook(book)}>
                  <BookOpen aria-hidden="true" />
                  <span><span className={`corpus-origin corpus-origin--${book.origin}`}>{book.origin === 'builtin' ? '内置' : '用户导入'}</span><strong>《{book.title}》</strong><small>{[book.author, book.edition, `${book.chunkCount} 片段`].filter(Boolean).join(' · ')}</small></span>
                  <em className={`corpus-index-state corpus-index-state--${book.indexState}`}>{book.deletedAt ? '最近删除' : indexLabel(book)}</em>
                </button>
                <div className="corpus-row-actions">
                  {book.deletedAt ? <><button type="button" aria-label={`恢复：${book.title}`} onClick={() => void restoreBook(book)}><ArchiveRestore /></button><button type="button" aria-label={`永久删除：${book.title}`} onClick={() => void purgeBook(book)}><Trash2 /></button></> : <><button type="button" className={`corpus-toggle${book.enabled ? ' is-on' : ''}`} aria-label={`${book.enabled ? '停用' : '启用'}：${book.title}`} aria-pressed={book.enabled} onClick={() => void toggleBook(book)}><i /></button>{book.origin === 'user' ? <button type="button" aria-label={`删除：${book.title}`} onClick={() => void trashBook(book)}><Trash2 /></button> : null}</>}
                </div>
              </article>
            )) : <p className="panel-empty">{showDeleted ? '最近删除中没有古籍。' : '书库中没有符合条件的古籍。'}</p>}
            {books.length < bookTotal ? <button type="button" className="corpus-load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? '正在加载…' : `加载更多（${books.length}/${bookTotal}）`}</button> : null}
          </section>

          <section className="corpus-book-detail">
            {selected ? (
              <>
                <button type="button" className="corpus-mobile-back" onClick={closeBook}><ArrowLeft />返回书目</button>
                <header className="corpus-detail-header"><div><span className={`corpus-origin corpus-origin--${selected.origin}`}>{selected.origin === 'builtin' ? '内置' : '用户导入'}</span><h3>《{selected.title}》</h3><p>{[selected.author, selected.edition, selected.encoding.toUpperCase()].filter(Boolean).join(' · ')}</p></div>{selected.origin === 'user' && !selected.deletedAt ? <button type="button" onClick={() => setEditing((value) => !value)}><Pencil />编辑资料</button> : null}</header>
                {editing ? <div className="corpus-edit-form"><label>书名<input value={editMetadata.title} onChange={(event) => setEditMetadata((value) => ({ ...value, title: event.target.value }))} /></label><label>作者<input value={editMetadata.author} onChange={(event) => setEditMetadata((value) => ({ ...value, author: event.target.value }))} /></label><label>版本说明<input value={editMetadata.edition} onChange={(event) => setEditMetadata((value) => ({ ...value, edition: event.target.value }))} /></label><button type="button" className="corpus-primary-button" disabled={!editMetadata.title.trim()} onClick={() => void saveMetadata()}><Save />保存资料</button></div> : null}
                <div className="corpus-detail-stats"><span><b>{selected.charCount.toLocaleString('zh-CN')}</b>字</span><span><b>{selected.chapterCount}</b>章节</span><span><b>{selected.chunkCount}</b>片段</span></div>
                <label className="panel-search"><Search size={15} /><input aria-label="搜索书内原文" value={entryQuery} onChange={(event) => void searchEntries(event.target.value)} placeholder="搜索本书片段" /></label>
                <div className="corpus-entry-list">{entries.map((entry) => <article key={entry.id}><strong>{entry.title}</strong><small>{entry.location}</small><p>{entry.text}</p></article>)}</div>
              </>
            ) : <div className="corpus-detail-empty"><BookOpen /><strong>选择一本书查看原文片段</strong><p>用户上传内容只在确认后发送给向量服务。</p></div>}
          </section>
        </div>
        {error ? <p className="corpus-panel-error" role="alert">{error}</p> : null}
      </aside>
      {importBatch ? <CorpusImportDialog batch={importBatch} aiStatus={aiStatus} onClose={() => setImportBatch(null)} onCommitted={() => void refresh()} /> : null}
    </div>
  );
}
