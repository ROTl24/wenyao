import type {
  AICapability,
  AIConnection,
  DesktopError,
} from '../../types/desktop';

export interface WebSecurityConfirmation {
  confirmedOrigins: string[];
  bulkEmbeddingAccepted?: boolean;
}

export interface ValidatedWebConnection {
  connection: AIConnection;
  endpoints: Partial<Record<AICapability, string>>;
  origins: string[];
}

export interface ValidatedWebModelCatalog {
  baseUrl: string;
  origins: string[];
}

const SECRET_FIELD = /(?:api[-_]?key|authorization|bearer|token|secret|password|credential)/i;
const SECRET_QUERY_FIELD = /^(?:api[-_]?key|key|access[-_]?token|token|authorization|signature|sig|secret|password|credential)$/i;
const PRIVATE_IPV4 = /^(?:0\.|127\.|10\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/;
const PRIVATE_IPV6 = /^\[(?:::1|f[cd]|fe[89ab])/;

function publicError(code: string, message: string, nextAction: string): DesktopError {
  return { code, message, dataSafe: true, nextAction };
}

export class WebAIError extends Error {
  readonly detail: DesktopError;

  constructor(detail: DesktopError) {
    super(detail.message);
    this.name = 'WebAIError';
    this.detail = detail;
  }
}

export function toDesktopError(error: unknown, fallbackCode = 'WEB_AI_OPERATION_FAILED'): DesktopError {
  if (error instanceof WebAIError) return error.detail;
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return publicError(
      'WEB_AI_TIMEOUT',
      'AI 服务请求超时，服务商仍可能已经处理并计费。',
      '请先到服务商控制台确认用量，再决定是否手动重试；问爻不会自动重试。',
    );
  }
  return publicError(
    fallbackCode,
    error instanceof Error ? error.message : 'AI 操作未完成。',
    '请核对服务地址、模型、浏览器 CORS 权限和账号额度后手动重试。',
  );
}

export function normalizeHttpsUrl(value: string, label = 'AI 服务地址', allowSafeQuery = false): URL {
  let url: URL;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new WebAIError(publicError('WEB_AI_URL_INVALID', `${label}不是有效 URL。`, '请输入完整的 HTTPS 地址。'));
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:') {
    throw new WebAIError(publicError('WEB_AI_HTTPS_REQUIRED', `${label}必须使用 HTTPS。`, '请使用服务商提供的 HTTPS API 地址。'));
  }
  const unsafeQuery = [...url.searchParams.keys()].some((key) => SECRET_QUERY_FIELD.test(key)) || url.search.length > 500;
  if (url.username || url.password || url.hash || (url.search && (!allowSafeQuery || unsafeQuery))) {
    throw new WebAIError(publicError('WEB_AI_URL_UNSAFE', `${label}不能包含账号、密码、密钥参数或片段。`, '基础地址请勿带查询参数；接口路径只允许 api-version 等非敏感参数。'));
  }
  if (hostname === 'localhost' || hostname.endsWith('.local') || PRIVATE_IPV4.test(hostname) || PRIVATE_IPV6.test(hostname)) {
    throw new WebAIError(publicError('WEB_AI_PRIVATE_HOST_BLOCKED', `${label}不能指向本机或内网地址。`, '网页版仅连接公开的 HTTPS AI 服务。'));
  }
  return url;
}

function endpoint(baseUrl: string, path: string | undefined, label: string): string {
  const rawPath = String(path || '').trim();
  if (/^https:\/\//i.test(rawPath)) return normalizeHttpsUrl(rawPath, label, true).toString();
  if (/^[a-z][a-z\d+.-]*:/i.test(rawPath) || rawPath.startsWith('//') || rawPath.includes('\\')) {
    throw new WebAIError(publicError('WEB_AI_ENDPOINT_INVALID', `${label}格式不安全。`, '请使用相对路径或完整 HTTPS 地址。'));
  }
  const base = normalizeHttpsUrl(baseUrl, '基础 API 地址').toString().replace(/\/$/, '');
  const relative = (rawPath || '/').replace(/^\/+/, '');
  const resolved = normalizeHttpsUrl(`${base}/${relative}`, label, true);
  if (resolved.origin !== new URL(base).origin || resolved.pathname.split('/').includes('..')) {
    throw new WebAIError(publicError('WEB_AI_ORIGIN_MISMATCH', `${label}超出了已确认的服务域名。`, '请检查自定义接口路径。'));
  }
  return resolved.toString();
}

function sanitizedFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields || {}).filter(([key, value]) => (
    !SECRET_FIELD.test(key) && typeof value === 'string' && value.length <= 200
  )));
}

export function validateWebConnection(input: AIConnection): ValidatedWebConnection {
  const connection = structuredClone(input);
  connection.baseUrl = normalizeHttpsUrl(connection.baseUrl, '基础 API 地址').toString().replace(/\/$/, '');
  connection.fields = sanitizedFields(connection.fields);
  connection.hasApiKey = true;
  connection.label = String(connection.label || '自定义服务').trim().slice(0, 80);
  connection.region = String(connection.region || '').trim().slice(0, 80);
  for (const capability of ['generation', 'embedding', 'rerank'] as const) {
    if (connection.capabilities[capability] && !connection.capabilities[capability]?.model.trim()) {
      delete connection.capabilities[capability];
    }
  }
  const generation = connection.capabilities.generation;
  const embedding = connection.capabilities.embedding;
  const rerank = connection.capabilities.rerank;
  if (!generation && !embedding && !rerank) {
    throw new WebAIError(publicError('WEB_AI_CAPABILITY_REQUIRED', '连接至少需要配置一项 AI 能力。', '请填写解读、向量或重排模型。'));
  }
  if (generation && (generation.protocol !== 'openai-chat' || !generation.model.trim())) {
    throw new WebAIError(publicError('WEB_AI_GENERATION_INVALID', '解读能力必须配置 OpenAI Chat 兼容模型。', '请填写解读模型名称。'));
  }
  if (embedding && (embedding.protocol !== 'openai-embeddings' || !embedding.model.trim() || (embedding.dimensions !== undefined && (!Number.isInteger(embedding.dimensions) || Number(embedding.dimensions) < 1 || Number(embedding.dimensions) > 8192)))) {
    throw new WebAIError(publicError('WEB_AI_EMBEDDING_INVALID', '向量能力的模型或维度无效。', '请填写 OpenAI Embeddings 兼容模型及 1–8192 的维度。'));
  }
  if (rerank && (!['cohere-rerank', 'alibaba-rerank'].includes(rerank.protocol) || !rerank.model.trim())) {
    throw new WebAIError(publicError('WEB_AI_RERANK_INVALID', '重排能力配置无效。', '请填写兼容的重排模型和协议。'));
  }
  const endpoints: Partial<Record<AICapability, string>> = {
    ...(generation ? { generation: endpoint(connection.baseUrl, generation.path || '/chat/completions', '解读接口') } : {}),
    ...(embedding ? { embedding: endpoint(connection.baseUrl, embedding.path || '/embeddings', '向量接口') } : {}),
    ...(rerank ? { rerank: endpoint(connection.baseUrl, rerank.url || rerank.path || '/rerank', '重排接口') } : {}),
  };
  const origins = [...new Set(Object.values(endpoints).filter(Boolean).map((value) => new URL(value).origin))].sort();
  return { connection, endpoints, origins };
}

export function validateWebModelCatalog(baseUrl: string): ValidatedWebModelCatalog {
  const normalizedBaseUrl = normalizeHttpsUrl(baseUrl, '模型目录基础地址').toString().replace(/\/$/, '');
  const catalogUrl = normalizeHttpsUrl(`${normalizedBaseUrl}/models`, '模型目录地址');
  return { baseUrl: normalizedBaseUrl, origins: [catalogUrl.origin] };
}

export function assertConfirmedOrigins(origins: string[], confirmation: WebSecurityConfirmation | undefined): void {
  const confirmed = [...new Set((confirmation?.confirmedOrigins || []).map((value) => normalizeHttpsUrl(value, '确认域名').origin))].sort();
  if (confirmed.length !== origins.length || confirmed.some((value, index) => value !== origins[index])) {
    throw new WebAIError(publicError('WEB_AI_ORIGIN_NOT_CONFIRMED', '服务域名尚未得到完整确认。', '请逐字核对并确认界面列出的全部 HTTPS 服务域名。'));
  }
}

export function confirmationPhrase(origins: string[]): string {
  return origins.map((origin) => new URL(origin).hostname).sort().join(' + ');
}

export function usesBundledVectorPack(connection: AIConnection): boolean {
  const embedding = connection.capabilities.embedding;
  return embedding?.model === 'text-embedding-v4' && embedding.dimensions === 1024;
}

export function isTrustedWebAIOrigin(): boolean {
  if (import.meta.env.MODE === 'test' || import.meta.env.DEV) return true;
  if (typeof Worker === 'undefined' || typeof indexedDB === 'undefined' || !navigator.locks || typeof crypto.randomUUID !== 'function') return false;
  const configured = String(import.meta.env.VITE_WEB_AI_ORIGINS || 'https://wenyao-9pu.pages.dev')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(window.location.origin);
}
