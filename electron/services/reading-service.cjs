const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const {
  assertAuthoritativeFollowUpPairV2,
  assertValidatedAnalysisBundleV2,
  assertValidatedFollowUpBundleV2,
} = require('./bundle-v2.cjs');

const domainPromise = import('../generated/domain/index.js');

function nodeHashPort() {
  return {
    sha256(value) {
      return crypto.createHash('sha256').update(value).digest('hex');
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nowIso(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('ReadingService 时钟无效');
  return date.toISOString();
}

function normalizeEntity(entity) {
  if (!isRecord(entity) || typeof entity.type !== 'string' || !nonEmptyString(entity.id)) return undefined;
  if (entity.type === 'line' && ['base', 'changed'].includes(entity.side)) {
    return { type: 'line', id: entity.id, side: entity.side };
  }
  if (entity.type === 'hidden-spirit') return { type: 'hidden-spirit', id: entity.id };
  return undefined;
}

function normalizeExplicitTarget(value) {
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
  if (value.kind === 'six-relation' && typeof value.relation === 'string') {
    return { kind: 'six-relation', relation: value.relation };
  }
  if (value.kind === 'role' && ['世', '应'].includes(value.role)) {
    return { kind: 'role', role: value.role };
  }
  if (value.kind === 'shi-ying-pair') return { kind: 'shi-ying-pair' };
  if (value.kind === 'explicit-entity') {
    const entity = normalizeEntity(value.entity);
    return entity ? { kind: 'explicit-entity', entity } : undefined;
  }
  return undefined;
}

function normalizeClarification(value) {
  if (!isRecord(value)) return undefined;
  const patch = {};
  if (typeof value.explicitIntentId === 'string') patch.explicitIntentId = value.explicitIntentId;
  if (typeof value.subjectRelation === 'string') patch.subjectRelation = value.subjectRelation;
  if (Object.hasOwn(value, 'explicitTarget')) {
    const explicitTarget = normalizeExplicitTarget(value.explicitTarget);
    if (explicitTarget) patch.explicitTarget = explicitTarget;
  }
  return Object.keys(patch).length ? patch : undefined;
}

function authoritativeIntentProvenance(caseSnapshot) {
  const intent = caseSnapshot?.useGod?.intent;
  if (!isRecord(intent) || !nonEmptyString(intent.id)) return {};
  return {
    explicitIntentId: intent.id,
    ...(typeof intent.subjectRelation === 'string'
      ? { subjectRelation: intent.subjectRelation }
      : {}),
    ...(isRecord(intent.explicitTarget)
      ? { explicitTarget: structuredClone(intent.explicitTarget) }
      : {}),
  };
}

function assertBuildableSession(session) {
  if (!session) throw new Error('会话不存在');
  if (session.migrationState === 'needs-review') throw new Error('该会话需要人工复核，不能进入正常排盘流程');
  if (session.status !== 'complete' || !Array.isArray(session.tosses) || session.tosses.length !== 6) {
    throw new Error('会话尚未完成六次投币');
  }
  const tossValues = session.tosses.map((toss) => toss?.value);
  if (tossValues.some((value) => ![6, 7, 8, 9].includes(value))) {
    throw new Error('会话投币数据无效');
  }
  return tossValues;
}

function assertCurrentCase(session, expectedFactSetHash) {
  if (!session) throw new Error('会话不存在');
  if (session.migrationState === 'needs-review') throw new Error('该会话需要人工复核');
  if (!isRecord(session.caseSnapshot)) throw new Error('权威 Case 不存在');
  if (!nonEmptyString(expectedFactSetHash) || session.caseSnapshot.factSetHash !== expectedFactSetHash) {
    throw new Error('权威 Case 已变化');
  }
  return session.caseSnapshot;
}

function assertCatalog(value) {
  if (
    !isRecord(value)
    || !Array.isArray(value.entries)
    || !isRecord(value.corpusRef)
    || typeof value.hydrate !== 'function'
  ) throw new TypeError('ReadingService evidenceCatalog 无效');
  return value;
}

function rawFromValidated(validated) {
  return {
    schemaVersion: validated.schemaVersion,
    caseHash: validated.caseHash,
    claims: structuredClone(validated.claims),
    uncertainties: structuredClone(validated.uncertainties),
  };
}

function exactProviderResult(value, expectedOrigin = 'cloud') {
  if (!isRecord(value)) throw new TypeError('原始报告 provider 返回无效');
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== 2
    || !Object.hasOwn(value, 'raw')
    || !Object.hasOwn(value, 'analysisOrigin')
    || keys.some((key) => typeof key !== 'string' || !['raw', 'analysisOrigin'].includes(key))
    || value.analysisOrigin !== expectedOrigin
  ) throw new TypeError('原始报告 provider 必须只返回 raw 与 analysisOrigin');
  return value;
}

function createReadingService({
  store,
  domain: injectedDomain,
  reportV2: injectedReportV2,
  evidenceCatalog: injectedEvidenceCatalog,
  searchCorpus,
  cloudProviderConfigured = () => false,
  analyzeCloudV2,
  followUpCloudV2,
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
  hashPort = nodeHashPort(),
}) {
  if (!store || typeof store.getSession !== 'function') throw new TypeError('ReadingService Store 无效');
  if (typeof searchCorpus !== 'function') throw new TypeError('ReadingService searchCorpus 无效');
  const evidenceCatalog = assertCatalog(injectedEvidenceCatalog);
  if (typeof cloudProviderConfigured !== 'function' && typeof cloudProviderConfigured !== 'boolean') {
    throw new TypeError('ReadingService cloudProviderConfigured 无效');
  }
  const sessionTails = new Map();

  function serializeSession(sessionId, task) {
    const previous = sessionTails.get(sessionId) || Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    sessionTails.set(sessionId, current);
    return current.finally(() => {
      if (sessionTails.get(sessionId) === current) sessionTails.delete(sessionId);
    });
  }

  async function resolveDomain() {
    return injectedDomain ? Promise.resolve(injectedDomain) : domainPromise;
  }

  async function resolveReportV2() {
    return injectedReportV2 ? Promise.resolve(injectedReportV2) : resolveDomain();
  }

  function analysisBundleOptions(domain, caseHash) {
    if (typeof domain.normalizeValidatedAnalysisReportV2 !== 'function') {
      throw new Error('ReadingService 缺少同步 normalizeValidatedAnalysisReportV2');
    }
    return {
      expectedCaseHash: caseHash,
      expectedCorpusRef: evidenceCatalog.corpusRef,
      normalizeValidatedAnalysisReportV2: domain.normalizeValidatedAnalysisReportV2,
    };
  }

  function followUpBundleOptions(domain, caseHash) {
    if (
      typeof domain.normalizeValidatedFollowUpV2 !== 'function'
      || typeof domain.deriveFollowUpContentV2 !== 'function'
    ) throw new Error('ReadingService 缺少同步 follow-up normalize/derive helper');
    return {
      expectedCaseHash: caseHash,
      expectedCorpusRef: evidenceCatalog.corpusRef,
      normalizeValidatedFollowUpV2: domain.normalizeValidatedFollowUpV2,
    };
  }

  function hydratePersistedEvidence(canonicalEvidence) {
    const candidateRefs = canonicalEvidence.map((entry, index) => ({ id: entry.id, rank: index + 1 }));
    const hydrated = evidenceCatalog.hydrate(candidateRefs, candidateRefs.length);
    if (
      hydrated.corpusRef.version !== evidenceCatalog.corpusRef.version
      || hydrated.corpusRef.hash !== evidenceCatalog.corpusRef.hash
      || !isDeepStrictEqual(hydrated.evidence, canonicalEvidence)
    ) throw new Error('持久化证据与当前 canonical catalog 不一致');
    return hydrated.evidence;
  }

  async function retrievalContextFor(contract, reportV2) {
    if (typeof reportV2.createAnalysisRetrievalContextV2 !== 'function') {
      throw new Error('ReadingService 缺少 createAnalysisRetrievalContextV2');
    }
    return Promise.resolve(
      reportV2.createAnalysisRetrievalContextV2(contract.modelContract),
    );
  }

  async function assertCurrentRequestedRuleIds(retrievalDiagnostics, contract, reportV2) {
    const context = await retrievalContextFor(contract, reportV2);
    if (!isDeepStrictEqual(retrievalDiagnostics.requestedRuleIds, context.ruleIds)) {
      throw new Error('retrievalDiagnostics.requestedRuleIds 与当前 Case 规则上下文不一致');
    }
    return context;
  }

  async function coherentAnalysisBundle(value, contract, domain, reportV2) {
    const outer = assertValidatedAnalysisBundleV2(
      value,
      analysisBundleOptions(domain, contract.modelContract.caseHash),
    );
    await assertCurrentRequestedRuleIds(outer.retrievalDiagnostics, contract, reportV2);
    const canonicalEvidence = hydratePersistedEvidence(outer.canonicalEvidence);
    if (typeof reportV2.validateAnalysisReportV2 !== 'function') {
      throw new Error('ReadingService 缺少 validateAnalysisReportV2');
    }
    const revalidated = await Promise.resolve(reportV2.validateAnalysisReportV2(
      rawFromValidated(outer.report),
      contract,
      canonicalEvidence,
      outer.report.validation.validatedAt,
    ));
    if (!isDeepStrictEqual(revalidated, outer.report)) {
      throw new Error('缓存报告未通过当前 Case 语义复验');
    }
    return assertValidatedAnalysisBundleV2({
      ...outer,
      report: revalidated,
      canonicalEvidence: [...canonicalEvidence],
    }, analysisBundleOptions(domain, contract.modelContract.caseHash));
  }

  async function maybeCoherentAnalysisBundle(value, contract, domain, reportV2) {
    try {
      if (!isRecord(value)) return null;
      return await coherentAnalysisBundle(value, contract, domain, reportV2);
    } catch {
      return null;
    }
  }

  async function coherentFollowUpBundle(value, contract, domain, reportV2) {
    const outer = assertValidatedFollowUpBundleV2(
      value,
      followUpBundleOptions(domain, contract.modelContract.caseHash),
    );
    await assertCurrentRequestedRuleIds(outer.retrievalDiagnostics, contract, reportV2);
    const canonicalEvidence = hydratePersistedEvidence(outer.canonicalEvidence);
    if (typeof reportV2.validateFollowUpV2 !== 'function') {
      throw new Error('ReadingService 缺少 validateFollowUpV2');
    }
    const revalidated = await Promise.resolve(reportV2.validateFollowUpV2(
      rawFromValidated(outer.followUp),
      contract,
      canonicalEvidence,
      outer.followUp.validation.validatedAt,
    ));
    if (!isDeepStrictEqual(revalidated, outer.followUp)) {
      throw new Error('缓存追问未通过当前 Case 语义复验');
    }
    return assertValidatedFollowUpBundleV2({
      ...outer,
      followUp: revalidated,
      canonicalEvidence: [...canonicalEvidence],
    }, followUpBundleOptions(domain, contract.modelContract.caseHash));
  }

  async function currentV2History(messages, contract, domain, reportV2) {
    const history = [];
    const source = Array.isArray(messages) ? messages : [];
    for (let index = 0; index + 1 < source.length;) {
      const candidatePair = [source[index], source[index + 1]];
      try {
        const normalized = assertAuthoritativeFollowUpPairV2(candidatePair, {
          ...followUpBundleOptions(domain, contract.modelContract.caseHash),
          deriveFollowUpContentV2: domain.deriveFollowUpContentV2,
        });
        const coherent = await coherentFollowUpBundle(
          normalized[1].followUpBundle,
          contract,
          domain,
          reportV2,
        );
        if (!isDeepStrictEqual(coherent, normalized[1].followUpBundle)) {
          throw new Error('追问 bundle 不一致');
        }
        history.push(
          { role: 'user', content: normalized[0].content },
          { role: 'assistant', content: normalized[1].content },
        );
        index += 2;
      } catch {
        index += 1;
      }
    }
    return history;
  }

  async function retrievalFor(contract, query) {
    const reportV2 = await resolveReportV2();
    const context = await retrievalContextFor(contract, reportV2);
    const found = await searchCorpus({
      query,
      domainTerms: [...context.queryTerms],
      ruleIds: [...context.ruleIds],
      limit: 8,
    });
    if (!isRecord(found) || !isRecord(found.diagnostics)) {
      throw new Error('检索服务没有返回有效 diagnostics');
    }
    if (!isDeepStrictEqual(found.diagnostics.requestedRuleIds, context.ruleIds)) {
      throw new Error('检索 diagnostics 未精确回显当前请求 ruleIds');
    }
    const hydrated = evidenceCatalog.hydrate(found.candidateRefs, 8);
    return {
      canonicalEvidence: hydrated.evidence,
      retrievalDiagnostics: structuredClone(found.diagnostics),
    };
  }

  async function isCloudConfigured() {
    return Boolean(await Promise.resolve(
      typeof cloudProviderConfigured === 'function'
        ? cloudProviderConfigured()
        : cloudProviderConfigured,
    ));
  }

  async function responseSchemaFor(reportV2, kind) {
    const directKey = kind === 'analysis' ? 'REPORT_V2_SCHEMA' : 'FOLLOW_UP_V2_SCHEMA';
    const getterKey = kind === 'analysis' ? 'getReportV2Schema' : 'getFollowUpV2Schema';
    if (isRecord(reportV2[directKey])) return reportV2[directKey];
    if (typeof reportV2[getterKey] !== 'function') {
      throw new Error(`ReadingService 缺少 ${directKey}`);
    }
    const schema = await Promise.resolve(reportV2[getterKey]());
    if (!isRecord(schema)) throw new Error(`ReadingService ${directKey} 无效`);
    return schema;
  }

  async function buildAndPersist(session, clarification, expectedFactSetHash) {
    const tossValues = assertBuildableSession(session);
    const interaction = store.getInteractionFingerprint(session.id);
    const domain = await resolveDomain();
    const builtAt = nowIso(now);
    const caseSnapshot = await Promise.resolve(domain.buildDivinationCase({
      sessionId: session.id,
      plateId: `plate:${session.id}:v2`,
      question: session.question,
      category: session.category,
      explicitIntentId: clarification?.explicitIntentId ?? null,
      ...(Object.hasOwn(clarification || {}, 'subjectRelation')
        ? { subjectRelation: clarification.subjectRelation }
        : {}),
      ...(Object.hasOwn(clarification || {}, 'explicitTarget')
        ? { explicitTarget: clarification.explicitTarget }
        : {}),
      castAt: session.castAt,
      builtAt,
      tossValues,
      ruleContext: session.ruleContext || domain.DEFAULT_RULE_CONTEXT,
    }, hashPort));
    const saved = store.saveAuthoritativeCase(session.id, caseSnapshot, {
      expectedInteractionFingerprint: interaction,
      ...(expectedFactSetHash ? { expectedFactSetHash } : {}),
      runtimeTrust: 'authoritative',
    });
    return {
      caseSnapshot: structuredClone(saved.caseSnapshot),
      runtimeTrust: 'authoritative',
    };
  }

  function buildCase(payload = {}) {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
    const clarification = normalizeClarification(payload.clarification);
    return serializeSession(sessionId, async () => {
      const session = store.getSession(sessionId);
      if (!session) throw new Error('会话不存在');
      if (session.migrationState === 'needs-review') throw new Error('该会话需要人工复核，不能进入正常排盘流程');
      if (session.caseSnapshot) {
        if (clarification) throw new Error('已有权威 Case 必须通过 selectIntent 提交澄清');
        return {
          caseSnapshot: structuredClone(session.caseSnapshot),
          runtimeTrust: session.caseRuntimeTrust || 'authoritative',
        };
      }
      return buildAndPersist(session, clarification);
    });
  }

  function selectIntent(payload = {}) {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
    const clarification = normalizeClarification(payload.clarification);
    const expectedFactSetHash = typeof payload.expectedFactSetHash === 'string'
      ? payload.expectedFactSetHash
      : '';
    return serializeSession(sessionId, async () => {
      if (!clarification) throw new TypeError('selectIntent 必须提交结构化澄清');
      const session = store.getSession(sessionId);
      const currentCase = assertCurrentCase(session, expectedFactSetHash);
      const provenance = authoritativeIntentProvenance(currentCase);
      const intentChanged = nonEmptyString(clarification.explicitIntentId)
        && clarification.explicitIntentId !== provenance.explicitIntentId;
      const merged = { ...(intentChanged ? {} : provenance), ...clarification };
      return buildAndPersist(session, merged, expectedFactSetHash);
    });
  }

  function analyze(payload = {}) {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
    const expectedFactSetHash = typeof payload.expectedFactSetHash === 'string'
      ? payload.expectedFactSetHash
      : '';
    return serializeSession(sessionId, async () => {
      const session = store.getSession(sessionId);
      const caseSnapshot = assertCurrentCase(session, expectedFactSetHash);
      const [domain, reportV2] = await Promise.all([resolveDomain(), resolveReportV2()]);
      if (typeof reportV2.createFactContractV2 !== 'function') {
        throw new Error('ReadingService 缺少 createFactContractV2');
      }
      const contract = await Promise.resolve(reportV2.createFactContractV2(caseSnapshot));

      const cached = await maybeCoherentAnalysisBundle(
        session.analysisBundle,
        contract,
        domain,
        reportV2,
      );
      if (cached) {
        const latest = store.getSession(sessionId);
        const latestCase = assertCurrentCase(latest, expectedFactSetHash);
        const latestCached = await maybeCoherentAnalysisBundle(
          latest.analysisBundle,
          contract,
          domain,
          reportV2,
        );
        if (latestCached) {
          return {
            caseSnapshot: structuredClone(latestCase),
            runtimeTrust: latest.caseRuntimeTrust || 'authoritative',
            analysisBundle: latestCached,
          };
        }
      }

      const { canonicalEvidence, retrievalDiagnostics } = await retrievalFor(
        contract,
        contract.modelContract.question,
      );
      let providerResult;
      if (await isCloudConfigured()) {
        if (typeof analyzeCloudV2 !== 'function') throw new Error('云端分析 provider 未配置');
        providerResult = exactProviderResult(await analyzeCloudV2({
          modelContract: contract.modelContract,
          canonicalEvidence,
          responseSchema: await responseSchemaFor(reportV2, 'analysis'),
        }));
      } else {
        if (typeof reportV2.createLocalRawReportV2 !== 'function') {
          throw new Error('ReadingService 缺少 createLocalRawReportV2');
        }
        providerResult = {
          raw: await Promise.resolve(reportV2.createLocalRawReportV2(contract, canonicalEvidence)),
          analysisOrigin: 'local',
        };
      }
      if (typeof reportV2.validateAnalysisReportV2 !== 'function') {
        throw new Error('ReadingService 缺少 validateAnalysisReportV2');
      }
      const report = await Promise.resolve(reportV2.validateAnalysisReportV2(
        providerResult.raw,
        contract,
        canonicalEvidence,
        nowIso(now),
      ));
      const bundle = assertValidatedAnalysisBundleV2({
        schemaVersion: '2.0.0',
        caseHash: expectedFactSetHash,
        analysisOrigin: providerResult.analysisOrigin,
        report,
        canonicalEvidence: [...canonicalEvidence],
        retrievalDiagnostics,
        corpusRef: { ...evidenceCatalog.corpusRef },
      }, analysisBundleOptions(domain, expectedFactSetHash));
      const saved = store.saveAuthoritativeAnalysisBundle(sessionId, bundle, {
        expectedFactSetHash,
        expectedCorpusRef: evidenceCatalog.corpusRef,
      });
      return {
        caseSnapshot: structuredClone(saved.caseSnapshot),
        runtimeTrust: saved.caseRuntimeTrust || 'authoritative',
        analysisBundle: bundle,
      };
    });
  }

  function followUp(payload = {}) {
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : '';
    const question = typeof payload.question === 'string' ? payload.question.trim() : '';
    const expectedFactSetHash = typeof payload.expectedFactSetHash === 'string'
      ? payload.expectedFactSetHash
      : '';
    return serializeSession(sessionId, async () => {
      if (!question || question.length > 500) throw new TypeError('追问内容无效');
      const session = store.getSession(sessionId);
      const caseSnapshot = assertCurrentCase(session, expectedFactSetHash);
      const [domain, reportV2] = await Promise.all([resolveDomain(), resolveReportV2()]);
      const contract = await Promise.resolve(reportV2.createFactContractV2(caseSnapshot));
      const analysisBundle = await maybeCoherentAnalysisBundle(
        session.analysisBundle,
        contract,
        domain,
        reportV2,
      );
      if (!analysisBundle) {
        throw new Error('当前会话缺少 coherent analysisBundle，请先重新分析后再追问');
      }
      const history = await currentV2History(session.messages, contract, domain, reportV2);
      const { canonicalEvidence, retrievalDiagnostics } = await retrievalFor(contract, question);
      let providerResult;
      if (await isCloudConfigured()) {
        if (typeof followUpCloudV2 !== 'function') throw new Error('云端追问 provider 未配置');
        providerResult = exactProviderResult(await followUpCloudV2({
          question,
          modelContract: contract.modelContract,
          analysisReport: analysisBundle.report,
          canonicalEvidence,
          currentV2History: history,
          responseSchema: await responseSchemaFor(reportV2, 'follow-up'),
        }));
      } else {
        if (typeof reportV2.createLocalRawFollowUpV2 !== 'function') {
          throw new Error('ReadingService 缺少 createLocalRawFollowUpV2');
        }
        providerResult = {
          raw: await Promise.resolve(reportV2.createLocalRawFollowUpV2(contract)),
          analysisOrigin: 'local',
        };
      }
      const operationAt = nowIso(now);
      const followUpReport = await Promise.resolve(reportV2.validateFollowUpV2(
        providerResult.raw,
        contract,
        canonicalEvidence,
        operationAt,
      ));
      const followUpBundle = assertValidatedFollowUpBundleV2({
        schemaVersion: '2.0.0',
        caseHash: expectedFactSetHash,
        analysisOrigin: providerResult.analysisOrigin,
        followUp: followUpReport,
        canonicalEvidence: [...canonicalEvidence],
        retrievalDiagnostics,
        corpusRef: { ...evidenceCatalog.corpusRef },
      }, followUpBundleOptions(domain, expectedFactSetHash));
      const pair = assertAuthoritativeFollowUpPairV2([{
        schemaVersion: '2.0.0',
        id: createId(),
        role: 'user',
        content: question,
        caseHash: expectedFactSetHash,
        createdAt: operationAt,
      }, {
        schemaVersion: '2.0.0',
        id: createId(),
        role: 'assistant',
        content: domain.deriveFollowUpContentV2(followUpReport),
        caseHash: expectedFactSetHash,
        followUpBundle,
        createdAt: operationAt,
      }], {
        ...followUpBundleOptions(domain, expectedFactSetHash),
        deriveFollowUpContentV2: domain.deriveFollowUpContentV2,
      });
      const saved = store.appendAuthoritativeFollowUpPair(sessionId, pair, {
        expectedFactSetHash,
        expectedCorpusRef: evidenceCatalog.corpusRef,
      });
      return {
        caseSnapshot: structuredClone(saved.caseSnapshot),
        runtimeTrust: saved.caseRuntimeTrust || 'authoritative',
        followUpBundle,
        messages: pair,
      };
    });
  }

  return { buildCase, selectIntent, analyze, followUp };
}

module.exports = {
  createReadingService,
  nodeHashPort,
  normalizeClarification,
};
