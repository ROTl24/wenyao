const test = require('node:test');
const assert = require('node:assert/strict');
const corpus = require('../../resources/corpus.json');
const knowledgeIndex = require('../../resources/knowledge-index.json');
const { countKnowledgeKinds, hydrateCorpusKnowledge } = require('../../shared/corpus-knowledge.cjs');

test('内置语料分类索引覆盖桌面与 PWA 使用的全部条目', () => {
  const hydrated = hydrateCorpusKnowledge(corpus, knowledgeIndex);

  assert.equal(hydrated.length, 1263);
  assert.deepEqual(countKnowledgeKinds(hydrated), {
    ruleCount: 495,
    caseCount: 190,
    doctrineCount: 578,
  });
  assert.equal(hydrated.every((entry) => Array.isArray(entry.topics)), true);
});

test('缺少分类元数据的条目以义理和自身标签安全降级', () => {
  const [entry] = hydrateCorpusKnowledge([
    { id: 'fallback', tags: ['用神'] },
  ], { units: [] });

  assert.equal(entry.knowledgeKind, 'doctrine');
  assert.deepEqual(entry.topics, ['用神']);
});
