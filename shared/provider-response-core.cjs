const REQUEST_ID_HEADERS = [
  'x-siliconcloud-trace-id',
  'x-request-id',
  'request-id',
  'x-ms-request-id',
  'x-correlation-id',
];

const QUOTA_HEADER_FIELDS = {
  'modelscope-ratelimit-requests-limit': 'requestsLimit',
  'modelscope-ratelimit-requests-remaining': 'requestsRemaining',
  'modelscope-ratelimit-model-requests-limit': 'modelRequestsLimit',
  'modelscope-ratelimit-model-requests-remaining': 'modelRequestsRemaining',
};

function headerValue(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || '').trim();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return String(entry?.[1] || '').trim();
}

function redactProviderText(value) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, '[REDACTED]')
    .replace(/([?&](?:api[-_]?key|token|authorization|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

function providerErrorFields(body) {
  const raw = String(body || '');
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  const source = parsed?.error && typeof parsed.error === 'object' ? parsed.error : parsed;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { code: '', message: redactProviderText(raw), searchable: raw.toLowerCase() };
  }
  const code = redactProviderText(source.code ?? source.type ?? source.status ?? '');
  const message = redactProviderText(source.message ?? source.detail ?? source.error_description ?? '');
  return { code, message, searchable: `${raw}\n${code}\n${message}`.toLowerCase() };
}

function safeResponseMetadata(status, headers, fields, includeProviderMessage) {
  const quota = {};
  for (const [header, field] of Object.entries(QUOTA_HEADER_FIELDS)) {
    const value = headerValue(headers, header);
    if (value) quota[field] = value.slice(0, 80);
  }
  const requestId = REQUEST_ID_HEADERS
    .map((name) => headerValue(headers, name))
    .find(Boolean);
  const retryAfter = headerValue(headers, 'retry-after');
  const metadata = {
    status: Number(status) || 0,
    ...(requestId ? { requestId: redactProviderText(requestId) } : {}),
    ...(retryAfter ? { retryAfter: redactProviderText(retryAfter) } : {}),
    ...(Object.keys(quota).length ? { quota } : {}),
    ...(fields.code || (includeProviderMessage && fields.message) ? {
      providerError: {
        ...(fields.code ? { code: fields.code } : {}),
        ...(includeProviderMessage && fields.message ? { message: fields.message } : {}),
      },
    } : {}),
  };
  return JSON.stringify(metadata);
}

function classifyProviderFailure({ status, headers, body, label = 'AI 服务', codePrefix = 'AI_', includeProviderMessage = true }) {
  const numericStatus = Number(status) || 0;
  const fields = providerErrorFields(body);
  const quotaRemaining = [
    'modelscope-ratelimit-requests-remaining',
    'modelscope-ratelimit-model-requests-remaining',
  ].map((name) => headerValue(headers, name)).filter(Boolean);
  const quotaExhausted = quotaRemaining.some((value) => Number(value) === 0);
  const balanceFailure = numericStatus === 402 || /balance|credit|余额|欠费|insufficient funds?/.test(fields.searchable);
  const modelFailure = numericStatus === 404 || /model.+not.+found|unknown model|模型不存在/.test(fields.searchable);
  const rateLimited = numericStatus === 429 || quotaExhausted
    || /rate.?limit|request.?limit|too many requests|quota|限流|频率限制|请求次数|额度上限/.test(fields.searchable);

  let suffix = 'PROVIDER_FAILED';
  let message = `${label}请求失败（${numericStatus}）`;
  let nextAction = '请到服务商控制台核对服务状态和请求记录，再决定是否手动重试。';
  if (numericStatus === 401 || numericStatus === 403) {
    suffix = 'AUTH_FAILED';
    message = `${label}访问密钥无效或没有模型权限`;
    nextAction = '请重新创建访问密钥，并确认账号已开通所选模型。';
  } else if (balanceFailure) {
    suffix = 'BALANCE_REQUIRED';
    message = `${label}账号余额或额度不足`;
    nextAction = '请前往服务商官方页面检查余额、额度和用量。';
  } else if (modelFailure) {
    suffix = 'MODEL_UNAVAILABLE';
    message = `${label}接口或模型不存在`;
    nextAction = '请检查接口路径和模型名称，或选择其他模型。';
  } else if (rateLimited) {
    suffix = 'RATE_LIMITED';
    message = `${label}请求频率或模型限额已达到上限`;
    nextAction = '请到服务商控制台检查限额和用量；确认限额恢复后重新测试，问爻不会自动重试。';
  } else if (numericStatus >= 500) {
    suffix = 'PROVIDER_UNAVAILABLE';
    message = `${label}暂时不可用`;
    nextAction = '请稍后重新测试服务连接；问爻不会自动重试。';
  } else if (numericStatus === 400 || numericStatus === 422) {
    suffix = 'PROVIDER_REJECTED';
    message = `${label}拒绝了当前请求（${numericStatus}）`;
    nextAction = '请根据诊断信息核对接口参数、模型配置和服务商限制，再重新测试。';
  }

  return {
    code: `${codePrefix}${suffix}`,
    message,
    dataSafe: true,
    nextAction,
    technicalDetails: safeResponseMetadata(numericStatus, headers, fields, includeProviderMessage),
  };
}

module.exports = {
  classifyProviderFailure,
  redactProviderText,
};
