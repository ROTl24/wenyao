const assert = require('node:assert/strict');
const test = require('node:test');
const { hybridSearch, reciprocalRankFusion } = require('./retrieval.cjs');

const corpus = [
  { id: 'E1', title: '事业章', source: '易隐', location: '第 1 行', text: '占功名以官鬼为用，兼看世爻旺衰。', tags: ['事业', '官鬼'], sourceType: 'original', knowledgeKind: 'rule' },
  { id: 'E2', title: '求财章', source: '卜筮正宗', location: '第 2 行', text: '占求财当取妻财为用神。', tags: ['财运', '妻财'], sourceType: 'original', knowledgeKind: 'rule' },
  { id: 'E3', title: '仕宦占验', source: '增删卜易', location: '第 3 行', text: '某占升迁，官鬼发动而得日月生扶，后果升任。', tags: ['事业', '占验'], sourceType: 'original', knowledgeKind: 'case' },
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
