import corpus from '../../resources/corpus.json';
import aiProviderCatalog from '../../config/ai-providers.json';
import type { AIConfigStatus, AIProviderCatalog, DesktopApi } from '../types/desktop';
import type { UpdateState } from '../types/desktop';
import type { DivinationSession } from './session';
import { searchEvidence } from './retrieval';
import {
  normalizeStoredSession,
  sanitizeRendererSession,
  validateSessionForSave,
} from './sessionValidation';

const STORAGE_KEY = 'wenyao-browser-sessions';
const browserUpdateState: UpdateState = {
  status: 'unsupported',
  currentVersion: '',
};
const browserAIStatus: AIConfigStatus = {
  status: 'unconfigured',
  message: '浏览器预览不连接 AI 服务',
  activeCapabilities: null,
  activeFingerprint: '',
  corpusCount: corpus.length,
  consentAcceptedAt: '',
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};

function storedBrowserSessions(): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function browserSessions(): DivinationSession[] {
  return storedBrowserSessions().map(normalizeStoredSession);
}

function storedSessionId(value: unknown): unknown {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).id
    : undefined;
}

const browserFallback: DesktopApi = {
  updates: {
    async getState() { return structuredClone(browserUpdateState); },
    async check() { return structuredClone(browserUpdateState); },
    async download() { return structuredClone(browserUpdateState); },
    async install() { return structuredClone(browserUpdateState); },
    onState() { return () => {}; },
  },
  sessions: {
    async list() { return browserSessions().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async get(id) { return browserSessions().find((item) => item.id === id) || null; },
    async save(session) {
      const sessions = storedBrowserSessions();
      const canonicalSession = sanitizeRendererSession(session);
      const canonicalId = storedSessionId(canonicalSession);
      const index = sessions.findIndex((item) => storedSessionId(item) === canonicalId);
      const safeSession = validateSessionForSave(
        canonicalSession,
        index >= 0 ? sessions[index] : null,
      );
      if (index >= 0) sessions[index] = safeSession; else sessions.push(safeSession);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      return structuredClone(safeSession);
    },
    async delete(id) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(storedBrowserSessions().filter((item) => storedSessionId(item) !== id)),
      );
      return true;
    },
  },
  aiConfig: {
    async getCatalog() { return structuredClone(aiProviderCatalog) as AIProviderCatalog; },
    async getStatus() { return structuredClone(browserAIStatus); },
    async saveDraft() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不保存 AI 密钥。', dataSafe: true, nextAction: '请启动 Electron 桌面应用。' } }; },
    async testDraft() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不测试 AI 连接。', dataSafe: true, nextAction: '请启动 Electron 桌面应用。' } }; },
    async buildAndActivate() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不构建向量索引。', dataSafe: true, nextAction: '请启动 Electron 桌面应用。' } }; },
    async pauseBuild() { return structuredClone(browserAIStatus); },
    async resumeBuild() { return structuredClone(browserAIStatus); },
    async cancelBuild() { return structuredClone(browserAIStatus); },
    async removeConnection() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览没有 AI 连接。', dataSafe: true, nextAction: '请启动 Electron 桌面应用。' } }; },
    async openExternal(url) { window.open(url, '_blank', 'noopener,noreferrer'); return true; },
    onStatus() { return () => {}; },
  },
  corpus: {
    async list() { return corpus as import('./retrieval').EvidenceEntry[]; },
    async status() { return { count: corpus.length, bookCount: new Set(corpus.map((entry) => entry.source)).size, originalCount: corpus.filter((entry) => entry.sourceType === 'original').length, summaryCount: corpus.filter((entry) => entry.sourceType === 'summary').length, ruleCount: 0, caseCount: 0, doctrineCount: corpus.length, vectorReady: false, vectorModel: '', ready: true }; },
    async rebuildVectors() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '请在桌面应用中构建向量索引。', dataSafe: true, nextAction: '启动 Electron 桌面窗口。' } }; },
  },
  retrieval: {
    async search(payload) {
      const evidence = searchEvidence(corpus as import('./retrieval').EvidenceEntry[], payload.query, payload.domainTerms, payload.limit || 8);
      return { evidence, diagnostics: { mode: 'lexical-fallback', lexicalCandidates: evidence.length, vectorCandidates: 0, fusedCandidates: evidence.length, vectorUsed: false, rerankUsed: false, warnings: ['浏览器预览仅使用关键词检索。'] } };
    },
  },
  ai: {
    async analyze() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不发送 AI 请求。', dataSafe: true, nextAction: '请在桌面应用中连接完整 AI 服务后生成云端解读。' } }; },
    async followUp() { return { ok: false, error: { code: 'DESKTOP_ONLY', message: '浏览器预览不发送 AI 请求。', dataSafe: true, nextAction: '请使用桌面应用。' } }; },
  },
  platform: 'browser',
};

export const desktop = window.wenyao || browserFallback;
