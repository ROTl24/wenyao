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

const testSecretStore = () => ({
  provider: 'test',
  name: '测试安全存储',
  encrypt: (value) => `encrypted:${value}`,
  decrypt: (value) => String(value).replace(/^encrypted:/, ''),
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
    if (options.signal?.aborted) throw options.signal.reason;
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

test('非标准接口、任意模型和 Bearer 密钥从测试到正式调用保持一致', async () => {
  const requests = [];
  const { runtime, store } = runtimeFixture({
    secretStore: testSecretStore(),
    fetchImpl: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body), key: options.headers.authorization });
      return json(200, { choices: [{ message: { content: '连接成功' } }] });
    },
  });
  const url = 'https://gateway.example.com/tenant/invoke?api-version=2026-01';
  const result = await runtime.testCapability({ capability: 'generation', apiUrl: url, addressMode: 'exact', model: 'my-private-alias', apiKey: ' Bearer arbitrary-key ', consentAccepted: true });
  assert.equal(result.ok, true);
  assert.equal((await runtime.completeSetup({ capabilities: ['generation'] })).ok, true);
  await runtime.analyze({ question: '事业', category: 'career', castingMethod: 'manual', castingBasis: {}, plate: studyPlate(), evidence: [], retrievalDiagnostics: {} });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url, url);
    assert.equal(request.key, 'Bearer arbitrary-key');
    assert.equal(request.body.model, 'my-private-alias');
  }
  const restarted = runtimeFixture({ store, secretStore: testSecretStore() }).runtime;
  assert.equal(restarted.getStatus().activeCapabilities.generation.model, 'my-private-alias');
});

test('更换服务时不隐式复用旧密钥，同域显式引用仍可更换模型', async () => {
  const requests = [];
  const { runtime } = runtimeFixture({ secretStore: testSecretStore(), fetchImpl: async (url, options) => {
    requests.push({ url, key: options.headers.authorization });
    return json(200, { choices: [{ message: { content: '连接成功' } }] });
  } });
  const input = { capability: 'generation', apiUrl: 'https://one.example.com/v1', model: 'a', apiKey: 'key-a', consentAccepted: true };
  assert.equal((await runtime.testCapability(input)).ok, true);
  assert.equal((await runtime.completeSetup({ capabilities: ['generation'] })).ok, true);
  await assert.rejects(runtime.testCapability({ ...input, apiUrl: 'https://two.example.com/v1', apiKey: '' }), /填写 API Key/);
  await assert.rejects(runtime.testCapability({ ...input, apiUrl: 'https://two.example.com/v1', apiKey: '', credentialSource: 'generation' }), /地址已变更/);
  assert.equal(requests.length, 1);
  assert.equal((await runtime.testCapability({ ...input, apiKey: '', model: 'b', credentialSource: 'generation' })).ok, true);
  assert.equal(requests[1].key, 'Bearer key-a');
});

test('IPv6 本机服务可以空密钥完成设置且不发送 Authorization', async () => {
  const { runtime } = runtimeFixture({ fetchImpl: async (url, options) => {
    assert.equal(url, 'http://[::1]:11434/v1/chat/completions');
    assert.equal(options.headers.authorization, undefined);
    return json(200, { choices: [{ message: { content: '连接成功' } }] });
  } });
  assert.equal((await runtime.testCapability({ capability: 'generation', apiUrl: 'http://[::1]:11434/v1', model: 'local-model', consentAccepted: true })).ok, true);
  assert.equal((await runtime.completeSetup({ capabilities: ['generation'] })).ok, true);
});

test('更换向量模型或调用路径后重新探测维度，不携带旧模型维度', async () => {
  const dimensions = [];
  const { runtime } = runtimeFixture({ fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    dimensions.push(body.dimensions);
    return json(200, { data: [{ index: 0, embedding: body.model === 'model-a' ? [1, 0] : [1, 0, 0] }] });
  } });
  for (const [model, path] of [['model-a', '/v1'], ['model-b', '/v1'], ['model-b', '/tenant']]) {
    assert.equal((await runtime.testCapability({ capability: 'embedding', apiUrl: `http://localhost:11434${path}`, model })).ok, true);
  }
  assert.deepEqual(dimensions, [undefined, undefined, undefined]);
});

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

test('正式解读和追问不设置固定总超时', async () => {
  const { runtime } = runtimeFixture();
  await configure(runtime, ['generation']);
  const timeoutCalls = [];
  const originalTimeout = AbortSignal.timeout;
  AbortSignal.timeout = (milliseconds) => {
    timeoutCalls.push(milliseconds);
    const controller = new AbortController();
    controller.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    return controller.signal;
  };

  try {
    const report = await runtime.analyze({
      question: '事业是否顺利', category: 'career', castingMethod: 'manual', castingBasis: {},
      plate: studyPlate(), evidence: [], retrievalDiagnostics: {},
    });
    assert.equal(report.markdown, '## 模拟解读');

    const answer = await runtime.followUp({
      question: '再说明应期',
      session: {
        question: '事业是否顺利', category: 'career', castingMethod: 'manual', castingBasis: {},
        plate: studyPlate(), analysis: report, messages: [],
      },
      evidence: [],
    });
    assert.equal(answer.content, '## 模拟解读');
  } finally {
    AbortSignal.timeout = originalTimeout;
  }

  assert.deepEqual(timeoutCalls, []);
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

test('阿里云重排最小测试通过后可完成向量索引准备', async () => {
  const fixture = runtimeFixture({ secretStore: testSecretStore() });
  await testCapability(fixture.runtime, 'generation');
  await testCapability(fixture.runtime, 'embedding');

  const rerankTest = await fixture.runtime.testCapability({
    capability: 'rerank',
    apiUrl: 'https://workspace-id.cn-beijing.maas.aliyuncs.com/compatible-api/v1/reranks',
    model: 'qwen3-rerank',
    apiKey: 'session-key',
    consentAccepted: true,
  });
  assert.equal(rerankTest.ok, true, JSON.stringify(rerankTest));

  const result = await fixture.runtime.completeSetup({
    capabilities: ['generation', 'embedding', 'rerank'],
    bulkEmbeddingAccepted: true,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.status.status, 'ready');
});

test('阿里云重排没有显式接口时仍阻止启用', async () => {
  const fixture = runtimeFixture({ secretStore: testSecretStore() });
  await testCapability(fixture.runtime, 'generation');
  await testCapability(fixture.runtime, 'embedding');
  const rerankTest = await fixture.runtime.testCapability({
    capability: 'rerank',
    apiUrl: 'https://workspace-id.cn-beijing.maas.aliyuncs.com/compatible-api/v1/reranks',
    model: 'qwen3-rerank',
    apiKey: 'session-key',
    consentAccepted: true,
  });
  assert.equal(rerankTest.ok, true, JSON.stringify(rerankTest));

  const state = fixture.store.getRawAIState();
  const rerankConnectionId = state.draft.pipeline.rerank.connectionId;
  const rerankConnection = state.draft.connections.find((connection) => connection.id === rerankConnectionId);
  delete rerankConnection.capabilities.rerank.path;
  delete rerankConnection.capabilities.rerank.url;
  fixture.store.saveAIState(state);

  await assert.rejects(
    () => fixture.runtime.completeSetup({
      capabilities: ['generation', 'embedding', 'rerank'],
      bulkEmbeddingAccepted: true,
    }),
    (error) => error.publicCode === 'AI_RERANK_ENDPOINT_REQUIRED',
  );
  assert.equal(fixture.calls.embedding, 1);
});

test('模型目录与最小测试严格分离，失败只请求一次且不覆盖旧活动方案', async () => {
  const { runtime, store, calls, failures } = runtimeFixture();
  await configure(runtime, ['generation']);
  const oldPipeline = structuredClone(store.getRawAIState().activePipeline);
  const oldModel = runtime.getStatus().activeCapabilities.generation.model;

  const catalog = await runtime.listModels({ capability: 'embedding', apiUrl: 'http://localhost:11434/v1' });
  assert.deepEqual(catalog.modelIds, ['text-embedding-test', 'chat-test', 'rerank-test']);
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
    secretStore: testSecretStore(),
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
