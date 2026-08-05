const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CorpusIndexCoordinator } = require('./corpus-index.cjs');
const { LocalVectorIndex } = require('./vector-index.cjs');

const identity = { fingerprint: 'model-fingerprint', providerId: 'test', baseUrl: 'https://example.com', model: 'embed', dimensions: 2, batchSize: 2 };

function shard(id, contentHash, ids) {
  return {
    id,
    title: id,
    contentHash,
    entries: ids.map((entryId) => ({ id: entryId, source: id, title: entryId, text: entryId })),
    enabledEntryIds: new Set(ids),
  };
}

test('按书构建分片并合并向量结果', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-shards-'));
  const coordinator = new CorpusIndexCoordinator({ indexRoot: root });
  const shards = [shard('builtin', 'hash-a', ['A1', 'A2']), shard('user-1', 'hash-b', ['B1'])];
  const vectors = { A1: [1, 0], A2: [0, 1], B1: [0.8, 0.2] };
  const progress = [];
  const result = await coordinator.buildShards({
    identity,
    shards,
    control: { paused: false, cancelled: false },
    embed: async (documents) => documents.map((document) => vectors[document.split('\n').at(-1)]),
    onProgress: (entry) => progress.push(entry),
  });
  assert.equal(result.ok, true);
  assert.equal(coordinator.readyShards(identity, shards).length, 2);
  assert.deepEqual(coordinator.search(identity, shards, [1, 0], 2).map((item) => item.id), ['A1', 'B1']);
  assert.equal(progress.at(-1).progress, 100);
});

test('分片搜索过滤已停用条目', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-shard-filter-'));
  const coordinator = new CorpusIndexCoordinator({ indexRoot: root });
  const source = shard('builtin', 'hash-a', ['A1', 'A2']);
  await coordinator.buildShards({ identity, shards: [source], control: { paused: false, cancelled: false }, embed: async () => [[1, 0], [0.9, 0.1]] });
  source.enabledEntryIds = new Set(['A2']);
  assert.deepEqual(coordinator.search(identity, [source], [1, 0], 5).map((item) => item.id), ['A2']);
});

test('旧单体索引可无付费调用迁移为内置分片', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-shard-migrate-'));
  const legacyBase = path.join(root, 'legacy', 'corpus-vectors');
  new LocalVectorIndex(legacyBase).write({ model: 'embed', corpusHash: 'old-corpus', fingerprint: 'old-fingerprint', ids: ['A1', 'A2'], vectors: [[1, 0], [0, 1]] });
  const coordinator = new CorpusIndexCoordinator({ indexRoot: path.join(root, 'new') });
  const builtIn = shard('builtin', 'new-built-in-hash', ['A1', 'A2']);
  assert.equal(coordinator.migrateLegacyBuiltIn({ identity, shard: builtIn, legacyBases: [legacyBase] }), true);
  assert.equal(coordinator.hasShard(identity, builtIn), true);
});
