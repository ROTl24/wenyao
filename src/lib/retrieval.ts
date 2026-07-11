export type EvidenceSourceType = 'original' | 'summary';

export interface EvidenceEntry {
  id: string;
  title: string;
  source: string;
  location: string;
  text: string;
  tags: string[];
  sourceType: EvidenceSourceType;
  pageImage?: string;
}

export interface RankedEvidence extends EvidenceEntry {
  score: number;
  matchedTerms: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s，。、《》“”‘’：；！？,.!?;:()（）\[\]]+/g, '');
}

function ngrams(value: string, size: number): string[] {
  const normalized = normalize(value);
  if (normalized.length < size) return normalized ? [normalized] : [];
  return Array.from({ length: normalized.length - size + 1 }, (_, index) => normalized.slice(index, index + size));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function searchEvidence(
  entries: readonly EvidenceEntry[],
  query: string,
  domainTerms: readonly string[],
  limit = 8,
): RankedEvidence[] {
  const normalizedQuery = normalize(query);
  const terms = unique([
    ...domainTerms.map(normalize).filter(Boolean),
    ...ngrams(query, 2),
    ...ngrams(query, 3),
  ]);

  return entries
    .map((entry) => {
      const normalizedText = normalize(`${entry.title}${entry.text}${entry.tags.join('')}${entry.source}`);
      const matchedTerms = terms.filter((term) => normalizedText.includes(term));
      const exactTagScore = entry.tags.reduce((sum, tag) => (
        normalizedQuery.includes(normalize(tag)) ? sum + 8 : sum
      ), 0);
      const titleScore = terms.reduce((sum, term) => sum + (normalize(entry.title).includes(term) ? 3 : 0), 0);
      const textScore = matchedTerms.reduce((sum, term) => sum + Math.min(4, term.length), 0);
      return { ...entry, score: exactTagScore + titleScore + textScore, matchedTerms };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, limit);
}
