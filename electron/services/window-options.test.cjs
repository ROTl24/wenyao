const assert = require('node:assert/strict');
const test = require('node:test');
const { createWindowOptions } = require('./window-options.cjs');

test('macOS window reserves native traffic lights without Windows overlay', () => {
  const options = createWindowOptions({
    platform: 'darwin', preloadPath: '/app/preload.cjs', runtimeArgument: '--runtime',
  });
  assert.equal(options.titleBarStyle, 'hiddenInset');
  assert.deepEqual(options.trafficLightPosition, { x: 16, y: 14 });
  assert.equal(Object.hasOwn(options, 'titleBarOverlay'), false);
  assert.deepEqual(options.webPreferences.additionalArguments, ['--runtime']);
});

test('Windows keeps the existing title bar overlay', () => {
  const options = createWindowOptions({
    platform: 'win32', preloadPath: 'C:\\app\\preload.cjs', runtimeArgument: '--runtime',
  });
  assert.equal(options.titleBarStyle, 'hidden');
  assert.deepEqual(options.titleBarOverlay, {
    color: '#232421', symbolColor: '#e8dfcf', height: 42,
  });
  assert.equal(Object.hasOwn(options, 'trafficLightPosition'), false);
});
