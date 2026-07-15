const providerConfig = require('../../config/alibaba.json');

function providerError(response, body, label = providerConfig.providerName) {
  const error = new Error(response.status === 401 || response.status === 403
    ? `${label}密钥无效或没有模型权限`
    : `${label}请求失败（${response.status}）`);
  error.status = response.status;
  error.providerBody = String(body || '').slice(0, 500);
  return error;
}

function createAlibabaClient({ apiKey, baseUrl = providerConfig.baseUrl, rerankUrl = providerConfig.rerankUrl, fetchImpl = fetch }) {
  const compatibleBase = String(baseUrl).replace(/\/$/, '');

  async function post(url, body, signal) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) throw providerError(response, await response.text?.());
    return response.json();
  }

  return {
    async chat({ model = providerConfig.model, messages, signal } = {}) {
      const json = await post(`${compatibleBase}/chat/completions`, {
        model,
        temperature: 0,
        max_tokens: 16,
        enable_thinking: false,
        messages,
      }, signal);
      const content = json?.choices?.[0]?.message?.content;
      if (!content) throw new Error('阿里云聊天服务没有返回有效内容');
      return { content, raw: json };
    },

    async embed(input, { model = providerConfig.embeddingModel, dimensions = providerConfig.embeddingDimensions, signal } = {}) {
      if (!Array.isArray(input) || input.length === 0 || input.length > 10) throw new Error('向量请求每批必须包含 1 至 10 条文本');
      const json = await post(`${compatibleBase}/embeddings`, { model, input, dimensions, encoding_format: 'float' }, signal);
      const ordered = [...(json.data || [])].sort((left, right) => left.index - right.index);
      if (ordered.length !== input.length || ordered.some((item) => !Array.isArray(item.embedding))) throw new Error('向量服务返回的数据不完整');
      return ordered.map((item) => item.embedding);
    },

    async rerank(query, documents, { model = providerConfig.rerankModel, topN = 8, signal } = {}) {
      if (!rerankUrl) throw new Error('尚未配置阿里云 qwen3-rerank 业务空间 API 地址');
      const json = await post(String(rerankUrl).replace(/\/$/, ''), {
        model,
        query,
        documents,
        top_n: Math.min(topN, documents.length),
        instruct: 'Given a Chinese divination question, retrieve classical divination passages that directly support the interpretation.',
      }, signal);
      return (json.results || []).map((item) => ({ index: item.index, score: item.relevance_score }));
    },
  };
}

module.exports = { createAlibabaClient, providerError };
