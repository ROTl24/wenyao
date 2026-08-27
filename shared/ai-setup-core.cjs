const CAPABILITIES = Object.freeze(['generation', 'embedding', 'rerank']);

const ENDPOINT_SUFFIX = Object.freeze({
  generation: /\/chat\/completions\/?$/i,
  embedding: /\/embeddings\/?$/i,
  rerank: /\/reranks?\/?$/i,
});
const MODELS_SUFFIX = /\/models\/?$/i;
const SECRET_QUERY_FIELD = /^(?:api[-_]?key|key|access[-_]?token|token|authorization|signature|sig|secret|password|credential)$/i;

function parsedUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('请输入完整的 API 调用地址，例如 https://api.example.com/v1'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('API 调用地址必须使用 HTTP 或 HTTPS');
  if (url.username || url.password || url.hash) throw new Error('API 调用地址不能包含账号、密码或 # 片段');
  if ([...url.searchParams.keys()].some((key) => SECRET_QUERY_FIELD.test(key))) {
    throw new Error('API 调用地址不能包含密钥参数；请把密钥单独填写到 API Key');
  }
  return url;
}

function normalizeCapabilityLocation(capability, value) {
  if (!CAPABILITIES.includes(capability)) throw new Error(`未知 AI 能力：${capability}`);
  const url = parsedUrl(value);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const suffix = ENDPOINT_SUFFIX[capability];
  const match = pathname.match(suffix);
  let basePath = pathname;
  let path = capability === 'generation'
    ? '/chat/completions'
    : capability === 'embedding'
      ? '/embeddings'
      : '/rerank';
  if (match) {
    basePath = pathname.slice(0, match.index) || '/';
    path = `${match[0].startsWith('/') ? '' : '/'}${match[0].replace(/\/$/, '')}${url.search}`;
  } else if (MODELS_SUFFIX.test(pathname)) {
    basePath = pathname.replace(MODELS_SUFFIX, '') || '/';
  } else if (url.search) {
    throw new Error('基础 API 地址不能带查询参数；请粘贴 Base URL 或该能力的完整调用地址');
  } else if (pathname === '/' && !['deepseek', 'alibaba'].includes(providerIdentity(url.origin).providerId)) {
    basePath = '/v1';
  }
  const baseUrl = `${url.origin}${basePath === '/' ? '' : basePath}`.replace(/\/$/, '');
  const displayUrl = `${baseUrl}${path}`;
  return { baseUrl, path, displayUrl, canonicalUrl: match ? displayUrl : baseUrl };
}

function providerIdentity(baseUrl) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  if (hostname === 'api.deepseek.com') return { providerId: 'deepseek', label: 'DeepSeek 官方' };
  if (hostname === 'api.siliconflow.cn') return { providerId: 'siliconflow', label: 'SiliconFlow' };
  if (hostname === 'dashscope.aliyuncs.com' || hostname.endsWith('.maas.aliyuncs.com')) {
    return { providerId: 'alibaba', label: '阿里云百炼' };
  }
  return { providerId: 'custom', label: `自定义 API · ${hostname}` };
}

function protocolFor(capability, baseUrl, path) {
  if (capability === 'generation') return 'openai-chat';
  if (capability === 'embedding') return 'openai-embeddings';
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname.endsWith('.maas.aliyuncs.com') || String(path).includes('/compatible-api/v1/reranks')
    ? 'alibaba-rerank'
    : 'cohere-rerank';
}

function capabilityConnection({ capability, apiUrl, model, id, createdAt, dimensions }) {
  const location = normalizeCapabilityLocation(capability, apiUrl);
  const identity = providerIdentity(location.baseUrl);
  const now = new Date().toISOString();
  const definition = {
    protocol: protocolFor(capability, location.baseUrl, location.path),
    model: String(model || '').trim(),
    path: location.path,
    ...(capability === 'embedding' ? {
      batchSize: 10,
      ...(Number.isInteger(dimensions) && dimensions > 0 ? { dimensions } : {}),
    } : {}),
  };
  if (!definition.model) throw new Error('请选择或填写模型名称');
  return {
    id: String(id || `setup-${capability}-${crypto.randomUUID()}`),
    providerId: identity.providerId,
    presetId: null,
    label: identity.label,
    region: '',
    baseUrl: location.baseUrl,
    fields: {},
    capabilities: { [capability]: definition },
    createdAt: createdAt || now,
    updatedAt: now,
  };
}

function isRerankModel(model) {
  return /(?:^|[\/_-])(?:re-?rank|reranker)(?:$|[\/_-])/i.test(model);
}

function isEmbeddingModel(model) {
  return !isRerankModel(model) && (
    /(?:^|[\/_-])(?:embed|embedding)(?:$|[\/_-])/i.test(model)
    || /(?:^|[\/_-])(?:bge-m3|bge-(?:small|base|large)|gte-(?:small|base|large)|e5-(?:small|base|large))(?:$|[\/_-])/i.test(model)
  );
}

function isNonChatModel(model) {
  return isEmbeddingModel(model)
    || isRerankModel(model)
    || /(?:^|[\/_-])(?:image|flux|kolors|stable-diffusion|wan\d*|whisper|tts|speech|audio|ocr|moderation)(?:$|[\/_-])/i.test(model);
}

function filterModels(capability, values) {
  const models = [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))].slice(0, 500);
  if (capability === 'embedding') return models.filter(isEmbeddingModel);
  if (capability === 'rerank') return models.filter(isRerankModel);
  return models.filter((model) => !isNonChatModel(model));
}

function generationProbeOptions(connection) {
  return {
    maxTokens: 16,
    ...(connection?.providerId === 'deepseek' ? { thinking: false } : {}),
  };
}

module.exports = {
  CAPABILITIES,
  capabilityConnection,
  filterModels,
  generationProbeOptions,
  normalizeCapabilityLocation,
  providerIdentity,
};
