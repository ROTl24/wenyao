export type Confidence = '高' | '中' | '低';

export interface AnalysisClaim {
  text: string;
  evidenceIds: string[];
  confidence: Confidence;
}

interface AnalysisReportCore {
  mode: 'cloud' | 'local';
  summary: string;
  focus: string;
  relations: string;
  moving: string;
  synthesis: string;
  uncertainties: string[];
  guidance: string[];
  claims: AnalysisClaim[];
  generatedAt: string;
  pipeline?: {
    retrievalMode: 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';
    factCheckPassed: boolean;
    citationCheckPassed: boolean;
    stages: string[];
    warnings: string[];
  };
}

export interface UnversionedAnalysisReport extends AnalysisReportCore {
  validation?: never;
}

export interface LegacyUnverifiedAnalysisReport extends AnalysisReportCore {
  validation: {
    status: 'legacy-unverified';
  };
}

export type AnalysisReport = UnversionedAnalysisReport | LegacyUnverifiedAnalysisReport;
