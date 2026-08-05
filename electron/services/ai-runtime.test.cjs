const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { emptyAIState, normalizeAIState, publicAIState } = require('./ai-config.cjs');
const { AIRuntime } = require('./ai-runtime.cjs');
const { CorpusLibrary } = require('./corpus-library.cjs');

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

test('runtime indexes a newly imported book without rebuilding the active built-in shard', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-ai-user-book-'));
  const builtInCorpus = [
    { id: 'E1', title: '事业章', text: '官鬼为事业用神', source: '内置甲书', location: '卷一', tags: ['事业'], sourceType: 'original', knowledgeKind: 'rule' },
  ];
  const library = new CorpusLibrary({
    rootPath: path.join(root, 'library'),
    builtInCorpus,
    builtInManifest: { sources: [{ id: 'A', title: '内置甲书' }] },
  });
  library.initialize();
  const store = new MemoryStore();
  let rejectFaultBook = false;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).endsWith('/chat/completions')) return json(200, { choices: [{ message: { content: '连接成功' } }] });
    if (String(url).endsWith('/embeddings')) {
      if (rejectFaultBook && body.input.some((text) => text.includes('故障正文'))) return json(400, { message: 'invalid document' });
      return json(200, { data: body.input.map((text, index) => ({ index, embedding: text.includes('星辰') ? [1, 0] : [0, 1] })) });
    }
    return json(200, { results: body.documents.map((_, index) => ({ index, relevance_score: 1 - index * 0.1 })) });
  };
  const runtime = new AIRuntime({
    store,
    safeStorage: { isEncryptionAvailable: () => false },
    corpusLibrary: library,
    corpusHash: 'unused',
    indexRoot: path.join(root, 'indexes'),
    fetchImpl,
  });
  runtime.initialize();
  const connection = {
    id: 'local-test', providerId: 'custom', presetId: null, label: '本机测试服务', region: '', baseUrl: 'http://localhost:11434/v1', fields: {},
    capabilities: {
      generation: { protocol: 'openai-chat', model: 'chat-test' },
      embedding: { protocol: 'openai-embeddings', model: 'embed-test', dimensions: 2, batchSize: 1 },
      rerank: { protocol: 'cohere-rerank', model: 'rerank-test', path: '/rerank' },
    },
  };
  const pipeline = Object.fromEntries(['generation', 'embedding', 'rerank'].map((capability) => [capability, { connectionId: connection.id }]));
  runtime.saveDraft({ connection, pipeline, consentAccepted: true });
  assert.equal((await runtime.testDraft()).ok, true);
  assert.equal((await runtime.buildAndActivate()).ok, true);

  const sourcePath = path.join(root, '星辰书.txt');
  fs.writeFileSync(sourcePath, '山川星辰随岁时变化，各有其理与次序。'.repeat(10), 'utf8');
  const preview = library.previewFiles([sourcePath]);
  const imported = library.commitImport({ batchId: preview.batchId, sendForIndex: true, books: [{ draftId: preview.previews[0].draftId, title: '星辰书' }] });
  const bookId = imported.results[0].book.id;
  const indexed = await runtime.indexBooks([bookId]);
  assert.equal(indexed.ok, true);
  assert.equal(library.getBook(bookId).indexState, 'ready');
  const retrieval = await runtime.search({ query: '星辰如何变化', domainTerms: [], limit: 2 });
  assert.equal(retrieval.evidence.some((entry) => entry.source === '星辰书' && entry.origin === 'user'), true);

  library.setEnabled(bookId, false);
  const disabledRetrieval = await runtime.search({ query: '星辰如何变化', domainTerms: [], limit: 2 });
  assert.equal(disabledRetrieval.evidence.some((entry) => entry.source === '星辰书'), false);

  const goodPath = path.join(root, '后续好书.txt');
  const faultPath = path.join(root, '后续故障书.txt');
  fs.writeFileSync(goodPath, '后续好书正文记载山川节候与万物次序。'.repeat(10), 'utf8');
  fs.writeFileSync(faultPath, '故障正文用于验证逐书索引失败后的状态隔离。'.repeat(10), 'utf8');
  const nextPreview = library.previewFiles([goodPath, faultPath]);
  const nextImport = library.commitImport({
    batchId: nextPreview.batchId,
    sendForIndex: true,
    books: nextPreview.previews.map((item) => ({ draftId: item.draftId, title: item.suggestedTitle })),
  });
  const [goodId, faultId] = nextImport.results.map((item) => item.book.id);
  rejectFaultBook = true;
  const partial = await runtime.indexBooks([goodId, faultId]);
  assert.equal(partial.ok, false);
  assert.deepEqual(partial.indexedBookIds, [goodId]);
  assert.equal(library.getBook(goodId).indexState, 'ready');
  assert.equal(library.getBook(faultId).indexState, 'error');

  rejectFaultBook = false;
  assert.equal((await runtime.indexBooks([faultId])).ok, true);
  assert.equal(library.getBook(faultId).indexState, 'ready');
});
