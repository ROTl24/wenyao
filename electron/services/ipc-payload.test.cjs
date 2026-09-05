const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { sanitizeRendererSession } = require('./ipc-payload.cjs');

test('session IPC sanitizer uses top-level and line allowlists while preserving current result fields', () => {
  const plate = { baseHexagram: { name: '乾为天' }, nested: { retained: true } };
  const analysis = { markdown: '# 解读', sections: [{ title: '主题' }] };
  const messages = [{ id: 'message-1', role: 'user', content: '追问', createdAt: '2026-07-30T12:00:00.000Z' }];
  const sanitized = sanitizeRendererSession({
    schemaVersion: 2,
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1', forged: true },
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    lines: [{
      id: 'line-1',
      lineIndex: 1,
      value: 7,
      recordedAt: '2026-07-30T12:00:01.000Z',
      coin: { faces: ['text', 'text', 'reverse'], visualSeed: 'seed-1', forged: true },
      nestedForgery: { accepted: true },
    }],
    currentLine: {
      id: 'line-2',
      lineIndex: 2,
      visualSeed: 'seed-2',
      confirmedAt: 'forged-confirmation',
      faces: ['text', 'reverse', 'reverse'],
      value: 8,
      label: '少阴',
      moving: false,
      baseYang: false,
      changedYang: false,
      extra: true,
    },
    plate,
    analysis,
    messages,
    interactionRevision: 999,
    caseSnapshot: { forged: true },
    extra: true,
  });

  assert.deepEqual(sanitized, {
    schemaVersion: 2,
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1' },
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    plate,
    analysis,
    messages,
    lines: [{
      id: 'line-1',
      lineIndex: 1,
      value: 7,
      recordedAt: '2026-07-30T12:00:01.000Z',
      coin: { faces: ['text', 'text', 'reverse'], visualSeed: 'seed-1' },
    }],
    currentLine: {
      id: 'line-2',
      lineIndex: 2,
      visualSeed: 'seed-2',
      faces: ['text', 'reverse', 'reverse'],
      value: 8,
      label: '少阴',
      moving: false,
      baseYang: false,
      changedYang: false,
    },
  });
  assert.notEqual(sanitized.plate, plate);
  assert.notEqual(sanitized.analysis, analysis);
  assert.notEqual(sanitized.messages, messages);
});

test('sanitizer retains an explicitly supplied physical visualSeed so validation can reject it', () => {
  const sanitized = sanitizeRendererSession({
    castingMethod: 'physical',
    lines: [{ id: 'line-1', coin: { faces: ['text', 'text', 'reverse'], visualSeed: undefined } }],
  });
  assert.equal(Object.hasOwn(sanitized.lines[0].coin, 'visualSeed'), true);
});

test('sandboxed preload exposes the desktop bridge and independently sanitizes session payloads', async () => {
  const calls = [];
  const listeners = new Map();
  let resolveAnalysis;
  let exposed;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, value) {
        assert.equal(name, 'wenyao');
        exposed = value;
      },
    },
    ipcRenderer: {
      invoke(channel, ...args) {
        calls.push({ channel, args });
        if (channel === 'ai:analyze') {
          return new Promise((resolve) => { resolveAnalysis = resolve; });
        }
        if (channel === 'updates:get-state') {
          return Promise.resolve({
            status: 'error',
            currentVersion: '0.3.0',
            operation: 'download',
            manual: true,
            message: 'C:\\private\\update.exe?token=secret',
          });
        }
        return Promise.resolve(args[0]);
      },
      on(channel, listener) {
        listeners.set(channel, listener);
      },
      removeListener(channel, listener) {
        if (listeners.get(channel) === listener) listeners.delete(channel);
      },
    },
  };
  const originalLoad = Module._load;
  const preloadPath = path.resolve(__dirname, '../preload.cjs');
  const preloadSource = fs.readFileSync(preloadPath, 'utf8');
  const requiredModules = Array.from(
    preloadSource.matchAll(/require\((['"])(.*?)\1\)/g),
    (match) => match[2],
  );
  assert.deepEqual(requiredModules, ['electron']);
  delete require.cache[preloadPath];
  Module._load = function load(request, parent, isMain) {
    if (request === 'electron') return electron;
    if (parent?.filename === preloadPath) {
      throw new Error(`Sandboxed preload cannot load ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    require(preloadPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[preloadPath];
  }

  await exposed.sessions.save({
    schemaVersion: 2,
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1' },
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    lines: [],
    messages: [],
    plate: { retained: true },
    analysis: { retained: true },
    forged: true,
  });

  assert.deepEqual(calls, [{
    channel: 'sessions:save',
    args: [{
      schemaVersion: 2,
      id: 'session-1',
      question: '问题',
      category: 'career',
      castingMethod: 'digital',
      castingBasis: { kind: 'digital', algorithm: 'three_coin_secure_v1' },
      castAt: '2026-07-12T04:00:00.000Z',
      updatedAt: '2026-07-30T12:00:00.000Z',
      status: 'casting',
      plate: { retained: true },
      analysis: { retained: true },
      messages: [],
      lines: [],
    }],
  }]);

  await exposed.aiConfig.listModels({
    capability: 'generation',
    apiUrl: 'https://api.example.com/v1',
    apiKey: 'secret',
    authorization: 'must-not-cross-preload',
  });
  assert.deepEqual(calls.at(-1), {
    channel: 'ai-config:list-models',
    args: [{ capability: 'generation', apiUrl: 'https://api.example.com/v1', apiKey: 'secret' }],
  });

  const review = { status: 'happened', observedAt: '2026-09-06', note: '本地复盘', tags: ['项目'], updatedAt: '2026-09-06T00:00:00.000Z' };
  await exposed.sessions.import({ sessions: [{ id: 'restored', lines: [], messages: [], review: { ...review, secret: 'drop-me' }, secret: 'drop-me' }], resolutions: { restored: { action: 'skip', expectedUpdatedAt: review.updatedAt } }, settings: { secret: 'drop-me' } });
  assert.deepEqual(calls.at(-1), { channel: 'sessions:import', args: [{ sessions: [{ id: 'restored', castingBasis: {}, lines: [], messages: [], review }], resolutions: { restored: { action: 'skip', expectedUpdatedAt: review.updatedAt } } }] });
  assert.throws(() => sanitizeRendererSession({ review: { ...review, observedAt: '2026-02-30' } }), /日期/);

  assert.equal(await exposed.externalLinks.open('repository'), true);
  assert.deepEqual(calls.at(-1), {
    channel: 'external-links:open',
    args: ['repository'],
  });

  assert.equal(exposed.runtime.kind, 'electron');
  assert.equal(exposed.runtime.platform, process.platform);

  const analysisProgress = [];
  const analysisPromise = exposed.ai.analyze(
    { question: '问题', evidence: [] },
    (progress) => analysisProgress.push(progress),
  );
  const analysisCall = calls.at(-1);
  assert.equal(analysisCall.channel, 'ai:analyze');
  assert.equal(typeof analysisCall.args[0].requestId, 'string');
  assert.equal(analysisCall.args[0].question, '问题');
  const requestId = analysisCall.args[0].requestId;
  const analysisProgressListener = listeners.get('ai:analysis-progress');
  assert.equal(typeof analysisProgressListener, 'function');
  analysisProgressListener({}, { requestId: 'another-request', stage: 'writing' });
  analysisProgressListener({}, { requestId, stage: 'unsupported' });
  analysisProgressListener({}, { requestId, stage: 'reasoning', detail: 'must-not-cross-preload' });
  analysisProgressListener({}, { requestId, stage: 'writing', delta: '可展示正文', reasoning_content: 'private', apiKey: 'private' });
  assert.deepEqual(analysisProgress, [{ stage: 'reasoning' }, { stage: 'writing', delta: '可展示正文' }]);
  await exposed.ai.cancel(requestId);
  assert.deepEqual(calls.at(-1), { channel: 'ai:cancel', args: [requestId] });
  resolveAnalysis({ markdown: '# 解读' });
  assert.deepEqual(await analysisPromise, { markdown: '# 解读' });
  assert.equal(listeners.has('ai:analysis-progress'), false);

  let settingsOpenCount = 0;
  const unsubscribeSettings = exposed.application.onOpenSettings(() => { settingsOpenCount += 1; });
  listeners.get('application:open-settings')();
  assert.equal(settingsOpenCount, 1);
  unsubscribeSettings();
  assert.equal(listeners.has('application:open-settings'), false);

  const updateStates = [];
  const currentUpdateState = await exposed.updates.getState();
  assert.deepEqual(currentUpdateState, {
    status: 'error',
    currentVersion: '0.3.0',
    operation: 'download',
    manual: true,
    message: '更新包下载失败，请检查网络连接后重试。',
  });
  const unsubscribe = exposed.updates.onState((state) => updateStates.push(state));
  listeners.get('updates:state')({}, {
    status: 'downloading',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
    progress: 45.67,
    token: 'must-not-cross-preload',
    installerPath: 'C:\\private\\update.exe',
  });
  assert.deepEqual(updateStates, [{
    status: 'downloading',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
    progress: 45.7,
  }]);
  unsubscribe();
  assert.equal(listeners.has('updates:state'), false);
});
