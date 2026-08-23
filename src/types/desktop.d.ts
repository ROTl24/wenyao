import type { EvidenceEntry, RetrievalDiagnostics } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import type { AnalysisReport } from '../lib/types';
import type { FeedbackApi } from '../lib/feedback';

export type AICapability = 'generation' | 'embedding' | 'rerank';
export type AIProtocol = 'openai-chat' | 'openai-embeddings' | 'cohere-rerank' | 'alibaba-rerank';
export type PublicLinkId = 'repository' | 'releases' | 'xiaohongshu';

export interface PlatformCapabilities {
  ai: boolean;
  corpusImport: boolean;
}

export interface PlatformRuntime {
  kind: 'electron' | 'web';
  platform: 'win32' | 'darwin' | 'linux' | 'browser';
  arch: string;
  isPackaged: boolean;
  updateMode: 'native' | 'manual' | 'none';
  secureStorage: 'dpapi' | 'keychain' | 'system' | 'memory';
  capabilities: PlatformCapabilities;
}

export interface AICapabilityDefinition {
  protocol: AIProtocol;
  model: string;
  dimensions?: number;
  batchSize?: number;
  path?: string;
  url?: string;
  urlTemplate?: string;
}

export interface AIProviderPreset {
  id: string;
  providerId: string;
  name: string;
  region: string;
  description: string;
  recommended: boolean;
  baseUrl: string;
  setup: { homeUrl: string; apiKeyUrl: string; billingUrl: string };
  requiredFields?: Array<{ id: string; label: string; description: string }>;
  capabilities: Partial<Record<AICapability, AICapabilityDefinition>>;
}

export interface AIProviderCatalog {
  version: number;
  defaultPresetId: string;
  presets: AIProviderPreset[];
  customProtocols: Record<AICapability, AIProtocol[]>;
}

export interface AIConnection {
  id: string;
  providerId: string;
  presetId: string | null;
  label: string;
  region: string;
  baseUrl: string;
  fields: Record<string, unknown>;
  capabilities: Partial<Record<AICapability, AICapabilityDefinition>>;
  hasApiKey: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AIPipeline = Record<AICapability, { connectionId: string } | null>;

export interface AIDraft {
  id: string;
  connection: AIConnection;
  pipeline: AIPipeline;
  testResult?: {
    status: 'testing' | 'passed' | 'failed';
    capabilities: Partial<Record<AICapability, { ok: boolean; checkedAt: string }>>;
    error?: DesktopError;
  } | null;
  indexTask?: {
    stage: 'building' | 'paused' | 'error';
    completed: number;
    total: number;
    progress: number;
    error?: DesktopError | null;
  } | null;
  webSecurity?: {
    confirmedOrigins: string[];
    bulkEmbeddingAccepted: boolean;
  };
}

export type AIConfigStatusName = 'unconfigured' | 'needs-consent' | 'needs-setup' | 'index-required' | 'testing' | 'building' | 'paused' | 'error' | 'ready';

export interface AIConfigStatus {
  status: AIConfigStatusName;
  message: string;
  activeCapabilities: Record<AICapability, { connectionId: string; providerId: string; label: string; model: string }> | null;
  activeFingerprint: string;
  corpusCount: number;
  consentAcceptedAt: string;
  connections: AIConnection[];
  activePipeline: AIPipeline | null;
  draft: AIDraft | null;
  usage: Array<{ id: string; createdAt: string; providerId: string; capability: AICapability; model: string; promptTokens: number; completionTokens: number; totalTokens: number }>;
}

export interface DesktopError { code: string; message: string; dataSafe: boolean; nextAction: string; technicalDetails?: string }

export type CorpusBookOrigin = 'builtin' | 'user';
export type CorpusIndexState = 'local-only' | 'pending' | 'building' | 'paused' | 'ready' | 'error';
export interface CorpusBookSummary {
  id: string;
  origin: CorpusBookOrigin;
  title: string;
  author: string;
  edition: string;
  fileName: string;
  extension: string;
  encoding: string;
  contentHash: string;
  charCount: number;
  chapterCount: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  enabled: boolean;
  deletedAt: string | null;
  purgeAt: string | null;
  indexRequested: boolean;
  indexState: CorpusIndexState;
  indexProgress: number;
  indexError: DesktopError | null;
}
export interface CorpusBookDetail extends CorpusBookSummary { samples: { first: string; last: string } }
export interface CorpusImportPreview {
  draftId: string;
  fileName: string;
  extension: string;
  bytes: number;
  suggestedTitle: string;
  encoding?: string;
  contentHash?: string;
  charCount?: number;
  chapterCount?: number;
  chunkCount?: number;
  samples?: { first: string; last: string };
  error: { code: string; message: string; nextAction: string } | null;
}
export interface CorpusImportBatch { batchId: string; totalBytes: number; previews: CorpusImportPreview[] }
export interface CorpusEntryPreview { id: string; title: string; location: string; text: string; tags: string[]; knowledgeKind: 'rule' | 'case' | 'doctrine' }
export interface CorpusStatus {
  count: number;
  bookCount: number;
  builtInBookCount: number;
  userBookCount: number;
  enabledBookCount: number;
  chunkCount: number;
  deletedBookCount: number;
  pendingIndexCount: number;
  originalCount: number;
  summaryCount: number;
  ruleCount: number;
  caseCount: number;
  doctrineCount: number;
  vectorReady: boolean;
  vectorModel: string;
  readyShardIds: string[];
  ready: boolean;
}

export type UpdateState =
  | { status: 'idle' | 'upToDate' | 'unsupported'; currentVersion: string }
  | { status: 'checking'; currentVersion: string; manual: boolean }
  | { status: 'available'; currentVersion: string; availableVersion: string }
  | { status: 'downloading'; currentVersion: string; availableVersion: string; progress: number }
  | { status: 'downloaded'; currentVersion: string; availableVersion: string }
  | { status: 'error'; currentVersion: string; availableVersion?: string; operation: 'check' | 'download'; manual: boolean; message: string };

export interface DesktopApi {
  runtime: PlatformRuntime;
  application: {
    onOpenSettings(listener: () => void): () => void;
  };
  externalLinks: {
    open(id: PublicLinkId): Promise<boolean>;
  };
  updates: {
    getState(): Promise<UpdateState>;
    check(): Promise<UpdateState>;
    download(): Promise<UpdateState>;
    install(): Promise<UpdateState>;
    onState(listener: (state: UpdateState) => void): () => void;
  };
  sessions: {
    list(): Promise<DivinationSession[]>;
    get(id: string): Promise<DivinationSession | null>;
    save(session: DivinationSession): Promise<DivinationSession>;
    delete(id: string): Promise<boolean>;
  };
  feedback: FeedbackApi;
  aiConfig: {
    getCatalog(): Promise<AIProviderCatalog>;
    getStatus(): Promise<AIConfigStatus>;
    discoverModels(payload: { baseUrl: string; apiKey: string }): Promise<{ ok: boolean; modelIds?: string[]; error?: DesktopError }>;
    saveDraft(payload: { presetId?: string; fields?: Record<string, string>; connection?: Partial<AIConnection>; pipeline?: AIPipeline; apiKey?: string; consentAccepted?: boolean; webSecurity?: { confirmedOrigins: string[]; bulkEmbeddingAccepted?: boolean } }): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    testDraft(): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    buildAndActivate(): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    pauseBuild(): Promise<AIConfigStatus>;
    resumeBuild(): Promise<AIConfigStatus>;
    cancelBuild(): Promise<AIConfigStatus>;
    removeConnection(id: string): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    openExternal(url: string): Promise<boolean>;
    onStatus(listener: (status: AIConfigStatus) => void): () => void;
  };
  corpus: {
    status(): Promise<CorpusStatus>;
    books(payload?: { includeDeleted?: boolean; query?: string; offset?: number; limit?: number }): Promise<{ items: CorpusBookSummary[]; total: number }>;
    book(id: string): Promise<CorpusBookDetail | null>;
    bookEntries(payload: { bookId: string; query?: string; offset?: number; limit?: number }): Promise<{ items: CorpusEntryPreview[]; total: number }>;
    selectImportFiles(): Promise<{ ok: boolean; canceled?: boolean; batch?: CorpusImportBatch; error?: DesktopError }>;
    previewDroppedFiles(files: FileList | File[]): Promise<{ ok: boolean; batch?: CorpusImportBatch; error?: DesktopError }>;
    commitImport(payload: { batchId: string; sendForIndex: boolean; books: Array<{ draftId: string; title: string; author: string; edition: string }> }): Promise<{ ok: boolean; results?: Array<{ draftId: string; ok: boolean; book?: CorpusBookSummary; error?: DesktopError }>; error?: DesktopError }>;
    setEnabled(id: string, enabled: boolean, requestIndex?: boolean): Promise<{ ok: boolean; book?: CorpusBookSummary; error?: DesktopError }>;
    updateMetadata(payload: { id: string; title: string; author: string; edition: string }): Promise<{ ok: boolean; book?: CorpusBookSummary; requiresIndex?: boolean; error?: DesktopError }>;
    trash(id: string): Promise<{ ok: boolean; book?: CorpusBookSummary; error?: DesktopError }>;
    restore(id: string): Promise<{ ok: boolean; book?: CorpusBookSummary; error?: DesktopError }>;
    purge(id: string): Promise<{ ok: boolean; error?: DesktopError }>;
    pauseIndex(): Promise<CorpusStatus>;
    resumeIndex(): Promise<CorpusStatus>;
    cancelIndex(): Promise<CorpusStatus>;
    rebuildVectors(): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    onState(listener: (status: CorpusStatus) => void): () => void;
  };
  retrieval: {
    search(payload: { query: string; domainTerms: string[]; limit?: number }): Promise<{ evidence: EvidenceEntry[]; diagnostics: RetrievalDiagnostics }>;
  };
  ai: {
    analyze(payload: { question: string; category: string; castingMethod: DivinationSession['castingMethod']; castingBasis: DivinationSession['castingBasis']; plate: DivinationSession['plate']; evidence: EvidenceEntry[]; retrievalDiagnostics?: RetrievalDiagnostics }): Promise<{ ok: boolean; report?: AnalysisReport; error?: DesktopError }>;
    followUp(payload: { question: string; session: DivinationSession; evidence: EvidenceEntry[] }): Promise<{ ok: boolean; answer?: { content: string; provider?: AnalysisReport['provider'] }; error?: DesktopError }>;
  };
}

export type ElectronBridge = DesktopApi;

declare global {
  interface Window { wenyao?: ElectronBridge }
}

export {};
