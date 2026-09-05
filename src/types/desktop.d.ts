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
  capabilityExamples: Record<AICapability, Array<{
    providerId: string;
    providerName: string;
    model: string;
    apiUrl: string;
    description: string;
  }>>;
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
  connections: AIConnection[];
  pipeline: AIPipeline;
  tests: Partial<Record<AICapability, {
    status: 'testing' | 'passed' | 'failed';
    checkedAt?: string;
    error?: DesktopError;
  }>>;
  indexTask?: {
    stage: 'building' | 'paused' | 'error';
    completed: number;
    total: number;
    progress: number;
    failedRange?: { shardId?: string; start: number; end: number; total: number } | null;
    error?: DesktopError | null;
  } | null;
  bulkEmbeddingAccepted?: boolean;
  webSecurity?: {
    confirmedOrigins: string[];
    bulkEmbeddingAccepted: boolean;
  };
}

export type AIConfigStatusName = 'unconfigured' | 'needs-consent' | 'needs-setup' | 'index-required' | 'testing' | 'building' | 'paused' | 'error' | 'ready';

export interface AIConfigStatus {
  status: AIConfigStatusName;
  message: string;
  activeCapabilities: Partial<Record<AICapability, { connectionId: string; providerId: string; label: string; model: string }>> | null;
  activeFingerprint: string;
  corpusCount: number;
  consentAcceptedAt: string;
  connections: AIConnection[];
  activePipeline: AIPipeline | null;
  draft: AIDraft | null;
  usage: Array<{ id: string; createdAt: string; providerId: string; capability: AICapability; model: string; promptTokens: number; completionTokens: number; totalTokens: number }>;
}

export interface DesktopError { code: string; message: string; dataSafe: boolean; nextAction: string; technicalDetails?: string }

export type AIAnalysisStage = 'retrieving' | 'connecting' | 'connected' | 'reasoning' | 'writing';
export interface AIAnalysisProgress { stage: AIAnalysisStage; delta?: string }

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
    import(payload: import('../lib/sessionArchive').SessionImportRequest): Promise<DivinationSession[]>;
  };
  feedback: FeedbackApi;
  aiConfig: {
    getCatalog(): Promise<AIProviderCatalog>;
    getStatus(): Promise<AIConfigStatus>;
    listModels(payload: { capability: AICapability; apiUrl: string; addressMode?: 'auto' | 'exact'; apiKey?: string; credentialSource?: AICapability; webSecurity?: { confirmedOrigins: string[] } }): Promise<{ ok: boolean; modelIds?: string[]; warning?: string; error?: DesktopError }>;
    testCapability(payload: { capability: AICapability; apiUrl: string; addressMode?: 'auto' | 'exact'; model: string; apiKey?: string; credentialSource?: AICapability; consentAccepted?: boolean; webSecurity?: { confirmedOrigins: string[] } }): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    completeSetup(payload: { capabilities: AICapability[]; bulkEmbeddingAccepted?: boolean }): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
    cancelSetup(): Promise<AIConfigStatus>;
    pauseBuild(): Promise<AIConfigStatus>;
    resumeBuild(): Promise<AIConfigStatus>;
    cancelBuild(): Promise<AIConfigStatus>;
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
    cancel(requestId: string): Promise<{ stopped: boolean }>;
    analyze(payload: { requestId?: string; question: string; category: string; castingMethod: DivinationSession['castingMethod']; castingBasis: DivinationSession['castingBasis']; plate: DivinationSession['plate']; evidence: EvidenceEntry[]; retrievalDiagnostics?: RetrievalDiagnostics }, onProgress?: (progress: AIAnalysisProgress) => void): Promise<{ ok: boolean; report?: AnalysisReport; error?: DesktopError }>;
    followUp(payload: { requestId?: string; question: string; session: DivinationSession; evidence: EvidenceEntry[] }, onProgress?: (progress: AIAnalysisProgress) => void): Promise<{ ok: boolean; answer?: { content: string; provider?: AnalysisReport['provider'] }; error?: DesktopError }>;
  };
}

export type ElectronBridge = DesktopApi;

declare global {
  interface Window { wenyao?: ElectronBridge }
}

export {};
