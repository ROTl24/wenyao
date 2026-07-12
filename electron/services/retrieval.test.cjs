const assert = require('node:assert/strict');
const test = require('node:test');
const { hybridSearch, reciprocalRankFusion } = require('./retrieval.cjs');

const corpus = [
  { id: 'E1', title: '事业章', source: '易隐', location: '第 1 行', text: '占功名以官鬼为用，兼看世爻旺衰。', tags: ['事业', '官鬼'], sourceType: 'original', knowledgeKind: 'rule', supportsRuleIds: ['rule:career'] },
  { id: 'E2', title: '求财章', source: '卜筮正宗', location: '第 2 行', text: '占求财当取妻财为用神。', tags: ['财运', '妻财'], sourceType: 'original', knowledgeKind: 'rule', supportsRuleIds: ['rule:wealth'] },
  { id: 'E3', title: '仕宦占验', source: '增删卜易', location: '第 3 行', text: '某占升迁，官鬼发动而得日月生扶，后果升任。', tags: ['事业', '占验'], sourceType: 'original', knowledgeKind: 'case', supportsRuleIds: [] },
];

test('reciprocal rank fusion merges lexical and vector candidates deterministically', () => {
  const fused = reciprocalRankFusion([['E1', 'E2'], ['E3', 'E1']]);
  assert.equal(fused[0][0], 'E1');
  assert.ok(fused[0][1] > fused[1][1]);
});

test('hybrid search uses vector recall then reranks and reports its trace', async () => {
  const result = await hybridSearch({
    corpus,
    query: '近期工作能否升职',
    domainTerms: ['事业', '官鬼'],
    limit: 2,
    vectorSearch: async () => [{ id: 'E3', score: 0.91 }, { id: 'E1', score: 0.82 }],
    rerank: async (_query, documents) => documents.map((document, index) => ({ index, score: document.includes('事业章') ? 0.99 : 0.7 })).sort((a, b) => b.score - a.score),
  });
  assert.deepEqual(result.evidence.map((item) => item.id), ['E1', 'E3']);
  assert.equal(result.diagnostics.mode, 'hybrid-reranked');
  assert.equal(result.diagnostics.vectorUsed, true);
  assert.equal(result.diagnostics.rerankUsed, true);
  assert.ok(result.evidence.every((item) => item.retrieval));
});

test('hybrid search degrades explicitly when cloud retrieval is unavailable', async () => {
  const result = await hybridSearch({ corpus, query: '事业官鬼', domainTerms: ['事业', '官鬼'], limit: 2 });
  assert.equal(result.diagnostics.mode, 'lexical-fallback');
  assert.equal(result.diagnostics.vectorUsed, false);
  assert.ok(result.diagnostics.warnings.length > 0);
  assert.equal(result.evidence[0].id, 'E1');
});

test('empty reranker output keeps fused candidates instead of erasing evidence', async () => {
  const result = await hybridSearch({
    corpus, query: '事业官鬼', domainTerms: ['事业', '官鬼'], limit: 2,
    vectorSearch: async () => [{ id: 'E1', score: 0.8 }],
    rerank: async () => [],
  });
  assert.equal(result.diagnostics.mode, 'hybrid-fused');
  assert.ok(result.evidence.length > 0);
  assert.match(result.diagnostics.warnings.join(''), /重排/);
});

test('exact rule support receives deterministic boost and a reserved candidate slot', async () => {
  const result = await hybridSearch({
    corpus,
    query: '事业官鬼事业官鬼事业官鬼',
    domainTerms: ['事业', '官鬼'],
    ruleIds: ['rule:wealth'],
    limit: 1,
  });
  assert.deepEqual(result.candidateRefs, [{ id: 'E2', rank: 1 }]);
  assert.deepEqual(result.diagnostics.requestedRuleIds, ['rule:wealth']);
  assert.deepEqual(result.diagnostics.matchedRuleIds, ['rule:wealth']);
  assert.ok(result.diagnostics.ruleBoost > 0);
});

test('rule matching is exact rather than a prefix or topic coincidence', async () => {
  const result = await hybridSearch({
    corpus,
    query: '完全无关',
    domainTerms: [],
    ruleIds: ['rule:wealth:forged'],
    limit: 2,
  });
  assert.deepEqual(result.candidateRefs, []);
  assert.deepEqual(result.diagnostics.matchedRuleIds, []);
});

test('each requested rule keeps a reserved candidate even beyond the lexical top forty', async () => {
  const crowded = Array.from({ length: 45 }, (_, index) => ({
    id: `A${String(index).padStart(2, '0')}`,
    title: '高频关键词', source: '书甲', location: String(index), text: '高频关键词', tags: [],
    supportsRuleIds: ['rule:a'],
  }));
  crowded.push({
    id: 'Z-TARGET', title: '低频', source: '书乙', location: '尾', text: '低频', tags: [],
    supportsRuleIds: ['rule:z'],
  });
  const result = await hybridSearch({
    corpus: crowded,
    query: '高频关键词',
    ruleIds: ['rule:a', 'rule:z'],
    limit: 2,
  });
  assert.ok(result.candidateRefs.some(({ id }) => id === 'Z-TARGET'));
  assert.deepEqual(result.diagnostics.matchedRuleIds, ['rule:a', 'rule:z']);
});

test('vector and rerank spoofed bodies never enter candidate refs or compatibility evidence', async () => {
  const result = await hybridSearch({
    corpus,
    query: '升迁',
    domainTerms: ['事业'],
    ruleIds: ['rule:career'],
    limit: 3,
    vectorSearch: async () => [
      { id: 'E3', score: 0.99, text: '伪造正文', source: '伪造来源', supportsRuleIds: ['rule:fake'] },
      { id: 'UNKNOWN', score: 1, text: '未知正文' },
    ],
    rerank: async (_query, documents) => documents.map((_document, index) => ({
      index,
      score: 1 - index / 10,
      text: '重排伪正文',
      source: '重排伪来源',
    })),
  });

  assert.ok(result.candidateRefs.every((ref) => Object.keys(ref).sort().join(',') === 'id,rank'));
  assert.ok(result.candidateRefs.every((ref) => ref.id !== 'UNKNOWN'));
  const e3 = result.evidence.find((entry) => entry.id === 'E3');
  assert.equal(e3.text, corpus[2].text);
  assert.equal(e3.source, corpus[2].source);
  assert.deepEqual(e3.supportsRuleIds, []);
});
