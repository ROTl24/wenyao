const assert = require('node:assert/strict');
const test = require('node:test');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { createProviderClient } = require('./ai-provider.cjs');

test('long real HTTP stream is readable before completion, preserves UTF-8 and aborts without retry', { timeout: 5000 }, async (context) => {
  const body = Array.from({ length: 440 }, (_, index) => `## ${index + 1}. 本地合成长文\n\n${'仅当条件成立时才继续；逐段核对原文与依据。'.repeat(7)}🪙\n\n`).join('');
  assert.ok(body.length > 60_000);
  let requests = 0;
  let finish;
  let received;
  let aborted;
  const abortedPromise = new Promise((resolve) => { aborted = resolve; });
  const server = createServer(async (request, response) => {
    requests += 1;
    let raw = '';
    for await (const chunk of request) raw += chunk;
    received = JSON.parse(raw);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    if (requests === 2) {
      response.on('close', aborted);
      response.write('data: {"choices":[{"delta":{"content":"停止前已显示的正文"}}]}\n\n');
      return;
    }
    const prefix = 'data: {"choices":[{"delta":{"reasoning_content":"PRIVATE REASONING"}}]}\n\n';
    const events = Array.from({ length: Math.ceil(body.length / 79) }, (_, index) =>
      `data: ${JSON.stringify({ choices: [{ delta: { content: body.slice(index * 79, (index + 1) * 79) } }] })}\r\n\r\n`,
    ).join('');
    const bytes = Buffer.from(prefix + events);
    // Split across UTF-8 characters, SSE separators and JSON tokens.
    for (let offset = 0; offset < bytes.length; offset += 97) {
      if (!response.write(bytes.subarray(offset, offset + 97))) await once(response, 'drain');
    }
    finish = () => response.end('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => { server.closeAllConnections(); server.close(); });
  const client = createProviderClient({ connection: { id: 'offline', label: '本地验收', providerId: 'deepseek', baseUrl: `http://127.0.0.1:${server.address().port}`, capabilities: { generation: { protocol: 'openai-chat', model: 'offline' } } }, apiKey: '' });
  let text = '';
  let settled = false;
  let allText;
  const allTextPromise = new Promise((resolve) => { allText = resolve; });
  const result = client.chat({ messages: [{ role: 'user', content: '合成验收' }], onProgress(event) { text += event.delta || ''; if (text.length === body.length) allText(); } }).finally(() => { settled = true; });
  await allTextPromise;
  assert.equal(text, body);
  assert.equal(settled, false);
  assert.equal(received.stream, true);
  assert.equal(Object.hasOwn(received, 'max_tokens'), false);
  finish();
  assert.equal((await result).content, body);
  assert.equal(requests, 1);
  const controller = new AbortController();
  const stop = client.chat({ messages: [{ role: 'user', content: '停止验收' }], signal: controller.signal, onProgress(event) { if (event.delta) controller.abort(); } });
  await assert.rejects(stop);
  await abortedPromise;
  assert.equal(requests, 2);
});
