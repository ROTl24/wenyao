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
import { WebAIClient, emptyWebAIStatus } from './webAI/client';
import { isTrustedWebAIOrigin } from './webAI/security';
import {
  normalizeStoredSession,
  sanitizeRendererSession,
  validateSessionForSave,
} from './sessionValidation';

const STORAGE_KEY = 'wenyao-browser-sessions';
const browserAIEnabled = isTrustedWebAIOrigin();
const webAI = browserAIEnabled ? new WebAIClient() : null;
const browserRuntime: PlatformRuntime = {
  kind: 'web',
  capabilities: {
    ai: browserAIEnabled,
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
  ...emptyWebAIStatus,
  message: browserAIEnabled
    ? '尚未连接 AI 服务；访问密钥只在当前页面会话中使用。'
    : '此预览域名不接收 AI 密钥；请使用正式发布地址。',
  corpusCount: corpus.length,
};
const browserProviderCatalog: AIProviderCatalog = {
  ...(structuredClone(aiProviderCatalog) as AIProviderCatalog),
  defaultPresetId: 'alibaba-cn-quality',
  presets: (structuredClone(aiProviderCatalog.presets) as AIProviderCatalog['presets']).map((preset) => ({
    ...preset,
    recommended: preset.id === 'alibaba-cn-quality',
  })),
};
const officialAIUrls = new Set(browserProviderCatalog.presets.flatMap((preset) => Object.values(preset.setup)));
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
    async getCatalog() { return structuredClone(browserProviderCatalog); },
    async getStatus() { return webAI ? { ...(await webAI.getStatus()), corpusCount: corpus.length } : structuredClone(browserAIStatus); },
    async saveDraft(payload) { return webAI ? webAI.saveDraft(payload) : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名未启用 AI 密钥输入。', dataSafe: true, nextAction: '请使用问爻正式发布地址。' } }; },
    async testDraft() { return webAI ? webAI.testDraft() : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名未启用 AI 服务。', dataSafe: true, nextAction: '请使用问爻正式发布地址。' } }; },
    async buildAndActivate() { return webAI ? webAI.buildAndActivate() : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名未启用 AI 服务。', dataSafe: true, nextAction: '请使用问爻正式发布地址。' } }; },
    async pauseBuild() { return webAI ? webAI.pauseBuild() : structuredClone(browserAIStatus); },
    async resumeBuild() { return webAI ? webAI.resumeBuild() : structuredClone(browserAIStatus); },
    async cancelBuild() { return webAI ? webAI.cancelBuild() : structuredClone(browserAIStatus); },
    async removeConnection(id) { return webAI ? webAI.removeConnection(id) : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名没有 AI 连接。', dataSafe: true, nextAction: '无需管理连接。' } }; },
    async openExternal(url) {
      if (!officialAIUrls.has(url)) return false;
      return window.open(url, '_blank', 'noopener,noreferrer') !== null;
    },
    onStatus(listener) { return webAI ? webAI.onStatus(listener) : () => {}; },
  },
  corpus: {
    async status() {
      const aiStatus = webAI ? await webAI.getStatus() : browserAIStatus;
      return { ...structuredClone(browserCorpusStatus), vectorReady: aiStatus.status === 'ready', vectorModel: aiStatus.activeCapabilities?.embedding.model || '' };
    },
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
      if (webAI && (await webAI.getStatus()).status === 'ready') return webAI.search(payload);
      const evidence = searchEvidence(corpus as import('./retrieval').EvidenceEntry[], payload.query, payload.domainTerms, payload.limit || 8);
      return { evidence, diagnostics: { mode: 'lexical-fallback', lexicalCandidates: evidence.length, vectorCandidates: 0, fusedCandidates: evidence.length, vectorUsed: false, rerankUsed: false, warnings: ['AI 未就绪时仅展示本地关键词检索结果，不会据此生成 AI 报告。'] } };
    },
  },
  ai: {
    async analyze(payload) { return webAI ? webAI.analyze(payload) : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名不发送 AI 请求。', dataSafe: true, nextAction: '请使用问爻正式发布地址。' } }; },
    async followUp(payload) { return webAI ? webAI.followUp(payload) : { ok: false, error: { code: 'WEB_AI_ORIGIN_DISABLED', message: '此域名不发送 AI 请求。', dataSafe: true, nextAction: '请使用问爻正式发布地址。' } }; },
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
