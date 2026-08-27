import type { AICapability, AIConnection } from '../../types/desktop';
import { normalizeHttpsUrl, toDesktopError, validateWebConnection, WebAIError } from './security';
import chatCompletionCore from '../../../shared/chat-completion-core.cjs';

const { hasReasoning, inspectChatCompletion, textValue } = chatCompletionCore as {
  hasReasoning: (value: unknown) => boolean;
  inspectChatCompletion: (
    response: Record<string, any>,
    options?: { reasoningObserved?: boolean },
  ) => { status: 'content' | 'output_limit' | 'reasoning_only' | 'non_text' | 'invalid'; content: string; finishReason: string };
  textValue: (value: unknown) => string;
};

interface UsageRecord {
  capability: 'generation' | 'embedding' | 'rerank';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const JSON_REQUEST_TIMEOUT_MS = 90_000;
const STREAM_CONNECT_TIMEOUT_MS = 3 * 60_000;
const STREAM_IDLE_TIMEOUT_MS = 90_000;

function usage(value: unknown): Omit<UsageRecord, 'capability' | 'model'> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const promptTokens = Number(record.prompt_tokens ?? record.input_tokens ?? 0);
  const completionTokens = Number(record.completion_tokens ?? record.output_tokens ?? 0);
  const totalTokens = Number(record.total_tokens ?? promptTokens + completionTokens);
  return [promptTokens, completionTokens, totalTokens].some((item) => Number.isFinite(item) && item > 0)
    ? { promptTokens, completionTokens, totalTokens }
    : null;
}

async function boundedText(response: Response, onChunk: () => void = () => {}): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('AI 服务响应超过 4 MB 安全上限。');
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new Error('AI 服务响应超过 4 MB 安全上限。');
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    onChunk();
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('AI 服务响应超过 4 MB 安全上限。');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

function providerFailure(status: number): WebAIError {
  if (status === 401 || status === 403) return new WebAIError({ code: 'WEB_AI_AUTH_FAILED', message: '访问密钥无效或没有模型权限。', dataSafe: true, nextAction: '请重新输入密钥，并确认账号已开通所选模型。' });
  if (status === 402) return new WebAIError({ code: 'WEB_AI_BALANCE_REQUIRED', message: 'AI 服务账号余额或额度不足。', dataSafe: true, nextAction: '请到服务商控制台检查余额和用量。' });
  if (status === 404) return new WebAIError({ code: 'WEB_AI_MODEL_UNAVAILABLE', message: 'AI 接口或模型不存在。', dataSafe: true, nextAction: '请核对自定义路径和模型名称。' });
  if (status === 429) return new WebAIError({ code: 'WEB_AI_RATE_LIMITED', message: 'AI 服务当前请求过于频繁。', dataSafe: true, nextAction: '请稍后手动重试；问爻不会自动重试。' });
  return new WebAIError({ code: 'WEB_AI_PROVIDER_FAILED', message: `AI 服务请求失败（${status}）。`, dataSafe: true, nextAction: '请到服务商控制台核对服务状态；响应正文不会在问爻中保存或展示。' });
}

function combinedSignal(outer?: AbortSignal): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), JSON_REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort(outer?.reason);
  if (outer?.aborted) abort();
  else outer?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      outer?.removeEventListener('abort', abort);
    },
  };
}

function streamSignal(outer?: AbortSignal): { signal: AbortSignal; receivedChunk(): void; dispose(): void } {
  const controller = new AbortController();
  const timeout = (message: string) => controller.abort(new DOMException(message, 'TimeoutError'));
  const connectTimer = setTimeout(() => timeout('AI stream did not start in time'), STREAM_CONNECT_TIMEOUT_MS);
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const abort = () => controller.abort(outer?.reason);
  if (outer?.aborted) abort();
  else outer?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    receivedChunk() {
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => timeout('AI stream stopped producing data'), STREAM_IDLE_TIMEOUT_MS);
    },
    dispose() {
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      outer?.removeEventListener('abort', abort);
    },
  };
}

interface StreamedChatState {
  content: string;
  usageValue?: unknown;
  completed: boolean;
  finishReason: string;
  reasoningObserved: boolean;
}

interface ChatTransportResult {
  json: Record<string, any>;
  reasoningObserved: boolean;
}

function consumeStreamEvent(event: string, state: StreamedChatState): void {
  const data = event.replace(/\r\n/g, '\n').split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();
  if (!data) return;
  if (data === '[DONE]') {
    state.completed = true;
    return;
  }
  let chunk: Record<string, any>;
  try {
    chunk = JSON.parse(data) as Record<string, any>;
  } catch {
    throw new WebAIError({ code: 'WEB_AI_INVALID_RESPONSE', message: 'AI 服务返回了无法解析的流式数据。', dataSafe: true, nextAction: '请确认自定义服务兼容 OpenAI Chat 流式协议。' });
  }
  const choice = chunk.choices?.[0];
  const delta = choice?.delta;
  state.content += textValue(delta?.content);
  if (hasReasoning(delta?.reasoning_content)) state.reasoningObserved = true;
  if (typeof choice?.finish_reason === 'string' && choice.finish_reason) state.finishReason = choice.finish_reason;
  if (chunk.usage) state.usageValue = chunk.usage;
}

function streamedChatResult(state: StreamedChatState): ChatTransportResult {
  if (!state.completed && !state.finishReason) {
    throw new WebAIError({ code: 'WEB_AI_STREAM_INCOMPLETE', message: 'AI 服务在解读完成前中断了流式响应。', dataSafe: true, nextAction: '请先到服务商控制台确认用量，再决定是否手动重试；问爻不会自动重试。' });
  }
  return {
    json: {
      choices: [{ message: { content: state.content }, finish_reason: state.finishReason || null }],
      ...(state.usageValue ? { usage: state.usageValue } : {}),
    },
    reasoningObserved: state.reasoningObserved,
  };
}

function parseStreamedChat(text: string): ChatTransportResult {
  const state: StreamedChatState = { content: '', completed: false, finishReason: '', reasoningObserved: false };
  text.replace(/\r\n/g, '\n').split(/\n\n+/).forEach((event) => consumeStreamEvent(event, state));
  return streamedChatResult(state);
}

async function readStreamedChat(response: Response, onChunk: () => void): Promise<ChatTransportResult> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('AI 服务响应超过 4 MB 安全上限。');
  if (!response.body) return parseStreamedChat(await response.text());
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state: StreamedChatState = { content: '', completed: false, finishReason: '', reasoningObserved: false };
  let buffer = '';
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    onChunk();
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('AI 服务响应超过 4 MB 安全上限。');
    }
    buffer += decoder.decode(value, { stream: true });
    while (true) {
      const boundary = /\r?\n\r?\n/.exec(buffer);
      if (!boundary || boundary.index === undefined) break;
      const event = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      consumeStreamEvent(event, state);
      if (state.completed) {
        await reader.cancel();
        return streamedChatResult(state);
      }
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) consumeStreamEvent(buffer, state);
  return streamedChatResult(state);
}

async function streamChatRequest(
  url: string,
  apiKey: string,
  body: unknown,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<ChatTransportResult> {
  const timeout = streamSignal(options.signal);
  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });
    if (!response.ok) {
      await boundedText(response, timeout.receivedChunk);
      throw providerFailure(response.status);
    }
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      return await readStreamedChat(response, timeout.receivedChunk);
    }
    const text = await boundedText(response, timeout.receivedChunk);
    if (text.trimStart().startsWith('data:')) return parseStreamedChat(text);
    try {
      return { json: text ? JSON.parse(text) as Record<string, any> : {}, reasoningObserved: false };
    } catch {
      throw new WebAIError({ code: 'WEB_AI_INVALID_RESPONSE', message: 'AI 服务返回了无法解析的数据。', dataSafe: true, nextAction: '请确认自定义服务兼容所选协议。' });
    }
  } catch (error) {
    if (error instanceof WebAIError) throw error;
    if (timeout.signal.aborted) throw timeout.signal.reason instanceof DOMException ? timeout.signal.reason : new DOMException('Aborted', 'AbortError');
    const detail = toDesktopError(error, 'WEB_AI_NETWORK_FAILED');
    detail.message = '无法连接 AI 服务。';
    detail.nextAction = '请确认服务商允许浏览器 CORS 访问，且网络和域名均正常；问爻不会改用公共代理。';
    throw new WebAIError(detail);
  } finally {
    timeout.dispose();
  }
}

export async function secureJsonRequest(
  url: string,
  apiKey: string,
  body: unknown,
  options: { signal?: AbortSignal; method?: 'GET' | 'POST'; fetchImpl?: typeof fetch } = {},
): Promise<Record<string, any>> {
  const method = options.method || 'POST';
  const timeout = combinedSignal(options.signal);
  try {
    const response = await (options.fetchImpl || fetch)(url, {
      method,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      signal: timeout.signal,
    });
    const text = await boundedText(response);
    if (!response.ok) throw providerFailure(response.status);
    try {
      return text ? JSON.parse(text) as Record<string, any> : {};
    } catch {
      throw new WebAIError({ code: 'WEB_AI_INVALID_RESPONSE', message: 'AI 服务返回了无法解析的数据。', dataSafe: true, nextAction: '请确认自定义服务兼容所选协议。' });
    }
  } catch (error) {
    if (error instanceof WebAIError) throw error;
    if (timeout.signal.aborted) throw timeout.signal.reason instanceof DOMException ? timeout.signal.reason : new DOMException('Aborted', 'AbortError');
    const detail = toDesktopError(error, 'WEB_AI_NETWORK_FAILED');
    detail.message = '无法连接 AI 服务。';
    detail.nextAction = '请确认服务商允许浏览器 CORS 访问，且网络和域名均正常；问爻不会改用公共代理。';
    throw new WebAIError(detail);
  } finally {
    timeout.dispose();
  }
}

export async function discoverWebModels(baseUrl: string, apiKey: string, capability: AICapability = 'generation'): Promise<string[]> {
  const base = normalizeHttpsUrl(baseUrl).toString().replace(/\/$/, '');
  const url = new URL(`${base}/models`);
  if (url.hostname === 'api.siliconflow.cn') {
    url.searchParams.set('type', 'text');
    url.searchParams.set('sub_type', capability === 'embedding' ? 'embedding' : capability === 'rerank' ? 'reranker' : 'chat');
  }
  const json = await secureJsonRequest(url.toString(), apiKey, undefined, { method: 'GET' });
  const source = Array.isArray(json.data) ? json.data : Array.isArray(json.models) ? json.models : [];
  const modelIds = [...new Set(source.map((item: unknown) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return '';
    const record = item as Record<string, unknown>;
    return record.id || record.model || record.name || '';
  }).map((item: unknown) => String(item || '').trim()).filter(Boolean))].slice(0, 500);
  if (!modelIds.length) {
    throw new WebAIError({
      code: 'WEB_AI_MODELS_NOT_DISCOVERED',
      message: '服务已连接，但没有返回可识别的模型列表。',
      dataSafe: true,
      nextAction: '请确认这是兼容的模型目录地址，或直接手动填写模型名称。',
    });
  }
  return modelIds;
}

export function createWebProvider(
  connection: AIConnection,
  apiKey: string,
  onUsage: (usage: UsageRecord) => void = () => {},
) {
  const validated = validateWebConnection(connection);
  const recordUsage = (capability: UsageRecord['capability'], model: string, json: Record<string, any>) => {
    const normalized = usage(json.usage || json.meta?.tokens || json.tokens);
    if (normalized) onUsage({ capability, model, ...normalized });
  };

  return {
    origins: validated.origins,
    async chat({ messages, signal, maxTokens = 8192, temperature, thinking }: { messages: Array<{ role: string; content: string }>; signal?: AbortSignal; maxTokens?: number; temperature?: number; thinking?: boolean }) {
      const definition = validated.connection.capabilities.generation!;
      const transport = await streamChatRequest(validated.endpoints.generation!, apiKey, {
        model: definition.model,
        messages,
        ...(temperature === undefined ? {} : { temperature }),
        max_tokens: maxTokens,
        ...(thinking === undefined ? {} : { thinking: { type: thinking ? 'enabled' : 'disabled' } }),
        stream: true,
        stream_options: { include_usage: true },
      }, { signal });
      const { json } = transport;
      recordUsage('generation', definition.model, json);
      const result = inspectChatCompletion(json, { reasoningObserved: transport.reasoningObserved });
      if (result.status === 'content') return { content: result.content, raw: json };
      if (result.status === 'output_limit') {
        throw new WebAIError({ code: 'WEB_AI_OUTPUT_LIMIT', message: '解读模型在生成可展示正文前耗尽了输出额度。', dataSafe: true, nextAction: '请提高模型输出上限，或在服务商侧关闭强制思考后手动重试；问爻不会自动重试。' });
      }
      if (result.status === 'reasoning_only') {
        throw new WebAIError({ code: 'WEB_AI_NO_VISIBLE_CONTENT', message: '解读模型只返回了推理过程，没有返回可展示正文。', dataSafe: true, nextAction: '请确认服务商会把最终答案放在 message.content；问爻不会把内部推理当作解读正文。' });
      }
      if (result.status === 'non_text') {
        throw new WebAIError({ code: 'WEB_AI_NON_TEXT_RESPONSE', message: '解读模型返回了非文本结果，无法用于解读。', dataSafe: true, nextAction: '请选择会直接返回文本内容的对话模型，并关闭强制工具调用。' });
      }
      throw new WebAIError({ code: 'WEB_AI_INVALID_RESPONSE', message: '解读模型返回的数据不符合 OpenAI Chat 响应协议。', dataSafe: true, nextAction: '请确认正文位于 choices[0].message.content。' });
    },
    async embed(input: string | string[], { signal }: { signal?: AbortSignal } = {}) {
      const definition = validated.connection.capabilities.embedding!;
      const values = Array.isArray(input) ? input : [input];
      if (!values.length || values.some((item) => !item.trim())) throw new Error('向量请求不能包含空文本。');
      const json = await secureJsonRequest(validated.endpoints.embedding!, apiKey, {
        model: definition.model,
        input: values,
        ...(definition.dimensions ? { dimensions: definition.dimensions } : {}),
        encoding_format: 'float',
      }, { signal });
      recordUsage('embedding', definition.model, json);
      const ordered = [...(json.data || [])].sort((left, right) => Number(left.index) - Number(right.index));
      if (ordered.length !== values.length || ordered.some((item) => !Array.isArray(item.embedding) || (definition.dimensions && item.embedding.length !== definition.dimensions))) {
        throw new WebAIError({ code: 'WEB_AI_EMBEDDING_INVALID_RESPONSE', message: '向量响应数量或维度与配置不一致。', dataSafe: true, nextAction: '请核对向量模型维度，修改后重新建库。' });
      }
      return ordered.map((item) => item.embedding as number[]);
    },
    async rerank(query: string, documents: string[], { signal, topN = 12 }: { signal?: AbortSignal; topN?: number } = {}) {
      const definition = validated.connection.capabilities.rerank!;
      const json = await secureJsonRequest(validated.endpoints.rerank!, apiKey, {
        model: definition.model,
        query,
        documents,
        top_n: Math.min(topN, documents.length),
        ...(definition.protocol === 'alibaba-rerank'
          ? { instruct: 'Given a Chinese divination question, retrieve classical divination passages that directly support the interpretation.' }
          : { instruction: '根据中文六爻问题，优先选择能直接支持判断的古籍原文、规则与占例。' }),
      }, { signal });
      recordUsage('rerank', definition.model, json);
      const results = json.results || json.output?.results || [];
      const normalized: Array<{ index: number; score: number }> = results.map((item: Record<string, unknown>) => ({
        index: Number(item.index),
        score: Number(item.relevance_score ?? item.score),
      })).filter((item: { index: number; score: number }) => Number.isInteger(item.index) && Number.isFinite(item.score));
      if (!normalized.length) throw new WebAIError({ code: 'WEB_AI_RERANK_INVALID_RESPONSE', message: '重排服务没有返回有效候选。', dataSafe: true, nextAction: '请核对重排协议、模型和接口路径。' });
      return normalized;
    },
  };
}
