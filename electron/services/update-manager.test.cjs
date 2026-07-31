const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const {
  CHECK_INTERVAL_MS,
  createUpdateManager,
} = require('./update-manager.cjs');

class FakeUpdater extends EventEmitter {
  checkCalls = 0;
  downloadCalls = 0;
  installCalls = [];
  checkImplementation = async () => null;
  downloadImplementation = async () => [];

  checkForUpdates() {
    this.checkCalls += 1;
    return this.checkImplementation();
  }

  downloadUpdate() {
    this.downloadCalls += 1;
    return this.downloadImplementation();
  }

  quitAndInstall(...args) {
    this.installCalls.push(args);
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function managerOptions(overrides = {}) {
  return {
    updater: new FakeUpdater(),
    currentVersion: '0.3.0',
    supported: true,
    broadcast: () => {},
    logger: { info() {}, warn() {}, error() {} },
    ...overrides,
  };
}

test('unsupported environments remain inert and never require an updater adapter', async () => {
  const manager = createUpdateManager({
    updater: null,
    currentVersion: 'browser',
    supported: false,
  });

  manager.start();
  assert.deepEqual(manager.getState(), {
    status: 'unsupported',
    currentVersion: 'browser',
  });
  assert.deepEqual(await manager.check(), manager.getState());
  assert.deepEqual(await manager.download(), manager.getState());
  assert.deepEqual(manager.install(), manager.getState());
});

test('configures a stable opt-in update channel without downgrades', () => {
  const updater = new FakeUpdater();
  createUpdateManager(managerOptions({ updater }));

  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, true);
  assert.equal(updater.autoRunAppAfterInstall, true);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  assert.equal(updater.disableWebInstaller, true);
  assert.equal(updater.channel, 'latest');
});

test('deduplicates checks and schedules automatic checks every six hours', async () => {
  const updater = new FakeUpdater();
  const pending = deferred();
  updater.checkImplementation = () => pending.promise;
  let scheduled = null;
  let intervalMilliseconds = 0;
  const manager = createUpdateManager(managerOptions({
    updater,
    setIntervalFn(callback, milliseconds) {
      scheduled = callback;
      intervalMilliseconds = milliseconds;
      return 17;
    },
  }));

  manager.start();
  const duplicate = manager.check('manual');
  await Promise.resolve();
  assert.equal(updater.checkCalls, 1);
  assert.equal(intervalMilliseconds, CHECK_INTERVAL_MS);
  assert.equal(manager.getState().manual, false);

  pending.resolve(null);
  await duplicate;
  updater.checkImplementation = async () => {
    updater.emit('update-not-available', { version: '0.3.0' });
  };
  scheduled();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updater.checkCalls, 2);
  assert.equal(manager.getState().status, 'upToDate');
});

test('publishes available, download progress, downloaded, and install states', async () => {
  const updater = new FakeUpdater();
  const states = [];
  updater.checkImplementation = async () => {
    updater.emit('update-available', { version: '0.3.1' });
  };
  updater.downloadImplementation = async () => {
    updater.emit('download-progress', { percent: 47.26 });
    updater.emit('update-downloaded', { version: '0.3.1', files: [] });
    return ['private-installer-path.exe'];
  };
  const manager = createUpdateManager(managerOptions({
    updater,
    broadcast: (state) => states.push(state),
  }));

  await manager.check('manual');
  assert.deepEqual(manager.getState(), {
    status: 'available',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
  });

  await manager.download();
  assert.deepEqual(manager.getState(), {
    status: 'downloaded',
    currentVersion: '0.3.0',
    availableVersion: '0.3.1',
  });
  assert.ok(states.some((state) => state.status === 'downloading' && state.progress === 47.3));
  assert.equal(JSON.stringify(states).includes('private-installer-path'), false);

  manager.install();
  assert.deepEqual(updater.installCalls, [[false, true]]);
});

test('returns safe retryable errors without exposing updater internals', async () => {
  const updater = new FakeUpdater();
  updater.checkImplementation = async () => {
    throw new Error('GET https://secret.example/latest.yml failed at C:\\private\\path');
  };
  const manager = createUpdateManager(managerOptions({ updater }));

  const state = await manager.check('manual');
  assert.deepEqual(state, {
    status: 'error',
    currentVersion: '0.3.0',
    operation: 'check',
    manual: true,
    message: '暂时无法检查更新，请检查网络连接后重试。',
  });
  assert.equal(JSON.stringify(state).includes('secret.example'), false);
  assert.equal(JSON.stringify(state).includes('private'), false);
});

test('destroy clears the interval and removes updater event listeners', () => {
  const updater = new FakeUpdater();
  const cleared = [];
  const manager = createUpdateManager(managerOptions({
    updater,
    setIntervalFn: () => 23,
    clearIntervalFn: (handle) => cleared.push(handle),
  }));

  manager.start();
  assert.ok(updater.listenerCount('update-available') > 0);
  manager.destroy();
  assert.deepEqual(cleared, [23]);
  assert.equal(updater.listenerCount('update-available'), 0);
});
