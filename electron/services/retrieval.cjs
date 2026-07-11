function normalize(value) {
  return String(value || '').toLowerCase().replace(/[\s，。、《》“”‘’：；！？,.!?;:()（）\[\]]+/g, '');
}

function ngrams(value, size) {
  const text = normalize(value);
  if (text.length < size) return text ? [text] : [];
  return Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size));
}

function lexicalSearch(corpus, query, domainTerms, limit = 40) {
  const normalizedDomainTerms = domainTerms.map(normalize);
  const domainTermSet = new Set(normalizedDomainTerms);
  const terms = [...new Set([...normalizedDomainTerms, ...ngrams(query, 2), ...ngrams(query, 3)].filter(Boolean))];
  const documents = corpus.map((entry) => normalize(`${entry.title}${entry.text}${(entry.tags || []).join('')}${entry.source}`));
  const documentFrequency = new Map(terms.map((term) => [term, documents.filter((document) => document.includes(term)).length]));
  return corpus.map((entry, index) => {
    const document = documents[index];
    const title = normalize(entry.title);
    const tags = (entry.tags || []).map(normalize);
    const matchedTerms = terms.filter((term) => document.includes(term));
    const score = matchedTerms.reduce((sum, term) => {
      const idf = Math.log(1 + (corpus.length - documentFrequency.get(term) + 0.5) / (documentFrequency.get(term) + 0.5));
      const domainBoost = domainTermSet.has(term) ? 2.5 : 1;
      const fieldBoost = title.includes(term) ? 3 : tags.includes(term) ? 2 : 1;
      return sum + idf * domainBoost * fieldBoost;
    }, 0);
    return { id: entry.id, score, matchedTerms };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit);
}

function reciprocalRankFusion(rankings, rankConstant = 60) {
  const scores = new Map();
  rankings.forEach((ranking) => ranking.forEach((id, rank) => scores.set(id, (scores.get(id) || 0) + 1 / (rankConstant + rank + 1))));
  return [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function diversify(items, limit) {
  const selected = [];
  const perSource = new Map();
  const sourceCap = Math.max(2, Math.ceil(limit / 3));
  for (const item of items) {
    if ((perSource.get(item.source) || 0) >= sourceCap) continue;
    selected.push(item);
    perSource.set(item.source, (perSource.get(item.source) || 0) + 1);
    if (selected.length === limit) return selected;
  }
  for (const item of items) {
    if (!selected.some((entry) => entry.id === item.id)) selected.push(item);
    if (selected.length === limit) break;
  }
  return selected;
}

async function hybridSearch({ corpus, query, domainTerms = [], limit = 8, vectorSearch, rerank }) {
  const lexical = lexicalSearch(corpus, query, domainTerms, 40);
  const warnings = [];
  let vector = [];
  if (vectorSearch) {
    try { vector = await vectorSearch(`${query}\n${domainTerms.join(' ')}`); }
    catch (error) { warnings.push(`向量召回不可用：${error.message}`); }
  } else warnings.push('本地向量索引尚未构建，当前仅使用关键词召回。');

  const fused = reciprocalRankFusion([lexical.map((item) => item.id), vector.map((item) => item.id)]);
  const byId = new Map(corpus.map((entry) => [entry.id, entry]));
  const lexicalById = new Map(lexical.map((item) => [item.id, item]));
  const vectorById = new Map(vector.map((item) => [item.id, item]));
  let candidates = fused.slice(0, 30).map(([id, fusionScore]) => ({
    ...byId.get(id),
    score: fusionScore,
    matchedTerms: lexicalById.get(id)?.matchedTerms || [],
    retrieval: { lexicalScore: lexicalById.get(id)?.score || 0, vectorScore: vectorById.get(id)?.score || 0, fusionScore, rerankScore: null },
  })).filter((item) => item.id);

  let rerankUsed = false;
  if (rerank && candidates.length) {
    try {
      const ranked = await rerank(`${query}\n${domainTerms.join(' ')}`, candidates.map((item) => `${item.title}\n${item.text}`));
      const rerankedCandidates = ranked.map((item) => {
        const candidate = candidates[item.index];
        return candidate ? { ...candidate, score: item.score, retrieval: { ...candidate.retrieval, rerankScore: item.score } } : null;
      }).filter(Boolean);
      if (rerankedCandidates.length === 0) throw new Error('重排模型没有返回有效候选');
      candidates = rerankedCandidates;
      rerankUsed = true;
    } catch (error) { warnings.push(`重排模型不可用：${error.message}`); }
  } else warnings.push('未配置专用重排 API，当前使用融合排序。');

  const evidence = diversify(candidates, limit);
  const vectorUsed = vector.length > 0;
  return {
    evidence,
    diagnostics: {
      mode: rerankUsed ? 'hybrid-reranked' : vectorUsed ? 'hybrid-fused' : 'lexical-fallback',
      lexicalCandidates: lexical.length,
      vectorCandidates: vector.length,
      fusedCandidates: fused.length,
      vectorUsed,
      rerankUsed,
      warnings,
    },
  };
}

module.exports = { lexicalSearch, reciprocalRankFusion, hybridSearch };
