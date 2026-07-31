const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const { sanitizeRendererSession } = require('./ipc-payload.cjs');

test('session IPC sanitizer uses top-level and toss allowlists while preserving current result fields', () => {
  const plate = { baseHexagram: { name: '乾为天' }, nested: { retained: true } };
  const analysis = { markdown: '# 解读', sections: [{ title: '主题' }] };
  const messages = [{ id: 'message-1', role: 'user', content: '追问', createdAt: '2026-07-30T12:00:00.000Z' }];
  const sanitized = sanitizeRendererSession({
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    tosses: [{
      id: 'toss-1',
      lineIndex: 1,
      visualSeed: 'seed-1',
      confirmedAt: '2026-07-30T12:00:01.000Z',
      faces: ['text', 'text', 'reverse'],
      value: 7,
      label: '少阳',
      moving: false,
      baseYang: true,
      changedYang: true,
      nestedForgery: { accepted: true },
    }],
    currentToss: {
      id: 'toss-2',
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
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    plate,
    analysis,
    messages,
    tosses: [{
      id: 'toss-1',
      lineIndex: 1,
      visualSeed: 'seed-1',
      confirmedAt: '2026-07-30T12:00:01.000Z',
      faces: ['text', 'text', 'reverse'],
      value: 7,
      label: '少阳',
      moving: false,
      baseYang: true,
      changedYang: true,
    }],
    currentToss: {
      id: 'toss-2',
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
    tosses: [{ id: 'toss-1', visualSeed: undefined }],
  });
  assert.equal(Object.hasOwn(sanitized.tosses[0], 'visualSeed'), true);
});

test('preload independently sanitizes session save payloads', async () => {
  const calls = [];
  const listeners = new Map();
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
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    require(preloadPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[preloadPath];
  }

  await exposed.sessions.save({
    id: 'session-1',
    question: '问题',
    category: 'career',
    castingMethod: 'digital',
    castAt: '2026-07-12T04:00:00.000Z',
    updatedAt: '2026-07-30T12:00:00.000Z',
    status: 'casting',
    tosses: [],
    messages: [],
    plate: { retained: true },
    analysis: { retained: true },
    forged: true,
  });

  assert.deepEqual(calls, [{
    channel: 'sessions:save',
    args: [{
      id: 'session-1',
      question: '问题',
      category: 'career',
      castingMethod: 'digital',
      castAt: '2026-07-12T04:00:00.000Z',
      updatedAt: '2026-07-30T12:00:00.000Z',
      status: 'casting',
      plate: { retained: true },
      analysis: { retained: true },
      messages: [],
      tosses: [],
    }],
  }]);

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
