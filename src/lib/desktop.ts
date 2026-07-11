import corpus from '../../resources/corpus.json';
import type { DesktopApi } from '../types/desktop';
import type { DivinationSession } from './session';

const STORAGE_KEY = 'wenyao-browser-sessions';

function browserSessions(): DivinationSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as DivinationSession[]; }
  catch { return []; }
}

const browserFallback: DesktopApi = {
  sessions: {
    async list() { return browserSessions().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async get(id) { return browserSessions().find((item) => item.id === id) || null; },
    async save(session) {
      const sessions = browserSessions();
      const index = sessions.findIndex((item) => item.id === session.id);
      if (index >= 0) sessions[index] = session; else sessions.push(session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return session;
    },
    async delete(id) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(browserSessions().filter((item) => item.id !== id)));
      return true;
    },
  },
  settings: {
    async get() { return { baseUrl: 'https://api.openai.com/v1', model: '', hasApiKey: false }; },
    async save(payload) { return { baseUrl: payload.baseUrl, model: payload.model, hasApiKey: false }; },
    async clearKey() { return { baseUrl: 'https://api.openai.com/v1', model: '', hasApiKey: false }; },
    async test() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '请在桌面应用中测试 AI 连接。', dataSafe: true, nextAction: '启动 Electron 桌面窗口。' } }; },
  },
  corpus: {
    async list() { return corpus as import('./retrieval').EvidenceEntry[]; },
    async status() { return { count: corpus.length, originalCount: 0, summaryCount: corpus.length, ready: true }; },
  },
  ai: {
    async analyze() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不发送 AI 请求。', dataSafe: true, nextAction: '桌面应用中可使用本地基础推演或云端 AI。' } }; },
    async followUp() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不发送 AI 请求。', dataSafe: true, nextAction: '请使用桌面应用。' } }; },
  },
  platform: 'browser',
};

export const desktop = window.wenyao || browserFallback;
