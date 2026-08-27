const KNOWLEDGE_KINDS = new Set(['rule', 'case', 'doctrine']);

function knowledgeUnits(index) {
  if (Array.isArray(index)) return index;
  return Array.isArray(index?.units) ? index.units : [];
}

function knowledgeKind(value) {
  return KNOWLEDGE_KINDS.has(value) ? value : 'doctrine';
}

function hydrateCorpusKnowledge(entries, index) {
  if (!Array.isArray(entries)) return [];
  const knowledgeById = new Map(
    knowledgeUnits(index)
      .filter((unit) => unit && typeof unit.id === 'string')
      .map((unit) => [unit.id, unit]),
  );

  return entries.map((entry) => {
    const unit = knowledgeById.get(entry.id);
    return {
      ...entry,
      knowledgeKind: knowledgeKind(unit?.kind ?? entry.knowledgeKind),
      topics: Array.isArray(unit?.topics)
        ? [...unit.topics]
        : Array.isArray(entry.topics)
          ? [...entry.topics]
          : Array.isArray(entry.tags)
            ? [...entry.tags]
            : [],
    };
  });
}

function countKnowledgeKinds(entries) {
  const counts = { ruleCount: 0, caseCount: 0, doctrineCount: 0 };
  for (const entry of Array.isArray(entries) ? entries : []) {
    const kind = knowledgeKind(entry?.knowledgeKind);
    counts[`${kind}Count`] += 1;
  }
  return counts;
}

module.exports = {
  countKnowledgeKinds,
  hydrateCorpusKnowledge,
};
