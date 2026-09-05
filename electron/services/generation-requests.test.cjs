const test = require('node:test');
const assert = require('node:assert/strict');
const { createGenerationRequests } = require('../../shared/generation-requests.cjs');

test('stop is scoped to its renderer, aborts the request, and rejects late success', async () => {
  const requests = createGenerationRequests();
  let resolve;
  let signal;
  const pending = requests.run(7, 'request-1', (value) => {
    signal = value;
    return new Promise((done) => { resolve = done; });
  });
  assert.equal(requests.cancel(8, 'request-1'), false);
  assert.equal(signal.aborted, false);
  await assert.rejects(requests.run(7, 'request-1', () => assert.fail('duplicate dispatch')), /已经在进行中/);
  assert.equal(requests.cancel(7, 'request-1'), true);
  assert.equal(signal.aborted, true);
  resolve('late complete report');
  await assert.rejects(pending, { publicCode: 'AI_GENERATION_STOPPED' });
  assert.equal(requests.cancel(7, 'request-1'), false);
});

test('renderer destruction aborts only its requests and cannot reverse a settled result', async () => {
  const requests = createGenerationRequests();
  const pending = requests.run('closed', 'a', (signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))));
  const completed = requests.run('open', 'a', async () => 'saved');
  requests.cancelOwner('closed');
  await assert.rejects(pending, { publicCode: 'AI_GENERATION_STOPPED' });
  assert.equal(await completed, 'saved');
  assert.equal(requests.cancel('open', 'a'), false);
});
