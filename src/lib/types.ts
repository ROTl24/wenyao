export interface AnalysisReport {
  mode: 'cloud';
  markdown: string;
  generatedAt: string;
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
