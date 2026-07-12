import {
  buildDivinationCase,
  DEFAULT_RULE_CONTEXT,
  type DivinationCaseV2,
  type UseGodClarificationPatch,
} from '../domain/liuyao/index';
import corpusJson from '../../resources/corpus.json';
import { legacyPlateFromCase } from './casePresentation';
import { createBrowserLocalReport } from './localAnalysis';
import {
  mergeClarificationWithProvenance,
  sanitizeClarificationPatch,
  type ReadingClient,
  type ReadingCaseEnvelope,
} from './readingClient';
import { searchEvidence, type EvidenceEntry, type RetrievalDiagnostics } from './retrieval';
import type { ChatMessage, DivinationSession } from './session';

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const CATEGORY_TERMS: Record<string, string[]> = {
  career: ['事业', '功名', '官鬼', '世爻', '父母'],
  wealth: ['财运', '求财', '妻财', '子孙', '兄弟'],
  relationship: ['感情', '婚姻', '世爻', '应爻', '官鬼', '妻财'],
  health: ['健康', '疾病', '世爻', '官鬼', '子孙'],
  study: ['学业', '考试', '父母', '官鬼', '世爻'],
  lost_item: ['寻物', '失物', '用神', '方位', '冲合'],
  travel: ['出行', '行人', '世爻', '应爻', '动爻'],
  other: ['世爻', '应爻', '日辰', '月建'],
};

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

export function browserSha256(value: string): string {
  const input = new TextEncoder().encode(value);
  const byteLength = Math.ceil((input.length + 9) / 64) * 64;
  const bytes = new Uint8Array(byteLength);
  bytes.set(input);
  bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer);
  const bitLength = input.length * 8;
  view.setUint32(byteLength - 8, Math.floor(bitLength / 0x1_0000_0000), false);
  view.setUint32(byteLength - 4, bitLength >>> 0, false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const before15 = words[index - 15];
      const before2 = words[index - 2];
      const sigma0 = rotateRight(before15, 7) ^ rotateRight(before15, 18) ^ (before15 >>> 3);
      const sigma1 = rotateRight(before2, 17) ^ rotateRight(before2, 19) ^ (before2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return [...hash].map((word) => word.toString(16).padStart(8, '0')).join('');
}

interface BrowserSessionsPort {
  get(id: string): Promise<DivinationSession | null>;
  save(session: DivinationSession): Promise<DivinationSession>;
}

export interface BrowserReadingAdapterPorts {
  sessions: BrowserSessionsPort;
  corpus?: readonly EvidenceEntry[];
  now?: () => Date;
  createId?: () => string;
}

function isoNow(now: () => Date): string {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError('浏览器预览时钟无效');
  return value.toISOString();
}

function interactionFingerprint(session: DivinationSession): string {
  return browserSha256(JSON.stringify({
    id: session.id,
    question: session.question,
    category: session.category,
    castAt: session.castAt,
    status: session.status,
    tosses: session.tosses,
    currentToss: session.currentToss ?? null,
  }));
}

function assertBuildable(session: DivinationSession | null): asserts session is DivinationSession {
  if (!session) throw new Error('会话不存在');
  if (session.migrationState === 'needs-review') throw new Error('该会话需要人工复核');
  if (session.status !== 'complete' || session.tosses.length !== 6) throw new Error('会话尚未完成六次投币');
}

function assertCase(session: DivinationSession | null, expectedFactSetHash: string): DivinationCaseV2 {
  if (!session) throw new Error('会话不存在');
  if (session.migrationState === 'needs-review') throw new Error('该会话需要人工复核');
  if (!session.caseSnapshot || session.caseSnapshot.factSetHash !== expectedFactSetHash) {
    throw new Error('权威 Case 已变化');
  }
  return session.caseSnapshot;
}

function provenance(caseSnapshot: DivinationCaseV2): UseGodClarificationPatch {
  const intent = caseSnapshot.useGod.intent;
  if (!intent) return {};
  return {
    explicitIntentId: intent.id,
    ...(intent.subjectRelation ? { subjectRelation: intent.subjectRelation } : {}),
    ...(intent.explicitTarget ? { explicitTarget: structuredClone(intent.explicitTarget) } : {}),
  };
}

function termsFor(caseSnapshot: DivinationCaseV2): string[] {
  return [...new Set([
    ...(CATEGORY_TERMS[caseSnapshot.category] ?? CATEGORY_TERMS.other),
    caseSnapshot.plate.baseHexagram.shortName,
    caseSnapshot.plate.changedHexagram.shortName,
    ...caseSnapshot.plate.lines.flatMap((line) => [line.base.relationToBasePalace, line.base.role ?? '']),
  ].filter(Boolean))];
}

export function createBrowserReadingAdapter({
  sessions,
  corpus = corpusJson as EvidenceEntry[],
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
}: BrowserReadingAdapterPorts): ReadingClient {
  const tails = new Map<string, Promise<unknown>>();

  function serialize<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    tails.set(sessionId, current);
    return current.finally(() => {
      if (tails.get(sessionId) === current) tails.delete(sessionId);
    });
  }

  async function buildAndSave(
    session: DivinationSession,
    clarification: UseGodClarificationPatch | undefined,
    expectedFactSetHash?: string,
  ): Promise<ReadingCaseEnvelope> {
    assertBuildable(session);
    const fingerprint = interactionFingerprint(session);
    const builtAt = isoNow(now);
    const caseSnapshot = buildDivinationCase({
      sessionId: session.id,
      plateId: `plate:${session.id}:v2`,
      question: session.question,
      category: session.category,
      explicitIntentId: clarification?.explicitIntentId ?? null,
      ...(clarification?.subjectRelation ? { subjectRelation: clarification.subjectRelation } : {}),
      ...(clarification?.explicitTarget ? { explicitTarget: clarification.explicitTarget } : {}),
      castAt: session.castAt,
      builtAt,
      tossValues: session.tosses.map((toss) => toss.value) as unknown as DivinationCaseV2['plate']['rawTosses'],
      ruleContext: session.ruleContext ?? DEFAULT_RULE_CONTEXT,
    }, { sha256: browserSha256 });
    const current = await sessions.get(session.id);
    if (!current || interactionFingerprint(current) !== fingerprint) throw new Error('会话交互状态已变化');
    if (expectedFactSetHash && current.caseSnapshot?.factSetHash !== expectedFactSetHash) {
      throw new Error('权威 Case 已变化');
    }
    await sessions.save({
      ...current,
      caseSnapshot,
      ruleContext: caseSnapshot.ruleContext,
      migrationVersion: 2,
      migrationState: 'clean',
      caseRuntimeTrust: 'browser-preview',
      plate: legacyPlateFromCase(caseSnapshot),
      analysis: current.caseSnapshot?.factSetHash === caseSnapshot.factSetHash ? current.analysis : undefined,
      updatedAt: builtAt,
    });
    return { caseSnapshot, runtimeTrust: 'browser-preview' };
  }

  return {
    buildCase(payload) {
      return serialize(payload.sessionId, async () => {
        const session = await sessions.get(payload.sessionId);
        assertBuildable(session);
        const clarification = sanitizeClarificationPatch(payload.clarification);
        if (session.caseSnapshot) {
          if (clarification) throw new Error('已有预览 Case 必须通过 selectIntent 提交澄清');
          return { caseSnapshot: session.caseSnapshot, runtimeTrust: 'browser-preview' };
        }
        return buildAndSave(session, clarification);
      });
    },
    selectIntent(payload) {
      return serialize(payload.sessionId, async () => {
        const session = await sessions.get(payload.sessionId);
        const currentCase = assertCase(session, payload.expectedFactSetHash);
        const clarification = sanitizeClarificationPatch(payload.clarification);
        if (!clarification) throw new Error('selectIntent 必须提交结构化澄清');
        return buildAndSave(
          session!,
          mergeClarificationWithProvenance(provenance(currentCase), clarification),
          payload.expectedFactSetHash,
        );
      });
    },
    analyze(payload) {
      return serialize(payload.sessionId, async () => {
        const session = await sessions.get(payload.sessionId);
        const caseSnapshot = assertCase(session, payload.expectedFactSetHash);
        const evidence = searchEvidence(corpus, caseSnapshot.question, termsFor(caseSnapshot), 8);
        const retrievalDiagnostics: RetrievalDiagnostics = {
          mode: 'lexical-fallback',
          lexicalCandidates: evidence.length,
          vectorCandidates: 0,
          fusedCandidates: evidence.length,
          vectorUsed: false,
          rerankUsed: false,
          warnings: ['浏览器预览仅使用关键词检索。'],
        };
        if (session!.analysis) {
          const current = await sessions.get(payload.sessionId);
          const currentCase = assertCase(current, payload.expectedFactSetHash);
          return {
            caseSnapshot: currentCase,
            runtimeTrust: 'browser-preview',
            report: structuredClone(current!.analysis!),
            evidence,
            retrievalDiagnostics,
          };
        }
        const report = {
          ...createBrowserLocalReport({
            ...session!,
            plate: legacyPlateFromCase(caseSnapshot),
          }, evidence),
          generatedAt: isoNow(now),
        };
        const current = await sessions.get(payload.sessionId);
        assertCase(current, payload.expectedFactSetHash);
        const saved = await sessions.save({
          ...current!,
          analysis: report,
          caseRuntimeTrust: 'browser-preview',
          updatedAt: report.generatedAt,
        });
        return {
          caseSnapshot: saved.caseSnapshot!,
          runtimeTrust: 'browser-preview',
          report,
          evidence,
          retrievalDiagnostics,
        };
      });
    },
    followUp(payload) {
      return serialize(payload.sessionId, async () => {
        const question = payload.question.trim();
        if (!question || question.length > 500) throw new Error('追问内容无效');
        const session = await sessions.get(payload.sessionId);
        const caseSnapshot = assertCase(session, payload.expectedFactSetHash);
        const createdAt = isoNow(now);
        const userMessage: ChatMessage = {
          id: createId(), role: 'user', content: question, createdAt,
        };
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: 'assistant',
          content: '浏览器预览不会发送 AI 请求；桌面应用会沿用本次权威排盘和古籍证据继续回答。',
          evidenceIds: [],
          createdAt: isoNow(now),
        };
        const current = await sessions.get(payload.sessionId);
        assertCase(current, payload.expectedFactSetHash);
        await sessions.save({
          ...current!,
          messages: [...(current!.messages ?? []), userMessage, assistantMessage],
          caseRuntimeTrust: 'browser-preview',
          updatedAt: assistantMessage.createdAt,
        });
        return {
          caseSnapshot,
          runtimeTrust: 'browser-preview',
          answer: { content: assistantMessage.content, evidenceIds: [] },
          messages: [userMessage, assistantMessage],
        };
      });
    },
  };
}
