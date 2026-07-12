const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const KNOWLEDGE_VERSION = 2;
const CANONICAL_SCHEMA_VERSION = 'canonical-evidence/v2';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RULE_ID_PATTERN = /^[^\u0000-\u001f\u007f]+$/;
const DOMAIN_ARTIFACT_SPECS = [
  {
    name: 'RELATION_CORE_V1_ARTIFACT', hashName: 'RELATION_CORE_V1_ARTIFACT_HASH',
    artifactSchema: 'liuyao-relation-core/v1', bundleId: 'relation_core_v1', version: '1.0.0',
  },
  {
    name: 'GROWTH_SHENSHA_CORE_V1_ARTIFACT', hashName: 'GROWTH_SHENSHA_CORE_V1_ARTIFACT_HASH',
    artifactSchema: 'liuyao-growth-shensha-core/v1', bundleId: 'growth_shensha_core_v1', version: '1.0.0',
  },
  {
    name: 'LIUYAO_EFFECTS_V1_ARTIFACT', hashName: 'LIUYAO_EFFECTS_V1_ARTIFACT_HASH',
    artifactSchema: 'liuyao-effects-core/v1', bundleId: 'liuyao_effects_v1', version: '1.0.0',
  },
  {
    name: 'USE_GOD_CORE_V1_ARTIFACT', hashName: 'USE_GOD_CORE_V1_ARTIFACT_HASH',
    artifactSchema: 'liuyao-use-god-core/v1', bundleId: 'use_god_core_v1', version: '1.0.0',
  },
];
const DOMAIN_CAPSULE_SPECS = [
  { name: 'RELATION_SOURCE_EVIDENCE_CAPSULES', count: 6 },
  { name: 'GROWTH_SHENSHA_SOURCE_EVIDENCE_CAPSULES', count: 5 },
  { name: 'EFFECTS_SOURCE_EVIDENCE_CAPSULES', count: 13 },
  { name: 'USE_GOD_SOURCE_EVIDENCE_CAPSULES', count: 9 },
];

function canonicalStringify(value, stack = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON 不接受非有限数字');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (stack.has(value)) throw new TypeError('canonical JSON 不接受循环引用');
    stack.add(value);
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key === 'symbol' || (key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) {
      throw new TypeError('canonical JSON 数组不接受额外字段');
    }
    const parts = [];
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new TypeError('canonical JSON 不接受稀疏数组');
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('canonical JSON 不接受访问器');
      parts.push(canonicalStringify(descriptor.value, stack));
    }
    stack.delete(value);
    return `[${parts.join(',')}]`;
  }
  if (value && typeof value === 'object') {
    if (stack.has(value)) throw new TypeError('canonical JSON 不接受循环引用');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('canonical JSON 只接受普通对象');
    if (Object.getOwnPropertySymbols(value).length) throw new TypeError('canonical JSON 不接受符号字段');
    stack.add(value);
    const pairs = Object.keys(value).sort().map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError('canonical JSON 不接受访问器');
      return `${JSON.stringify(key)}:${canonicalStringify(descriptor.value, stack)}`;
    });
    stack.delete(value);
    return `{${pairs.join(',')}}`;
  }
  throw new TypeError(`canonical JSON 不接受 ${typeof value}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function deepFreeze(value, seen = new Set()) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function assertPlainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} 必须是对象`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${label} 必须是普通对象`);
  if (Object.getOwnPropertySymbols(value).length) throw new TypeError(`${label} 不允许符号字段`);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new TypeError(`${label}.${key} 不允许访问器`);
  }
  return value;
}

function assertExactKeys(value, required, optional, label) {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const extra = keys.filter((key) => !allowed.has(key));
  if (missing.length || extra.length) {
    throw new TypeError(`${label} 字段无效${missing.length ? `，缺失 ${missing.join(',')}` : ''}${extra.length ? `，额外 ${extra.join(',')}` : ''}`);
  }
}

function assertDenseArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} 必须是数组`);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) throw new TypeError(`${label} 不允许稀疏数组`);
  }
  return value;
}

function assertString(value, label, { nonEmpty = true, pattern } = {}) {
  if (typeof value !== 'string') throw new TypeError(`${label} 必须是字符串`);
  if (nonEmpty && (!value.trim() || value !== value.trim())) throw new TypeError(`${label} 必须是无首尾空白的非空字符串`);
  if (pattern && !pattern.test(value)) throw new TypeError(`${label} 格式无效`);
  return value;
}

function assertInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${label} 必须是非负整数`);
  return value;
}

function stringSet(value, label, { sortRequired = false } = {}) {
  const array = assertDenseArray(value, label).map((item, index) => assertString(item, `${label}[${index}]`));
  const unique = new Set(array);
  if (unique.size !== array.length) throw new TypeError(`${label} 存在重复项`);
  if (sortRequired && array.some((item, index) => index && array[index - 1].localeCompare(item) > 0)) {
    throw new TypeError(`${label} 必须稳定排序`);
  }
  return array;
}

function normalizeManifest(raw) {
  const manifest = assertPlainRecord(raw, 'corpus manifest');
  assertExactKeys(manifest,
    ['schemaVersion', 'corpusVersion', 'sourceType', 'bookCount', 'entryCount', 'sources'], [],
    'corpus manifest');
  if (manifest.schemaVersion !== 1) throw new TypeError('corpus manifest 版本无效');
  assertString(manifest.corpusVersion, 'corpus manifest.corpusVersion');
  assertString(manifest.sourceType, 'corpus manifest.sourceType');
  assertInteger(manifest.bookCount, 'corpus manifest.bookCount');
  assertInteger(manifest.entryCount, 'corpus manifest.entryCount');
  const sourceIds = new Set();
  const sourceTitles = new Set();
  const sources = assertDenseArray(manifest.sources, 'corpus manifest.sources').map((rawSource, index) => {
    const source = assertPlainRecord(rawSource, `corpus manifest.sources[${index}]`);
    assertExactKeys(source, [
      'id', 'title', 'filename', 'sha256', 'encoding', 'bytes', 'rawLineCount', 'acceptedLineCount', 'entryCount',
    ], [], `corpus manifest.sources[${index}]`);
    const normalized = {
      id: assertString(source.id, `corpus manifest.sources[${index}].id`),
      title: assertString(source.title, `corpus manifest.sources[${index}].title`),
      filename: assertString(source.filename, `corpus manifest.sources[${index}].filename`),
      sha256: assertString(source.sha256, `corpus manifest.sources[${index}].sha256`, { pattern: HASH_PATTERN }),
      encoding: assertString(source.encoding, `corpus manifest.sources[${index}].encoding`),
      bytes: assertInteger(source.bytes, `corpus manifest.sources[${index}].bytes`),
      rawLineCount: assertInteger(source.rawLineCount, `corpus manifest.sources[${index}].rawLineCount`),
      acceptedLineCount: assertInteger(source.acceptedLineCount, `corpus manifest.sources[${index}].acceptedLineCount`),
      entryCount: assertInteger(source.entryCount, `corpus manifest.sources[${index}].entryCount`),
    };
    if (sourceIds.has(normalized.id) || sourceTitles.has(normalized.title)) throw new TypeError('corpus manifest 来源重复');
    sourceIds.add(normalized.id);
    sourceTitles.add(normalized.title);
    return normalized;
  });
  if (manifest.bookCount !== sources.length) throw new TypeError('corpus manifest bookCount 不一致');
  return {
    schemaVersion: 1,
    corpusVersion: manifest.corpusVersion,
    sourceType: manifest.sourceType,
    bookCount: manifest.bookCount,
    entryCount: manifest.entryCount,
    sources,
  };
}

function normalizeCorpus(raw, manifest) {
  const ids = new Set();
  const titleCounts = new Map(manifest.sources.map((source) => [source.title, 0]));
  const entries = assertDenseArray(raw, 'corpus').map((rawEntry, index) => {
    const entry = assertPlainRecord(rawEntry, `corpus[${index}]`);
    assertExactKeys(entry, ['id', 'title', 'source', 'location', 'text', 'tags', 'sourceType'], ['pageImage'], `corpus[${index}]`);
    const id = assertString(entry.id, `corpus[${index}].id`);
    if (ids.has(id)) throw new TypeError(`corpus ID 重复：${id}`);
    ids.add(id);
    const source = assertString(entry.source, `corpus[${index}].source`);
    if (!titleCounts.has(source)) throw new TypeError(`corpus 来源不在 manifest：${source}`);
    titleCounts.set(source, titleCounts.get(source) + 1);
    const normalized = {
      id,
      title: assertString(entry.title, `corpus[${index}].title`),
      source,
      location: assertString(entry.location, `corpus[${index}].location`),
      text: assertString(entry.text, `corpus[${index}].text`),
      tags: stringSet(entry.tags, `corpus[${index}].tags`),
      sourceType: assertString(entry.sourceType, `corpus[${index}].sourceType`),
      ...(Object.hasOwn(entry, 'pageImage')
        ? { pageImage: assertString(entry.pageImage, `corpus[${index}].pageImage`) }
        : {}),
    };
    if (!['original', 'summary'].includes(normalized.sourceType)) throw new TypeError(`corpus[${index}].sourceType 无效`);
    return normalized;
  });
  if (manifest.entryCount !== entries.length) throw new TypeError('corpus entryCount 不一致');
  for (const source of manifest.sources) {
    if (titleCounts.get(source.title) !== source.entryCount) throw new TypeError(`corpus 来源条目数不一致：${source.id}`);
  }
  return entries;
}

function normalizeKnowledgeIndex(raw, corpusManifest, knownRuleIds) {
  const index = assertPlainRecord(raw, '知识索引');
  assertExactKeys(index, ['version', 'corpusVersion', 'corpusHash', 'units'], [], '知识索引');
  if (index.version !== KNOWLEDGE_VERSION) throw new TypeError('知识索引版本无效，必须为 v2');
  if (index.corpusVersion !== corpusManifest.corpusVersion) throw new TypeError('知识索引 corpusVersion 陈旧');
  assertString(index.corpusHash, '知识索引.corpusHash', { pattern: HASH_PATTERN });
  const known = new Set(stringSet(knownRuleIds, 'knownRuleIds'));
  const ids = new Set();
  const units = assertDenseArray(index.units, '知识索引.units').map((rawUnit, unitIndex) => {
    const unit = assertPlainRecord(rawUnit, `知识索引.units[${unitIndex}]`);
    assertExactKeys(unit, ['id', 'kind', 'topics', 'source', 'location', 'supportsRuleIds'], [], `知识索引.units[${unitIndex}]`);
    const id = assertString(unit.id, `知识索引.units[${unitIndex}].id`);
    if (ids.has(id)) throw new TypeError(`知识索引 ID 重复：${id}`);
    ids.add(id);
    if (!['rule', 'case', 'doctrine'].includes(unit.kind)) throw new TypeError(`知识索引 kind 无效：${unit.kind}`);
    const supportsRuleIds = stringSet(unit.supportsRuleIds, `知识索引.units[${unitIndex}].supportsRuleIds`, { sortRequired: true });
    for (const ruleId of supportsRuleIds) {
      if (!known.has(ruleId)) throw new TypeError(`知识索引引用未知规则：${ruleId}`);
    }
    return {
      id,
      kind: unit.kind,
      topics: stringSet(unit.topics, `知识索引.units[${unitIndex}].topics`),
      source: assertString(unit.source, `知识索引.units[${unitIndex}].source`),
      location: assertString(unit.location, `知识索引.units[${unitIndex}].location`),
      supportsRuleIds,
    };
  });
  return { version: KNOWLEDGE_VERSION, corpusVersion: index.corpusVersion, corpusHash: index.corpusHash, units };
}

function normalizeReviewedEvidence(raw, corpus) {
  const reviewed = assertPlainRecord(raw, '权威 reviewed mapping');
  assertExactKeys(reviewed, ['knownRuleIds', 'mappings'], [], '权威 reviewed mapping');
  const knownRuleIds = stringSet(reviewed.knownRuleIds, '权威 reviewed mapping.knownRuleIds', { sortRequired: true });
  if (!knownRuleIds.length) throw new TypeError('权威 reviewed mapping 规则集合为空');
  const knownRules = new Set(knownRuleIds);
  const corpusById = new Map(corpus.map((entry) => [entry.id, entry]));
  const pairKeys = new Set();
  const mappings = assertDenseArray(reviewed.mappings, '权威 reviewed mapping.mappings').map((rawMapping, index) => {
    const mapping = assertPlainRecord(rawMapping, `权威 reviewed mapping.mappings[${index}]`);
    assertExactKeys(mapping, ['ruleId', 'evidenceId', 'textSha256', 'sourceRef'], [], `权威 reviewed mapping.mappings[${index}]`);
    const normalized = {
      ruleId: assertString(mapping.ruleId, `权威 reviewed mapping.mappings[${index}].ruleId`, { pattern: RULE_ID_PATTERN }),
      evidenceId: assertString(mapping.evidenceId, `权威 reviewed mapping.mappings[${index}].evidenceId`),
      textSha256: assertString(mapping.textSha256, `权威 reviewed mapping.mappings[${index}].textSha256`, { pattern: HASH_PATTERN }),
      sourceRef: assertString(mapping.sourceRef, `权威 reviewed mapping.mappings[${index}].sourceRef`),
    };
    if (!knownRules.has(normalized.ruleId)) throw new TypeError(`权威 reviewed mapping 包含未知规则：${normalized.ruleId}`);
    const entry = corpusById.get(normalized.evidenceId);
    if (!entry) throw new TypeError(`权威 reviewed mapping 包含未知证据：${normalized.evidenceId}`);
    if (sha256(entry.text) !== normalized.textSha256) throw new Error(`权威 reviewed mapping 正文哈希陈旧：${normalized.evidenceId}`);
    const pairKey = `${normalized.ruleId}\u0000${normalized.evidenceId}`;
    if (pairKeys.has(pairKey)) throw new TypeError(`权威 reviewed mapping 重复：${normalized.ruleId} -> ${normalized.evidenceId}`);
    pairKeys.add(pairKey);
    return normalized;
  });
  return { knownRuleIds, mappings };
}

function assertKnowledgeMatchesReviewed(units, reviewed) {
  const expectedByEvidence = new Map(units.map((unit) => [unit.id, new Set()]));
  for (const mapping of reviewed.mappings) {
    const expected = expectedByEvidence.get(mapping.evidenceId);
    if (!expected) throw new Error(`知识索引缺失权威证据：${mapping.evidenceId}`);
    expected.add(mapping.ruleId);
  }
  for (const unit of units) {
    const expected = [...expectedByEvidence.get(unit.id)].sort((left, right) => left.localeCompare(right));
    if (unit.supportsRuleIds.length !== expected.length
      || unit.supportsRuleIds.some((ruleId, index) => ruleId !== expected[index])) {
      throw new Error(`知识索引支持映射与权威 reviewed mapping 不一致：${unit.id}`);
    }
  }
}

function buildCanonicalEvidence({ corpus, corpusManifest, units }) {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  if (unitById.size !== corpus.length || units.length !== corpus.length) throw new TypeError('语料与知识索引必须一一对应');
  const entries = [...corpus].sort((left, right) => left.id.localeCompare(right.id)).map((entry) => {
    const unit = unitById.get(entry.id);
    if (!unit) throw new TypeError(`知识索引缺失语料：${entry.id}`);
    if (unit.source !== entry.source || unit.location !== entry.location) {
      throw new TypeError(`知识索引来源与语料不一致：${entry.id}`);
    }
    return {
      id: entry.id,
      title: entry.title,
      source: entry.source,
      location: entry.location,
      text: entry.text,
      tags: [...entry.tags],
      sourceType: entry.sourceType,
      ...(entry.pageImage ? { pageImage: entry.pageImage } : {}),
      contentHash: sha256(entry.text),
      knowledgeKind: unit.kind,
      topics: [...unit.topics],
      supportsRuleIds: [...unit.supportsRuleIds],
    };
  });
  for (const unit of units) {
    if (!entries.some((entry) => entry.id === unit.id)) throw new TypeError(`知识索引包含未知语料：${unit.id}`);
  }
  const payload = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    corpusManifest,
    entries,
  };
  return { entries, hash: sha256(canonicalStringify(payload)) };
}

function createEvidenceCatalog({ corpus: rawCorpus, corpusManifest: rawManifest, knowledgeIndex: rawIndex, reviewed: rawReviewed }) {
  const corpusManifest = normalizeManifest(rawManifest);
  const corpus = normalizeCorpus(rawCorpus, corpusManifest);
  const reviewed = normalizeReviewedEvidence(rawReviewed, corpus);
  const knowledgeIndex = normalizeKnowledgeIndex(rawIndex, corpusManifest, reviewed.knownRuleIds);
  assertKnowledgeMatchesReviewed(knowledgeIndex.units, reviewed);
  const canonical = buildCanonicalEvidence({ corpus, corpusManifest, units: knowledgeIndex.units });
  if (canonical.hash !== knowledgeIndex.corpusHash) throw new Error('知识索引 corpusHash 陈旧或语料哈希损坏');

  const entries = canonical.entries.map((entry) => deepFreeze(entry));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const corpusRef = deepFreeze({ version: KNOWLEDGE_VERSION, hash: canonical.hash });

  function hydrate(candidates, requestedLimit = 8) {
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 0 || requestedLimit > 100) throw new TypeError('hydrate limit 无效');
    const ranked = [];
    const seen = new Set();
    for (let index = 0; index < (Array.isArray(candidates) ? candidates.length : 0); index += 1) {
      if (!Object.hasOwn(candidates, index)) continue;
      const candidate = candidates[index];
      const id = typeof candidate === 'string' ? candidate : candidate && typeof candidate.id === 'string' ? candidate.id : '';
      if (!byId.has(id) || seen.has(id)) continue;
      const rankValue = typeof candidate === 'string'
        ? index + 1
        : candidate && Number.isSafeInteger(candidate.rank) && candidate.rank >= 0
          ? candidate.rank
          : null;
      if (rankValue === null) continue;
      seen.add(id);
      ranked.push({ id, rank: rankValue });
    }
    ranked.sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
    const evidence = ranked.slice(0, requestedLimit).map(({ id }) => byId.get(id));
    return deepFreeze({ evidence, corpusRef });
  }

  return deepFreeze({ entries, corpusRef, hydrate });
}

function parseLocalEntries(payload, sourceId) {
  assertString(payload, `来源 ${sourceId} payload`);
  const lines = payload.split(/\r?\n/).filter((line) => line.startsWith('localEntries='));
  if (!lines.length) return [];
  if (lines.length !== 1) throw new TypeError(`来源 ${sourceId} 的 localEntries 重复映射`);
  const body = lines[0].slice('localEntries='.length);
  if (!body) throw new TypeError(`来源 ${sourceId} 的 localEntries 为空`);
  const seen = new Set();
  return body.split(',').map((binding) => {
    const separator = binding.lastIndexOf(':');
    if (separator <= 0) throw new TypeError(`来源 ${sourceId} 的 localEntries 映射损坏`);
    const evidenceId = binding.slice(0, separator);
    const textSha256 = binding.slice(separator + 1);
    assertString(evidenceId, `来源 ${sourceId} evidenceId`);
    assertString(textSha256, `来源 ${sourceId} textSha256`, { pattern: HASH_PATTERN });
    if (seen.has(evidenceId)) throw new TypeError(`来源 ${sourceId} 存在重复 evidence 映射：${evidenceId}`);
    seen.add(evidenceId);
    return { evidenceId, textSha256 };
  });
}

function collectRuleRecords(value, pathLabel, records) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectRuleRecords(entry, `${pathLabel}[${index}]`, records));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'ruleId')) {
    const ruleId = assertString(value.ruleId, `${pathLabel}.ruleId`, { pattern: RULE_ID_PATTERN });
    const sourceRefs = stringSet(value.sourceRefs, `${pathLabel}.sourceRefs`);
    if (!sourceRefs.length) throw new TypeError(`规则 ${ruleId} 缺少来源`);
    records.push({ ruleId, sourceRefs });
  }
  for (const [key, child] of Object.entries(value)) collectRuleRecords(child, `${pathLabel}.${key}`, records);
}

function collectReviewedRuleEvidence({ artifacts, capsules }) {
  assertDenseArray(artifacts, 'reviewed artifacts');
  assertDenseArray(capsules, 'reviewed capsules');
  const capsuleById = new Map();
  capsules.forEach((rawCapsule, index) => {
    const capsule = assertPlainRecord(rawCapsule, `reviewed capsules[${index}]`);
    const ref = assertPlainRecord(capsule.ref, `reviewed capsules[${index}].ref`);
    const sourceId = assertString(ref.id, `reviewed capsules[${index}].ref.id`);
    const payload = assertString(capsule.payload, `reviewed capsules[${index}].payload`);
    const existing = capsuleById.get(sourceId);
    if (existing) {
      if (existing.payload !== payload || canonicalStringify(existing.ref) !== canonicalStringify(ref)) {
        throw new TypeError(`reviewed 来源重复且不一致：${sourceId}`);
      }
      return;
    }
    capsuleById.set(sourceId, { ref, payload, localEntries: parseLocalEntries(payload, sourceId) });
  });

  const records = [];
  artifacts.forEach((artifact, index) => collectRuleRecords(artifact, `reviewed artifacts[${index}]`, records));
  const ruleIds = new Set();
  const pairKeys = new Set();
  const mappings = [];
  for (const record of records) {
    if (ruleIds.has(record.ruleId)) throw new TypeError(`重复规则定义：${record.ruleId}`);
    ruleIds.add(record.ruleId);
    for (const sourceRef of record.sourceRefs) {
      const capsule = capsuleById.get(sourceRef);
      if (!capsule) throw new TypeError(`规则 ${record.ruleId} 的来源缺失：${sourceRef}`);
      for (const binding of capsule.localEntries) {
        const key = `${record.ruleId}\u0000${binding.evidenceId}`;
        if (pairKeys.has(key)) throw new TypeError(`重复 rule-evidence 映射：${record.ruleId} -> ${binding.evidenceId}`);
        pairKeys.add(key);
        mappings.push({ ruleId: record.ruleId, evidenceId: binding.evidenceId, textSha256: binding.textSha256, sourceRef });
      }
    }
  }
  return deepFreeze({
    knownRuleIds: [...ruleIds].sort((left, right) => left.localeCompare(right)),
    mappings: mappings.sort((left, right) => (
      left.evidenceId.localeCompare(right.evidenceId)
      || left.ruleId.localeCompare(right.ruleId)
      || left.sourceRef.localeCompare(right.sourceRef)
    )),
  });
}

function reviewedRuleEvidenceFromDomain(domain) {
  if (!domain || typeof domain !== 'object') throw new TypeError('compiled domain 缺失');
  const artifacts = DOMAIN_ARTIFACT_SPECS.map((spec) => {
    const artifact = assertPlainRecord(domain[spec.name], spec.name);
    if (artifact.artifactSchema !== spec.artifactSchema
      || artifact.bundleId !== spec.bundleId
      || artifact.version !== spec.version) {
      throw new TypeError(`${spec.name} schema/bundle/version 无效`);
    }
    const artifactHash = assertString(domain[spec.hashName], `${spec.name} ${spec.hashName}`, { pattern: HASH_PATTERN });
    if (sha256(canonicalStringify(artifact)) !== artifactHash) throw new Error(`${spec.name} artifact hash 不一致或内容被截断`);
    const records = [];
    collectRuleRecords(artifact, spec.name, records);
    if (!records.length) throw new TypeError(`${spec.name} 规则集合为空`);
    return artifact;
  });
  const capsules = DOMAIN_CAPSULE_SPECS.flatMap((spec) => {
    const collection = assertDenseArray(domain[spec.name], spec.name);
    if (collection.length !== spec.count) throw new TypeError(`${spec.name} 数量无效或被截断`);
    const ids = new Set();
    collection.forEach((rawCapsule, index) => {
      const capsule = assertPlainRecord(rawCapsule, `${spec.name}[${index}]`);
      assertExactKeys(capsule, ['ref', 'payload'], [], `${spec.name}[${index}]`);
      const ref = assertPlainRecord(capsule.ref, `${spec.name}[${index}].ref`);
      assertExactKeys(ref, ['id', 'title', 'url', 'locator', 'contentHash'], [], `${spec.name}[${index}].ref`);
      const id = assertString(ref.id, `${spec.name}[${index}].ref.id`);
      assertString(ref.title, `${spec.name}[${index}].ref.title`);
      assertString(ref.url, `${spec.name}[${index}].ref.url`);
      assertString(ref.locator, `${spec.name}[${index}].ref.locator`);
      assertString(ref.contentHash, `${spec.name}[${index}].ref.contentHash`, { pattern: HASH_PATTERN });
      const payload = assertString(capsule.payload, `${spec.name}[${index}].payload`);
      if (!payload.split(/\r?\n/).includes(`sourceId=${id}`)) throw new TypeError(`${spec.name}[${index}] payload sourceId 不一致`);
      if (ids.has(id)) throw new TypeError(`${spec.name} 来源 ID 重复：${id}`);
      ids.add(id);
    });
    return collection;
  });
  return collectReviewedRuleEvidence({ artifacts, capsules });
}

async function loadEvidenceCatalog({
  resourcesDir = path.resolve(__dirname, '..', '..', 'resources'),
  reviewed: injectedReviewed,
  domain,
} = {}) {
  function readJson(filename, label) {
    const file = path.join(resourcesDir, filename);
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`${label}（${filename}）缺失或损坏：${error.message}`);
    }
  }
  let reviewed = injectedReviewed;
  if (!reviewed) {
    const compiled = domain || await import(pathToFileURL(path.resolve(__dirname, '..', 'generated', 'domain', 'index.js')).href);
    reviewed = reviewedRuleEvidenceFromDomain(compiled);
  }
  return createEvidenceCatalog({
    corpus: readJson('corpus.json', '语料'),
    corpusManifest: readJson('corpus-manifest.json', '语料清单'),
    knowledgeIndex: readJson('knowledge-index.json', 'knowledge-index 知识索引'),
    reviewed,
  });
}

module.exports = {
  CANONICAL_SCHEMA_VERSION,
  KNOWLEDGE_VERSION,
  buildCanonicalEvidence,
  canonicalStringify,
  collectReviewedRuleEvidence,
  createEvidenceCatalog,
  deepFreeze,
  loadEvidenceCatalog,
  normalizeCorpus,
  normalizeManifest,
  reviewedRuleEvidenceFromDomain,
  sha256,
};
