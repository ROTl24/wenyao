const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { LocalVectorIndex, ResumableVectorBuilder } = require('./vector-index.cjs');

test('local vector index persists normalized vectors and searches by cosine similarity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-vector-'));
  const index = new LocalVectorIndex(path.join(dir, 'corpus-vectors'));
  index.write({ model: 'text-embedding-v4', corpusHash: 'abc', ids: ['E1', 'E2'], vectors: [[3, 0], [0, 4]] });
  const loaded = new LocalVectorIndex(path.join(dir, 'corpus-vectors'));
  assert.equal(loaded.load({ model: 'text-embedding-v4', corpusHash: 'abc' }), true);
  assert.deepEqual(loaded.search([0.9, 0.1], 1).map((item) => item.id), ['E1']);
  assert.equal(loaded.load({ model: 'other', corpusHash: 'abc' }), false);
});

test('resumable vector builder continues complete batches and discards stale checkpoints', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-vector-resume-'));
  const basePath = path.join(dir, 'fingerprint', 'corpus-vectors');
  const identity = {
    fingerprint: 'fp-a', providerId: 'custom', baseUrl: 'https://api.example.com/v1',
    model: 'embed-a', corpusHash: 'corpus-a', dimensions: 2, ids: ['E1', 'E2', 'E3'],
  };
  const first = new ResumableVectorBuilder(basePath, identity);
  first.append([[3, 0], [0, 4]]);
  assert.equal(first.status().completed, 2);

  const resumed = new ResumableVectorBuilder(basePath, identity);
  assert.equal(resumed.status().completed, 2);
  resumed.append([[1, 1]]);
  const index = resumed.finalize();
  assert.deepEqual(index.search([1, 0], 1).map((item) => item.id), ['E1']);

  fs.writeFileSync(`${basePath}.partial.f32`, Buffer.alloc(16));
  fs.writeFileSync(`${basePath}.partial.json`, JSON.stringify({ ...identity, fingerprint: 'stale', completed: 2 }));
  const reset = new ResumableVectorBuilder(basePath, identity);
  assert.equal(reset.status().completed, 0);
  assert.equal(fs.existsSync(`${basePath}.partial.f32`), false);
});
