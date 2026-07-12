import {
  buildDivinationCase,
  createAnalysisRetrievalContextV2,
  createFactContractV2,
  createLocalRawFollowUpV2,
  createLocalRawReportV2,
  DEFAULT_RULE_CONTEXT,
  deriveFollowUpContentV2,
  strictCanonicalStringify,
  validateAnalysisReportV2,
  validateFollowUpV2,
  type AnalysisReportV2,
  type DivinationCaseV2,
  type FactContractBundleV2,
  type UseGodClarificationPatch,
} from '../domain/liuyao/index';
import { browserSha256 } from './browserCrypto';
import {
  browserEvidenceCatalog,
  type BrowserEvidenceCatalog,
} from './browserEvidenceCatalog';
import { legacyPlateFromCase } from './casePresentation';
import {
  mergeClarificationWithProvenance,
  sanitizeClarificationPatch,
  type ReadingCaseEnvelope,
  type ReadingClient,
} from './readingClient';
import { searchEvidenceCandidates, type RetrievalDiagnosticsV2 } from './retrieval';
import type {
  AssistantChatMessageV2,
  DivinationSession,
  UserChatMessageV2,
} from './session';
import type { ValidatedAnalysisBundleV2, ValidatedFollowUpBundleV2 } from './types';

interface BrowserSessionsPort {
  get(id: string): Promise<DivinationSession | null>;
  save(session: DivinationSession): Promise<DivinationSession>;
}

export interface BrowserReadingAdapterPorts {
  sessions: BrowserSessionsPort;
  catalog?: BrowserEvidenceCatalog;
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
    id: session.id, question: session.question, category: session.category,
    castAt: session.castAt, status: session.status, tosses: session.tosses,
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
  if (!session.caseSnapshot || session.caseSnapshot.factSetHash !== expectedFactSetHash) throw new Error('权威 Case 已变化');
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

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rawFromValidated(report: AnalysisReportV2) {
  return {
    schemaVersion: report.schemaVersion,
    caseHash: report.caseHash,
    claims: report.claims,
    uncertainties: report.uncertainties,
  };
}

function assertCurrentDiagnostics(
  diagnostics: RetrievalDiagnosticsV2,
  contract: FactContractBundleV2,
  catalog: BrowserEvidenceCatalog,
): void {
  const context = createAnalysisRetrievalContextV2(contract.modelContract);
  if (!diagnostics || !sameStrings(diagnostics.requestedRuleIds, context.ruleIds)) throw new Error('检索诊断与当前 Case 不一致');
  const supported = new Set(catalog.entries.flatMap((entry) => entry.supportsRuleIds));
  const matched = context.ruleIds.filter((ruleId) => supported.has(ruleId));
  if (!sameStrings(diagnostics.matchedRuleIds, matched)) throw new Error('检索诊断与当前 catalog 不一致');
  if (matched.length && diagnostics.ruleCandidateIds.length === 0) throw new Error('检索诊断缺少规则候选');
  const byId = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  if (diagnostics.ruleCandidateIds.some((id) => !byId.get(id)?.supportsRuleIds.some((ruleId) => matched.includes(ruleId)))) {
    throw new Error('检索诊断规则候选无效');
  }
}

function coherentBundle(
  value: unknown,
  contract: FactContractBundleV2,
  catalog: BrowserEvidenceCatalog,
): ValidatedAnalysisBundleV2 | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const bundle = value as ValidatedAnalysisBundleV2;
    if (
      bundle.schemaVersion !== '2.0.0'
      || bundle.caseHash !== contract.modelContract.caseHash
      || bundle.report?.caseHash !== bundle.caseHash
      || bundle.corpusRef?.version !== catalog.corpusRef.version
      || bundle.corpusRef?.hash !== catalog.corpusRef.hash
      || !Array.isArray(bundle.canonicalEvidence)
    ) return null;
    assertCurrentDiagnostics(bundle.retrievalDiagnostics, contract, catalog);
    const hydrated = catalog.hydrate(
      bundle.canonicalEvidence.map((entry, index) => ({ id: entry.id, rank: index + 1 })),
      bundle.canonicalEvidence.length,
    ).evidence;
    if (strictCanonicalStringify(hydrated) !== strictCanonicalStringify(bundle.canonicalEvidence)) return null;
    const report = validateAnalysisReportV2(
      rawFromValidated(bundle.report), contract, hydrated, bundle.report.validation.validatedAt,
    );
    if (strictCanonicalStringify(report) !== strictCanonicalStringify(bundle.report)) return null;
    return structuredClone({ ...bundle, report, canonicalEvidence: hydrated });
  } catch {
    return null;
  }
}

function retrievalFor(
  catalog: BrowserEvidenceCatalog,
  contract: FactContractBundleV2,
  query: string,
) {
  const context = createAnalysisRetrievalContextV2(contract.modelContract);
  const found = searchEvidenceCandidates({
    entries: catalog.entries,
    query,
    domainTerms: context.queryTerms,
    ruleIds: context.ruleIds,
    limit: 8,
  });
  assertCurrentDiagnostics(found.diagnostics, contract, catalog);
  return {
    canonicalEvidence: catalog.hydrate(found.candidateRefs, 8).evidence,
    retrievalDiagnostics: found.diagnostics,
  };
}

export function createBrowserReadingAdapter({
  sessions,
  catalog = browserEvidenceCatalog,
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
}: BrowserReadingAdapterPorts): ReadingClient {
  const tails = new Map<string, Promise<unknown>>();

  function serialize<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(sessionId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    tails.set(sessionId, current);
    return current.finally(() => { if (tails.get(sessionId) === current) tails.delete(sessionId); });
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
      sessionId: session.id, plateId: `plate:${session.id}:v2`, question: session.question,
      category: session.category, explicitIntentId: clarification?.explicitIntentId ?? null,
      ...(clarification?.subjectRelation ? { subjectRelation: clarification.subjectRelation } : {}),
      ...(clarification?.explicitTarget ? { explicitTarget: clarification.explicitTarget } : {}),
      castAt: session.castAt, builtAt,
      tossValues: session.tosses.map((toss) => toss.value) as unknown as DivinationCaseV2['plate']['rawTosses'],
      ruleContext: session.ruleContext ?? DEFAULT_RULE_CONTEXT,
    }, { sha256: browserSha256 });
    const current = await sessions.get(session.id);
    if (!current || interactionFingerprint(current) !== fingerprint) throw new Error('会话交互状态已变化');
    if (expectedFactSetHash && current.caseSnapshot?.factSetHash !== expectedFactSetHash) throw new Error('权威 Case 已变化');
    const sameCase = current.caseSnapshot?.factSetHash === caseSnapshot.factSetHash;
    const next: DivinationSession = {
      ...current, caseSnapshot, ruleContext: caseSnapshot.ruleContext,
      migrationVersion: 2, migrationState: 'clean', caseRuntimeTrust: 'browser-preview',
      plate: legacyPlateFromCase(caseSnapshot), messages: sameCase ? (current.messages ?? []) : [], updatedAt: builtAt,
    };
    if (!sameCase) {
      delete next.analysisBundle;
      delete next.analysis;
    }
    await sessions.save(next);
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
        return buildAndSave(session!, mergeClarificationWithProvenance(provenance(currentCase), clarification), payload.expectedFactSetHash);
      });
    },
    analyze(payload) {
      return serialize(payload.sessionId, async () => {
        const session = await sessions.get(payload.sessionId);
        const caseSnapshot = assertCase(session, payload.expectedFactSetHash);
        const contract = createFactContractV2(caseSnapshot);
        const cached = coherentBundle(session!.analysisBundle, contract, catalog);
        if (cached) {
          const latest = await sessions.get(payload.sessionId);
          assertCase(latest, payload.expectedFactSetHash);
          const latestCached = coherentBundle(latest!.analysisBundle, contract, catalog);
          if (!latestCached) throw new Error('预览分析缓存状态已变化');
          return { caseSnapshot: latest!.caseSnapshot!, runtimeTrust: 'browser-preview', analysisBundle: latestCached };
        }
        const { canonicalEvidence, retrievalDiagnostics } = retrievalFor(catalog, contract, caseSnapshot.question);
        const report = validateAnalysisReportV2(
          createLocalRawReportV2(contract, canonicalEvidence), contract, canonicalEvidence, isoNow(now),
        );
        const analysisBundle: ValidatedAnalysisBundleV2 = {
          schemaVersion: '2.0.0', caseHash: caseSnapshot.factSetHash, analysisOrigin: 'local',
          report, canonicalEvidence, retrievalDiagnostics, corpusRef: catalog.corpusRef,
        };
        const current = await sessions.get(payload.sessionId);
        assertCase(current, payload.expectedFactSetHash);
        const next: DivinationSession = {
          ...current!, analysisBundle: structuredClone(analysisBundle), caseRuntimeTrust: 'browser-preview',
          updatedAt: report.validation.validatedAt,
        };
        delete next.analysis;
        const saved = await sessions.save(next);
        return { caseSnapshot: saved.caseSnapshot!, runtimeTrust: 'browser-preview', analysisBundle };
      });
    },
    followUp(payload) {
      return serialize(payload.sessionId, async () => {
        const question = payload.question.trim();
        if (!question || question.length > 500) throw new Error('追问内容无效');
        const session = await sessions.get(payload.sessionId);
        const caseSnapshot = assertCase(session, payload.expectedFactSetHash);
        const contract = createFactContractV2(caseSnapshot);
        if (!coherentBundle(session!.analysisBundle, contract, catalog)) throw new Error('当前会话缺少 coherent analysisBundle，请先重新分析后再追问');
        const { canonicalEvidence, retrievalDiagnostics } = retrievalFor(catalog, contract, question);
        const createdAt = isoNow(now);
        const followUp = validateFollowUpV2(
          createLocalRawFollowUpV2(contract), contract, canonicalEvidence, createdAt,
        );
        const followUpBundle: ValidatedFollowUpBundleV2 = {
          schemaVersion: '2.0.0', caseHash: caseSnapshot.factSetHash, analysisOrigin: 'local',
          followUp, canonicalEvidence, retrievalDiagnostics, corpusRef: catalog.corpusRef,
        };
        const userMessage: UserChatMessageV2 = {
          schemaVersion: '2.0.0', id: createId(), role: 'user', content: question,
          caseHash: caseSnapshot.factSetHash, createdAt,
        };
        const assistantMessage: AssistantChatMessageV2 = {
          schemaVersion: '2.0.0', id: createId(), role: 'assistant',
          content: deriveFollowUpContentV2(followUp), caseHash: caseSnapshot.factSetHash,
          followUpBundle, createdAt,
        };
        const current = await sessions.get(payload.sessionId);
        assertCase(current, payload.expectedFactSetHash);
        if (!coherentBundle(current!.analysisBundle, contract, catalog)) throw new Error('预览分析缓存状态已变化');
        await sessions.save({
          ...current!, messages: [...(current!.messages ?? []), userMessage, assistantMessage],
          caseRuntimeTrust: 'browser-preview', updatedAt: createdAt,
        });
        return {
          caseSnapshot, runtimeTrust: 'browser-preview', followUpBundle,
          messages: [userMessage, assistantMessage] as const,
        };
      });
    },
  };
}
