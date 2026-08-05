import { AlertCircle, CheckCircle2, Database, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, CorpusImportBatch } from '../types/desktop';

interface Props {
  batch: CorpusImportBatch;
  aiStatus: AIConfigStatus;
  onClose(): void;
  onCommitted(): void;
}

interface DraftMetadata { title: string; author: string; edition: string }

function initialMetadata(batch: CorpusImportBatch) {
  return Object.fromEntries(batch.previews.map((preview) => [preview.draftId, {
    title: preview.suggestedTitle,
    author: '',
    edition: '',
  }])) as Record<string, DraftMetadata>;
}

export function CorpusImportDialog({ batch, aiStatus, onClose, onCommitted }: Props) {
  const [metadata, setMetadata] = useState(() => initialMetadata(batch));
  const [sendForIndex, setSendForIndex] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Array<{ draftId: string; ok: boolean; error?: { message: string } }> | null>(null);
  const valid = batch.previews.filter((preview) => !preview.error);
  const totalCharacters = useMemo(() => valid.reduce((sum, preview) => sum + Number(preview.charCount || 0), 0), [valid]);
  const embedding = aiStatus.activeCapabilities?.embedding;
  const canIndex = aiStatus.status === 'ready' && Boolean(aiStatus.activeFingerprint) && Boolean(embedding);

  const update = (draftId: string, field: keyof DraftMetadata, value: string) => {
    setMetadata((current) => ({ ...current, [draftId]: { ...current[draftId], [field]: value } }));
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const response = await desktop.corpus.commitImport({
        batchId: batch.batchId,
        sendForIndex: canIndex && sendForIndex,
        books: valid.map((preview) => ({ draftId: preview.draftId, ...metadata[preview.draftId] })),
      });
      if (!response.ok) throw new Error(response.error?.message || '导入失败');
      const imported = response.results || [];
      setResults(imported);
      if (imported.some((item) => item.ok)) onCommitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '导入失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="corpus-modal-layer" role="presentation">
      <section className="corpus-import-dialog" aria-labelledby="corpus-import-title" aria-modal="true" role="dialog">
        <header>
          <div><span className="corpus-kicker">IMPORT REVIEW</span><h2 id="corpus-import-title">确认导入古籍</h2><p>每个文件作为一本书，确认后原子写入本地书库。</p></div>
          <button type="button" aria-label="关闭导入确认" onClick={onClose}><X /></button>
        </header>

        <div className="corpus-import-scroll">
          {batch.previews.map((preview) => (
            <article className={`corpus-preview-card${preview.error ? ' corpus-preview-card--error' : ''}`} key={preview.draftId}>
              <div className="corpus-preview-heading">
                {preview.error ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                <div><strong>{preview.fileName}</strong><span>{preview.error ? preview.error.message : `${preview.encoding?.toUpperCase()} · ${(preview.charCount || 0).toLocaleString('zh-CN')} 字 · ${preview.chapterCount} 章节 · ${preview.chunkCount} 片段`}</span></div>
              </div>
              {preview.error ? <p className="corpus-inline-error">{preview.error.nextAction}</p> : (
                <>
                  <div className="corpus-metadata-grid">
                    <label>书名<input value={metadata[preview.draftId].title} maxLength={120} onChange={(event) => update(preview.draftId, 'title', event.target.value)} /></label>
                    <label>作者（可选）<input value={metadata[preview.draftId].author} maxLength={80} onChange={(event) => update(preview.draftId, 'author', event.target.value)} /></label>
                    <label>版本说明（可选）<input value={metadata[preview.draftId].edition} maxLength={120} placeholder="如：清刻本、整理本" onChange={(event) => update(preview.draftId, 'edition', event.target.value)} /></label>
                  </div>
                  <details><summary>查看首尾抽样</summary><div className="corpus-samples"><p>{preview.samples?.first}</p><p>{preview.samples?.last}</p></div></details>
                </>
              )}
            </article>
          ))}

          <section className="corpus-index-consent">
            <Database aria-hidden="true" />
            <div>
              <strong>建立 AI 检索索引</strong>
              {canIndex ? (
                <>
                  <p>确认后会把本批约 {totalCharacters.toLocaleString('zh-CN')} 字分批发送给 {embedding?.label} 的 {embedding?.model}；解读检索时，少量候选原文还会交给当前重排服务排序。</p>
                  <label className="corpus-consent-check"><input type="checkbox" checked={sendForIndex} onChange={(event) => setSendForIndex(event.target.checked)} />我确认发送上述古籍正文并建立索引</label>
                </>
              ) : <p>AI 向量服务尚未就绪。本次仍可保存到本地，稍后在书库中启用索引。</p>}
            </div>
          </section>

          {results ? <div className="corpus-import-results" role="status">{results.map((item) => <p key={item.draftId}>{item.ok ? '已导入' : `失败：${item.error?.message || '未知错误'}`}</p>)}</div> : null}
          {error ? <p className="corpus-inline-error" role="alert">{error}</p> : null}
        </div>

        <footer>
          <button type="button" className="corpus-secondary-button" onClick={onClose}>{results ? '完成' : '取消'}</button>
          {results?.some((item) => !item.ok) ? <button type="button" className="corpus-secondary-button" onClick={() => setResults(null)}>重试失败项</button> : null}
          {!results ? <button type="button" className="corpus-primary-button" disabled={submitting || !valid.length || valid.some((preview) => !metadata[preview.draftId].title.trim())} onClick={() => void submit()}>{submitting ? <><Loader2 className="corpus-spin" />正在导入…</> : sendForIndex && canIndex ? '导入并建立索引' : '仅保存到本地'}</button> : null}
        </footer>
      </section>
    </div>
  );
}
