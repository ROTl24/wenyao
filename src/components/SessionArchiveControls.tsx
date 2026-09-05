import { Download, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { DivinationSession } from '../lib/session';
import { downloadSessionArchive, MAX_ARCHIVE_BYTES, parseSessionArchive, type ImportAction, type SessionImportRequest } from '../lib/sessionArchive';
import { useModalDialog } from '../lib/useModalDialog';

interface Props {
  sessions: DivinationSession[];
  existingSessions: DivinationSession[];
  onImport?(payload: SessionImportRequest): Promise<void>;
}

function ImportPreview({ incoming, existing, onImport, onClose }: {
  incoming: DivinationSession[]; existing: DivinationSession[];
  onImport(payload: SessionImportRequest): Promise<void>; onClose(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useModalDialog<HTMLElement>(onClose, busy);
  // Capture the preview revisions. A later change must be rejected by the persistence layer.
  const [conflicts] = useState(() => {
    const byId = new Map(existing.map((session) => [session.id, session]));
    return incoming.flatMap((session) => byId.has(session.id) ? [{ incoming: session, existing: byId.get(session.id)! }] : []);
  });
  const [actions, setActions] = useState<Record<string, ImportAction>>(() => Object.fromEntries(conflicts.map((item) => [item.incoming.id, 'skip'])));
  const selectedCount = incoming.length - conflicts.filter((item) => actions[item.incoming.id] === 'skip').length;
  const submit = async () => {
    setBusy(true); setError('');
    try {
      await onImport({ sessions: incoming, resolutions: Object.fromEntries(conflicts.map((item) => [item.incoming.id, {
        action: actions[item.incoming.id], expectedUpdatedAt: item.existing.updatedAt,
        ...(actions[item.incoming.id] === 'copy' ? { newId: crypto.randomUUID() } : {}),
      }])) });
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : '备份导入失败，原占簿未作修改。'); }
    finally { setBusy(false); }
  };
  return <div className="archive-overlay">
    <section ref={ref} tabIndex={-1} className="archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
      <header><div><h2 id="archive-title">导入占簿备份</h2><p>共 {incoming.length} 条记录，{conflicts.length} 条与本机重复。</p></div><button type="button" aria-label="关闭导入预览" disabled={busy} onClick={onClose}><X /></button></header>
      <p>排盘、解读、追问和复盘将在本机恢复。导入不会调用 AI，也不会更改密钥和反馈上传授权。</p>
      {conflicts.length ? <div className="archive-conflicts">{conflicts.map((item) => <label key={item.incoming.id}>
        <strong>{item.incoming.question}</strong>
        <select aria-label={`重复记录：${item.incoming.question}`} disabled={busy} value={actions[item.incoming.id]} onChange={(event) => setActions((current) => ({ ...current, [item.incoming.id]: event.target.value as ImportAction }))}>
          <option value="skip">保留本机，跳过备份</option><option value="copy">保留两份，另存副本</option><option value="replace">使用备份替换本机</option>
        </select>
      </label>)}</div> : null}
      {Object.values(actions).includes('replace') ? <p className="archive-warning">所选本机记录将被备份替换；需要保留当前版本时，请先导出占簿或选择另存副本。</p> : null}
      {error ? <p role="alert" className="archive-warning">{error}</p> : null}
      <footer><button type="button" disabled={busy} onClick={onClose}>取消</button><button type="button" disabled={busy || !selectedCount} onClick={() => void submit()}>{busy ? '正在导入…' : `确认导入 ${selectedCount} 条`}</button></footer>
    </section>
  </div>;
}

export function SessionArchiveControls({ sessions, existingSessions, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<DivinationSession[] | null>(null);
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const exportArchive = () => {
    setError(''); setMessage('');
    try { downloadSessionArchive(sessions); setMessage(`已准备 ${sessions.length} 条记录的备份，请在下载中确认文件。`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '备份导出失败。'); }
  };
  const readArchive = async (file?: File) => {
    if (!file) return;
    setReading(true); setMessage(''); setError(''); setIncoming(null);
    try {
      if (file.size > MAX_ARCHIVE_BYTES) throw new Error('单份备份最多支持 64 MB，请使用分批备份。');
      setIncoming(parseSessionArchive(await file.text()).sessions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '无法读取备份文件，原占簿未作修改。'); }
    finally { setReading(false); if (inputRef.current) inputRef.current.value = ''; }
  };
  return <div className="archive-controls">
    <div className="archive-actions"><button type="button" disabled={!sessions.length || reading} onClick={exportArchive}><Download size={16} />导出当前列表</button>
      {onImport ? <button type="button" disabled={reading} onClick={() => inputRef.current?.click()}><Upload size={16} />{reading ? '读取备份中…' : '导入备份'}</button> : null}
    </div>
    <small>备份包含排盘、解读、追问与复盘；不含 API 密钥。可先搜索筛选，再分批导出。</small>
    <input ref={inputRef} type="file" accept=".json,application/json" aria-label="选择占簿备份" hidden onChange={(event) => void readArchive(event.target.files?.[0])} />
    {error ? <p role="alert" className="archive-warning">{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {incoming && onImport ? <ImportPreview incoming={incoming} existing={existingSessions} onClose={() => setIncoming(null)} onImport={async (payload) => {
      await onImport(payload); setMessage('导入完成，已更新本机占簿。');
    }} /> : null}
  </div>;
}
