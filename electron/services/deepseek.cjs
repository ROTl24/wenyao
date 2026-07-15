const providerConfig = require('../../config/deepseek.json');

function providerError(response, body) {
  const error = new Error(response.status === 401 || response.status === 403
    ? `${providerConfig.providerName} API 密钥无效或没有模型权限`
    : `${providerConfig.providerName}请求失败（${response.status}）`);
  error.status = response.status;
  error.providerBody = String(body || '').slice(0, 500);
  return error;
}

function createDeepSeekClient({ apiKey, baseUrl = providerConfig.baseUrl, fetchImpl = fetch }) {
  const compatibleBase = String(baseUrl).replace(/\/$/, '');

  async function chat({ model = providerConfig.model, messages, responseFormat = 'json_object', thinkingType = 'enabled', reasoningEffort = 'high', maxTokens = 8192, signal } = {}) {
    const response = await fetchImpl(`${compatibleBase}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        thinking: { type: thinkingType },
        reasoning_effort: reasoningEffort,
        ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
        stream: false,
        messages,
      }),
      signal,
    });
    if (!response.ok) throw providerError(response, await response.text?.());
    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek 服务没有返回有效内容');
    return { content, raw: json };
  }

  return { chat };
}

module.exports = { createDeepSeekClient, providerError };
