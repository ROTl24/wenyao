import retrievalCore from '../../shared/retrieval-core.cjs';

export type EvidenceSourceType = 'original' | 'summary';
export type RetrievalMode = 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';

export interface RetrievalRank {
  id: string;
  rank: number;
  score: number;
}

export interface EvidenceEntry {
  id: string;
  title: string;
  source: string;
  author?: string;
  edition?: string;
  origin?: 'builtin' | 'user';
  bookId?: string;
  location: string;
  text: string;
  tags: string[];
  sourceType: EvidenceSourceType;
  pageImage?: string;
  knowledgeKind?: 'rule' | 'case' | 'doctrine';
  topics?: string[];
  retrieval?: {
    lexicalScore: number;
    vectorScore: number;
    fusionScore: number;
    rerankScore: number | null;
  };
}

export interface RankedEvidence extends EvidenceEntry {
  score: number;
  matchedTerms: string[];
}

export interface RetrievalDiagnostics {
  mode: RetrievalMode;
  lexicalCandidates: number;
  vectorCandidates: number;
  fusedCandidates: number;
  rerankedCandidates?: number;
  selectedCandidates?: number;
  serializedCharacters?: number;
  vectorUsed: boolean;
  rerankUsed: boolean;
  stages?: string[];
  warnings: string[];
  rankings?: Record<'bm25' | 'vector' | 'fusion' | 'rerank' | 'final', RetrievalRank[]>;
  corpusVersion?: string;
}

export function searchEvidence(
  entries: readonly EvidenceEntry[],
  query: string,
  domainTerms: readonly string[],
  limit = 40,
): RankedEvidence[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return retrievalCore.bm25Search(entries, query, domainTerms, limit).map((ranked: { id: string; score: number; matchedTerms: string[] }) => ({
    ...byId.get(ranked.id)!,
    ...ranked,
  }));
}

export function isClarificationQuestion(question: string): boolean {
  return retrievalCore.isClarificationQuestion(question);
}

export function reselectEvidence(entries: readonly EvidenceEntry[], question: string, domainTerms: readonly string[]): EvidenceEntry[] {
  return retrievalCore.reselectEvidence(entries, question, domainTerms);
}

export function reselectEvidenceWithDiagnostics(
  entries: readonly EvidenceEntry[],
  question: string,
  domainTerms: readonly string[],
): { evidence: EvidenceEntry[]; diagnostics: RetrievalDiagnostics } {
  return retrievalCore.reselectEvidenceWithDiagnostics(entries, question, domainTerms);
}

export async function searchLocalEvidence(
  entries: readonly EvidenceEntry[],
  query: string,
  domainTerms: readonly string[],
): Promise<{ evidence: EvidenceEntry[]; diagnostics: RetrievalDiagnostics }> {
  return retrievalCore.hybridSearch({ corpus: entries, query, domainTerms });
}
