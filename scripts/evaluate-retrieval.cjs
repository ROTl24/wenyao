const corpus = require('../resources/corpus.json');
const cases = require('../resources/evaluation-cases.json');
const knowledge = require('../resources/knowledge-index.json');
const { bm25Search } = require('../electron/services/retrieval.cjs');

const knowledgeById = new Map(knowledge.units.map((unit) => [unit.id, unit]));
const corpusById = new Map(corpus.map((entry) => [entry.id, entry]));
const totals = { recall8: 0, recall12: 0, recall16: 0, reciprocalRank: 0 };
const byKind = new Map();
const sources = new Set();

for (const item of cases) {
  const ranking = bm25Search(corpus, item.query, item.domainTerms, 40);
  const topicAt = (limit) => new Set(ranking.slice(0, limit).flatMap((entry) => knowledgeById.get(entry.id)?.topics || []));
  const ok8 = item.expectedTopics.every((topic) => topicAt(8).has(topic));
  const ok12 = item.expectedTopics.every((topic) => topicAt(12).has(topic));
  const ok16 = item.expectedTopics.every((topic) => topicAt(16).has(topic));
  const firstRelevant = ranking.findIndex((entry) => item.expectedTopics.some((topic) => (knowledgeById.get(entry.id)?.topics || []).includes(topic)));
  totals.recall8 += Number(ok8);
  totals.recall12 += Number(ok12);
  totals.recall16 += Number(ok16);
  totals.reciprocalRank += firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0;
  const kind = byKind.get(item.kind) || { total: 0, recall12: 0, recall16: 0 };
  kind.total += 1;
  kind.recall12 += Number(ok12);
  kind.recall16 += Number(ok16);
  byKind.set(item.kind, kind);
  ranking.slice(0, 12).forEach((entry) => sources.add(corpusById.get(entry.id)?.source));
  if (!ok16) console.log(`MISS ${item.id}: ${item.expectedTopics.join('、')}`);
}

console.log(`Cases: ${cases.length}`);
console.log(`Recall@8: ${totals.recall8}/${cases.length}`);
console.log(`Recall@12: ${totals.recall12}/${cases.length}`);
console.log(`Recall@16: ${totals.recall16}/${cases.length}`);
console.log(`MRR: ${(totals.reciprocalRank / cases.length).toFixed(3)}`);
console.log(`Sources represented: ${[...sources].filter(Boolean).sort().join('、')}`);
for (const [kind, result] of byKind) console.log(`${kind} Recall@12/16: ${result.recall12}/${result.recall16}/${result.total}`);
