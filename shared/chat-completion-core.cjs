const TEXT_BLOCK_TYPES = new Set(['text', 'output_text']);
const OUTPUT_LIMIT_REASONS = new Set(['length', 'max_tokens']);
const CHAT_STREAM_CONNECT_TIMEOUT_MS = 3 * 60_000;
const CHAT_STREAM_IDLE_TIMEOUT_MS = 90_000;

function textValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textValue).join('');
  if (!value || typeof value !== 'object') return '';
  const type = typeof value.type === 'string' ? value.type : '';
  if (type && !TEXT_BLOCK_TYPES.has(type)) return '';
  if (typeof value.text === 'string') return value.text;
  if (value.text && typeof value.text === 'object' && typeof value.text.value === 'string') {
    return value.text.value;
  }
  return '';
}

function hasReasoning(value) {
  if (typeof value === 'string') return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasReasoning);
  return Boolean(value && typeof value === 'object' && Object.keys(value).length);
}

function reasoningTokens(response) {
  const usage = response?.usage;
  const details = usage?.completion_tokens_details || usage?.output_tokens_details;
  const tokens = Number(details?.reasoning_tokens ?? 0);
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
}

function inspectChatCompletion(response, { reasoningObserved = false } = {}) {
  const choice = response?.choices?.[0];
  const message = choice?.message;
  const content = textValue(message?.content);
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : '';
  if (OUTPUT_LIMIT_REASONS.has(finishReason)) {
    return { status: 'output_limit', content, finishReason };
  }
  if (content.trim()) return { status: 'content', content, finishReason };
  const producedReasoning = reasoningObserved
    || hasReasoning(message?.reasoning_content)
    || reasoningTokens(response) > 0;
  if (producedReasoning) return { status: 'reasoning_only', content: '', finishReason };
  if (hasReasoning(message?.refusal) || (Array.isArray(message?.tool_calls) && message.tool_calls.length)) {
    return { status: 'non_text', content: '', finishReason };
  }
  return { status: 'invalid', content: '', finishReason };
}

function createChatStreamSignal(outer) {
  const controller = new AbortController();
  const timeout = (message) => controller.abort(new DOMException(message, 'TimeoutError'));
  const connectTimer = setTimeout(() => timeout('AI stream did not start in time'), CHAT_STREAM_CONNECT_TIMEOUT_MS);
  let idleTimer = null;
  const abort = () => controller.abort(outer?.reason);
  if (outer?.aborted) abort();
  else outer?.addEventListener('abort', abort, { once: true });
  return {
    signal: controller.signal,
    receivedChunk() {
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => timeout('AI stream stopped producing data'), CHAT_STREAM_IDLE_TIMEOUT_MS);
    },
    dispose() {
      clearTimeout(connectTimer);
      if (idleTimer) clearTimeout(idleTimer);
      outer?.removeEventListener('abort', abort);
    },
  };
}

function createChatStreamState() {
  return {
    content: '',
    usage: null,
    completed: false,
    finishReason: '',
    reasoningObserved: false,
  };
}

function consumeChatStreamEvent(event, state) {
  const data = event.replace(/\r\n/g, '\n').split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
    .trim();
  if (!data) return null;
  if (data === '[DONE]') {
    state.completed = true;
    return null;
  }
  let chunk;
  try { chunk = JSON.parse(data); }
  catch {
    const error = new Error('Invalid OpenAI Chat stream event');
    error.code = 'CHAT_STREAM_INVALID_EVENT';
    error.technicalDetails = data.slice(0, 1000);
    throw error;
  }
  const choice = chunk?.choices?.[0];
  const delta = choice?.delta;
  const content = textValue(delta?.content);
  let stage = null;
  if (hasReasoning(delta?.reasoning_content)) {
    state.reasoningObserved = true;
    stage = 'reasoning';
  }
  if (content) {
    state.content += content;
    stage = 'writing';
  }
  if (typeof choice?.finish_reason === 'string' && choice.finish_reason) {
    state.finishReason = choice.finish_reason;
  }
  if (chunk?.usage) state.usage = chunk.usage;
  return stage;
}

function chatCompletionFromStreamState(state) {
  return {
    complete: Boolean(state.completed || state.finishReason),
    json: {
      choices: [{ message: { content: state.content }, finish_reason: state.finishReason || null }],
      ...(state.usage ? { usage: state.usage } : {}),
    },
    reasoningObserved: state.reasoningObserved,
  };
}

module.exports = {
  CHAT_STREAM_CONNECT_TIMEOUT_MS,
  CHAT_STREAM_IDLE_TIMEOUT_MS,
  chatCompletionFromStreamState,
  consumeChatStreamEvent,
  createChatStreamSignal,
  createChatStreamState,
  hasReasoning,
  inspectChatCompletion,
  textValue,
};
