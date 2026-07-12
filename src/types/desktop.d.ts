import type { EvidenceEntry } from '../lib/retrieval';
import type { ReadingClient } from '../lib/readingClient';
import type { DivinationSession } from '../lib/session';

interface PublicSettings { baseUrl: string; model: string; embeddingModel: string; rerankModel: string; rerankUrl: string; hasApiKey: boolean }
interface DesktopError { code: string; message: string; dataSafe: boolean; nextAction: string }
interface CorpusStatus { count: number; bookCount: number; originalCount: number; summaryCount: number; ruleCount: number; caseCount: number; doctrineCount: number; vectorReady: boolean; vectorModel: string; ready: boolean }

export interface DesktopApi {
  sessions: {
    list(): Promise<DivinationSession[]>;
    get(id: string): Promise<DivinationSession | null>;
    save(session: DivinationSession): Promise<DivinationSession>;
    delete(id: string): Promise<boolean>;
  };
  settings: {
    get(): Promise<PublicSettings>;
    save(payload: { baseUrl: string; model: string; embeddingModel: string; rerankModel: string; rerankUrl: string; apiKey?: string }): Promise<PublicSettings>;
    clearKey(): Promise<PublicSettings>;
    test(): Promise<{ ok: boolean; message?: string; error?: DesktopError }>;
  };
  corpus: {
    list(): Promise<EvidenceEntry[]>;
    status(): Promise<CorpusStatus>;
    rebuildVectors(): Promise<{ ok: boolean; result?: { count: number; model: string; dimensions: number }; error?: DesktopError }>;
  };
  reading: ReadingClient;
  platform: string;
}

declare global {
  interface Window { wenyao?: DesktopApi }
}

export {};
