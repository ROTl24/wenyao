const assert = require('node:assert/strict');
const test = require('node:test');
const { createDeepSeekClient } = require('./deepseek.cjs');

test('DeepSeek uses the official chat endpoint and JSON output contract', async () => {
  let request;
  const client = createDeepSeekClient({
    apiKey: 'secret',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) };
    },
  });
  const result = await client.chat({ messages: [{ role: 'user', content: '输出 JSON' }] });
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.reasoning_effort, 'high');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.stream, false);
  assert.equal(result.content, '{"ok":true}');
});
