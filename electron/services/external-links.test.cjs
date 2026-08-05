const assert = require('node:assert/strict');
const test = require('node:test');
const {
  allowedExternalUrl,
  openPublicLink,
  publicLinkUrl,
} = require('./external-links.cjs');

const catalog = {
  presets: [{
    setup: {
      homeUrl: 'https://provider.example/',
      apiKeyUrl: 'https://provider.example/keys',
      billingUrl: 'https://provider.example/billing',
    },
  }],
};

test('public links resolve only predefined HTTPS targets', () => {
  assert.equal(publicLinkUrl('repository'), 'https://github.com/ROTl24/wenyao');
  assert.equal(
    publicLinkUrl('xiaohongshu'),
    'https://www.xiaohongshu.com/user/profile/66b5c9be000000001d0320ae',
  );
  assert.equal(publicLinkUrl('https://attacker.example/'), null);
  assert.equal(publicLinkUrl('__proto__'), null);
});

test('external URL policy accepts public and provider links but rejects arbitrary URLs', () => {
  assert.equal(allowedExternalUrl(publicLinkUrl('repository'), catalog), true);
  assert.equal(allowedExternalUrl('https://provider.example/keys', catalog), true);
  assert.equal(allowedExternalUrl('https://attacker.example/', catalog), false);
});

test('public link opening reports success and opener failures', async () => {
  const opened = [];
  assert.equal(await openPublicLink('repository', async (url) => opened.push(url)), true);
  assert.deepEqual(opened, ['https://github.com/ROTl24/wenyao']);
  assert.equal(await openPublicLink('unknown', async () => {}), false);
  assert.equal(await openPublicLink('xiaohongshu', async () => { throw new Error('unavailable'); }), false);
});
