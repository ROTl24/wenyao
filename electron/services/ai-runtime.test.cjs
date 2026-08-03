const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { emptyAIState, normalizeAIState, publicAIState } = require('./ai-config.cjs');
const { AIRuntime } = require('./ai-runtime.cjs');

class MemoryStore {
  constructor() { this.ai = emptyAIState(); }
  getRawAIState() { return structuredClone(this.ai); }
  getPublicAIState() { return publicAIState(this.ai); }
  saveAIState(value) { this.ai = normalizeAIState(value); return this.getPublicAIState(); }
  appendAIUsage(entry) { this.ai.usage.push(structuredClone(entry)); }
}

function json(status, value) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(value) };
}

test('runtime atomically activates a tested three-capability stack and forbids retrieval fallback', async () => {
  const store = new MemoryStore();
  let rerankAvailable = true;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).endsWith('/chat/completions')) return json(200, { choices: [{ message: { content: '连接成功' } }] });
    if (String(url).endsWith('/embeddings')) {
      return json(200, { data: body.input.map((text, index) => ({ index, embedding: text.includes('财') ? [0, 1] : [1, 0] })) });
    }
    if (!rerankAvailable) return json(503, { message: 'maintenance' });
    return json(200, { results: body.documents.map((_, index) => ({ index, relevance_score: 1 - index * 0.1 })) });
  };
  const runtime = new AIRuntime({
    store,
    safeStorage: { isEncryptionAvailable: () => false },
    corpus: [
      { id: 'E1', title: '事业章', text: '官鬼为事业用神', source: '甲书', location: '卷一', tags: ['事业'], sourceType: 'original', knowledgeKind: 'rule' },
      { id: 'E2', title: '求财章', text: '妻财为求财用神', source: '乙书', location: '卷二', tags: ['求财'], sourceType: 'original', knowledgeKind: 'rule' },
    ],
    corpusHash: 'corpus-test',
    indexRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-ai-runtime-')),
    fetchImpl,
  });
  runtime.initialize();
  const connection = {
    id: 'local-test', providerId: 'custom', presetId: null, label: '本机测试服务', region: '',
    baseUrl: 'http://localhost:11434/v1', fields: {},
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-test' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-test', dimensions: 2, batchSize: 1 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-test', path: '/rerank' },
    },
  };
  const pipeline = {
    generation: { connectionId: connection.id },
    embedding: { connectionId: connection.id },
    rerank: { connectionId: connection.id },
  };
  runtime.saveDraft({ connection, pipeline, consentAccepted: true });
  assert.equal((await runtime.testDraft()).ok, true);
  const built = await runtime.buildAndActivate();
  assert.equal(built.ok, true);
  assert.equal(built.status.status, 'ready');
  assert.equal(store.getRawAIState().draft, null);

  const result = await runtime.search({ query: '事业是否顺利', domainTerms: ['事业'], limit: 2 });
  assert.equal(result.diagnostics.vectorUsed, true);
  assert.equal(result.diagnostics.rerankUsed, true);

  rerankAvailable = false;
  await assert.rejects(
    () => runtime.search({ query: '事业是否顺利', domainTerms: ['事业'], limit: 2 }),
    (error) => error.publicCode === 'AI_RETRIEVAL_REQUIRED' && /不会降级/.test(error.publicNextAction),
  );
});
