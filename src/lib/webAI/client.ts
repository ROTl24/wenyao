import type { AIConfigStatus, DesktopApi, DesktopError } from '../../types/desktop';
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

  private async paid<T>(label: string, command: WebAIRequest['command'], payload?: unknown): Promise<T> {
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
  discoverModels: DesktopApi['aiConfig']['discoverModels'] = async (payload) => {
    try { return await this.call('discoverModels', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  saveDraft: DesktopApi['aiConfig']['saveDraft'] = async (payload) => {
    try { return await this.call('saveDraft', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  testDraft: DesktopApi['aiConfig']['testDraft'] = async () => {
    try { return await this.paid('连接检测', 'testDraft'); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  buildAndActivate: DesktopApi['aiConfig']['buildAndActivate'] = async () => {
    try { return await this.paid('索引准备', 'buildAndActivate'); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  pauseBuild: DesktopApi['aiConfig']['pauseBuild'] = async () => this.call('pauseBuild');
  resumeBuild: DesktopApi['aiConfig']['resumeBuild'] = async () => this.call('resumeBuild');
  cancelBuild: DesktopApi['aiConfig']['cancelBuild'] = async () => this.call('cancelBuild');
  removeConnection: DesktopApi['aiConfig']['removeConnection'] = async (id) => {
    try { return await this.call('removeConnection', id); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  search: DesktopApi['retrieval']['search'] = async (payload) => this.paid('古籍检索', 'search', payload);
  analyze: DesktopApi['ai']['analyze'] = async (payload) => {
    try { return await this.paid('AI 解读', 'analyze', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };
  followUp: DesktopApi['ai']['followUp'] = async (payload) => {
    try { return await this.paid('AI 追问', 'followUp', payload); }
    catch (error) { return { ok: false, error: desktopError(error) }; }
  };

  onStatus(listener: (status: AIConfigStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
