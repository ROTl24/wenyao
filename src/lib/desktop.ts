import corpus from '../../resources/corpus.json';
import aiProviderCatalog from '../../config/ai-providers.json';
import publicLinks from '../../config/public-links.json';
import type {
  AIConfigStatus,
  AIProviderCatalog,
  CorpusBookSummary,
  CorpusStatus,
  DesktopApi,
  ElectronBridge,
  PlatformRuntime,
} from '../types/desktop';
import type { UpdateState } from '../types/desktop';
import type { DivinationSession } from './session';
import { searchEvidence } from './retrieval';
import {
  normalizeStoredSession,
  sanitizeRendererSession,
  validateSessionForSave,
} from './sessionValidation';

const STORAGE_KEY = 'wenyao-browser-sessions';
const browserRuntime: PlatformRuntime = {
  kind: 'web',
  capabilities: {
    ai: false,
    corpusImport: false,
    nativeUpdates: false,
    secureKeyStorage: false,
  },
};
const electronRuntime: PlatformRuntime = {
  kind: 'electron',
  capabilities: {
    ai: true,
    corpusImport: true,
    nativeUpdates: true,
    secureKeyStorage: true,
  },
};
const browserUpdateState: UpdateState = {
  status: 'unsupported',
  currentVersion: '',
};
const browserAIStatus: AIConfigStatus = {
  status: 'unconfigured',
  message: '网页版提供本地排盘、历史记录和内置古籍浏览，不提供 AI 解读。',
  activeCapabilities: null,
  activeFingerprint: '',
  corpusCount: corpus.length,
  consentAcceptedAt: '',
  connections: [],
  activePipeline: null,
  draft: null,
  usage: [],
};
const browserCorpusBooks: CorpusBookSummary[] = [...new Set(corpus.map((entry) => entry.source))].map((title, index) => {
  const entries = corpus.filter((entry) => entry.source === title);
  return {
    id: `browser-builtin-${index + 1}`,
    origin: 'builtin',
    title,
    author: '',
    edition: '',
    fileName: '',
    extension: '.json',
    encoding: 'utf-8',
    contentHash: '',
    charCount: entries.reduce((sum, entry) => sum + entry.text.length, 0),
    chapterCount: new Set(entries.map((entry) => entry.title)).size,
    chunkCount: entries.length,
    createdAt: '',
    updatedAt: '',
    enabled: true,
    deletedAt: null,
    purgeAt: null,
    indexRequested: true,
    indexState: 'local-only',
    indexProgress: 0,
    indexError: null,
  };
});
const browserCorpusStatus: CorpusStatus = {
  count: corpus.length,
  bookCount: browserCorpusBooks.length,
  builtInBookCount: browserCorpusBooks.length,
  userBookCount: 0,
  enabledBookCount: browserCorpusBooks.length,
  chunkCount: corpus.length,
  deletedBookCount: 0,
  pendingIndexCount: 0,
  originalCount: corpus.filter((entry) => entry.sourceType === 'original').length,
  summaryCount: corpus.filter((entry) => entry.sourceType === 'summary').length,
  ruleCount: 0,
  caseCount: 0,
  doctrineCount: corpus.length,
  vectorReady: false,
  vectorModel: '',
  readyShardIds: [],
  ready: true,
};
const webOnlyLocalCorpusError = { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版仅提供内置古籍浏览。', dataSafe: true, nextAction: '仍可使用本地排盘、历史记录和内置古籍检索。' };

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
  runtime: browserRuntime,
  externalLinks: {
    async open(id) {
      const url = publicLinks[id]?.url;
      if (!url) return false;
      try {
        return window.open(url, '_blank', 'noopener,noreferrer') !== null;
      } catch {
        return false;
      }
    },
  },
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
    async saveDraft() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不接收或保存 AI 密钥。', dataSafe: true, nextAction: '仍可使用本地排盘、历史记录和内置古籍检索。' } }; },
    async testDraft() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不连接 AI 服务。', dataSafe: true, nextAction: '仍可使用本地排盘、历史记录和内置古籍检索。' } }; },
    async buildAndActivate() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不构建向量索引。', dataSafe: true, nextAction: '内置古籍仍可在本机进行关键词检索。' } }; },
    async pauseBuild() { return structuredClone(browserAIStatus); },
    async resumeBuild() { return structuredClone(browserAIStatus); },
    async cancelBuild() { return structuredClone(browserAIStatus); },
    async removeConnection() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版没有 AI 连接。', dataSafe: true, nextAction: '无需进行 AI 连接管理。' } }; },
    async openExternal(url) { window.open(url, '_blank', 'noopener,noreferrer'); return true; },
    onStatus() { return () => {}; },
  },
  corpus: {
    async status() { return structuredClone(browserCorpusStatus); },
    async books(payload = {}) {
      const query = String(payload.query || '').toLowerCase();
      const items = browserCorpusBooks.filter((book) => !query || book.title.toLowerCase().includes(query));
      return { items: structuredClone(items), total: items.length };
    },
    async book(id) {
      const book = browserCorpusBooks.find((item) => item.id === id);
      if (!book) return null;
      const entries = corpus.filter((entry) => entry.source === book.title);
      return { ...structuredClone(book), samples: { first: entries[0]?.text.slice(0, 500) || '', last: entries.at(-1)?.text.slice(-500) || '' } };
    },
    async bookEntries(payload) {
      const book = browserCorpusBooks.find((item) => item.id === payload.bookId);
      const query = String(payload.query || '').toLowerCase();
      const entries = book ? corpus.filter((entry) => entry.source === book.title && (!query || `${entry.title}${entry.text}`.toLowerCase().includes(query))) : [];
      return { items: entries.slice(0, payload.limit || 30).map((entry) => ({ id: entry.id, title: entry.title, location: entry.location, text: entry.text, tags: entry.tags, knowledgeKind: 'doctrine' as const })), total: entries.length };
    },
    async selectImportFiles() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async previewDroppedFiles() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async commitImport() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async setEnabled() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async updateMetadata() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async trash() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async restore() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async purge() { return { ok: false, error: webOnlyLocalCorpusError }; },
    async pauseIndex() { return structuredClone(browserCorpusStatus); },
    async resumeIndex() { return structuredClone(browserCorpusStatus); },
    async cancelIndex() { return structuredClone(browserCorpusStatus); },
    async rebuildVectors() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不构建向量索引。', dataSafe: true, nextAction: '内置古籍仍可在本机进行关键词检索。' } }; },
    onState() { return () => {}; },
  },
  retrieval: {
    async search(payload) {
      const evidence = searchEvidence(corpus as import('./retrieval').EvidenceEntry[], payload.query, payload.domainTerms, payload.limit || 8);
      return { evidence, diagnostics: { mode: 'lexical-fallback', lexicalCandidates: evidence.length, vectorCandidates: 0, fusedCandidates: evidence.length, vectorUsed: false, rerankUsed: false, warnings: ['浏览器预览仅使用关键词检索。'] } };
    },
  },
  ai: {
    async analyze() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不发送 AI 请求。', dataSafe: true, nextAction: '仍可查看本地排盘和内置古籍依据。' } }; },
    async followUp() { return { ok: false, error: { code: 'WEB_FEATURE_UNAVAILABLE', message: '网页版不发送 AI 请求。', dataSafe: true, nextAction: '仍可查看本地排盘和内置古籍依据。' } }; },
  },
  platform: 'browser',
};

export function resolvePlatformApi(bridge?: ElectronBridge): DesktopApi {
  if (!bridge) return browserFallback;
  return {
    ...bridge,
    runtime: bridge.runtime || electronRuntime,
  };
}

export const desktop = resolvePlatformApi(window.wenyao);
