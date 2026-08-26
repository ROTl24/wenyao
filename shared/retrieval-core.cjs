const MAX_EVIDENCE_CHARS = 9000;
const DEFAULT_LIMIT = 12;
const MIN_LIMIT = 8;
const MAX_LIMIT = 16;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

const PUNCTUATION = /[\s，。、《》“”‘’：；！？,.!?;:()（）\[\]{}【】<>/\\|_—–-]+/g;
const ASCII_WORDS = /[a-z0-9]+/g;
const CJK_RUNS = /[\u3400-\u9fff]+/g;
const indexCache = new WeakMap();

function normalized(value) {
  return String(value || '').toLowerCase().replace(PUNCTUATION, '');
}

function tokenize(value) {
  const text = String(value || '').toLowerCase();
  const tokens = [...(text.match(ASCII_WORDS) || [])];
  for (const run of text.match(CJK_RUNS) || []) {
    if (run.length === 1) tokens.push(run);
    for (const size of [2, 3]) {
      if (run.length < size) continue;
      for (let index = 0; index <= run.length - size; index += 1) tokens.push(run.slice(index, index + size));
    }
  }
  return tokens;
}

function addTokens(target, value, weight) {
  for (const token of tokenize(value)) target.set(token, (target.get(token) || 0) + weight);
}

function documentTerms(entry) {
  const terms = new Map();
  addTokens(terms, entry.text, 1);
  addTokens(terms, entry.title, 2.2);
  addTokens(terms, (entry.tags || []).join(' '), 2);
  addTokens(terms, `${entry.source || ''} ${entry.location || ''}`, 0.35);
  return terms;
}

function buildBM25Index(entries) {
  const documents = entries.map((entry) => ({ id: entry.id, terms: documentTerms(entry) }));
  const documentFrequency = new Map();
  let totalLength = 0;
  for (const document of documents) {
    document.length = [...document.terms.values()].reduce((sum, count) => sum + count, 0);
    totalLength += document.length;
    for (const token of document.terms.keys()) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
  }
  return {
    documents,
    documentFrequency,
    size: documents.length,
    averageLength: documents.length ? totalLength / documents.length : 1,
  };
}

function queryTerms(query, domainTerms) {
  const terms = new Map();
  addTokens(terms, query, 1);
  for (const term of domainTerms || []) addTokens(terms, term, 0.75);
  return terms;
}

function bm25Search(entries, query, domainTerms = [], limit = 40, preparedIndex = null) {
  let index = preparedIndex;
  if (!index && entries && typeof entries === 'object') {
    index = indexCache.get(entries);
    if (!index) {
      index = buildBM25Index(entries);
      indexCache.set(entries, index);
    }
  }
  index ||= buildBM25Index(entries);
  const queryWeights = queryTerms(query, domainTerms);
  if (!index.size || !queryWeights.size) return [];
  const results = [];
  for (const document of index.documents) {
    let score = 0;
    const matchedTerms = [];
    for (const [term, queryWeight] of queryWeights) {
      const termFrequency = document.terms.get(term) || 0;
      if (!termFrequency) continue;
      const frequency = index.documentFrequency.get(term) || 0;
      const inverseDocumentFrequency = Math.log(1 + (index.size - frequency + 0.5) / (frequency + 0.5));
      const normalization = termFrequency + BM25_K1 * (1 - BM25_B + BM25_B * document.length / index.averageLength);
      score += queryWeight * inverseDocumentFrequency * (termFrequency * (BM25_K1 + 1)) / normalization;
      matchedTerms.push(term);
    }
    if (score > 0) results.push({ id: document.id, score, matchedTerms });
  }
  return results.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id)).slice(0, limit);
}

function reciprocalRankFusion(rankings, rankConstant = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => scores.set(id, (scores.get(id) || 0) + 1 / (rankConstant + index + 1)));
  }
  return [...scores.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
}

function stageRanking(items) {
  return items.map((item, index) => ({ id: item.id, rank: index + 1, score: Number(item.score || 0) }));
}

function nearDuplicate(left, right) {
  const a = normalized(left.text);
  const b = normalized(right.text);
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 80 && longer.includes(shorter) && shorter.length / longer.length >= 0.82) return true;
  const shingles = (value) => {
    const set = new Set();
    for (let index = 0; index <= value.length - 12; index += 6) set.add(value.slice(index, index + 12));
    return set;
  };
  const leftShingles = shingles(a);
  const rightShingles = shingles(b);
  if (!leftShingles.size || !rightShingles.size) return false;
  let intersection = 0;
  for (const shingle of leftShingles) if (rightShingles.has(shingle)) intersection += 1;
  return intersection / (leftShingles.size + rightShingles.size - intersection) >= 0.78;
}

function novelty(item, selected) {
  let score = 0;
  if (!selected.some((entry) => entry.source === item.source)) score += 3;
  if (!selected.some((entry) => entry.knowledgeKind === item.knowledgeKind)) score += 2;
  const topics = new Set(item.topics || []);
  if (topics.size && !selected.some((entry) => (entry.topics || []).some((topic) => topics.has(topic)))) score += 1;
  return score;
}

function adaptiveTarget(query, domainTerms, ranked) {
  const candidateCount = ranked.length;
  const complexity = tokenize(query).length + Math.min(8, (domainTerms || []).length);
  let requested = complexity >= 48 ? 16 : complexity >= 38 ? 14 : complexity <= 14 ? 10 : DEFAULT_LIMIT;
  if (requested === DEFAULT_LIMIT && candidateCount >= MAX_LIMIT) {
    const twelfthScore = Number(ranked[DEFAULT_LIMIT - 1].score || 0);
    const sixteenthScore = Number(ranked[MAX_LIMIT - 1].score || 0);
    const earlyTerms = new Set(ranked.slice(0, DEFAULT_LIMIT).flatMap((item) => item.matchedTerms || []));
    const lateTerms = new Set(ranked.slice(DEFAULT_LIMIT, MAX_LIMIT).flatMap((item) => item.matchedTerms || []));
    const missingDomainCoverage = (domainTerms || []).flatMap(tokenize).some((term) => !earlyTerms.has(term) && lateTerms.has(term));
    if (missingDomainCoverage && twelfthScore > 0 && sixteenthScore / twelfthScore >= 0.9) requested = MAX_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(Math.min(MIN_LIMIT, candidateCount), Math.min(requested, candidateCount)));
}

function chooseEvidence(ranked, { query = '', domainTerms = [], maxChars = MAX_EVIDENCE_CHARS } = {}) {
  const deduplicated = [];
  for (const candidate of ranked) {
    if (!deduplicated.some((selected) => nearDuplicate(selected, candidate))) deduplicated.push(candidate);
  }
  const target = adaptiveTarget(query, domainTerms, deduplicated);
  const selected = [];
  const remaining = [...deduplicated];
  let characters = 0;
  while (remaining.length && selected.length < target) {
    const leadingScore = Number(remaining[0].score || 0);
    const closeCount = remaining.findIndex((item) => Number(item.score || 0) < leadingScore * 0.97);
    const windowSize = closeCount === -1 ? remaining.length : Math.max(1, closeCount);
    const close = remaining.slice(0, windowSize).sort((left, right) => novelty(right, selected) - novelty(left, selected));
    const candidate = close[0];
    remaining.splice(remaining.indexOf(candidate), 1);
    const size = String(candidate.text || '').length + String(candidate.title || '').length + 80;
    if (characters + size > maxChars && selected.length >= Math.min(MIN_LIMIT, target)) continue;
    selected.push(candidate);
    characters += size;
  }
  return { evidence: selected, serializedCharacters: characters, target };
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || '未知错误');
}

async function hybridSearch({ corpus = null, lexicalSearch: lexicalProvider = null, hydrate = null, query, domainTerms = [], vectorSearch, rerank }) {
  const lexical = lexicalProvider ? await lexicalProvider(query, domainTerms, 40) : bm25Search(corpus || [], query, domainTerms, 40);
  const warnings = [];
  let vector = [];
  if (vectorSearch) {
    try {
      vector = (await vectorSearch(`${query}\n辅助盘面词：${domainTerms.join(' ')}`)).slice(0, 40);
    } catch (error) {
      warnings.push(`向量召回暂不可用，已按 BM25 继续：${errorMessage(error)}`);
    }
  } else {
    warnings.push('向量召回未配置，已按 BM25 继续。');
  }

  const fused = vector.length
    ? reciprocalRankFusion([lexical.map((item) => item.id), vector.map((item) => item.id)]).slice(0, 30)
    : lexical.slice(0, 30).map((item) => [item.id, item.score]);
  const candidateIds = fused.map(([id]) => id);
  const hydrated = hydrate ? await hydrate(candidateIds) : (corpus || []).filter((entry) => candidateIds.includes(entry.id));
  const byId = new Map(hydrated.map((entry) => [entry.id, entry]));
  const lexicalById = new Map(lexical.map((item) => [item.id, item]));
  const vectorById = new Map(vector.map((item) => [item.id, item]));
  let candidates = fused.map(([id, fusionScore]) => ({
    ...byId.get(id),
    score: fusionScore,
    matchedTerms: lexicalById.get(id)?.matchedTerms || [],
    retrieval: {
      lexicalScore: lexicalById.get(id)?.score || 0,
      vectorScore: vectorById.get(id)?.score || 0,
      fusionScore,
      rerankScore: null,
    },
  })).filter((item) => item.id);

  let rerankUsed = false;
  let rerankRanking = [];
  if (rerank && candidates.length) {
    try {
      const ranked = await rerank(`${query}\n辅助盘面词：${domainTerms.join(' ')}`, candidates.map((item) => `${item.title}\n${item.source} ${item.location}\n${item.text}`));
      const seen = new Set();
      const valid = ranked.slice(0, MAX_LIMIT).map((item) => {
        const candidate = candidates[item.index];
        if (!candidate || seen.has(candidate.id)) return null;
        seen.add(candidate.id);
        return { ...candidate, score: Number(item.score || 0), retrieval: { ...candidate.retrieval, rerankScore: Number(item.score || 0) } };
      }).filter(Boolean);
      if (!valid.length) throw new Error('重排服务没有返回有效候选');
      candidates = valid;
      rerankRanking = stageRanking(valid);
      rerankUsed = true;
    } catch (error) {
      warnings.push(`重排暂不可用，已沿用${vector.length ? ' RRF' : ' BM25'} 排序：${errorMessage(error)}`);
    }
  } else if (candidates.length) {
    warnings.push(`重排未配置，已沿用${vector.length ? ' RRF' : ' BM25'} 排序。`);
  }

  const selection = chooseEvidence(candidates, { query, domainTerms });
  const mode = rerankUsed ? 'hybrid-reranked' : vector.length ? 'hybrid-fused' : 'lexical-fallback';
  const stages = [
    `BM25 召回 ${lexical.length}`,
    vector.length ? `向量召回 ${vector.length}` : '向量召回降级',
    vector.length ? `RRF 候选 ${fused.length}` : `BM25 候选 ${fused.length}`,
    rerankUsed ? `重排候选 ${candidates.length}` : '重排降级',
    `采用证据 ${selection.evidence.length}`,
  ];
  return {
    evidence: selection.evidence,
    diagnostics: {
      mode,
      lexicalCandidates: lexical.length,
      vectorCandidates: vector.length,
      fusedCandidates: fused.length,
      rerankedCandidates: rerankRanking.length,
      selectedCandidates: selection.evidence.length,
      serializedCharacters: selection.serializedCharacters,
      vectorUsed: vector.length > 0,
      rerankUsed,
      stages,
      warnings,
      rankings: {
        bm25: stageRanking(lexical),
        vector: stageRanking(vector),
        fusion: fused.map(([id, score], index) => ({ id, rank: index + 1, score: Number(score || 0) })),
        rerank: rerankRanking,
        final: selection.evidence.map((item, index) => ({ id: item.id, rank: index + 1, score: Number(item.score || 0) })),
      },
    },
  };
}

function isClarificationQuestion(question) {
  const text = normalized(question);
  return /^(这(里|个|句话|条|是)|那(个|句话|条|是)|哪个|哪一|为什么|为何|怎么|如何|具体|也就是|意思是|你说的|上述|前面|刚才)/.test(text)
    || /(具体指什么|是什么意思|能解释|再说明|展开说|哪条依据|为何这样说)$/.test(text);
}

function reselectEvidenceWithDiagnostics(entries, question, domainTerms = []) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ranked = bm25Search(entries, question, domainTerms, entries.length).map((item) => ({ ...byId.get(item.id), ...item }));
  const selection = chooseEvidence(ranked, { query: question, domainTerms });
  return {
    evidence: selection.evidence,
    diagnostics: {
      mode: 'lexical-fallback',
      lexicalCandidates: ranked.length,
      vectorCandidates: 0,
      fusedCandidates: ranked.length,
      rerankedCandidates: 0,
      selectedCandidates: selection.evidence.length,
      serializedCharacters: selection.serializedCharacters,
      vectorUsed: false,
      rerankUsed: false,
      stages: [`既有证据 BM25 重选 ${ranked.length}`, `采用证据 ${selection.evidence.length}`],
      warnings: [],
      rankings: {
        bm25: stageRanking(ranked),
        vector: [],
        fusion: [],
        rerank: [],
        final: selection.evidence.map((item, index) => ({ id: item.id, rank: index + 1, score: Number(item.score || 0) })),
      },
    },
  };
}

function reselectEvidence(entries, question, domainTerms = []) {
  return reselectEvidenceWithDiagnostics(entries, question, domainTerms).evidence;
}

module.exports = {
  MAX_EVIDENCE_CHARS,
  MAX_LIMIT,
  MIN_LIMIT,
  bm25Search,
  buildBM25Index,
  chooseEvidence,
  hybridSearch,
  isClarificationQuestion,
  reciprocalRankFusion,
  reselectEvidence,
  reselectEvidenceWithDiagnostics,
  tokenize,
};
