import { taskIsRunning, type GenerationTask } from '../lib/useGenerationTasks';

const labels: Record<GenerationTask['status'], string> = { saving: '正在保存', running: '生成中', stopping: '正在停止', stopped: '已停止', failed: '未完成', complete: '已完成并保存', 'save-error': '等待保存' };

export function GenerationTasks({ tasks, onOpen, onStop, onDismiss }: { tasks: GenerationTask[]; onOpen(id: string): void; onStop(id: string): void; onDismiss(id: string): void }) {
  if (!tasks.length) return null;
  return <aside className="generation-tasks" aria-label="生成任务">
    <details>
      <summary>生成任务 · {tasks.filter(taskIsRunning).length} 项进行中<span role="status">{tasks.some((task) => task.status === 'save-error') ? '有结果等待保存' : tasks.some((task) => task.status === 'complete') ? '有结果已完成' : tasks.some((task) => task.status === 'failed' || task.status === 'stopped') ? '有任务未完成' : ''}</span></summary>
      <p>切换应用内页面可继续生成。关闭或刷新应用会中断接收。</p>
      {tasks.map((task) => <div className="generation-task" key={task.requestId}>
        <button type="button" onClick={(event) => { onOpen(task.sessionId); event.currentTarget.closest('details')?.removeAttribute('open'); }}><strong>{task.question}</strong><small>{task.kind === 'analysis' ? '解读' : '追问'} · {labels[task.status]}</small></button>
        {taskIsRunning(task) ? <button type="button" disabled={task.status !== 'running'} onClick={() => onStop(task.sessionId)}>停止接收</button> : <button type="button" disabled={task.status === 'save-error'} onClick={() => onDismiss(task.sessionId)}>收起通知</button>}
      </div>)}
    </details>
  </aside>;
}
