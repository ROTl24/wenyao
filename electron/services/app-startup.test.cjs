const assert = require('node:assert/strict');
const test = require('node:test');
const { prepareApplicationStartup } = require('./app-startup.cjs');

test('a secondary GUI instance exits before configuring installation data paths', () => {
  let lockHeld = false;
  let configureCount = 0;

  function fakeApp(name) {
    return {
      requestSingleInstanceLock() {
        if (lockHeld) return false;
        lockHeld = true;
        return true;
      },
      quitCalled: false,
      quit() {
        this.quitCalled = true;
      },
      name,
    };
  }

  function configureDataPaths(app) {
    configureCount += 1;
    assert.equal(app.name, 'primary');
  }

  const primaryApp = fakeApp('primary');
  const secondaryApp = fakeApp('secondary');
  const primary = prepareApplicationStartup({
    app: primaryApp,
    argv: ['问爻.exe'],
    configureDataPaths,
  });

  assert.equal(primary.shouldStart, true);
  assert.doesNotThrow(() => {
    const secondary = prepareApplicationStartup({
      app: secondaryApp,
      argv: ['问爻.exe'],
      configureDataPaths,
    });
    assert.equal(secondary.shouldStart, false);
  });
  assert.equal(secondaryApp.quitCalled, true);
  assert.equal(configureCount, 1);
});

test('maintenance commands keep their existing non-GUI startup path', () => {
  let lockRequests = 0;
  let configureCount = 0;
  const app = {
    requestSingleInstanceLock() {
      lockRequests += 1;
      return false;
    },
    quit() {
      assert.fail('maintenance commands must not be rejected by the GUI instance lock');
    },
  };

  const startup = prepareApplicationStartup({
    app,
    argv: ['问爻.exe', '--verify-model-stack'],
    configureDataPaths() {
      configureCount += 1;
    },
  });

  assert.deepEqual(startup, { shouldStart: true, commandMode: true });
  assert.equal(lockRequests, 0);
  assert.equal(configureCount, 1);
});

test('packaged platform verification bypasses the GUI instance lock', () => {
  let lockRequests = 0;
  let configureCount = 0;
  const startup = prepareApplicationStartup({
    app: {
      requestSingleInstanceLock() {
        lockRequests += 1;
        return false;
      },
      quit() {
        assert.fail('platform verification must not be rejected by the GUI instance lock');
      },
    },
    argv: ['问爻', '--verify-platform-runtime'],
    configureDataPaths() {
      configureCount += 1;
    },
  });

  assert.deepEqual(startup, { shouldStart: true, commandMode: true });
  assert.equal(lockRequests, 0);
  assert.equal(configureCount, 1);
});

test('Chromium switches do not accidentally bypass the GUI instance lock', () => {
  let configureCount = 0;
  const app = {
    requestSingleInstanceLock: () => false,
    quitCalled: false,
    quit() {
      this.quitCalled = true;
    },
  };

  const startup = prepareApplicationStartup({
    app,
    argv: ['问爻.exe', '--remote-debugging-port=49331'],
    configureDataPaths() {
      configureCount += 1;
    },
  });

  assert.deepEqual(startup, { shouldStart: false, commandMode: false });
  assert.equal(app.quitCalled, true);
  assert.equal(configureCount, 0);
});
