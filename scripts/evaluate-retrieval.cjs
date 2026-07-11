const corpus = require('../resources/corpus.json');
const cases = require('../resources/evaluation-cases.json');
const knowledge = require('../resources/knowledge-index.json');
const { hybridSearch } = require('../electron/services/retrieval.cjs');

const byId = new Map(knowledge.units.map((unit) => [unit.id, unit]));
(async () => {
  let passed = 0;
  for (const item of cases) {
    const result = await hybridSearch({ corpus, query: item.query, domainTerms: item.domainTerms, limit: 8 });
    const topics = new Set(result.evidence.flatMap((entry) => byId.get(entry.id)?.topics || []));
    const ok = item.expectedTopics.every((topic) => topics.has(topic));
    if (ok) passed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${item.id}: ${result.evidence.map((entry) => entry.source).join('、')}`);
  }
  console.log(`Recall@8 主题覆盖：${passed}/${cases.length}`);
  if (passed !== cases.length) process.exitCode = 1;
})();
