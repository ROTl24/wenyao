const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { LocalVectorIndex } = require('./vector-index.cjs');

test('local vector index persists normalized vectors and searches by cosine similarity', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-vector-'));
  const index = new LocalVectorIndex(path.join(dir, 'corpus-vectors'));
  index.write({ model: 'text-embedding-v4', corpusHash: 'abc', ids: ['E1', 'E2'], vectors: [[3, 0], [0, 4]] });
  const loaded = new LocalVectorIndex(path.join(dir, 'corpus-vectors'));
  assert.equal(loaded.load({ model: 'text-embedding-v4', corpusHash: 'abc' }), true);
  assert.deepEqual(loaded.search([0.9, 0.1], 1).map((item) => item.id), ['E1']);
  assert.equal(loaded.load({ model: 'other', corpusHash: 'abc' }), false);
});
