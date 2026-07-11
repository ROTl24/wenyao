const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const {
  APP_PROTOCOL_ENTRY_URL,
  APP_PROTOCOL_PRIVILEGES,
  createAppProtocolHandler,
  resolveAppProtocolFile,
  resolveAppProtocolFileUrl,
} = require('./app-protocol.cjs');

const distRoot = path.resolve('C:/safe/wenyao/dist');

test('app protocol maps only wenyao host paths inside dist', () => {
  assert.equal(APP_PROTOCOL_ENTRY_URL, 'app://wenyao/index.html');
  assert.deepEqual(APP_PROTOCOL_PRIVILEGES, {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true,
    codeCache: true,
  });
  assert.equal(
    resolveAppProtocolFile('app://wenyao/assets/index-abc.js?cache=1', distRoot),
    path.join(distRoot, 'assets', 'index-abc.js'),
  );
  assert.equal(
    resolveAppProtocolFile('app://wenyao/', distRoot),
    path.join(distRoot, 'index.html'),
  );
  assert.equal(
    fileURLToPath(resolveAppProtocolFileUrl('app://wenyao/ritual/manifest.json', distRoot)),
    path.join(distRoot, 'ritual', 'manifest.json'),
  );
});

test('app protocol rejects foreign origins and traversal encodings', () => {
  const rejected = [
    'app://attacker/index.html',
    'app://wenyao:443/index.html',
    'app://user@wenyao/index.html',
    'https://wenyao/index.html',
    'app://wenyao/..%2f..%2fsecret.txt',
    'app://wenyao/%2f..%2fsecret.txt',
    'app://wenyao/%5c..%5csecret.txt',
    'app://wenyao/%00secret.txt',
    'not a url',
  ];

  rejected.forEach((url) => {
    assert.equal(resolveAppProtocolFile(url, distRoot), null, url);
    assert.equal(resolveAppProtocolFileUrl(url, distRoot), null, url);
  });
});

test('app protocol handler forwards only validated GET/HEAD files to file fetch', async () => {
  const calls = [];
  const handler = createAppProtocolHandler({
    distRoot,
    fetchFile: async (...args) => {
      calls.push(args);
      return new Response('manifest', { status: 200 });
    },
  });

  const response = await handler({
    url: 'app://wenyao/ritual/manifest.json',
    method: 'GET',
    headers: new Headers({ range: 'bytes=0-99' }),
  });
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(fileURLToPath(calls[0][0]), path.join(distRoot, 'ritual', 'manifest.json'));
  assert.equal(calls[0][1].headers.get('range'), 'bytes=0-99');
  assert.equal(calls[0][1].bypassCustomProtocolHandlers, true);

  const traversal = await handler({
    url: 'app://wenyao/..%2f..%2fsecret.txt',
    method: 'GET',
    headers: new Headers(),
  });
  const mutation = await handler({
    url: 'app://wenyao/index.html',
    method: 'POST',
    headers: new Headers(),
  });
  assert.equal(traversal.status, 404);
  assert.equal(mutation.status, 405);
  assert.equal(calls.length, 1);
});
