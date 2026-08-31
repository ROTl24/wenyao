const assert = require('node:assert/strict');
const test = require('node:test');
const { classifyProviderFailure } = require('../../shared/provider-response-core.cjs');

test('ModelScope 以 400 返回限额耗尽时仍识别为限流并保留安全诊断', () => {
  const detail = classifyProviderFailure({
    status: 400,
    headers: {
      'modelscope-ratelimit-model-requests-limit': '450',
      'modelscope-ratelimit-model-requests-remaining': '0',
      'x-request-id': 'request-400-quota',
    },
    body: JSON.stringify({ error: { code: 'request_limit_exceeded', message: 'Model request limit exceeded' } }),
    label: '自定义 AI 服务',
  });

  assert.equal(detail.code, 'AI_RATE_LIMITED');
  assert.match(detail.message, /限额|频繁/);
  assert.match(detail.nextAction, /不会自动重试/);
  assert.deepEqual(JSON.parse(detail.technicalDetails), {
    status: 400,
    requestId: 'request-400-quota',
    quota: {
      modelRequestsLimit: '450',
      modelRequestsRemaining: '0',
    },
    providerError: {
      code: 'request_limit_exceeded',
      message: 'Model request limit exceeded',
    },
  });
});

test('未知 400 被识别为请求拒绝且诊断信息会脱敏', () => {
  const detail = classifyProviderFailure({
    status: 400,
    headers: { 'request-id': 'request-invalid' },
    body: JSON.stringify({ error: { code: 'invalid_dimensions', message: 'invalid key sk-dangerous-secret and dimensions' } }),
    codePrefix: 'WEB_AI_',
  });

  assert.equal(detail.code, 'WEB_AI_PROVIDER_REJECTED');
  assert.match(detail.nextAction, /接口参数|模型配置/);
  assert.match(detail.technicalDetails, /invalid_dimensions/);
  assert.doesNotMatch(detail.technicalDetails, /sk-dangerous-secret/);
});

test('SiliconFlow 额度错误保留官方追踪 ID 而不保存响应消息', () => {
  const detail = classifyProviderFailure({
    status: 402,
    headers: { 'x-siliconcloud-trace-id': 'ti_test_trace' },
    body: JSON.stringify({ code: 30001, message: 'account balance unavailable' }),
    includeProviderMessage: false,
  });

  assert.equal(detail.code, 'AI_BALANCE_REQUIRED');
  assert.deepEqual(JSON.parse(detail.technicalDetails), {
    status: 402,
    requestId: 'ti_test_trace',
    providerError: { code: '30001' },
  });
});
