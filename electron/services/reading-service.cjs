const crypto = require('node:crypto');

const domainPromise = import('../generated/domain/index.js');

const CATEGORY_TERMS = {
  career: ['事业', '功名', '官禄', '仕宦', '求名', '官鬼', '世爻', '父母'],
  wealth: ['财运', '求财', '买卖', '妻财', '子孙', '兄弟'],
  relationship: ['感情', '婚姻', '世爻', '应爻', '官鬼', '妻财'],
  health: ['健康', '疾病', '世爻', '官鬼', '子孙'],
  study: ['学业', '考试', '科举', '科甲', '求名', '父母', '官鬼', '世爻'],
  lost_item: ['寻物', '失物', '用神', '方位', '冲合'],
  travel: ['出行', '行人', '世爻', '应爻', '动爻'],
  other: ['世爻', '应爻', '日辰', '月建'],
};

const TRIGRAMS = {
  乾: { key: '乾', nature: '天', element: '金', symbol: '☰' },
  兑: { key: '兑', nature: '泽', element: '金', symbol: '☱' },
  离: { key: '离', nature: '火', element: '火', symbol: '☲' },
  震: { key: '震', nature: '雷', element: '木', symbol: '☳' },
  巽: { key: '巽', nature: '风', element: '木', symbol: '☴' },
  坎: { key: '坎', nature: '水', element: '水', symbol: '☵' },
  艮: { key: '艮', nature: '山', element: '土', symbol: '☶' },
  坤: { key: '坤', nature: '地', element: '土', symbol: '☷' },
};

const TOSS_FIELDS = {
  6: { faces: ['text', 'text', 'text'], label: '老阴', moving: true, baseYang: false, changedYang: true },
  7: { faces: ['text', 'text', 'reverse'], label: '少阳', moving: false, baseYang: true, changedYang: true },
  8: { faces: ['text', 'reverse', 'reverse'], label: '少阴', moving: false, baseYang: false, changedYang: false },
  9: { faces: ['reverse', 'reverse', 'reverse'], label: '老阳', moving: true, baseYang: true, changedYang: false },
};

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

function sideToLegacy(side) {
  const upper = TRIGRAMS[side?.upperTrigram] || { key: side?.upperTrigram || '', nature: '', element: side?.palaceElement || '', symbol: '' };
  const lower = TRIGRAMS[side?.lowerTrigram] || { key: side?.lowerTrigram || '', nature: '', element: side?.palaceElement || '', symbol: '' };
  return {
    name: side?.name || '',
    shortName: side?.shortName || side?.name || '',
    upper,
    lower,
    palace: side?.palace || '',
    palaceElement: side?.palaceElement || '',
    generation: side?.generation || '',
    shiLine: side?.shiLine || 0,
    yingLine: side?.yingLine || 0,
  };
}

function isLineSide(entity, lineId, side) {
  return entity?.type === 'line' && entity.id === lineId && entity.side === side;
}

function factForLine(caseSnapshot, lineId, side, relation, pillar) {
  return (caseSnapshot.facts || []).find((fact) => (
    fact?.relation === relation
    && (isLineSide(fact.source, lineId, side) || isLineSide(fact.target, lineId, side))
    && (!pillar || (
      (fact.source?.type === 'pillar' && fact.source.id === pillar)
      || (fact.target?.type === 'pillar' && fact.target.id === pillar)
    ))
  ));
}

function legacyPlateFromCase(caseSnapshot) {
  const plate = caseSnapshot.plate;
  const calendar = plate.calendar || {};
  const month = calendar.pillars?.month || {};
  const day = calendar.pillars?.day || {};
  const voidBranches = Array.isArray(day.voidBranches) ? [...day.voidBranches] : ['', ''];
  const lines = (plate.lines || []).map((line, zeroIndex) => {
    const toss = TOSS_FIELDS[line.tossValue] || TOSS_FIELDS[7];
    const beast = factForLine(caseSnapshot, line.id, 'base', 'is-six-beast');
    return {
      ...structuredClone(toss),
      value: line.tossValue,
      index: line.position || zeroIndex + 1,
      stem: line.base?.stem || '',
      branch: line.base?.branch || '',
      ganZhi: line.base?.ganZhi || '',
      element: line.base?.branchElement || '',
      relation: line.base?.relationToBasePalace || '',
      changedStem: line.changed?.stem || '',
      changedBranch: line.changed?.branch || '',
      changedGanZhi: line.changed?.ganZhi || '',
      changedElement: line.changed?.branchElement || '',
      changedRelation: line.changed?.relationToBasePalace || '',
      void: Boolean(factForLine(caseSnapshot, line.id, 'base', 'is-void')),
      monthBreak: Boolean(factForLine(caseSnapshot, line.id, 'base', 'is-month-break')),
      dayClash: Boolean(factForLine(caseSnapshot, line.id, 'base', 'clashes', 'day')),
      monthCombine: Boolean(factForLine(caseSnapshot, line.id, 'base', 'combines', 'month')),
      dayCombine: Boolean(factForLine(caseSnapshot, line.id, 'base', 'combines', 'day')),
      changedVoid: Boolean(factForLine(caseSnapshot, line.id, 'changed', 'is-void')),
      changedMonthBreak: Boolean(factForLine(caseSnapshot, line.id, 'changed', 'is-month-break')),
      changedDayClash: Boolean(factForLine(caseSnapshot, line.id, 'changed', 'clashes', 'day')),
      changedMonthCombine: Boolean(factForLine(caseSnapshot, line.id, 'changed', 'combines', 'month')),
      changedDayCombine: Boolean(factForLine(caseSnapshot, line.id, 'changed', 'combines', 'day')),
      role: line.base?.role || null,
      beast: beast?.values?.spirit || beast?.values?.sixSpirit || '',
    };
  });
  return {
    id: plate.id,
    castAt: plate.castAt,
    dayGanZhi: day.ganZhi || '',
    monthGanZhi: month.ganZhi || '',
    monthBranch: month.branch?.value || '',
    voidBranches,
    baseHexagram: sideToLegacy(plate.baseHexagram),
    changedHexagram: sideToLegacy(plate.changedHexagram),
    movingLines: [...(plate.movingLines || [])],
    lines,
  };
}

function termsForCase(caseSnapshot) {
  const terms = [
    ...(CATEGORY_TERMS[caseSnapshot.category] || CATEGORY_TERMS.other),
    caseSnapshot.plate?.baseHexagram?.shortName,
    caseSnapshot.plate?.changedHexagram?.shortName,
    ...(caseSnapshot.plate?.lines || []).flatMap((line) => [
      line.base?.relationToBasePalace,
      line.base?.role,
    ]),
  ];
  return [...new Set(terms.filter(nonEmptyString))];
}

function createReadingService({
  store,
  domain: injectedDomain,
  searchCorpus = async () => ({ evidence: [], diagnostics: null }),
  analyze: analyzePort,
  followUp: followUpPort,
  now = () => new Date(),
  createId = () => crypto.randomUUID(),
  hashPort = nodeHashPort(),
}) {
  if (!store || typeof store.getSession !== 'function') throw new TypeError('ReadingService Store 无效');
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
      const found = await searchCorpus({
        query: caseSnapshot.question,
        domainTerms: termsForCase(caseSnapshot),
        limit: 8,
      });
      const evidence = Array.isArray(found?.evidence) ? structuredClone(found.evidence) : [];
      const retrievalDiagnostics = found?.diagnostics ? structuredClone(found.diagnostics) : null;
      const current = store.getSession(sessionId);
      const currentCase = assertCurrentCase(current, expectedFactSetHash);
      if (isRecord(current.analysis)) {
        return {
          caseSnapshot: structuredClone(currentCase),
          runtimeTrust: current.caseRuntimeTrust || 'authoritative',
          report: structuredClone(current.analysis),
          evidence,
          retrievalDiagnostics,
        };
      }
      if (typeof analyzePort !== 'function') throw new Error('分析服务未配置');
      const legacyPlate = legacyPlateFromCase(caseSnapshot);
      const raw = await analyzePort({
        question: caseSnapshot.question,
        category: caseSnapshot.category,
        plate: legacyPlate,
        evidence,
        retrievalDiagnostics,
        caseSnapshot: structuredClone(caseSnapshot),
      });
      const report = isRecord(raw?.report) ? raw.report : raw;
      const saved = store.saveAuthoritativeAnalysis(sessionId, report, { expectedFactSetHash });
      return {
        caseSnapshot: structuredClone(saved.caseSnapshot),
        runtimeTrust: saved.caseRuntimeTrust || 'authoritative',
        report: structuredClone(saved.analysis),
        evidence,
        retrievalDiagnostics,
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
      const userMessage = {
        id: createId(),
        role: 'user',
        content: question,
        createdAt: nowIso(now),
      };
      const found = await searchCorpus({
        query: question,
        domainTerms: termsForCase(caseSnapshot),
        limit: 8,
      });
      const evidence = Array.isArray(found?.evidence) ? structuredClone(found.evidence) : [];
      if (typeof followUpPort !== 'function') throw new Error('追问服务未配置');
      const legacyPlate = legacyPlateFromCase(caseSnapshot);
      const raw = await followUpPort({
        question,
        session: { ...structuredClone(session), plate: legacyPlate },
        plate: legacyPlate,
        evidence,
        caseSnapshot: structuredClone(caseSnapshot),
      });
      const answer = isRecord(raw?.answer) ? raw.answer : raw;
      if (!isRecord(answer) || !nonEmptyString(answer.content)) throw new Error('追问服务没有返回有效回答');
      const allowedEvidence = new Set(evidence.map((entry) => entry.id));
      const evidenceIds = Array.isArray(answer.evidenceIds)
        ? answer.evidenceIds.filter((id) => typeof id === 'string' && allowedEvidence.has(id))
        : [];
      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: answer.content.trim(),
        evidenceIds,
        createdAt: nowIso(now),
      };
      const saved = store.appendAuthoritativeMessages(
        sessionId,
        [userMessage, assistantMessage],
        { expectedFactSetHash },
      );
      return {
        caseSnapshot: structuredClone(saved.caseSnapshot),
        runtimeTrust: saved.caseRuntimeTrust || 'authoritative',
        answer: { content: assistantMessage.content, evidenceIds },
        messages: [structuredClone(userMessage), structuredClone(assistantMessage)],
      };
    });
  }

  return { buildCase, selectIntent, analyze, followUp };
}

module.exports = {
  createReadingService,
  legacyPlateFromCase,
  nodeHashPort,
  normalizeClarification,
};
