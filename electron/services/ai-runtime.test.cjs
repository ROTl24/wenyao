const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { emptyAIState, normalizeAIState, publicAIState } = require('./ai-config.cjs');
const { AIRuntime } = require('./ai-runtime.cjs');
const { CorpusLibrary } = require('./corpus-library.cjs');
const { createSecretStore } = require('./secret-store.cjs');

const unavailableSecretStore = () => createSecretStore({
  safeStorage: { isEncryptionAvailable: () => false },
  provider: 'system',
});

class MemoryStore {
  constructor() { this.ai = emptyAIState(); }
  getRawAIState() { return structuredClone(this.ai); }
  getPublicAIState() { return publicAIState(this.ai); }
  saveAIState(value) { this.ai = normalizeAIState(value); return this.getPublicAIState(); }
  appendAIUsage(entry) { this.ai.usage.push(structuredClone(entry)); }
}

function json(status, value, headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([name, entry]) => [name.toLowerCase(), String(entry)]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalized[String(name).toLowerCase()] || null },
    text: async () => JSON.stringify(value),
  };
}

function corpusEntries() {
  return [
    { id: 'E1', title: '事业章', text: '官鬼为事业用神', source: '甲书', location: '卷一', tags: ['事业'], sourceType: 'original', knowledgeKind: 'rule' },
    { id: 'E2', title: '求财章', text: '妻财为求财用神', source: '乙书', location: '卷二', tags: ['求财'], sourceType: 'original', knowledgeKind: 'rule' },
  ];
}

function studyPlate() {
  return {
    baseHexagram: { name: '泽雷随', palace: '震', palaceElement: '木' },
    changedHexagram: { name: '泽雷随' },
    movingLines: [], dayGanZhi: '戊子', monthGanZhi: '乙未', voidBranches: ['午', '未'], shenSha: [], fuShen: [],
    lines: [
      { index: 1, relation: '父母', ganZhi: '庚子', branch: '子', element: '水', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
      { index: 2, relation: '兄弟', ganZhi: '庚寅', branch: '寅', element: '木', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
      { index: 3, relation: '妻财', ganZhi: '庚辰', branch: '辰', element: '土', role: '世', moving: false, void: false, monthBreak: false, dayClash: false },
      { index: 4, relation: '父母', ganZhi: '丁亥', branch: '亥', element: '水', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
      { index: 5, relation: '官鬼', ganZhi: '丁酉', branch: '酉', element: '金', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
      { index: 6, relation: '妻财', ganZhi: '丁未', branch: '未', element: '土', role: '应', moving: false, void: true, monthBreak: false, dayClash: false },
    ],
  };
}

function mockProvider() {
  const calls = { generation: 0, embedding: 0, rerank: 0, models: 0 };
  const failures = { generation: false, embedding: false, rerank: false };
  const fetchImpl = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/models')) {
      calls.models += 1;
      return json(200, { data: [{ id: 'chat-test' }, { id: 'text-embedding-test' }, { id: 'rerank-test' }] });
    }
    const body = JSON.parse(options.body || '{}');
    if (target.endsWith('/chat/completions')) {
      calls.generation += 1;
      return failures.generation ? json(503, { message: 'maintenance' }) : json(200, { choices: [{ message: { content: '## 模拟解读' } }] });
    }
    if (target.endsWith('/embeddings')) {
      calls.embedding += 1;
      return failures.embedding ? json(503, { message: 'maintenance' }) : json(200, { data: body.input.map((text, index) => ({ index, embedding: text.includes('财') ? [0, 1] : [1, 0] })) });
    }
    calls.rerank += 1;
    return failures.rerank ? json(503, { message: 'maintenance' }) : json(200, { results: body.documents.map((_, index) => ({ index, relevance_score: 1 - index * 0.1 })) });
  };
  return { calls, failures, fetchImpl };
}

function runtimeFixture(options = {}) {
  const store = new MemoryStore();
  const provider = mockProvider();
  const runtime = new AIRuntime({
    store,
    secretStore: unavailableSecretStore(),
    corpus: corpusEntries(),
    corpusHash: 'corpus-test',
    indexRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-ai-runtime-')),
    fetchImpl: provider.fetchImpl,
    ...options,
  });
  runtime.initialize();
  return { runtime, store, ...provider };
}

async function testCapability(runtime, capability) {
  const model = capability === 'generation' ? 'chat-test' : capability === 'embedding' ? 'text-embedding-test' : 'rerank-test';
  const result = await runtime.testCapability({
    capability,
    apiUrl: 'http://localhost:11434/v1',
    model,
    consentAccepted: true,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
}

async function configure(runtime, selected) {
  for (const capability of selected) await testCapability(runtime, capability);
  const result = await runtime.completeSetup({ capabilities: selected, bulkEmbeddingAccepted: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.status;
}

test('仅主模型使用 BM25 检索并能生成报告，不调用向量或重排', async () => {
  const { runtime, calls } = runtimeFixture();
  const status = await configure(runtime, ['generation']);
  assert.equal(status.status, 'ready');
  assert.equal(status.activeFingerprint, '');
  assert.deepEqual(Object.keys(status.activeCapabilities), ['generation']);

  const result = await runtime.search({ query: '事业是否顺利', domainTerms: ['事业'], limit: 2 });
  assert.equal(result.diagnostics.vectorUsed, false);
  assert.equal(result.diagnostics.rerankUsed, false);
  assert.ok(result.evidence.length > 0);
  assert.equal(calls.embedding, 0);
  assert.equal(calls.rerank, 0);

  const report = await runtime.analyze({
    question: '事业是否顺利', category: 'career', castingMethod: 'manual', castingBasis: {},
    plate: studyPlate(), evidence: result.evidence, retrievalDiagnostics: result.diagnostics,
  });
  assert.equal(report.markdown, '## 模拟解读');
  assert.deepEqual(Object.keys(report.provider), ['generation']);
  assert.equal(calls.generation, 2);
});

test('主模型加向量采用融合检索且不调用重排', async () => {
  const { runtime, calls } = runtimeFixture();
  const status = await configure(runtime, ['generation', 'embedding']);
  assert.equal(status.status, 'ready');
  assert.ok(status.activeFingerprint);
  const rerankBeforeSearch = calls.rerank;
  const result = await runtime.search({ query: '事业是否顺利', domainTerms: ['事业'], limit: 2 });
  assert.equal(result.diagnostics.vectorUsed, true);
  assert.equal(result.diagnostics.rerankUsed, false);
  assert.equal(calls.rerank, rerankBeforeSearch);
});

test('三项能力齐全时启用完整重排链路', async () => {
  const { runtime, calls } = runtimeFixture();
  await configure(runtime, ['generation', 'embedding', 'rerank']);
  const rerankBeforeSearch = calls.rerank;
  const result = await runtime.search({ query: '事业是否顺利', domainTerms: ['事业'], limit: 2 });
  assert.equal(result.diagnostics.vectorUsed, true);
  assert.equal(result.diagnostics.rerankUsed, true);
  assert.equal(calls.rerank, rerankBeforeSearch + 1);
});

test('模型目录与最小测试严格分离，失败只请求一次且不覆盖旧活动方案', async () => {
  const { runtime, store, calls, failures } = runtimeFixture();
  await configure(runtime, ['generation']);
  const oldPipeline = structuredClone(store.getRawAIState().activePipeline);
  const oldModel = runtime.getStatus().activeCapabilities.generation.model;

  const catalog = await runtime.listModels({ capability: 'embedding', apiUrl: 'http://localhost:11434/v1' });
  assert.deepEqual(catalog.modelIds, ['text-embedding-test']);
  assert.equal(calls.models, 1);
  assert.equal(calls.embedding, 0);

  failures.generation = true;
  const before = calls.generation;
  const result = await runtime.testCapability({ capability: 'generation', apiUrl: 'http://localhost:11434/v1', model: 'chat-new', consentAccepted: true });
  assert.equal(result.ok, false);
  assert.equal(calls.generation, before + 1);
  assert.deepEqual(store.getRawAIState().activePipeline, oldPipeline);
  assert.equal(runtime.getStatus().activeCapabilities.generation.model, oldModel);
});

test('生成、向量和重排最小测试失败都不会自动重试', async () => {
  for (const capability of ['generation', 'embedding', 'rerank']) {
    const fixture = runtimeFixture();
    if (capability !== 'generation') await testCapability(fixture.runtime, 'generation');
    if (capability === 'rerank') await testCapability(fixture.runtime, 'embedding');
    fixture.failures[capability] = true;
    const before = fixture.calls[capability];
    const model = capability === 'generation' ? 'chat-fail' : capability === 'embedding' ? 'text-embedding-fail' : 'rerank-fail';
    const result = await fixture.runtime.testCapability({ capability, apiUrl: 'http://localhost:11434/v1', model, consentAccepted: true });
    assert.equal(result.ok, false);
    assert.equal(fixture.calls[capability], before + 1);
  }
});

test('建库失败后保存失败范围并阻止未经重新测试的原样续发', async () => {
  let embeddingRequests = 0;
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: `E${index + 1}`,
    title: `章节${index + 1}`,
    text: `古籍正文${index + 1}`,
    source: '测试书',
    location: `卷${index + 1}`,
    tags: [],
    sourceType: 'original',
    knowledgeKind: 'rule',
  }));
  const fixture = runtimeFixture({
    corpus: entries,
    corpusHash: 'corpus-resume-guard',
    fetchImpl: async (url, options = {}) => {
      const target = String(url);
      const body = JSON.parse(options.body || '{}');
      if (target.endsWith('/chat/completions')) return json(200, { choices: [{ message: { content: '连接成功' } }] });
      if (target.endsWith('/embeddings')) {
        embeddingRequests += 1;
        if (embeddingRequests === 3) {
          return json(400, { error: { code: 'request_limit_exceeded', message: 'request limit exceeded' } }, {
            'modelscope-ratelimit-model-requests-remaining': '0',
            'x-request-id': 'runtime-request-400',
          });
        }
        return json(200, { data: body.input.map((_, index) => ({ index, embedding: [1, 0] })) });
      }
      return json(200, { results: [{ index: 0, relevance_score: 1 }] });
    },
  });

  await testCapability(fixture.runtime, 'generation');
  await testCapability(fixture.runtime, 'embedding');
  const result = await fixture.runtime.completeSetup({ capabilities: ['generation', 'embedding'], bulkEmbeddingAccepted: true });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'AI_RATE_LIMITED');
  assert.deepEqual(result.status.draft.indexTask.failedRange, { shardId: 'builtin', start: 10, end: 12, total: 12 });
  assert.equal(result.status.draft.tests.embedding.status, 'failed');
  const requestsBeforeResume = embeddingRequests;
  const resumed = fixture.runtime.resumeBuild();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resumed.status, 'error');
  assert.equal(embeddingRequests, requestsBeforeResume);
});

test('生成模型最小测试统一使用短推理预算，DeepSeek 官方适配仍关闭默认思考', async () => {
  let requestBody = null;
  let requests = 0;
  const { runtime } = runtimeFixture({
    secretStore: {
      provider: 'test',
      name: '测试安全存储',
      encrypt: (value) => `encrypted:${value}`,
      decrypt: (value) => String(value).replace(/^encrypted:/, ''),
    },
    fetchImpl: async (_url, options = {}) => {
      requests += 1;
      requestBody = JSON.parse(options.body || '{}');
      const thinkingDisabled = requestBody.thinking?.type === 'disabled';
      return json(200, {
        choices: [{
          finish_reason: thinkingDisabled ? 'stop' : 'length',
          message: thinkingDisabled
            ? { content: '连接成功' }
            : { content: '', reasoning_content: '正在思考如何回答' },
        }],
      });
    },
  });

  const result = await runtime.testCapability({
    capability: 'generation',
    apiUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    apiKey: 'session-key',
    consentAccepted: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(requests, 1);
  assert.equal(requestBody.max_tokens, 512);
  assert.deepEqual(requestBody.thinking, { type: 'disabled' });
});

test('没有向量模型时用户古籍参与本地检索且远程建库被禁止', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-ai-local-book-'));
  const library = new CorpusLibrary({
    rootPath: path.join(root, 'library'),
    builtInCorpus: corpusEntries(),
    builtInManifest: { sources: [{ id: 'A', title: '甲书' }, { id: 'B', title: '乙书' }] },
  });
  library.initialize();
  const fixture = runtimeFixture({ corpus: undefined, corpusLibrary: library, indexRoot: path.join(root, 'indexes') });
  await configure(fixture.runtime, ['generation']);

  const sourcePath = path.join(root, '星辰书.txt');
  fs.writeFileSync(sourcePath, '山川星辰随岁时变化，各有其理与次序。'.repeat(10), 'utf8');
  const preview = library.previewFiles([sourcePath]);
  const imported = library.commitImport({ batchId: preview.batchId, sendForIndex: false, books: [{ draftId: preview.previews[0].draftId, title: '星辰书' }] });
  const bookId = imported.results[0].book.id;
  library.setEnabled(bookId, true);
  const result = await fixture.runtime.search({ query: '星辰如何变化', domainTerms: ['星辰'], limit: 4 });
  assert.equal(result.evidence.some((entry) => entry.source === '星辰书'), true);
  await assert.rejects(() => fixture.runtime.indexBooks([bookId]), (error) => error.publicCode === 'AI_EMBEDDING_REQUIRED');
  assert.equal(fixture.calls.embedding, 0);
});
