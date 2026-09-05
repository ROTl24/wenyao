import { z } from 'zod';
import packageInfo from '../../package.json';
import { buildPlate } from './divination';
import type { DivinationSession } from './session';
import { normalizeStoredSession, sanitizeRendererSession, validateSessionForSave } from './sessionValidation';
import { formatShanghaiDateTimeInput } from './shanghaiTime';

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export type ImportAction = 'skip' | 'copy' | 'replace';
export interface SessionImportRequest {
  sessions: DivinationSession[];
  resolutions: Record<string, { action: ImportAction; expectedUpdatedAt: string; newId?: string }>;
}

const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const id = z.string().min(1).refine((value) => value === value.trim());
const rank = z.object({ id, rank: z.number().finite(), score: z.number().finite() });
const providerConnection = z.object({ providerId: z.string(), connectionLabel: z.string(), model: z.string() });
const provider = z.object({ generation: providerConnection.optional(), embedding: providerConnection.optional(), rerank: providerConnection.optional() });
const evidence = z.object({
  id, title: z.string(), source: z.string(), location: z.string(), text: z.string(), tags: z.array(z.string()),
  sourceType: z.enum(['original', 'summary']), origin: z.enum(['builtin', 'user']).optional(),
  author: z.string().optional(), edition: z.string().optional(), bookId: z.string().optional(), pageImage: z.string().optional(),
  knowledgeKind: z.enum(['rule', 'case', 'doctrine']).optional(), topics: z.array(z.string()).optional(),
  retrieval: z.object({ lexicalScore: z.number(), vectorScore: z.number(), fusionScore: z.number(), rerankScore: z.number().nullable() }).optional(),
});
const retrievalMode = z.enum(['hybrid-reranked', 'hybrid-fused', 'lexical-fallback']);
const snapshot = z.object({
  capturedAt: timestamp, appVersion: z.string(), corpusVersion: z.string(), category: z.string(), evidence: z.array(evidence),
  retrieval: z.object({
    mode: retrievalMode, lexicalCandidates: z.number(), vectorCandidates: z.number(), fusedCandidates: z.number(),
    rerankedCandidates: z.number().optional(), selectedCandidates: z.number().optional(), serializedCharacters: z.number().optional(),
    vectorUsed: z.boolean(), rerankUsed: z.boolean(), stages: z.array(z.string()).optional(), warnings: z.array(z.string()),
    rankings: z.object({ bm25: z.array(rank), vector: z.array(rank), fusion: z.array(rank), rerank: z.array(rank), final: z.array(rank) }).optional(),
    corpusVersion: z.string().optional(),
  }),
});
const report = z.object({
  mode: z.literal('cloud'), analysisId: id.optional(), markdown: z.string(), generatedAt: timestamp,
  evidenceSnapshot: snapshot.optional(), provider: provider.optional(),
  pipeline: z.object({ retrievalMode, stages: z.array(z.string()), warnings: z.array(z.string()) }).optional(),
});
const messages = z.array(z.object({
  id, role: z.enum(['user', 'assistant']), kind: z.enum(['markdown-answer', 'system-notice']).optional(),
  content: z.string(), createdAt: timestamp, evidenceSnapshot: snapshot.optional(), provider: provider.optional(),
}));

/** Archives contain only session facts and text, never application settings or credentials. */
function archiveSession(input: unknown): DivinationSession {
  const safe = validateSessionForSave(sanitizeRendererSession(normalizeStoredSession(input)));
  if (safe.status === 'complete') {
    const source = safe.plate!;
    const replayed = buildPlate(safe.lines.map((line) => line.value), new Date(safe.castAt));
    if (source.castAt !== safe.castAt || source.baseHexagram.name !== replayed.baseHexagram.name
      || source.changedHexagram.name !== replayed.changedHexagram.name || source.lines.length !== 6
      || source.lines.some((line, index) => line.value !== safe.lines[index].value)) throw new Error('排盘与原始六爻记录不一致');
    safe.plate = { ...replayed, id: id.parse(source.id) };
  } else delete safe.plate;
  safe.messages = messages.parse(safe.messages);
  if (new Set(safe.messages.map((message) => message.id)).size !== safe.messages.length) throw new Error('追问记录标识重复');
  if (safe.analysis) safe.analysis = report.parse(safe.analysis);
  if (safe.generationDraft?.evidenceSnapshot) safe.generationDraft.evidenceSnapshot = snapshot.parse(safe.generationDraft.evidenceSnapshot);
  return safe;
}

function archiveSessions(input: unknown[]): DivinationSession[] {
  const ids = new Set<string>();
  return input.map((value, index) => {
    try {
      const session = archiveSession(value);
      if (ids.has(session.id)) throw new Error('记录标识重复');
      ids.add(session.id);
      return session;
    } catch (error) {
      const detail = error instanceof z.ZodError ? '解读或证据格式无效' : error instanceof Error ? error.message : '记录无效';
      throw new Error(`第 ${index + 1} 条记录无法恢复：${detail}。原占簿未作修改。`);
    }
  });
}

export function serializeSessionArchive(sessions: DivinationSession[]): string {
  if (!sessions.length) throw new Error('占簿中还没有可导出的记录。');
  if (sessions.length > 10000) throw new Error('单份备份最多支持 10000 条记录，请先筛选后分批导出。');
  const text = JSON.stringify({ format: 'wenyao-session-archive', version: 1, exportedAt: new Date().toISOString(), appVersion: packageInfo.version, sessions: archiveSessions(sessions) }, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_ARCHIVE_BYTES) throw new Error('备份超过 64 MB，请先筛选记录后分批导出。');
  return text;
}

export function parseSessionArchive(text: string): { sessions: DivinationSession[]; exportedAt: string } {
  if (new TextEncoder().encode(text).byteLength > MAX_ARCHIVE_BYTES) throw new Error('单份备份最多支持 64 MB，请使用分批备份。');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('备份不是有效的 JSON 文件，原占簿未作修改。'); }
  const envelope = z.object({ format: z.literal('wenyao-session-archive'), version: z.literal(1), exportedAt: timestamp, appVersion: z.string(), sessions: z.array(z.unknown()).min(1).max(10000) }).safeParse(parsed);
  if (!envelope.success) throw new Error('无法识别这份占簿备份，或备份版本暂不支持。请使用问爻导出的备份文件。');
  return { sessions: archiveSessions(envelope.data.sessions), exportedAt: envelope.data.exportedAt };
}

export function downloadSessionArchive(sessions: DivinationSession[]) {
  const text = serializeSessionArchive(sessions);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `问爻占簿-${formatShanghaiDateTimeInput(new Date()).slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
