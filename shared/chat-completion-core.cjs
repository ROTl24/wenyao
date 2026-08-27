const TEXT_BLOCK_TYPES = new Set(['text', 'output_text']);
const OUTPUT_LIMIT_REASONS = new Set(['length', 'max_tokens']);

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
  if (content.trim()) return { status: 'content', content, finishReason };
  if (OUTPUT_LIMIT_REASONS.has(finishReason)) {
    return { status: 'output_limit', content: '', finishReason };
  }
  const producedReasoning = reasoningObserved
    || hasReasoning(message?.reasoning_content)
    || reasoningTokens(response) > 0;
  if (producedReasoning) return { status: 'reasoning_only', content: '', finishReason };
  if (hasReasoning(message?.refusal) || (Array.isArray(message?.tool_calls) && message.tool_calls.length)) {
    return { status: 'non_text', content: '', finishReason };
  }
  return { status: 'invalid', content: '', finishReason };
}

module.exports = {
  hasReasoning,
  inspectChatCompletion,
  textValue,
};
