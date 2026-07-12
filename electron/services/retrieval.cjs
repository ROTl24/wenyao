function normalize(value) {
  return String(value || '').toLowerCase().replace(/[\s，。、《》“”‘’：；！？,.!?;:()（）\[\]]+/g, '');
}

function ngrams(value, size) {
  const text = normalize(value);
  if (text.length < size) return text ? [text] : [];
  return Array.from({ length: text.length - size + 1 }, (_, index) => text.slice(index, index + size));
}

const RULE_MATCH_BOOST = 12;

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
    .sort((left, right) => left.localeCompare(right));
}

function exactRuleMatches(entry, requestedRuleIds) {
  const supported = new Set(Array.isArray(entry.supportsRuleIds) ? entry.supportsRuleIds : []);
  return requestedRuleIds.filter((ruleId) => supported.has(ruleId));
}

function lexicalSearch(corpus, query, domainTerms = [], limit = 40, ruleIds = []) {
  const requestedRuleIds = uniqueStrings(ruleIds);
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
    const lexicalScore = matchedTerms.reduce((sum, term) => {
      const idf = Math.log(1 + (corpus.length - documentFrequency.get(term) + 0.5) / (documentFrequency.get(term) + 0.5));
      const domainBoost = domainTermSet.has(term) ? 2.5 : 1;
      const fieldBoost = title.includes(term) ? 3 : tags.includes(term) ? 2 : 1;
      return sum + idf * domainBoost * fieldBoost;
    }, 0);
    const matchedRuleIds = exactRuleMatches(entry, requestedRuleIds);
    const score = lexicalScore + matchedRuleIds.length * RULE_MATCH_BOOST;
    return { id: entry.id, score, lexicalScore, matchedTerms, matchedRuleIds };
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

async function hybridSearch({ corpus, query, domainTerms = [], ruleIds = [], limit = 8, vectorSearch, rerank }) {
  const requestedRuleIds = uniqueStrings(ruleIds);
  const byId = new Map(corpus.map((entry) => [entry.id, entry]));
  const lexicalAll = lexicalSearch(corpus, query, domainTerms, Math.max(40, corpus.length), requestedRuleIds);
  const lexical = lexicalAll.slice(0, 40);
  const warnings = [];
  let vector = [];
  if (vectorSearch) {
    try {
      const untrustedVector = await vectorSearch(`${query}\n${domainTerms.join(' ')}`);
      const seen = new Set();
      vector = (Array.isArray(untrustedVector) ? untrustedVector : []).filter((item) => {
        if (!item || typeof item.id !== 'string' || !byId.has(item.id) || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).map((item) => ({ id: item.id, score: Number.isFinite(item.score) ? item.score : 0 }));
    }
    catch (error) { warnings.push(`向量召回不可用：${error.message}`); }
  } else warnings.push('本地向量索引尚未构建，当前仅使用关键词召回。');

  const fused = reciprocalRankFusion([lexical.map((item) => item.id), vector.map((item) => item.id)]);
  const lexicalById = new Map(lexical.map((item) => [item.id, item]));
  const vectorById = new Map(vector.map((item) => [item.id, item]));
  let candidates = fused.slice(0, 30).map(([id, fusionScore]) => ({
    canonical: byId.get(id),
    id,
    source: byId.get(id)?.source,
    score: fusionScore,
    matchedTerms: lexicalById.get(id)?.matchedTerms || [],
    retrieval: { lexicalScore: lexicalById.get(id)?.score || 0, vectorScore: vectorById.get(id)?.score || 0, fusionScore, rerankScore: null },
  })).filter((item) => item.canonical);
  const fusedCandidates = candidates;

  let rerankUsed = false;
  if (rerank && candidates.length) {
    try {
      const ranked = await rerank(`${query}\n${domainTerms.join(' ')}`, candidates.map((item) => `${item.canonical.title}\n${item.canonical.text}`));
      const usedIndexes = new Set();
      const rerankedCandidates = (Array.isArray(ranked) ? ranked : []).map((item) => {
        if (!item || !Number.isSafeInteger(item.index) || usedIndexes.has(item.index)) return null;
        usedIndexes.add(item.index);
        const candidate = candidates[item.index];
        const rerankScore = Number.isFinite(item.score) ? item.score : 0;
        return candidate ? { ...candidate, score: rerankScore, retrieval: { ...candidate.retrieval, rerankScore } } : null;
      }).filter(Boolean);
      if (rerankedCandidates.length === 0) throw new Error('重排模型没有返回有效候选');
      candidates = rerankedCandidates;
      rerankUsed = true;
    } catch (error) { warnings.push(`重排模型不可用：${error.message}`); }
  } else warnings.push('未配置专用重排 API，当前使用融合排序。');

  const matchedRuleIds = requestedRuleIds.filter((ruleId) => corpus.some((entry) => exactRuleMatches(entry, [ruleId]).length));
  const reservedIds = [];
  for (const ruleId of matchedRuleIds) {
    const candidate = lexicalAll.find((item) => item.matchedRuleIds.includes(ruleId));
    if (candidate && !reservedIds.includes(candidate.id)) reservedIds.push(candidate.id);
  }
  const candidateById = new Map([...fusedCandidates, ...candidates].map((candidate) => [candidate.id, candidate]));
  const fusionById = new Map(fused);
  for (const id of reservedIds) {
    if (candidateById.has(id)) continue;
    const canonical = byId.get(id);
    const lexicalCandidate = lexicalAll.find((candidate) => candidate.id === id);
    const fusionScore = fusionById.get(id) || 0;
    candidateById.set(id, {
      canonical,
      id,
      source: canonical.source,
      score: fusionScore || lexicalCandidate.score,
      matchedTerms: lexicalCandidate.matchedTerms,
      retrieval: {
        lexicalScore: lexicalCandidate.score,
        vectorScore: 0,
        fusionScore,
        rerankScore: null,
      },
    });
  }
  const reserved = reservedIds.map((id) => candidateById.get(id)).filter(Boolean).slice(0, limit);
  const remainingLimit = Math.max(0, limit - reserved.length);
  const remaining = diversify(candidates.filter((candidate) => !reservedIds.includes(candidate.id)), remainingLimit);
  const selected = [...reserved, ...remaining].slice(0, limit);
  const candidateRefs = selected.map((item, index) => ({ id: item.id, rank: index + 1 }));
  const evidence = selected.map((item) => ({ ...item.canonical, score: item.score, retrieval: item.retrieval }));
  const vectorUsed = vector.length > 0;
  return {
    candidateRefs,
    evidence,
    diagnostics: {
      mode: rerankUsed ? 'hybrid-reranked' : vectorUsed ? 'hybrid-fused' : 'lexical-fallback',
      lexicalCandidates: lexical.length,
      vectorCandidates: vector.length,
      fusedCandidates: fused.length,
      vectorUsed,
      rerankUsed,
      requestedRuleIds,
      matchedRuleIds,
      ruleCandidateIds: reserved.map((candidate) => candidate.id),
      ruleBoost: RULE_MATCH_BOOST,
      warnings,
    },
  };
}

module.exports = { RULE_MATCH_BOOST, lexicalSearch, reciprocalRankFusion, hybridSearch };
