import type { EvidenceEntry, RetrievalDiagnostics } from '../lib/retrieval';
import type { DivinationSession } from '../lib/session';
import type { AnalysisReport } from '../lib/types';

export type AICapability = 'generation' | 'embedding' | 'rerank';
export type AIProtocol = 'openai-chat' | 'openai-embeddings' | 'cohere-rerank' | 'alibaba-rerank';

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
interface CorpusStatus { count: number; bookCount: number; originalCount: number; summaryCount: number; ruleCount: number; caseCount: number; doctrineCount: number; vectorReady: boolean; vectorModel: string; ready: boolean }

export type UpdateState =
  | { status: 'idle' | 'upToDate' | 'unsupported'; currentVersion: string }
  | { status: 'checking'; currentVersion: string; manual: boolean }
  | { status: 'available'; currentVersion: string; availableVersion: string }
  | { status: 'downloading'; currentVersion: string; availableVersion: string; progress: number }
  | { status: 'downloaded'; currentVersion: string; availableVersion: string }
  | { status: 'error'; currentVersion: string; availableVersion?: string; operation: 'check' | 'download'; manual: boolean; message: string };

export interface DesktopApi {
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
  aiConfig: {
    getCatalog(): Promise<AIProviderCatalog>;
    getStatus(): Promise<AIConfigStatus>;
    saveDraft(payload: { presetId?: string; fields?: Record<string, string>; connection?: Partial<AIConnection>; pipeline?: AIPipeline; apiKey?: string; consentAccepted?: boolean }): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
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
    list(): Promise<EvidenceEntry[]>;
    status(): Promise<CorpusStatus>;
    rebuildVectors(): Promise<{ ok: boolean; status?: AIConfigStatus; error?: DesktopError }>;
  };
  retrieval: {
    search(payload: { query: string; domainTerms: string[]; limit?: number }): Promise<{ evidence: EvidenceEntry[]; diagnostics: RetrievalDiagnostics }>;
  };
  ai: {
    analyze(payload: { question: string; category: string; plate: DivinationSession['plate']; evidence: EvidenceEntry[]; retrievalDiagnostics?: RetrievalDiagnostics }): Promise<{ ok: boolean; report?: AnalysisReport; error?: DesktopError }>;
    followUp(payload: { question: string; session: DivinationSession; evidence: EvidenceEntry[] }): Promise<{ ok: boolean; answer?: { content: string }; error?: DesktopError }>;
  };
  platform: string;
}

declare global {
  interface Window { wenyao?: DesktopApi }
}

export {};
