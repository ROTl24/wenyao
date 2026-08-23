import { ADMIN_HTML } from './admin';

interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
  ADMIN_EMAILS: string;
  DETAIL_RETENTION_DAYS: string;
}

type Json = Record<string, unknown>;

const REASONS = new Set(['问非所答', '盘面事实有误', '引用依据不相关', '结论前后矛盾', '说得太模糊', '内容难以理解', '与后来实际情况不符', '其他问题']);
const RETRIEVAL_MODES = new Set(['full-hybrid', 'bm25-reranked', 'rrf-fallback', 'bm25-fallback']);
const RANKING_STAGES = ['bm25', 'vector', 'fusion', 'rerank', 'final'] as const;
const encoder = new TextEncoder();

class InvalidFeedbackError extends Error {}

function response(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', ...headers },
  });
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('origin');
  if (!origin) return '*';
  return env.ALLOWED_ORIGINS.split(',').map((item) => item.trim()).includes(origin) ? origin : '';
}

function cors(request: Request, env: Env): HeadersInit {
  const origin = allowedOrigin(request, env);
  return origin ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,authorization', vary: 'origin' } : {};
}

function requireAdmin(request: Request, env: Env) {
  const email = request.headers.get('cf-access-authenticated-user-email') || '';
  const allowed = env.ADMIN_EMAILS.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return Boolean(email && allowed.includes(email.toLowerCase()));
}

function text(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function timestamp(value: unknown) {
  const candidate = text(value, 40);
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function rankings(value: unknown) {
  const source = value && typeof value === 'object' ? value as Json : {};
  return Object.fromEntries(RANKING_STAGES.map((stage) => {
    const items = Array.isArray(source[stage]) ? source[stage] as Json[] : [];
    return [stage, items.slice(0, 40).map((item) => ({
      id: text(item?.id, 200),
      rank: Math.max(0, Math.trunc(Number(item?.rank) || 0)),
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0,
    })).filter((item) => item.id)];
  }));
}

function sanitize(body: Json) {
  const technical = body.technical && typeof body.technical === 'object' ? body.technical as Json : {};
  const modelIds = technical.modelIds && typeof technical.modelIds === 'object' ? technical.modelIds as Json : {};
  const sentiment = body.sentiment === 'helpful' ? 'helpful' : body.sentiment === 'problematic' ? 'problematic' : '';
  const targetType = body.targetType === 'analysis' ? 'analysis' : body.targetType === 'follow-up' ? 'follow-up' : '';
  const credential = text(body.deletionCredential, 200);
  if (!text(body.feedbackId, 100) || !text(body.targetId, 100) || !sentiment || !targetType || !credential) throw new InvalidFeedbackError('INVALID_FEEDBACK');
  const contentOptIn = body.contentOptIn === true;
  const content = contentOptIn && body.content && typeof body.content === 'object' ? body.content as Json : null;
  return {
    feedbackId: text(body.feedbackId, 100), targetType, targetId: text(body.targetId, 100), sentiment,
    reasons: sentiment === 'problematic' && Array.isArray(body.reasons) ? [...new Set(body.reasons.filter((item): item is string => typeof item === 'string' && REASONS.has(item)))].slice(0, 8) : [],
    note: text(body.note, 1000),
    technical: {
      appVersion: text(technical.appVersion, 50), corpusVersion: text(technical.corpusVersion, 200), category: text(technical.category, 50),
      modelIds: Object.fromEntries(['generation', 'embedding', 'rerank'].filter((key) => modelIds[key]).map((key) => [key, text(modelIds[key], 200)])), retrievalMode: RETRIEVAL_MODES.has(technical.retrievalMode) ? technical.retrievalMode as string : '',
      stages: Array.isArray(technical.stages) ? technical.stages.slice(0, 10).map((item) => text(item, 200)).filter(Boolean) : [], candidateRankings: rankings(technical.candidateRankings),
      finalEvidenceIds: Array.isArray(technical.finalEvidenceIds) ? technical.finalEvidenceIds.slice(0, 16).map((item) => text(item, 200)) : [],
    },
    contentOptIn, content: content ? { question: text(content.question, 5000), answer: text(content.answer, 30000) } : null,
    credential, createdAt: timestamp(body.createdAt), updatedAt: timestamp(body.updatedAt),
  };
}

function aggregateStatements(env: Env, item: Pick<ReturnType<typeof sanitize>, 'sentiment' | 'reasons' | 'technical' | 'updatedAt'>, delta: 1 | -1) {
  const day = item.updatedAt.slice(0, 10);
  const modelIds = item.technical.modelIds as Record<string, unknown>;
  return ['', ...item.reasons].map((reason) => env.DB.prepare(`INSERT INTO feedback_daily_aggregates (day,sentiment,reason,app_version,corpus_version,retrieval_mode,generation_model,count)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(day,sentiment,reason,app_version,corpus_version,retrieval_mode,generation_model) DO UPDATE SET count=MAX(0,count+excluded.count)`)
    .bind(day, item.sentiment, reason, item.technical.appVersion, item.technical.corpusVersion, item.technical.retrievalMode, text(modelIds.generation, 200), delta));
}

async function saveFeedback(request: Request, env: Env) {
  const item = sanitize(await request.json() as Json);
  const credentialHash = await hash(item.credential);
  const safePayload = { ...item, credential: undefined };
  const payloadHash = await hash(JSON.stringify(safePayload));
  const existing = await env.DB.prepare('SELECT target_type,target_id,sentiment,reasons_json,technical_json,deletion_credential_hash,payload_hash,updated_at FROM feedback_details WHERE feedback_id=?').bind(item.feedbackId).first<{
    target_type: string; target_id: string; sentiment: string; reasons_json: string; technical_json: string;
    deletion_credential_hash: string; payload_hash: string; updated_at: string;
  }>();
  if (existing && existing.deletion_credential_hash !== credentialHash) return response({ error: 'credential_mismatch' }, 409, cors(request, env));
  if (existing && (existing.target_type !== item.targetType || existing.target_id !== item.targetId)) return response({ error: 'immutable_target' }, 409, cors(request, env));
  if (existing?.payload_hash === payloadHash) return response({ ok: true, idempotent: true }, 200, cors(request, env));
  const days = Math.max(1, Number(env.DETAIL_RETENTION_DAYS) || 90);
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const statements = [env.DB.prepare(`INSERT INTO feedback_details (feedback_id,target_type,target_id,sentiment,reasons_json,note,technical_json,content_opt_in,content_json,deletion_credential_hash,payload_hash,created_at,updated_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(feedback_id) DO UPDATE SET sentiment=excluded.sentiment,reasons_json=excluded.reasons_json,note=excluded.note,technical_json=excluded.technical_json,content_opt_in=excluded.content_opt_in,content_json=excluded.content_json,payload_hash=excluded.payload_hash,updated_at=excluded.updated_at,expires_at=excluded.expires_at`)
    .bind(item.feedbackId, item.targetType, item.targetId, item.sentiment, JSON.stringify(item.reasons), item.note, JSON.stringify(item.technical), item.contentOptIn ? 1 : 0, item.contentOptIn ? JSON.stringify(item.content) : null, credentialHash, payloadHash, item.createdAt, item.updatedAt, expiresAt)];
  if (existing) {
    const previous = {
      sentiment: existing.sentiment as ReturnType<typeof sanitize>['sentiment'],
      reasons: JSON.parse(existing.reasons_json) as string[],
      technical: JSON.parse(existing.technical_json) as ReturnType<typeof sanitize>['technical'],
      updatedAt: existing.updated_at,
    };
    statements.push(...aggregateStatements(env, previous, -1));
  }
  statements.push(...aggregateStatements(env, item, 1));
  statements.push(env.DB.prepare('DELETE FROM feedback_daily_aggregates WHERE count<=0'));
  await env.DB.batch(statements);
  return response({ ok: true }, 200, cors(request, env));
}

async function deleteFeedback(request: Request, env: Env, feedbackId: string) {
  const credential = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const row = await env.DB.prepare('SELECT deletion_credential_hash FROM feedback_details WHERE feedback_id=?').bind(feedbackId).first<{ deletion_credential_hash: string }>();
  if (!row) return response({ ok: true }, 404, cors(request, env));
  if (!credential || await hash(credential) !== row.deletion_credential_hash) return response({ error: 'unauthorized' }, 401, cors(request, env));
  await env.DB.prepare('DELETE FROM feedback_details WHERE feedback_id=?').bind(feedbackId).run();
  return response({ ok: true }, 200, cors(request, env));
}

async function adminData(request: Request, env: Env) {
  if (!requireAdmin(request, env)) return response({ error: 'forbidden' }, 403);
  const url = new URL(request.url);
  const conditions: string[] = [];
  const values: string[] = [];
  for (const [parameter, column] of [['sentiment', 'sentiment'], ['retrievalMode', "json_extract(technical_json,'$.retrievalMode')"]] as const) {
    const value = text(url.searchParams.get(parameter), 200); if (value) { conditions.push(`${column}=?`); values.push(value); }
  }
  const reason = text(url.searchParams.get('reason'), 100); if (reason) { conditions.push('EXISTS (SELECT 1 FROM json_each(reasons_json) WHERE value=?)'); values.push(reason); }
  const model = text(url.searchParams.get('model'), 200); if (model) {
    conditions.push("(json_extract(technical_json,'$.modelIds.generation')=? OR json_extract(technical_json,'$.modelIds.embedding')=? OR json_extract(technical_json,'$.modelIds.rerank')=?)");
    values.push(model, model, model);
  }
  const version = text(url.searchParams.get('version'), 200); if (version) {
    conditions.push("(json_extract(technical_json,'$.appVersion')=? OR json_extract(technical_json,'$.corpusVersion')=?)");
    values.push(version, version);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await env.DB.prepare(`SELECT feedback_id,target_type,target_id,sentiment,reasons_json,note,technical_json,content_opt_in,created_at,updated_at FROM feedback_details ${where} ORDER BY updated_at DESC LIMIT 1000`).bind(...values).all();
  const aggregates = await env.DB.prepare("SELECT sentiment,SUM(count) AS count FROM feedback_daily_aggregates WHERE reason='' GROUP BY sentiment").all();
  const trend = await env.DB.prepare("SELECT day,sentiment,SUM(count) AS count FROM feedback_daily_aggregates WHERE reason='' AND day>=date('now','-90 day') GROUP BY day,sentiment ORDER BY day").all();
  if (url.searchParams.get('format') === 'csv') {
    const rows = ['feedback_id,target_type,target_id,sentiment,reasons,note,updated_at', ...result.results.map((row) => [row.feedback_id,row.target_type,row.target_id,row.sentiment,row.reasons_json,row.note,row.updated_at].map(csvCell).join(','))];
    return new Response(rows.join('\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="wenyao-feedback.csv"' } });
  }
  return response({ items: result.results, aggregates: aggregates.results, trend: trend.results }, 200, url.searchParams.get('format') === 'json' ? { 'content-disposition': 'attachment; filename="wenyao-feedback.json"' } : {});
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (url.pathname === '/admin') return requireAdmin(request, env) ? response(ADMIN_HTML, 200, { 'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }) : response({ error: 'forbidden' }, 403);
    if (url.pathname === '/api/admin/feedback' && request.method === 'GET') return adminData(request, env);
    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      if (!allowedOrigin(request, env)) return response({ error: 'origin_not_allowed' }, 403);
      const size = Number(request.headers.get('content-length') || 0);
      if (size > 128 * 1024) return response({ error: 'payload_too_large' }, 413, cors(request, env));
      try {
        return await saveFeedback(request, env);
      } catch (error) {
        if (error instanceof InvalidFeedbackError || error instanceof SyntaxError) return response({ error: 'invalid_feedback' }, 400, cors(request, env));
        console.error('feedback_save_failed', error instanceof Error ? error.message : 'unknown');
        return response({ error: 'server_error' }, 500, cors(request, env));
      }
    }
    if (url.pathname.startsWith('/api/feedback/') && request.method === 'DELETE') return deleteFeedback(request, env, decodeURIComponent(url.pathname.slice('/api/feedback/'.length)));
    return response({ error: 'not_found' }, 404);
  },
  async scheduled(_controller: ScheduledController, env: Env) {
    await env.DB.prepare('DELETE FROM feedback_details WHERE expires_at <= ?').bind(new Date().toISOString()).run();
  },
};
