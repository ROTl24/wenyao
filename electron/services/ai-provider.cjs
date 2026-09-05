const crypto = require('node:crypto');
const { isLocalApiUrl } = require('../../shared/ai-setup-core.cjs');
const {
  chatCompletionFromStreamState,
  consumeChatStreamEvent,
  createChatStreamSignal,
  createChatStreamState,
  inspectChatCompletion,
  textValue,
} = require('../../shared/chat-completion-core.cjs');
const { classifyProviderFailure } = require('../../shared/provider-response-core.cjs');

const STREAMING_PROVIDER_IDS = new Set(['alibaba', 'deepseek', 'siliconflow']);

function validateBaseUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('AI 服务地址不是有效 URL'); }
  const local = isLocalApiUrl(url.href);
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
  const detail = classifyProviderFailure({ status: response.status, headers: response.headers, body, label });
  const error = new Error(detail.message);
  error.status = response.status;
  error.publicCode = detail.code;
  error.publicNextAction = detail.nextAction;
  error.technicalDetails = detail.technicalDetails;
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
  let text;
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
    text = await response.text();
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      const timeoutError = new Error(`${label || 'AI 服务'}请求超时`);
      timeoutError.cause = error;
      timeoutError.publicCode = 'AI_TIMEOUT';
      timeoutError.publicNextAction = '请先到服务商控制台确认本次用量，再决定是否手动重试；问爻不会自动重试。';
      throw timeoutError;
    }
    const networkError = new Error(`${label || 'AI 服务'}网络连接失败`);
    networkError.cause = error;
    networkError.publicCode = 'AI_NETWORK_FAILED';
    networkError.publicNextAction = '请检查网络、代理和服务地址后重试。';
    throw networkError;
  }
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

function streamFailure(label, code, message, nextAction, technicalDetails = '') {
  const error = new Error(`${label || 'AI 服务'}${message}`);
  error.publicCode = code;
  error.publicNextAction = nextAction;
  error.technicalDetails = technicalDetails;
  return error;
}

function consumeStreamEvent(event, state, label, reportStage) {
  try {
    const offset = state.content.length;
    const stage = consumeChatStreamEvent(event, state);
    if (stage) reportStage(stage, state.content.slice(offset));
  } catch (error) {
    if (error?.code !== 'CHAT_STREAM_INVALID_EVENT') throw error;
    throw streamFailure(
      label,
      'AI_INVALID_RESPONSE',
      '返回了无法解析的流式数据',
      '请确认自定义服务兼容 OpenAI Chat 流式协议。',
      error.technicalDetails,
    );
  }
}

function streamedChatResult(state, label) {
  const result = chatCompletionFromStreamState(state);
  if (!result.complete) {
    throw streamFailure(
      label,
      'AI_STREAM_INCOMPLETE',
      '在解读完成前中断了流式响应',
      '请先到服务商控制台确认本次用量，再决定是否手动重试；问爻不会自动重试。',
    );
  }
  return { json: result.json, reasoningObserved: result.reasoningObserved };
}

function parseStreamedChat(text, label, reportStage) {
  const state = createChatStreamState();
  text.replace(/\r\n/g, '\n').split(/\n\n+/).forEach((event) => consumeStreamEvent(event, state, label, reportStage));
  return streamedChatResult(state, label);
}

async function responseText(response, onChunk) {
  if (!response.body?.getReader) {
    const text = await response.text();
    if (text) onChunk();
    return text;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    onChunk();
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function readStreamedChat(response, timeout, label, reportStage) {
  if (!response.body?.getReader) {
    return parseStreamedChat(await responseText(response, timeout.receivedChunk), label, reportStage);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = createChatStreamState();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    timeout.receivedChunk();
    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const boundary = /\r?\n\r?\n/.exec(buffer);
      if (!boundary || boundary.index === undefined) break;
      const event = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      consumeStreamEvent(event, state, label, reportStage);
      if (state.completed) {
        void reader.cancel().catch(() => undefined);
        return streamedChatResult(state, label);
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) consumeStreamEvent(buffer, state, label, reportStage);
  return streamedChatResult(state, label);
}

async function requestStreamedChat({ url, apiKey, body, signal, fetchImpl = fetch, label, onProgress }) {
  const timeout = createChatStreamSignal(signal);
  const stageRank = { connected: 1, reasoning: 2, writing: 3 };
  let currentStage = 0;
  const reportStage = (stage, delta = '') => {
    const nextRank = stageRank[stage] || 0;
    if (nextRank <= currentStage && !delta) return;
    currentStage = Math.max(currentStage, nextRank);
    try { onProgress?.({ stage, ...(delta ? { delta } : {}) }); } catch {}
  };
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
    reportStage('connected');
    if (!response.ok) {
      const text = await responseText(response, timeout.receivedChunk);
      throw providerError(response, text, label);
    }
    const contentType = response.headers?.get?.('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      return await readStreamedChat(response, timeout, label, reportStage);
    }
    const text = await responseText(response, timeout.receivedChunk);
    if (text.trimStart().startsWith('data:')) return parseStreamedChat(text, label, reportStage);
    try {
      const json = text ? JSON.parse(text) : {};
      const content = textValue(json?.choices?.[0]?.message?.content);
      if (content) reportStage('writing', content);
      return { json, reasoningObserved: false };
    } catch {
      throw streamFailure(label, 'AI_INVALID_RESPONSE', '返回了无法解析的数据', '请确认自定义接口协议选择正确。', text.slice(0, 1000));
    }
  } catch (error) {
    if (error?.publicCode) throw error;
    if (timeout.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      const timeoutError = streamFailure(
        label,
        'AI_TIMEOUT',
        '请求超时',
        '请先到服务商控制台确认本次用量，再决定是否手动重试；问爻不会自动重试。',
      );
      timeoutError.cause = error;
      throw timeoutError;
    }
    const networkError = streamFailure(label, 'AI_NETWORK_FAILED', '网络连接失败', '请检查网络、代理和服务地址后重试。');
    networkError.cause = error;
    throw networkError;
  } finally {
    timeout.dispose();
  }
}

async function discoverModels({ baseUrl, apiKey = '', capability = 'generation', signal, fetchImpl = fetch }) {
  const url = new URL(endpoint(baseUrl, '/models'));
  if (url.hostname === 'api.siliconflow.cn') {
    url.searchParams.set('type', 'text');
    url.searchParams.set('sub_type', capability === 'embedding' ? 'embedding' : capability === 'rerank' ? 'reranker' : 'chat');
  }
  const json = await requestJson({
    url: url.toString(),
    apiKey,
    method: 'GET',
    signal,
    fetchImpl,
    label: '自定义 AI 服务',
  });
  const source = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
  const modelIds = [...new Set(source.map((item) => (
    typeof item === 'string' ? item : item?.id || item?.model || item?.name || ''
  )).map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 500);
  if (!modelIds.length) {
    const error = new Error('服务已连接，但没有返回可识别的模型列表');
    error.publicCode = 'AI_MODELS_NOT_DISCOVERED';
    error.publicNextAction = '请确认这是兼容的模型目录地址，或直接手动填写模型名称。';
    throw error;
  }
  return modelIds;
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

  async function chat({ messages, signal, maxTokens, temperature, thinking, onProgress }) {
    const definition = connection.capabilities?.generation;
    if (!definition || definition.protocol !== 'openai-chat') throw new Error(`${label}未配置兼容的解读能力`);
    const url = endpoint(baseUrl, definition.path || '/chat/completions');
    const body = {
      model: definition.model,
      messages,
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
      ...(thinking === undefined ? {} : { thinking: { type: thinking ? 'enabled' : 'disabled' } }),
    };
    const transport = STREAMING_PROVIDER_IDS.has(connection.providerId)
      ? await requestStreamedChat({
          url,
          apiKey,
          signal,
          fetchImpl,
          label,
          onProgress,
          body: { ...body, stream: true, stream_options: { include_usage: true } },
        })
      : { json: await requestJson({ url, apiKey, signal, fetchImpl, label, body }), reasoningObserved: false };
    const { json } = transport;
    if (!STREAMING_PROVIDER_IDS.has(connection.providerId)) {
      const delta = textValue(json?.choices?.[0]?.message?.content);
      if (delta) { try { onProgress?.({ stage: 'writing', delta }); } catch {} }
    }
    record('generation', definition.model, json);
    const result = inspectChatCompletion(json, { reasoningObserved: transport.reasoningObserved });
    if (result.status === 'content') return { content: result.content, raw: json };
    const error = result.status === 'output_limit'
      ? new Error(`${label}达到服务商输出额度，正文可能尚未完成`)
      : result.status === 'reasoning_only'
        ? new Error(`${label}只返回了推理过程，没有返回可展示正文`)
        : result.status === 'non_text'
          ? new Error(`${label}返回了非文本结果，无法用于解读`)
          : new Error(`${label}返回的数据不符合 OpenAI Chat 响应协议`);
    error.publicCode = result.status === 'output_limit'
      ? 'AI_OUTPUT_LIMIT'
      : result.status === 'reasoning_only'
        ? 'AI_NO_VISIBLE_CONTENT'
        : result.status === 'non_text'
          ? 'AI_NON_TEXT_RESPONSE'
          : 'AI_INVALID_RESPONSE';
    error.publicNextAction = result.status === 'output_limit'
      ? maxTokens === undefined
        ? '问爻未设置本次输出 Token 上限；请在服务商侧提高模型可用输出额度，或关闭强制思考后手动重试。问爻不会自动重试。'
        : '请提高本次模型输出上限，或在服务商侧关闭强制思考后手动重试；问爻不会自动重试。'
      : result.status === 'reasoning_only'
        ? '请确认服务商会把最终答案放在 message.content；问爻不会把内部推理当作解读正文。'
        : result.status === 'non_text'
          ? '请选择会直接返回文本内容的对话模型，并关闭强制工具调用。'
          : '请确认所选接口兼容 OpenAI Chat Completions，且正文位于 choices[0].message.content。';
    error.technicalDetails = JSON.stringify({ finishReason: result.finishReason, responseStatus: result.status });
    throw error;
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
        ...(definition.dimensions ? { dimensions: definition.dimensions } : {}),
        encoding_format: 'float',
      },
    });
    record('embedding', definition.model, json);
    const ordered = [...(json.data || [])].sort((left, right) => left.index - right.index);
    if (ordered.length !== values.length || ordered.some((item) => !Array.isArray(item.embedding))) {
      throw new Error(`${label}向量响应数量或格式不正确`);
    }
    if (definition.dimensions && ordered.some((item) => item.embedding.length !== definition.dimensions)) {
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
  discoverModels,
  endpoint,
  normalizeUsage,
  providerError,
  requestJson,
  structuredProviderError,
  validateBaseUrl,
};
