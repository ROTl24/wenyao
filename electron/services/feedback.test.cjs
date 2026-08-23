const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { FeedbackService } = require('./feedback.cjs');
const { JsonStore } = require('./store.cjs');

function service(fetchImpl = async () => ({ ok: true, status: 200 })) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-feedback-'));
  const store = new JsonStore(path.join(root, 'app-data.json'));
  return { store, feedback: new FeedbackService({ store, endpoint: 'https://feedback.example/api/feedback', fetchImpl }) };
}

function submission(overrides = {}) {
  return {
    sessionId: 'session-1', targetType: 'analysis', targetId: 'analysis-1', sentiment: 'problematic',
    reasons: ['问非所答'], note: '没有回答时间问题',
    technical: {
      appVersion: '0.5.1', corpusVersion: 'corpus-1', category: 'career', retrievalMode: 'full-hybrid',
      modelIds: { generation: 'chat-model', connectionLabel: '不得上传' },
      candidateRankings: { bm25: [{ id: 'E1', rank: 1, score: 1.2 }] }, finalEvidenceIds: ['E1'],
      apiKey: '不得上传', baseUrl: '不得上传', importedBookName: '不得上传',
    },
    contentOptIn: false,
    content: { question: '默认不得上传的问题', answer: '默认不得上传的回答' },
    ...overrides,
  };
}

test('feedback is local-first and persists consent separately from sessions', async () => {
  const { store, feedback } = service();
  const record = await feedback.submit(submission());
  assert.equal(record.uploadStatus, 'local');
  assert.equal(record.content, undefined);
  assert.deepEqual(record.technical.modelIds, { generation: 'chat-model' });
  assert.equal(record.technical.apiKey, undefined);
  const restored = new JsonStore(store.filePath).getFeedbackState();
  assert.equal(restored.records[0].targetId, 'analysis-1');
  assert.equal(restored.consent.technicalUpload, null);
});

test('explicit consent uploads only the allowlisted snapshot and retry keeps the feedback id', async () => {
  const requests = [];
  let available = false;
  const { feedback } = service(async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: available, status: available ? 200 : 503 };
  });
  const local = await feedback.submit(submission());
  await feedback.setConsent(true);
  let state = feedback.getState();
  assert.equal(state.records[0].uploadStatus, 'failed');
  available = true;
  state = await feedback.retry(local.feedbackId);
  assert.equal(state.records[0].uploadStatus, 'sent');
  assert.equal(requests[0].feedbackId, requests[1].feedbackId);
  assert.equal(requests[1].content, undefined);
  assert.equal(requests[1].technical.apiKey, undefined);
});

test('raw question and answer are uploaded only after per-feedback opt in', async () => {
  const requests = [];
  const { feedback } = service(async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true, status: 200 }; });
  await feedback.setConsent(true);
  await feedback.submit(submission({ contentOptIn: true }));
  assert.deepEqual(requests[0].content, { question: '默认不得上传的问题', answer: '默认不得上传的回答' });
});

test('sent feedback is withdrawn with its local deletion credential', async () => {
  const calls = [];
  const { feedback } = service(async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200 }; });
  await feedback.setConsent(true);
  const record = await feedback.submit(submission({ sentiment: 'helpful' }));
  assert.equal(await feedback.delete(record.feedbackId), true);
  assert.match(calls.at(-1).options.headers.authorization, /^Bearer /);
  assert.equal(feedback.getState().records.length, 0);
});

test('feedback id cannot be reassigned to another analysis target', async () => {
  const { feedback } = service();
  const original = await feedback.submit(submission());
  const edited = await feedback.submit(submission({ feedbackId: original.feedbackId, targetId: 'analysis-2', targetType: 'follow-up' }));
  assert.equal(edited.feedbackId, original.feedbackId);
  assert.equal(edited.targetId, 'analysis-1');
  assert.equal(edited.targetType, 'analysis');
});
