import { useEffect, useRef, useState } from 'react';
import type { AIAnalysisProgress } from '../types/desktop';
import type { EvidenceEntry, RetrievalDiagnostics } from './retrieval';

export interface GenerationTask {
  requestId: string;
  sessionId: string;
  question: string;
  kind: 'analysis' | 'followUp';
  status: 'running' | 'saving' | 'stopping' | 'stopped' | 'failed' | 'complete' | 'save-error';
  startedAt: number;
  stage: AIAnalysisProgress['stage'];
  content: string;
  error: string;
  evidence?: EvidenceEntry[];
  diagnostics?: RetrievalDiagnostics | null;
}

export function taskIsRunning(task?: GenerationTask) {
  return task?.status === 'running' || task?.status === 'stopping' || task?.status === 'saving';
}

export function useGenerationTasks() {
  const ref = useRef(new Map<string, GenerationTask>());
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publish = () => { timer.current = null; setTasks([...ref.current.values()]); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const update = (requestId: string, changes: Partial<GenerationTask>, immediate = true) => {
    const current = [...ref.current.values()].find((task) => task.requestId === requestId);
    if (!current) return;
    ref.current.set(current.sessionId, { ...current, ...changes });
    if (immediate) { if (timer.current) clearTimeout(timer.current); publish(); }
    else if (!timer.current) timer.current = setTimeout(publish, 200);
  };
  return {
    tasks, ref, update,
    begin(sessionId: string, question: string, kind: GenerationTask['kind']) {
      const task: GenerationTask = { requestId: crypto.randomUUID(), sessionId, question, kind, status: 'running', startedAt: Date.now(), stage: 'retrieving', content: '', error: '' };
      ref.current.set(sessionId, task);
      publish();
      return task;
    },
    progress(requestId: string, progress: AIAnalysisProgress) {
      const current = [...ref.current.values()].find((task) => task.requestId === requestId);
      if (!current || current.status !== 'running') return;
      update(requestId, { stage: progress.stage, content: current.content + (progress.delta || '') }, false);
    },
    dismiss(sessionId: string) { ref.current.delete(sessionId); publish(); },
  };
}
