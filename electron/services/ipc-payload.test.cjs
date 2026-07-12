const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const {
  sanitizeAnalyzePayload,
  sanitizeBuildCasePayload,
  sanitizeFollowUpPayload,
  sanitizeRendererSession,
  sanitizeSelectIntentPayload,
} = require('./ipc-payload.cjs');

const FORGED = {
  plate: { baseHexagram: { name: '伪造卦' } },
  facts: [{ id: 'fake' }],
  evidence: [{ id: 'fake' }],
  validation: { status: 'validated' },
  analysis: { summary: 'fake' },
  messages: [{ id: 'fake', role: 'assistant', content: 'fake' }],
  caseSnapshot: { factSetHash: 'fake' },
  ruleContext: { schemaVersion: 'fake' },
  caseRuntimeTrust: 'authoritative',
};

test('main-process payload sanitizers use nested allowlists', () => {
  assert.deepEqual(sanitizeRendererSession({
    id: 'session-1', question: '问题', category: 'career', castAt: '2026-07-12T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z', status: 'casting',
    tosses: [{
      id: 'toss-1', lineIndex: 1, visualSeed: 'seed', confirmedAt: '2026-07-12T00:00:01.000Z',
      faces: ['text', 'text', 'reverse'], value: 7, label: '少阳', moving: false,
      baseYang: true, changedYang: true, factSetHash: 'nested-fake', extra: true,
    }],
    currentToss: {
      id: 'toss-2', lineIndex: 2, visualSeed: 'seed-2', faces: ['text', 'reverse', 'reverse'],
      value: 8, label: '少阴', moving: false, baseYang: false, changedYang: false,
      analysis: { summary: 'nested-fake' },
    },
    ...FORGED,
  }), {
    id: 'session-1', question: '问题', category: 'career', castAt: '2026-07-12T00:00:00.000Z', status: 'casting',
    tosses: [{
      id: 'toss-1', lineIndex: 1, visualSeed: 'seed', confirmedAt: '2026-07-12T00:00:01.000Z',
      faces: ['text', 'text', 'reverse'], value: 7, label: '少阳', moving: false,
      baseYang: true, changedYang: true,
    }],
    currentToss: {
      id: 'toss-2', lineIndex: 2, visualSeed: 'seed-2', faces: ['text', 'reverse', 'reverse'],
      value: 8, label: '少阴', moving: false, baseYang: false, changedYang: false,
    },
  });

  assert.deepEqual(sanitizeBuildCasePayload({
    sessionId: 'session-1',
    clarification: {
      explicitIntentId: 'other.explicit', subjectRelation: '父母',
      explicitTarget: {
        kind: 'explicit-entity',
        entity: { type: 'line', id: 'line-1', side: 'base', facts: ['fake'] },
        facts: ['fake'],
      },
      facts: ['fake'],
    },
    ...FORGED,
  }), {
    sessionId: 'session-1',
    clarification: {
      explicitIntentId: 'other.explicit', subjectRelation: '父母',
      explicitTarget: { kind: 'explicit-entity', entity: { type: 'line', id: 'line-1', side: 'base' } },
    },
  });
  assert.deepEqual(sanitizeSelectIntentPayload({
    sessionId: 'session-1', expectedFactSetHash: 'expected-hash',
    clarification: { explicitIntentId: 'career.rank-or-office', facts: ['fake'] },
    ...FORGED,
  }), {
    sessionId: 'session-1', expectedFactSetHash: 'expected-hash',
    clarification: { explicitIntentId: 'career.rank-or-office' },
  });
  assert.deepEqual(sanitizeAnalyzePayload({
    sessionId: 'session-1', expectedFactSetHash: 'expected-hash', ...FORGED,
  }), { sessionId: 'session-1', expectedFactSetHash: 'expected-hash' });
  assert.deepEqual(sanitizeFollowUpPayload({
    sessionId: 'session-1', question: '继续追问', expectedFactSetHash: 'expected-hash', ...FORGED,
  }), { sessionId: 'session-1', question: '继续追问', expectedFactSetHash: 'expected-hash' });
});

test('preload independently sanitizes reading and session payloads and exposes no business ai/retrieval API', async () => {
  const calls = [];
  let exposed;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, value) {
        assert.equal(name, 'wenyao');
        exposed = value;
      },
    },
    ipcRenderer: {
      invoke(channel, payload) {
        calls.push({ channel, payload });
        return Promise.resolve(payload);
      },
    },
  };
  const originalLoad = Module._load;
  const preloadPath = path.resolve(__dirname, '../preload.cjs');
  delete require.cache[preloadPath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') return electron;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    require(preloadPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[preloadPath];
  }

  assert.ok(exposed.reading);
  assert.equal(Object.hasOwn(exposed, 'ai'), false);
  assert.equal(Object.hasOwn(exposed, 'retrieval'), false);
  await exposed.sessions.save({ id: 'session-1', question: '问题', tosses: [], ...FORGED });
  await exposed.reading.buildCase({
    sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office', facts: ['fake'] }, ...FORGED,
  });
  await exposed.reading.selectIntent({
    sessionId: 'session-1', clarification: { subjectRelation: '父母', facts: ['fake'] }, expectedFactSetHash: 'hash', ...FORGED,
  });
  await exposed.reading.analyze({ sessionId: 'session-1', expectedFactSetHash: 'hash', ...FORGED });
  await exposed.reading.followUp({ sessionId: 'session-1', question: '追问', expectedFactSetHash: 'hash', ...FORGED });

  assert.deepEqual(calls, [
    { channel: 'sessions:save', payload: { id: 'session-1', question: '问题', tosses: [] } },
    { channel: 'reading:build-case', payload: { sessionId: 'session-1', clarification: { explicitIntentId: 'career.rank-or-office' } } },
    { channel: 'reading:select-intent', payload: { sessionId: 'session-1', clarification: { subjectRelation: '父母' }, expectedFactSetHash: 'hash' } },
    { channel: 'reading:analyze', payload: { sessionId: 'session-1', expectedFactSetHash: 'hash' } },
    { channel: 'reading:follow-up', payload: { sessionId: 'session-1', question: '追问', expectedFactSetHash: 'hash' } },
  ]);
});
