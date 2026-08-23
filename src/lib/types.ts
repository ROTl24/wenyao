import type { EvidenceEntry, RetrievalDiagnostics } from './retrieval';

export interface AnalysisEvidenceSnapshot {
  capturedAt: string;
  appVersion: string;
  corpusVersion: string;
  category: string;
  evidence: EvidenceEntry[];
  retrieval: RetrievalDiagnostics;
}

export interface AnalysisReport {
  mode: 'cloud';
  analysisId?: string;
  markdown: string;
  generatedAt: string;
  evidenceSnapshot?: AnalysisEvidenceSnapshot;
  pipeline?: {
    retrievalMode: 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';
    stages: string[];
    warnings: string[];
  };
  provider?: Record<'generation' | 'embedding' | 'rerank', {
    providerId: string;
    connectionLabel: string;
    model: string;
  }>;
}
