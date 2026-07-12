const assert = require('node:assert/strict');
const test = require('node:test');
const {
  analyzeCloudV2,
  followUpCloudV2,
  postChat,
} = require('./ai.cjs');

const REPORT_SCHEMA = {
  name: 'report-v2',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: { schemaVersion: { type: 'string' } },
    required: ['schemaVersion'],
  },
};

const MODEL_CONTRACT = Object.freeze({
  schemaVersion: '2.0.0',
  caseHash: 'a'.repeat(64),
  question: '事业是否顺利？',
  facts: [],
});

const CANONICAL_EVIDENCE = Object.freeze([Object.freeze({
  id: 'evidence:one',
  title: '规则证据',
  source: '测试语料',
  sourceType: 'original',
  location: '第一节',
  text: '经过核验的规则正文。',
  contentHash: 'b'.repeat(64),
  tags: ['规则'],
  knowledgeKind: 'rule',
  topics: ['事业'],
  supportsRuleIds: ['rule:career'],
})]);

function installFetch(raw, inspect) {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    inspect(url, JSON.parse(options.body), options);
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(raw) } }] }),
    };
  };
  return () => { global.fetch = originalFetch; };
}

test('analyzeCloudV2 sends only modelContract and complete canonical evidence to the model', async () => {
  const raw = { schemaVersion: '2.0.0' };
  let request;
  const restore = installFetch(raw, (_url, body) => { request = body; });
  try {
    const result = await analyzeCloudV2({
      baseUrl: 'https://example.com/v1',
      model: 'qwen',
      apiKey: 'secret',
      modelContract: MODEL_CONTRACT,
      canonicalEvidence: CANONICAL_EVIDENCE,
      responseSchema: REPORT_SCHEMA,
    });

    assert.deepEqual(result, { raw, analysisOrigin: 'cloud' });
    assert.equal(request.response_format.type, 'json_schema');
    assert.equal(request.response_format.json_schema.strict, true);
    assert.deepEqual(request.response_format.json_schema, REPORT_SCHEMA);
    const payload = JSON.parse(request.messages[1].content);
    assert.deepEqual(Object.keys(payload).sort(), ['canonicalEvidence', 'modelContract']);
    assert.deepEqual(payload.modelContract, MODEL_CONTRACT);
    assert.deepEqual(payload.canonicalEvidence, CANONICAL_EVIDENCE);
    assert.equal(payload.canonicalEvidence[0].contentHash, 'b'.repeat(64));
    assert.deepEqual(payload.canonicalEvidence[0].supportsRuleIds, ['rule:career']);
    assert.deepEqual(payload.canonicalEvidence[0].topics, ['事业']);
    for (const forbidden of ['validationContext', 'session', 'plate', 'messages', 'reasoningPlan', 'retrievalDiagnostics']) {
      assert.equal(Object.hasOwn(payload, forbidden), false, `provider payload leaked ${forbidden}`);
    }
  } finally {
    restore();
  }
});

test('followUpCloudV2 keeps claim output raw and accepts only the explicit V2 continuation boundary', async () => {
  const raw = {
    schemaVersion: '2.0.0',
    caseHash: 'a'.repeat(64),
    claims: [],
    uncertainties: [],
  };
  const analysisReport = { schemaVersion: '2.0.0', caseHash: 'a'.repeat(64), claims: [] };
  const currentV2History = [{ role: 'user', content: '上一问' }, { role: 'assistant', content: '上一答' }];
  let request;
  const restore = installFetch(raw, (_url, body) => { request = body; });
  try {
    const result = await followUpCloudV2({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '下一步如何？',
      modelContract: MODEL_CONTRACT,
      analysisReport,
      canonicalEvidence: CANONICAL_EVIDENCE,
      currentV2History,
      responseSchema: REPORT_SCHEMA,
    });

    assert.deepEqual(result, { raw, analysisOrigin: 'cloud' });
    const payload = JSON.parse(request.messages[1].content);
    assert.deepEqual(Object.keys(payload).sort(), [
      'analysisReport', 'canonicalEvidence', 'currentV2History', 'modelContract', 'question',
    ]);
    assert.deepEqual(payload.currentV2History, currentV2History);
    assert.deepEqual(payload.analysisReport, analysisReport);
    assert.equal(Object.hasOwn(payload, 'session'), false);
    assert.equal(Object.hasOwn(payload, 'answer'), false);
    assert.equal(Object.hasOwn(payload, 'evidenceIds'), false);
  } finally {
    restore();
  }
});

test('postChat rejects provider failures and malformed model content without inventing a local answer', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: false, status: 401, text: async () => 'secret provider detail' });
    await assert.rejects(postChat({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'bad',
      messages: [], responseSchema: REPORT_SCHEMA,
    }), /密钥无效|权限/);

    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not-json' } }] }),
    });
    await assert.rejects(postChat({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      messages: [], responseSchema: REPORT_SCHEMA,
    }), /JSON|Unexpected|position/i);
  } finally {
    global.fetch = originalFetch;
  }
});
