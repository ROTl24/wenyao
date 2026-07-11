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

const SUBJECT_TERMS = new Set([
  '事业', '功名', '官禄', '仕宦', '求名', '财运', '求财', '买卖',
  '感情', '婚姻', '健康', '疾病', '学业', '考试', '科举', '科甲',
  '寻物', '失物', '出行', '行人',
].map((term) => term.toLowerCase()));

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
  const normalizedDomainTerms = unique(domainTerms.map(normalize).filter(Boolean));
  const terms = unique([
    ...normalizedDomainTerms,
    ...ngrams(query, 2),
    ...ngrams(query, 3),
  ]);

  const ranked = entries
    .map((entry) => {
      const normalizedText = normalize(`${entry.title}${entry.text}${entry.tags.join('')}${entry.source}`);
      const normalizedTitle = normalize(entry.title);
      const normalizedTags = entry.tags.map(normalize);
      const matchedTerms = terms.filter((term) => normalizedText.includes(term));
      const exactTagScore = entry.tags.reduce((sum, tag) => (
        normalizedQuery.includes(normalize(tag)) ? sum + 8 : sum
      ), 0);
      const domainScore = normalizedDomainTerms.reduce((sum, term) => {
        const tagScore = normalizedTags.includes(term) ? 8 : 0;
        const titleScore = SUBJECT_TERMS.has(term) && normalizedTitle.includes(term) ? 80 : 0;
        const bodyScore = normalize(entry.text).includes(term) ? 2 : 0;
        return sum + tagScore + titleScore + bodyScore;
      }, 0);
      const titleScore = terms.reduce((sum, term) => sum + (normalizedTitle.includes(term) ? 3 : 0), 0);
      const textScore = matchedTerms.reduce((sum, term) => sum + Math.min(4, term.length), 0);
      return { ...entry, score: exactTagScore + domainScore + titleScore + textScore, matchedTerms };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  const selected: RankedEvidence[] = [];
  const perSource = new Map<string, number>();
  const sourceCap = Math.max(2, Math.ceil(limit / 3));
  const diversityFloor = (ranked[0]?.score || 0) * 0.5;
  for (const entry of ranked) {
    if (entry.score < diversityFloor) continue;
    if ((perSource.get(entry.source) || 0) >= sourceCap) continue;
    selected.push(entry);
    perSource.set(entry.source, (perSource.get(entry.source) || 0) + 1);
    if (selected.length >= limit) return selected;
  }
  for (const entry of ranked) {
    if (selected.some((item) => item.id === entry.id)) continue;
    selected.push(entry);
    if (selected.length >= limit) break;
  }
  return selected;
}
