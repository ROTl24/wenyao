const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalStringify,
  createEvidenceCatalog,
  loadEvidenceCatalog,
} = require('./evidence-catalog.cjs');

function corpusFixture() {
  return [
    {
      id: 'E1',
      title: '用神章',
      source: '增删卜易',
      location: '卷一',
      text: '占功名以官鬼为用。',
      tags: ['用神', '官鬼'],
      sourceType: 'original',
    },
    {
      id: 'E2',
      title: '求财章',
      source: '卜筮正宗',
      location: '卷二',
      text: '求财以妻财为用。',
      tags: ['用神', '妻财'],
      sourceType: 'original',
    },
    {
      id: 'E3',
      title: '占验',
      source: '增删卜易',
      location: '卷三',
      text: '旧例为甲子日。',
      tags: ['占验'],
      sourceType: 'original',
      pageImage: 'images/zengshan-3.png',
    },
  ];
}

function manifestFixture() {
  return {
    schemaVersion: 1,
    corpusVersion: 'fixture-v1',
    sourceType: 'user-provided-plain-text',
    bookCount: 2,
    entryCount: 3,
    sources: [
      {
        id: 'ZENGSHAN', title: '增删卜易', filename: 'zengshan.txt', sha256: '1'.repeat(64),
        encoding: 'utf8', bytes: 100, rawLineCount: 10, acceptedLineCount: 9, entryCount: 2,
      },
      {
        id: 'BUSHI', title: '卜筮正宗', filename: 'bushi.txt', sha256: '2'.repeat(64),
        encoding: 'utf8', bytes: 80, rawLineCount: 8, acceptedLineCount: 8, entryCount: 1,
      },
    ],
  };
}

function unitsFixture() {
  return [
    { id: 'E1', kind: 'rule', topics: ['用神'], source: '增删卜易', location: '卷一', supportsRuleIds: ['rule:career'] },
    { id: 'E2', kind: 'rule', topics: ['用神'], source: '卜筮正宗', location: '卷二', supportsRuleIds: ['rule:wealth'] },
    { id: 'E3', kind: 'case', topics: ['占验'], source: '增删卜易', location: '卷三', supportsRuleIds: [] },
  ];
}

function canonicalEntries(corpus, units) {
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  return [...corpus].sort((a, b) => a.id.localeCompare(b.id)).map((entry) => {
    const unit = unitById.get(entry.id);
    return {
      id: entry.id,
      title: entry.title,
      source: entry.source,
      location: entry.location,
      text: entry.text,
      tags: [...entry.tags],
      sourceType: entry.sourceType,
      ...(entry.pageImage ? { pageImage: entry.pageImage } : {}),
      contentHash: crypto.createHash('sha256').update(entry.text, 'utf8').digest('hex'),
      knowledgeKind: unit.kind,
      topics: [...unit.topics],
      supportsRuleIds: [...unit.supportsRuleIds],
    };
  });
}

function corpusHash(corpus, manifest, units) {
  return crypto.createHash('sha256').update(canonicalStringify({
    schemaVersion: 'canonical-evidence/v2',
    corpusManifest: manifest,
    entries: canonicalEntries(corpus, units),
  })).digest('hex');
}

function indexFixture(corpus = corpusFixture(), manifest = manifestFixture(), units = unitsFixture()) {
  return {
    version: 2,
    corpusVersion: manifest.corpusVersion,
    corpusHash: corpusHash(corpus, manifest, units),
    units,
  };
}

test('canonical catalog merges corpus and v2 knowledge one-to-one and owns a frozen snapshot', () => {
  const corpus = corpusFixture();
  const manifest = manifestFixture();
  const index = indexFixture(corpus, manifest);
  const catalog = createEvidenceCatalog({
    corpus,
    corpusManifest: manifest,
    knowledgeIndex: index,
    knownRuleIds: ['rule:career', 'rule:wealth'],
  });

  corpus[0].text = '被调用方事后篡改';
  index.units[0].supportsRuleIds.push('rule:fake');

  assert.equal(catalog.entries[0].text, '占功名以官鬼为用。');
  assert.deepEqual(catalog.entries[0].supportsRuleIds, ['rule:career']);
  assert.deepEqual(catalog.corpusRef, { version: 2, hash: index.corpusHash });
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.entries));
  assert.ok(Object.isFrozen(catalog.entries[0]));
  assert.ok(Object.isFrozen(catalog.entries[0].supportsRuleIds));
  assert.equal(catalog.entries[2].pageImage, 'images/zengshan-3.png');
  assert.ok(Object.isFrozen(catalog.corpusRef));
});

test('hydrate trusts only candidate ids and first rank, dropping spoofed bodies, unknowns, duplicates and overflow', () => {
  const corpus = corpusFixture();
  const manifest = manifestFixture();
  const index = indexFixture(corpus, manifest);
  const catalog = createEvidenceCatalog({
    corpus,
    corpusManifest: manifest,
    knowledgeIndex: index,
    knownRuleIds: ['rule:career', 'rule:wealth'],
  });
  const hydrated = catalog.hydrate([
    { id: 'UNKNOWN', rank: 0, text: '伪正文' },
    { id: 'E2', rank: 7, text: '伪正文', source: '恶意来源', supportsRuleIds: ['rule:fake'] },
    { id: 'E1', rank: 2 },
    { id: 'E2', rank: 1 },
    { id: 'E3', rank: 99 },
  ], 2);

  assert.deepEqual(hydrated.evidence.map((entry) => entry.id), ['E1', 'E2']);
  assert.equal(hydrated.evidence[1].text, '求财以妻财为用。');
  assert.equal(hydrated.evidence[1].source, '卜筮正宗');
  assert.deepEqual(hydrated.evidence[1].supportsRuleIds, ['rule:wealth']);
  assert.match(hydrated.evidence[1].contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(hydrated.corpusRef, catalog.corpusRef);
  assert.ok(Object.isFrozen(hydrated));
  assert.ok(Object.isFrozen(hydrated.evidence));
  assert.ok(Object.isFrozen(hydrated.evidence[0]));
});

test('catalog fails closed on invalid versions, one-to-one mismatches, unknown rules and stale hashes', () => {
  const corpus = corpusFixture();
  const manifest = manifestFixture();
  const base = indexFixture(corpus, manifest);
  const make = (knowledgeIndex, knownRuleIds = ['rule:career', 'rule:wealth']) => () => createEvidenceCatalog({
    corpus, corpusManifest: manifest, knowledgeIndex, knownRuleIds,
  });

  assert.throws(make({ ...base, version: 1 }), /版本/);
  assert.throws(make({ ...base, units: base.units.slice(1) }), /一一对应|缺失/);
  assert.throws(make({ ...base, units: [...base.units, { ...base.units[0] }] }), /重复/);
  assert.throws(make({ ...base, units: base.units.map((unit, index) => index ? unit : { ...unit, source: '伪来源' }) }), /来源|source/);
  assert.throws(make({ ...base, units: base.units.map((unit, index) => index ? unit : { ...unit, supportsRuleIds: ['rule:fake'] }) }), /未知规则/);
  assert.throws(make({ ...base, corpusHash: '0'.repeat(64) }), /陈旧|哈希/);
  assert.throws(make({ ...base, units: base.units.map((unit, index) => index ? unit : { ...unit, topics: [...unit.topics, '官鬼'] }) }), /陈旧|哈希/);
});

test('catalog rejects sparse and duplicate semantic arrays instead of silently normalizing them', () => {
  const corpus = corpusFixture();
  const manifest = manifestFixture();
  const base = indexFixture(corpus, manifest);
  const duplicateRules = base.units.map((unit, index) => index ? unit : { ...unit, supportsRuleIds: ['rule:career', 'rule:career'] });
  assert.throws(() => createEvidenceCatalog({
    corpus, corpusManifest: manifest, knowledgeIndex: { ...base, units: duplicateRules },
    knownRuleIds: ['rule:career', 'rule:wealth'],
  }), /重复/);

  const sparseTopics = [...base.units[0].topics];
  sparseTopics.length = 2;
  const sparseUnits = base.units.map((unit, index) => index ? unit : { ...unit, topics: sparseTopics });
  assert.throws(() => createEvidenceCatalog({
    corpus, corpusManifest: manifest, knowledgeIndex: { ...base, units: sparseUnits },
    knownRuleIds: ['rule:career', 'rule:wealth'],
  }), /稀疏/);
});

test('catalog rejects unsupported source types and malformed candidate ranks cannot gain priority', () => {
  const corpus = corpusFixture();
  const manifest = manifestFixture();
  const base = indexFixture(corpus, manifest);
  assert.throws(() => createEvidenceCatalog({
    corpus: corpus.map((entry, index) => index ? entry : { ...entry, sourceType: 'model-generated' }),
    corpusManifest: manifest,
    knowledgeIndex: base,
    knownRuleIds: ['rule:career', 'rule:wealth'],
  }), /sourceType/);

  const catalog = createEvidenceCatalog({
    corpus, corpusManifest: manifest, knowledgeIndex: base,
    knownRuleIds: ['rule:career', 'rule:wealth'],
  });
  const hydrated = catalog.hydrate([
    { id: 'E2', rank: -100 },
    { id: 'E1', rank: 2 },
    { id: 'E3', rank: 3.5 },
  ], 3);
  assert.deepEqual(hydrated.evidence.map((entry) => entry.id), ['E1']);
});

test('canonical serializer rejects sparse arrays, accessors and cycles', () => {
  const sparse = [];
  sparse.length = 1;
  assert.throws(() => canonicalStringify(sparse), /稀疏/);
  const accessor = {};
  Object.defineProperty(accessor, 'secret', { enumerable: true, get: () => 'value' });
  assert.throws(() => canonicalStringify(accessor), /访问器/);
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => canonicalStringify(cycle), /循环/);
});

test('loader treats a missing or corrupt knowledge index as a startup error', async () => {
  const resourcesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-evidence-'));
  fs.writeFileSync(path.join(resourcesDir, 'corpus.json'), JSON.stringify(corpusFixture()));
  fs.writeFileSync(path.join(resourcesDir, 'corpus-manifest.json'), JSON.stringify(manifestFixture()));
  await assert.rejects(
    () => loadEvidenceCatalog({ resourcesDir, knownRuleIds: ['rule:career', 'rule:wealth'] }),
    /knowledge-index|知识索引/,
  );
  fs.writeFileSync(path.join(resourcesDir, 'knowledge-index.json'), '{broken');
  await assert.rejects(
    () => loadEvidenceCatalog({ resourcesDir, knownRuleIds: ['rule:career', 'rule:wealth'] }),
    /knowledge-index|知识索引/,
  );
});

test('bundled corpus and knowledge v2 load as one coherent canonical catalog', async () => {
  const catalog = await loadEvidenceCatalog();
  const manifest = require('../../resources/corpus-manifest.json');
  assert.equal(catalog.entries.length, manifest.entryCount);
  assert.ok(catalog.entries.some((entry) => entry.supportsRuleIds.length > 0));
  assert.ok(catalog.entries.every((entry) => crypto.createHash('sha256').update(entry.text, 'utf8').digest('hex') === entry.contentHash));
  assert.match(catalog.corpusRef.hash, /^[a-f0-9]{64}$/);
});
