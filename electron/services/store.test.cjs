const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { JsonStore } = require('./store.cjs');

test('JsonStore persists, orders and deletes sessions atomically', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveSession({ id: 'older', question: '旧问题', updatedAt: '2026-01-01T00:00:00.000Z' });
  store.saveSession({ id: 'newer', question: '新问题', updatedAt: '2026-02-01T00:00:00.000Z' });

  assert.deepEqual(store.listSessions().map((item) => item.id), ['newer', 'older']);
  assert.equal(store.getSession('older').question, '旧问题');
  store.deleteSession('older');
  assert.equal(store.getSession('older'), null);
  assert.equal(fs.existsSync(`${store.filePath}.tmp`), false);
});

test('JsonStore never exposes an encrypted secret through public settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  store.saveSettings({ baseUrl: 'https://api.example.com/v1', model: 'model-a', embeddingModel: 'embed-a', rerankModel: 'rank-a', rerankUrl: 'https://rank.example/reranks', encryptedApiKey: 'ciphertext' });
  assert.deepEqual(store.getPublicSettings(), {
    baseUrl: 'https://api.example.com/v1',
    model: 'model-a',
    embeddingModel: 'embed-a',
    rerankModel: 'rank-a',
    rerankUrl: 'https://rank.example/reranks',
    hasApiKey: true,
  });
});

test('JsonStore defaults to the Alibaba high-quality model stack', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-store-'));
  const store = new JsonStore(path.join(dir, 'app-data.json'));
  assert.deepEqual(store.getPublicSettings(), {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.7-plus',
    embeddingModel: 'text-embedding-v4',
    rerankModel: 'qwen3-rerank',
    rerankUrl: '',
    hasApiKey: false,
  });
});
