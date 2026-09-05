import type { AIAnalysisProgress, AIConfigStatus, DesktopApi, DesktopError } from '../../types/desktop';
import type { WebAIRequest, WebAIWorkerMessage } from './protocol';

const unavailableError: DesktopError = {
  code: 'WEB_AI_RUNTIME_UNAVAILABLE',
  message: '当前浏览器无法启动隔离的 AI 会话。',
  dataSafe: true,
  nextAction: '请更新浏览器后重试，或使用桌面版。',
};

export const emptyWebAIStatus: AIConfigStatus = {
  status: 'unconfigured',
  message: '尚未连接 AI 服务；访问密钥只在当前页面会话中使用。',
  activeCapabilities: null,
  activeFingerprint: '',
  corpusCount: 0,
  consentAcceptedAt: '',
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};

type Pending = { resolve(value: unknown): void; reject(error: DesktopError): void };

function desktopError(error: unknown): DesktopError {
  if (error && typeof error === 'object' && typeof (error as DesktopError).code === 'string') return error as DesktopError;
  return unavailableError;
}

export class WebAIClient {
  private worker: Worker | null = null;
  private pending = new Map<string, Pending>();
  private generations = new Map<string, { stopped: boolean; dispatched: boolean }>();
  private progressListeners = new Map<string, (progress: AIAnalysisProgress) => void>();
  private listeners = new Set<(status: AIConfigStatus) => void>();
  private status = structuredClone(emptyWebAIStatus);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.clearSession());
      navigator.serviceWorker?.addEventListener('controllerchange', () => this.clearSession());
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') throw unavailableError;
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'wenyao-web-ai' });
    worker.addEventListener('message', (event: MessageEvent<WebAIWorkerMessage>) => {
      const message = event.data;
      if ('event' in message && message.event === 'generation') {
        try { this.progressListeners.get(message.requestId)?.(message.progress); } catch { /* Observer only. */ }
        return;
      }
      if ('event' in message) {
        this.status = message.status;
        this.listeners.forEach((listener) => listener(structuredClone(message.status)));
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.ok) pending.resolve(message.value);
      else pending.reject(message.error || unavailableError);
    });
    worker.addEventListener('error', () => {
      this.pending.forEach(({ reject }) => reject(unavailableError));
      this.pending.clear();
      this.clearSession();
    });
    this.worker = worker;
    return worker;
  }

  private call<T>(command: WebAIRequest['command'], payload?: unknown): Promise<T> {
    let worker: Worker;
    try { worker = this.ensureWorker(); }
    catch (error) { return Promise.reject(error); }
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      worker.postMessage({ id, command, payload } satisfies WebAIRequest);
    });
  }

  private async paid<T>(label: string, command: WebAIRequest['command'], payload?: unknown, beforeDispatch?: () => void): Promise<T> {
    if (!navigator.locks) {
      throw {
        code: 'WEB_AI_LOCKS_UNAVAILABLE',
        message: '当前浏览器缺少防止重复计费所需的页面锁能力。',
        dataSafe: true,
        nextAction: '请更新浏览器后重试，或使用桌面版。',
      } satisfies DesktopError;
    }
    return navigator.locks.request('wenyao-web-ai-billable', { ifAvailable: true }, async (lock) => {
      if (!lock) {
        throw {
          code: 'WEB_AI_CROSS_TAB_BUSY',
          message: '另一个问爻页面正在使用 AI 服务。',
          dataSafe: true,
          nextAction: `请等待另一页面完成${label}，避免重复请求和重复计费。`,
        } satisfies DesktopError;
      }
      beforeDispatch?.();
      return this.call<T>(command, payload);
    });
  }

  clearSession(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.forEach(({ reject }) => reject({
      code: 'WEB_AI_SESSION_CLEARED',
      message: '页面会话已变化，访问密钥已清除。',
      dataSafe: true,
      nextAction: '请重新输入访问密钥后再使用 AI。',
    }));
    this.pending.clear();
    this.status = structuredClone(emptyWebAIStatus);
    this.listeners.forEach((listener) => listener(structuredClone(this.status)));
  }

  getStatus = async (): Promise<AIConfigStatus> => structuredClone(this.status);
  listModels: DesktopApi['aiConfig']['listModels'] = async (payload) => {
    try { return await this.call('listModels', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  testCapability: DesktopApi['aiConfig']['testCapability'] = async (payload) => {
    try { return await this.paid('最小连接测试', 'testCapability', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  completeSetup: DesktopApi['aiConfig']['completeSetup'] = async (payload) => {
    try { return await this.paid('索引准备', 'completeSetup', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  cancelSetup: DesktopApi['aiConfig']['cancelSetup'] = async () => this.call('cancelSetup');
  pauseBuild: DesktopApi['aiConfig']['pauseBuild'] = async () => this.call('pauseBuild');
  resumeBuild: DesktopApi['aiConfig']['resumeBuild'] = async () => this.call('resumeBuild');
  cancelBuild: DesktopApi['aiConfig']['cancelBuild'] = async () => this.call('cancelBuild');
  search: DesktopApi['retrieval']['search'] = async (payload) => this.paid('古籍检索', 'search', payload);
  private async generate<T>(command: 'analyze' | 'followUp', payload: { requestId?: string }, onProgress?: (progress: AIAnalysisProgress) => void): Promise<T> {
    const requestId = payload.requestId || crypto.randomUUID();
    const control = { stopped: false, dispatched: false };
    this.generations.set(requestId, control);
    if (onProgress) this.progressListeners.set(requestId, onProgress);
    try { return await this.paid<T>('生成', command, { ...payload, requestId }, () => {
      if (control.stopped) throw { code: 'AI_GENERATION_STOPPED', message: '已停止接收，本次生成未发出。', dataSafe: true, nextAction: '' } satisfies DesktopError;
      control.dispatched = true;
    }); }
    finally { this.progressListeners.delete(requestId); this.generations.delete(requestId); }
  }
  cancel: DesktopApi['ai']['cancel'] = async (requestId) => {
    const control = this.generations.get(requestId);
    if (!control) return { stopped: false };
    control.stopped = true;
    return control.dispatched ? this.call('cancelGeneration', requestId) : { stopped: true };
  };
  analyze: DesktopApi['ai']['analyze'] = async (payload, onProgress) => {
    try { return await this.generate('analyze', payload, onProgress); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  followUp: DesktopApi['ai']['followUp'] = async (payload, onProgress) => {
    try { return await this.generate('followUp', payload, onProgress); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };

  onStatus(listener: (status: AIConfigStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
