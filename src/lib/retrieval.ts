import type { CanonicalEvidenceV2 } from '../domain/liuyao/analysis-report';

export type EvidenceEntry = CanonicalEvidenceV2;

export interface RetrievalDiagnosticsV2 {
  readonly mode: 'hybrid-reranked' | 'hybrid-fused' | 'lexical-fallback';
  readonly lexicalCandidates: number;
  readonly vectorCandidates: number;
  readonly fusedCandidates: number;
  readonly vectorUsed: boolean;
  readonly rerankUsed: boolean;
  readonly requestedRuleIds: readonly string[];
  readonly matchedRuleIds: readonly string[];
  readonly ruleCandidateIds: readonly string[];
  readonly ruleBoost: number;
  readonly warnings: readonly string[];
}

export interface EvidenceCandidateRef {
  readonly id: string;
  readonly rank: number;
}

export const RULE_MATCH_BOOST = 12;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s，。、《》“”‘’：；！？,.!?;:()（）\[\]]+/g, '');
}

function ngrams(value: string, size: number): string[] {
  const text = normalize(value);
  if (text.length < size) return text ? [text] : [];
  return Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size));
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

interface SearchInput {
  readonly entries: readonly CanonicalEvidenceV2[];
  readonly query: string;
  readonly domainTerms: readonly string[];
  readonly ruleIds: readonly string[];
  readonly limit?: number;
}

export function searchEvidenceCandidates({
  entries, query, domainTerms, ruleIds, limit = 8,
}: SearchInput): { readonly candidateRefs: readonly EvidenceCandidateRef[]; readonly diagnostics: RetrievalDiagnosticsV2 } {
  const requestedRuleIds = uniqueStrings(ruleIds);
  const normalizedDomainTerms = domainTerms.map(normalize).filter(Boolean);
  const domainSet = new Set(normalizedDomainTerms);
  const terms = [...new Set([...normalizedDomainTerms, ...ngrams(query, 2), ...ngrams(query, 3)])].filter(Boolean);
  const documents = entries.map((entry) => normalize(`${entry.title}${entry.text}${entry.tags.join('')}${entry.source}`));
  const frequency = new Map(terms.map((term) => [term, documents.filter((document) => document.includes(term)).length]));
  const lexicalAll = entries.map((entry, index) => {
    const document = documents[index];
    const title = normalize(entry.title);
    const tags = entry.tags.map(normalize);
    const matchedTerms = terms.filter((term) => document.includes(term));
    const lexicalScore = matchedTerms.reduce((sum, term) => {
      const df = frequency.get(term) ?? 0;
      const idf = Math.log(1 + (entries.length - df + 0.5) / (df + 0.5));
      const domainBoost = domainSet.has(term) ? 2.5 : 1;
      const fieldBoost = title.includes(term) ? 3 : tags.includes(term) ? 2 : 1;
      return sum + idf * domainBoost * fieldBoost;
    }, 0);
    const matchedRuleIds = requestedRuleIds.filter((ruleId) => entry.supportsRuleIds.includes(ruleId));
    return { entry, score: lexicalScore + matchedRuleIds.length * RULE_MATCH_BOOST, matchedRuleIds };
  }).filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
  const lexical = lexicalAll.slice(0, 40);
  const matchedRuleIds = requestedRuleIds.filter((ruleId) => entries.some((entry) => entry.supportsRuleIds.includes(ruleId)));
  const reservedIds: string[] = [];
  for (const ruleId of matchedRuleIds) {
    const candidate = lexicalAll.find((item) => item.matchedRuleIds.includes(ruleId));
    if (candidate && !reservedIds.includes(candidate.entry.id)) reservedIds.push(candidate.entry.id);
  }
  const selected = reservedIds.slice(0, limit);
  const sourceCounts = new Map<string, number>();
  const sourceCap = Math.max(2, Math.ceil(limit / 3));
  for (const id of selected) {
    const source = entries.find((entry) => entry.id === id)?.source ?? '';
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  for (const candidate of lexical.slice(0, 30)) {
    if (selected.includes(candidate.entry.id)) continue;
    if ((sourceCounts.get(candidate.entry.source) ?? 0) >= sourceCap) continue;
    selected.push(candidate.entry.id);
    sourceCounts.set(candidate.entry.source, (sourceCounts.get(candidate.entry.source) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  for (const candidate of lexical.slice(0, 30)) {
    if (selected.includes(candidate.entry.id)) continue;
    selected.push(candidate.entry.id);
    if (selected.length >= limit) break;
  }
  const candidateRefs = selected.slice(0, limit).map((id, index) => ({ id, rank: index + 1 }));
  return {
    candidateRefs,
    diagnostics: {
      mode: 'lexical-fallback', lexicalCandidates: lexical.length, vectorCandidates: 0,
      fusedCandidates: lexical.length, vectorUsed: false, rerankUsed: false,
      requestedRuleIds, matchedRuleIds,
      ruleCandidateIds: reservedIds.filter((id) => selected.includes(id)).slice(0, limit),
      ruleBoost: RULE_MATCH_BOOST,
      warnings: ['浏览器预览仅使用 canonical catalog 关键词召回。'],
    },
  };
}
