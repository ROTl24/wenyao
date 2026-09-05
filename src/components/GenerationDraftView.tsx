import { StreamingMarkdownContent } from './StreamingMarkdownContent';
import type { GenerationDraft } from '../lib/session';
import { taskIsRunning, type GenerationTask } from '../lib/useGenerationTasks';

export function GenerationDraftView({ task, draft, onStop, onRetrySave }: { task?: GenerationTask; draft?: GenerationDraft | null; onStop?(): void; onRetrySave?(): void }) {
  const running = taskIsRunning(task);
  if (!running && task?.status !== 'save-error' && !draft) return null;
  const currentDraft = draft && (!task || draft.requestId === task.requestId) ? draft : null;
  const content = task?.content || currentDraft?.content || '';
  const evidence = task?.evidence ?? currentDraft?.evidenceSnapshot?.evidence ?? [];
  const anchorPrefix = `evidence-draft-${task?.requestId || currentDraft?.requestId}-`;
  const unfinished = Boolean(currentDraft) || task?.status === 'running' || task?.status === 'stopping';
  if (task?.kind === 'analysis' && task.status === 'save-error' && !unfinished && !content) return null;
  return <section className="generation-draft" aria-label="未完成正文">
    <header><strong>{running ? task?.status === 'saving' ? '正在保存完整正文…' : task?.status === 'stopping' ? '正在停止接收…' : '正在接收正文 · 尚未完成' : task?.status === 'save-error' ? '本次结果等待保存' : draft?.status === 'stopped' ? '已停止 · 未完成草稿' : '未完成草稿'}</strong>
      {running && task?.status !== 'saving' ? <button type="button" onClick={onStop} disabled={task?.status === 'stopping'}>停止接收</button> : null}
    </header>
    <p>{running ? '可以切换到应用内其他页面，稍后从“生成任务”返回。停止接收不能保证服务商停止处理或计费。' : unfinished ? '以下正文可能缺少结论或条件，请勿作为完整解读使用。' : '正文已接收完整，请先保存到本机占簿。'}</p>
    {task?.error ? <div role="alert"><strong>{!unfinished ? '正文已收到，保存未完成' : task.kind === 'followUp' ? '追问未完成' : '解读未完成'}</strong><p>{task.error}</p></div> : null}
    {task?.status === 'save-error' ? <button type="button" onClick={onRetrySave}>重试保存本次结果</button> : null}
    {content ? <div className="generation-text" data-reading-kind={task?.kind || currentDraft?.kind}><StreamingMarkdownContent markdown={content} evidenceAnchorPrefix={anchorPrefix} /></div> : running ? <p>正在等待可展示的正文，内部推理不会出现在这里。</p> : null}
    {content && evidence.length ? <div className="draft-evidence"><h4>本次草稿的古籍依据</h4>{evidence.map((item) => <details key={item.id} id={`${anchorPrefix}${item.id}`} tabIndex={-1}><summary>{item.source} · {item.title}</summary><p>{item.location}</p><p>{item.text}</p></details>)}</div> : null}
  </section>;
}
