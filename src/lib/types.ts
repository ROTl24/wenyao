export interface AnalysisReport {
  mode: 'cloud' | 'local';
  markdown: string;
  generatedAt: string;
  pipeline?: {
    retrievalMode: 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';
    stages: string[];
    warnings: string[];
  };
}
