const crypto = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');

function validateBaseUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('AI 服务地址不是有效 URL'); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('AI 服务地址必须使用 HTTPS；仅本机 localhost 可以使用 HTTP');
  }
  if (url.username || url.password || url.hash) throw new Error('AI 服务地址不能包含账号、密码或片段标识');
  return url.toString().replace(/\/$/, '');
}

function endpoint(baseUrl, path) {
  if (/^https?:\/\//i.test(String(path || ''))) return validateBaseUrl(path);
  return `${validateBaseUrl(baseUrl)}${String(path || '').startsWith('/') ? '' : '/'}${String(path || '')}`;
}

function providerError(response, body, label = 'AI 服务') {
  const text = String(body || '').slice(0, 1000);
  const lower = text.toLowerCase();
  let message = `${label}请求失败（${response.status}）`;
  let publicCode = 'AI_PROVIDER_FAILED';
  let publicNextAction = '请稍后重试；如持续失败，请打开高级设置查看技术详情。';
  if (response.status === 401 || response.status === 403) {
    message = `${label}访问密钥无效或没有模型权限`;
    publicCode = 'AI_AUTH_FAILED';
    publicNextAction = '请重新创建访问密钥，并确认账号已开通所选模型。';
  } else if (response.status === 402 || /balance|credit|余额|欠费|insufficient/.test(lower)) {
    message = `${label}账号余额或额度不足`;
    publicCode = 'AI_BALANCE_REQUIRED';
    publicNextAction = '请前往服务商官方页面充值或检查额度。';
  } else if (response.status === 404 || /model.+not.+found|unknown model|模型不存在/.test(lower)) {
    message = `${label}接口或模型不存在`;
    publicCode = 'AI_MODEL_UNAVAILABLE';
    publicNextAction = '请检查模型是否仍可用，或在高级设置中选择其他模型。';
  } else if (response.status === 429) {
    message = `${label}当前请求过于频繁`;
    publicCode = 'AI_RATE_LIMITED';
    publicNextAction = '请稍候重试，或前往服务商控制台提升额度。';
  } else if (response.status >= 500) {
    message = `${label}暂时不可用`;
    publicCode = 'AI_PROVIDER_UNAVAILABLE';
    publicNextAction = '服务商暂时异常，请稍后重试。';
  }
  const error = new Error(message);
  error.status = response.status;
  error.publicCode = publicCode;
  error.publicNextAction = publicNextAction;
  error.technicalDetails = text;
  return error;
}

function normalizeUsage(value) {
  if (!value || typeof value !== 'object') return null;
  const source = value.tokens && typeof value.tokens === 'object' ? value.tokens : value;
  const promptTokens = Number(source.prompt_tokens ?? source.input_tokens ?? source.inputTokens ?? 0);
  const completionTokens = Number(source.completion_tokens ?? source.output_tokens ?? source.outputTokens ?? 0);
  const totalTokens = Number(source.total_tokens ?? source.totalTokens ?? promptTokens + completionTokens);
  if (![promptTokens, completionTokens, totalTokens].some((number) => Number.isFinite(number) && number > 0)) return null;
  return {
    promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

async function requestJson({ url, apiKey, method = 'POST', body, signal, fetchImpl = fetch, label }) {
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      error.publicCode = 'AI_TIMEOUT';
      error.publicNextAction = '请检查网络后重试；正式解读超时不会自动重复扣费。';
      throw error;
    }
    const networkError = new Error(`${label || 'AI 服务'}网络连接失败`);
    networkError.cause = error;
    networkError.publicCode = 'AI_NETWORK_FAILED';
    networkError.publicNextAction = '请检查网络、代理和服务地址后重试。';
    throw networkError;
  }
  const text = await response.text();
  if (!response.ok) throw providerError(response, text, label);
  try { return text ? JSON.parse(text) : {}; }
  catch {
    const error = new Error(`${label || 'AI 服务'}返回了无法解析的数据`);
    error.publicCode = 'AI_INVALID_RESPONSE';
    error.publicNextAction = '请确认自定义接口协议选择正确。';
    error.technicalDetails = text.slice(0, 1000);
    throw error;
  }
}

function isTransientProviderError(error) {
  return error?.publicCode === 'AI_NETWORK_FAILED'
    || error?.publicCode === 'AI_TIMEOUT'
    || error?.publicCode === 'AI_RATE_LIMITED'
    || error?.publicCode === 'AI_PROVIDER_UNAVAILABLE'
    || error?.status === 429
    || error?.status >= 500;
}

async function withTransientRetry(operation, { retries = 2, signal, delayImpl = delay, onRetry = () => {} } = {}) {
  let attempt = 0;
  while (true) {
    try { return await operation(attempt); }
    catch (error) {
      if (attempt >= retries || !isTransientProviderError(error) || signal?.aborted) throw error;
      attempt += 1;
      onRetry(error, attempt);
      await delayImpl(Math.min(3000, 350 * (2 ** (attempt - 1))), undefined, { signal });
    }
  }
}

function createProviderClient({ connection, apiKey = '', fetchImpl = fetch, usageSink = () => {} }) {
  if (!connection?.baseUrl) throw new Error('AI 服务连接缺少接口地址');
  const baseUrl = validateBaseUrl(connection.baseUrl);
  const label = connection.label || connection.providerId || 'AI 服务';

  function record(capability, model, json) {
    const usage = normalizeUsage(json?.usage || json?.meta?.tokens || json?.tokens);
    if (!usage) return;
    usageSink({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      providerId: connection.providerId,
      connectionId: connection.id,
      capability,
      model,
      ...usage,
    });
  }

  async function listModels(capability, signal) {
    if (connection.providerId !== 'siliconflow') return null;
    const subType = capability === 'generation' ? 'chat' : capability === 'embedding' ? 'embedding' : 'reranker';
    const url = new URL(endpoint(baseUrl, '/models'));
    url.searchParams.set('type', 'text');
    url.searchParams.set('sub_type', subType);
    const json = await requestJson({ url: url.toString(), apiKey, method: 'GET', signal, fetchImpl, label });
    return Array.isArray(json.data) ? json.data.map((item) => String(item.id || '')).filter(Boolean) : [];
  }

  async function chat({ messages, signal, maxTokens = 8192, temperature = 0 }) {
    const definition = connection.capabilities?.generation;
    if (!definition || definition.protocol !== 'openai-chat') throw new Error(`${label}未配置兼容的解读能力`);
    const json = await requestJson({
      url: endpoint(baseUrl, definition.path || '/chat/completions'),
      apiKey,
      signal,
      fetchImpl,
      label,
      body: {
        model: definition.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      },
    });
    record('generation', definition.model, json);
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      const error = new Error(`${label}没有返回可展示的解读内容`);
      error.publicCode = 'AI_INVALID_RESPONSE';
      error.publicNextAction = '请重试；如持续失败，请更换解读模型。';
      throw error;
    }
    return { content, raw: json };
  }

  async function embed(input, { signal } = {}) {
    const definition = connection.capabilities?.embedding;
    if (!definition || definition.protocol !== 'openai-embeddings') throw new Error(`${label}未配置兼容的向量能力`);
    const values = Array.isArray(input) ? input : [input];
    if (values.length === 0 || values.some((item) => typeof item !== 'string' || !item.trim())) throw new Error('向量请求包含空文本');
    const json = await requestJson({
      url: endpoint(baseUrl, definition.path || '/embeddings'),
      apiKey,
      signal,
      fetchImpl,
      label,
      body: {
        model: definition.model,
        input: values,
        dimensions: definition.dimensions,
        encoding_format: 'float',
      },
    });
    record('embedding', definition.model, json);
    const ordered = [...(json.data || [])].sort((left, right) => left.index - right.index);
    if (ordered.length !== values.length || ordered.some((item) => !Array.isArray(item.embedding))) {
      throw new Error(`${label}向量响应数量或格式不正确`);
    }
    if (ordered.some((item) => item.embedding.length !== definition.dimensions)) {
      const error = new Error(`${label}返回的向量维度与配置不一致`);
      error.publicCode = 'AI_EMBEDDING_DIMENSION_MISMATCH';
      error.publicNextAction = '请恢复推荐维度，或重新配置后构建新索引。';
      throw error;
    }
    return ordered.map((item) => item.embedding);
  }

  async function rerank(query, documents, { signal, topN = 12 } = {}) {
    const definition = connection.capabilities?.rerank;
    if (!definition) throw new Error(`${label}未配置重排能力`);
    const url = definition.url || endpoint(baseUrl, definition.path || '/rerank');
    if (definition.protocol !== 'cohere-rerank' && definition.protocol !== 'alibaba-rerank') {
      throw new Error(`${label}重排协议不受支持：${definition.protocol}`);
    }
    if (!url) throw new Error(`${label}缺少重排接口地址`);
    const json = await requestJson({
      url: validateBaseUrl(url),
      apiKey,
      signal,
      fetchImpl,
      label,
      body: {
        model: definition.model,
        query,
        documents,
        top_n: Math.min(topN, documents.length),
        ...(definition.protocol === 'alibaba-rerank'
          ? { instruct: 'Given a Chinese divination question, retrieve classical divination passages that directly support the interpretation.' }
          : { instruction: '根据中文六爻问题，优先选择能直接支持判断的古籍原文、规则与占例。' }),
      },
    });
    record('rerank', definition.model, json);
    const results = json.results || json.output?.results || [];
    const normalized = results.map((item) => ({
      index: Number(item.index),
      score: Number(item.relevance_score ?? item.score),
    })).filter((item) => Number.isInteger(item.index) && Number.isFinite(item.score));
    if (normalized.length === 0) throw new Error(`${label}重排服务没有返回有效候选`);
    return normalized;
  }

  return { listModels, chat, embed, rerank };
}

function structuredProviderError(error, fallbackCode = 'AI_OPERATION_FAILED') {
  return {
    code: typeof error?.publicCode === 'string' ? error.publicCode : fallbackCode,
    message: error instanceof Error ? error.message : 'AI 操作失败',
    dataSafe: true,
    nextAction: typeof error?.publicNextAction === 'string'
      ? error.publicNextAction
      : '已保存的起卦与排盘不会丢失，可以稍后重试。',
    technicalDetails: typeof error?.technicalDetails === 'string' ? error.technicalDetails.slice(0, 1000) : '',
  };
}

module.exports = {
  createProviderClient,
  endpoint,
  isTransientProviderError,
  normalizeUsage,
  providerError,
  requestJson,
  structuredProviderError,
  validateBaseUrl,
  withTransientRetry,
};
