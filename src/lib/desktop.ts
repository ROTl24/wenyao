import corpus from '../../resources/corpus.json';
import type { DesktopApi } from '../types/desktop';
import { createBrowserReadingAdapter } from './browserReadingAdapter';
import type { EvidenceEntry } from './retrieval';
import { normalizeSessionIdentity, type DivinationSession } from './session';

const STORAGE_KEY = 'wenyao-browser-sessions';
const deletedBrowserSessionIds = new Set<string>();
const TOSS_VALUES = new Set([6, 7, 8, 9]);

function exactIso(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validTossFields(value: unknown, lineIndex: number, confirmed: boolean): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const toss = value as Record<string, unknown>;
  if (
    typeof toss.id !== 'string' || !toss.id.trim()
    || typeof toss.visualSeed !== 'string' || !toss.visualSeed.trim()
    || toss.lineIndex !== lineIndex
    || typeof toss.value !== 'number' || !TOSS_VALUES.has(toss.value)
    || !Array.isArray(toss.faces) || toss.faces.length !== 3
    || toss.faces.some((face) => face !== 'text' && face !== 'reverse')
    || (confirmed ? !exactIso(toss.confirmedAt) : Object.hasOwn(toss, 'confirmedAt'))
  ) return false;
  const faceValue = toss.faces.reduce<number>(
    (sum, face) => sum + (face === 'text' ? 2 : 3),
    0,
  );
  const expected = {
    label: toss.value === 6 ? '老阴' : toss.value === 7 ? '少阳' : toss.value === 8 ? '少阴' : '老阳',
    moving: toss.value === 6 || toss.value === 9,
    baseYang: toss.value === 7 || toss.value === 9,
    changedYang: toss.value === 7 || toss.value === 6,
  };
  return faceValue === toss.value
    && toss.label === expected.label
    && toss.moving === expected.moving
    && toss.baseYang === expected.baseYang
    && toss.changedYang === expected.changedYang;
}

function validateBrowserInteraction(input: DivinationSession): void {
  if (
    input.tosses.length > 6
    || !input.tosses.every((toss, index) => (
      validTossFields(toss, index + 1, true)
      && !input.tosses.slice(0, index).some((candidate) => candidate.id === toss.id)
    ))
  ) throw new Error('投币历史冲突');
  if (
    input.currentToss
    && (input.tosses.length >= 6 || !validTossFields(input.currentToss, input.tosses.length + 1, false))
  ) throw new Error('当前投币状态冲突');
}

function browserTimestamp(existing?: DivinationSession): string {
  const previous = Date.parse(existing?.updatedAt ?? '');
  const timestamp = Number.isFinite(previous) && Date.now() <= previous ? previous + 1 : Date.now();
  return new Date(timestamp).toISOString();
}

function browserSessions(): DivinationSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as DivinationSession[]; }
  catch { return []; }
}

function writeBrowserSession(session: DivinationSession): DivinationSession {
  if (deletedBrowserSessionIds.has(session.id)) throw new Error('会话已删除');
  const sessions = browserSessions();
  const index = sessions.findIndex((item) => item.id === session.id);
  const owned = structuredClone(session);
  if (index >= 0) sessions[index] = owned;
  else sessions.push(owned);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  return structuredClone(owned);
}

function confirmedPrefix(
  existing: DivinationSession['tosses'],
  incoming: DivinationSession['tosses'],
): boolean {
  return existing.every((toss, index) => JSON.stringify(toss) === JSON.stringify(incoming[index]));
}

function rendererBrowserSession(input: DivinationSession): DivinationSession {
  validateBrowserInteraction(input);
  const existing = browserSessions().find((item) => item.id === input.id);
  if (!existing) {
    const identity = normalizeSessionIdentity(input);
    return {
      ...identity,
      updatedAt: browserTimestamp(),
      status: input.tosses.length === 6 ? 'complete' : 'casting',
      tosses: structuredClone(input.tosses),
      ...(input.tosses.length < 6 && input.currentToss
        ? { currentToss: structuredClone(input.currentToss) }
        : {}),
      messages: [],
    };
  }
  const canAdvance = input.tosses.length >= existing.tosses.length
    && confirmedPrefix(existing.tosses, input.tosses);
  if (!canAdvance) return existing;
  const progressed = input.tosses.length > existing.tosses.length;
  const complete = input.tosses.length === 6;
  let currentToss = existing.currentToss;
  if (complete) currentToss = undefined;
  else if (progressed) currentToss = input.currentToss;
  else if (input.currentToss && existing.currentToss) {
    if (JSON.stringify(input.currentToss) !== JSON.stringify(existing.currentToss)) {
      throw new Error('当前投币状态冲突');
    }
  } else if (input.currentToss && !existing.currentToss) currentToss = input.currentToss;
  const next: DivinationSession = {
    ...existing,
    status: complete ? 'complete' : 'casting',
    tosses: structuredClone(input.tosses),
    ...(!complete && currentToss
      ? { currentToss: structuredClone(currentToss) }
      : {}),
    updatedAt: browserTimestamp(existing),
  };
  if (complete) delete next.currentToss;
  return next;
}

const browserSessionApi: DesktopApi['sessions'] = {
  async list() { return browserSessions().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
  async get(id) {
    if (deletedBrowserSessionIds.has(id)) return null;
    return browserSessions().find((item) => item.id === id) || null;
  },
  async save(session) { return writeBrowserSession(rendererBrowserSession(session)); },
  async delete(id) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(browserSessions().filter((item) => item.id !== id)));
    deletedBrowserSessionIds.add(id);
    return true;
  },
};

const browserReading = createBrowserReadingAdapter({
  sessions: {
    get: browserSessionApi.get,
    async save(session) { return writeBrowserSession(session); },
  },
  corpus: corpus as unknown as EvidenceEntry[],
});

const browserFallback: DesktopApi = {
  sessions: browserSessionApi,
  settings: {
    async get() { return { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-plus', embeddingModel: 'text-embedding-v4', rerankModel: 'qwen3-rerank', rerankUrl: '', hasApiKey: false }; },
    async save(payload) { return { baseUrl: payload.baseUrl, model: payload.model, embeddingModel: payload.embeddingModel, rerankModel: payload.rerankModel, rerankUrl: payload.rerankUrl, hasApiKey: false }; },
    async clearKey() { return { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-plus', embeddingModel: 'text-embedding-v4', rerankModel: 'qwen3-rerank', rerankUrl: '', hasApiKey: false }; },
    async test() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '请在桌面应用中测试 AI 连接。', dataSafe: true, nextAction: '启动 Electron 桌面窗口。' } }; },
  },
  corpus: {
    async list() { return corpus as unknown as EvidenceEntry[]; },
    async status() { return { count: corpus.length, bookCount: new Set(corpus.map((entry) => entry.source)).size, originalCount: corpus.filter((entry) => entry.sourceType === 'original').length, summaryCount: corpus.filter((entry) => entry.sourceType === 'summary').length, ruleCount: 0, caseCount: 0, doctrineCount: corpus.length, vectorReady: false, vectorModel: '', ready: true }; },
    async rebuildVectors() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '请在桌面应用中构建向量索引。', dataSafe: true, nextAction: '启动 Electron 桌面窗口。' } }; },
  },
  reading: browserReading,
  platform: 'browser',
};

export const desktop = window.wenyao || browserFallback;
