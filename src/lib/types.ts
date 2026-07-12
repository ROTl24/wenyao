import type {
  AnalysisReportV2,
  CanonicalEvidenceV2,
  ValidatedFollowUpV2,
} from '../domain/liuyao/analysis-report';
import type { RetrievalDiagnosticsV2 } from './retrieval';

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

/** Legacy quarantine only; it is never a validated V2 cache entry. */
export type LegacyQuarantinedAnalysisReport = AnalysisReport;

export interface CorpusRefV2 {
  readonly version: number;
  readonly hash: string;
}

export type AnalysisOriginV2 = 'local' | 'cloud';

export interface ValidatedAnalysisBundleV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly analysisOrigin: AnalysisOriginV2;
  readonly report: AnalysisReportV2;
  readonly canonicalEvidence: readonly CanonicalEvidenceV2[];
  readonly retrievalDiagnostics: RetrievalDiagnosticsV2;
  readonly corpusRef: CorpusRefV2;
}

export interface ValidatedFollowUpBundleV2 {
  readonly schemaVersion: '2.0.0';
  readonly caseHash: string;
  readonly analysisOrigin: AnalysisOriginV2;
  readonly followUp: ValidatedFollowUpV2;
  readonly canonicalEvidence: readonly CanonicalEvidenceV2[];
  readonly retrievalDiagnostics: RetrievalDiagnosticsV2;
  readonly corpusRef: CorpusRefV2;
}
