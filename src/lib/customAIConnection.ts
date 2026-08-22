import type { AICapability, AIConnection, AIProviderPreset } from '../types/desktop';

export interface CustomApiLocation {
  baseUrl: string;
  generationPath: string;
  displayUrl: string;
}

export interface InferredCustomConnection {
  connection: AIConnection;
  detected: Partial<Record<AICapability, string>>;
  missing: AICapability[];
}

const capabilityOrder: AICapability[] = ['generation', 'embedding', 'rerank'];
const endpointSuffix = /\/(?:v\d+\/)?chat\/completions\/?$/i;
const modelsSuffix = /\/models\/?$/i;
const secretQueryField = /^(?:api[-_]?key|key|access[-_]?token|token|authorization|signature|sig|secret|password|credential)$/i;

function normalizedUrl(value: string): URL {
  let url: URL;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new Error('请输入完整的 API 调用地址，例如 https://api.example.com/v1'); }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('API 调用地址必须使用 HTTPS；仅桌面版本机服务可以使用 HTTP');
  }
  if (url.username || url.password || url.hash) throw new Error('API 调用地址不能包含账号、密码或 # 片段');
  if ([...url.searchParams.keys()].some((key) => secretQueryField.test(key))) {
    throw new Error('API 调用地址不能包含密钥参数；请把密钥单独粘贴到 API Key');
  }
  return url;
}

export function parseCustomApiUrl(value: string): CustomApiLocation {
  const url = normalizedUrl(value);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  let basePath = pathname;
  let generationPath = '/chat/completions';

  if (endpointSuffix.test(pathname)) {
    const match = pathname.match(/\/chat\/completions$/i);
    basePath = pathname.slice(0, match?.index ?? pathname.length) || '/';
    generationPath = `/chat/completions${url.search}`;
  } else if (modelsSuffix.test(pathname)) {
    basePath = pathname.replace(modelsSuffix, '') || '/';
  } else if (url.search) {
    throw new Error('基础 API 地址不能带查询参数；请粘贴 Base URL 或完整的 /chat/completions 地址');
  }

  const baseUrl = `${url.origin}${basePath === '/' ? '' : basePath}`.replace(/\/$/, '');
  return {
    baseUrl,
    generationPath,
    displayUrl: `${baseUrl}${generationPath}`,
  };
}

export function presetForApiLocation(location: CustomApiLocation, presets: AIProviderPreset[]): AIProviderPreset | null {
  const normalizedBase = location.baseUrl.replace(/\/$/, '').toLowerCase();
  return presets.find((preset) => (
    preset.baseUrl.replace(/\/$/, '').toLowerCase() === normalizedBase
    && !(preset.requiredFields || []).length
    && capabilityOrder.every((capability) => preset.capabilities[capability])
  )) || null;
}

function uniqueModelIds(values: string[]): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 500);
}

function isRerankModel(model: string): boolean {
  return /(?:^|[\/_-])(?:re-?rank|reranker)(?:$|[\/_-])/i.test(model);
}

function isEmbeddingModel(model: string): boolean {
  return !isRerankModel(model) && (
    /(?:^|[\/_-])(?:embed|embedding)(?:$|[\/_-])/i.test(model)
    || /(?:^|[\/_-])(?:bge-m3|bge-(?:small|base|large)|gte-(?:small|base|large)|e5-(?:small|base|large))(?:$|[\/_-])/i.test(model)
  );
}

function isNonChatModel(model: string): boolean {
  return isEmbeddingModel(model)
    || isRerankModel(model)
    || /(?:^|[\/_-])(?:image|flux|kolors|stable-diffusion|wan\d*|whisper|tts|speech|audio|ocr|moderation)(?:$|[\/_-])/i.test(model);
}

function preference(model: string, capability: AICapability): number {
  const value = model.toLowerCase();
  if (capability === 'generation') {
    if (/deepseek.*(?:v4|chat)/.test(value)) return 120;
    if (/qwen.*(?:plus|max|turbo|instruct)/.test(value)) return 115;
    if (/(?:gpt-4\.1|gpt-4o|claude|gemini)/.test(value)) return 110;
    return 1;
  }
  if (capability === 'embedding') {
    if (value.includes('text-embedding-v4')) return 120;
    if (value.includes('qwen3-embedding')) return 115;
    if (value.includes('bge-m3')) return 110;
    if (value.includes('text-embedding-3')) return 105;
    return 1;
  }
  if (value.includes('qwen3-reranker')) return 120;
  if (value.includes('bge-reranker')) return 110;
  return 1;
}

function preferred(values: string[], capability: AICapability): string | undefined {
  return [...values].sort((left, right) => (
    preference(right, capability) - preference(left, capability)
    || left.localeCompare(right, 'zh-CN')
  ))[0];
}

export function inferCustomConnection(
  location: CustomApiLocation,
  modelIds: string[],
  existingId = `custom-${crypto.randomUUID()}`,
): InferredCustomConnection {
  const models = uniqueModelIds(modelIds);
  const detected: Partial<Record<AICapability, string>> = {
    generation: preferred(models.filter((model) => !isNonChatModel(model)), 'generation'),
    embedding: preferred(models.filter(isEmbeddingModel), 'embedding'),
    rerank: preferred(models.filter(isRerankModel), 'rerank'),
  };
  const capabilities: AIConnection['capabilities'] = {};
  if (detected.generation) capabilities.generation = { protocol: 'openai-chat', model: detected.generation, path: location.generationPath };
  if (detected.embedding) capabilities.embedding = { protocol: 'openai-embeddings', model: detected.embedding, batchSize: 10, path: '/embeddings' };
  if (detected.rerank) capabilities.rerank = { protocol: 'cohere-rerank', model: detected.rerank, path: '/rerank' };
  const now = new Date().toISOString();
  const hostname = new URL(location.baseUrl).hostname;
  return {
    connection: {
      id: existingId,
      providerId: 'custom',
      presetId: null,
      label: `自定义 API · ${hostname}`,
      region: '',
      baseUrl: location.baseUrl,
      fields: {},
      capabilities,
      hasApiKey: false,
      createdAt: now,
      updatedAt: now,
    },
    detected,
    missing: capabilityOrder.filter((capability) => !detected[capability]),
  };
}

export function connectionFromKnownPreset(
  preset: AIProviderPreset,
  location: CustomApiLocation,
  existingId = `custom-${crypto.randomUUID()}`,
): InferredCustomConnection {
  const now = new Date().toISOString();
  const capabilities = structuredClone(preset.capabilities);
  if (capabilities.generation) capabilities.generation.path = location.generationPath;
  return {
    connection: {
      id: existingId,
      providerId: preset.providerId,
      presetId: preset.id,
      label: preset.name,
      region: preset.region,
      baseUrl: location.baseUrl,
      fields: {},
      capabilities,
      hasApiKey: false,
      createdAt: now,
      updatedAt: now,
    },
    detected: Object.fromEntries(capabilityOrder.map((capability) => [capability, capabilities[capability]?.model]).filter((entry) => entry[1])) as Partial<Record<AICapability, string>>,
    missing: capabilityOrder.filter((capability) => !capabilities[capability]),
  };
}

export const customCapabilityLabel: Record<AICapability, string> = {
  generation: 'AI 解读',
  embedding: '古籍向量检索',
  rerank: '结果重排',
};
