const crypto = require('node:crypto');

const HASH_RE = /^[0-9a-f]{64}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/u;
const SECTIONS = new Set(['summary', 'use-god', 'calendar', 'moving', 'synthesis', 'guidance']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
const MODES = new Set(['hybrid-reranked', 'hybrid-fused', 'lexical-fallback']);
const ORIGINS = new Set(['local', 'cloud']);
const ANALYSIS_BUNDLE_KEYS = [
  'schemaVersion', 'caseHash', 'analysisOrigin', 'report', 'canonicalEvidence',
  'retrievalDiagnostics', 'corpusRef',
];
const FOLLOW_UP_BUNDLE_KEYS = [
  'schemaVersion', 'caseHash', 'analysisOrigin', 'followUp', 'canonicalEvidence',
  'retrievalDiagnostics', 'corpusRef',
];
const REPORT_KEYS = ['schemaVersion', 'caseHash', 'claims', 'uncertainties', 'validation'];
const CLAIM_KEYS = ['id', 'section', 'text', 'factIds', 'ruleIds', 'evidenceIds', 'confidence'];
const VALIDATION_KEYS = ['status', 'factCheckPassed', 'citationCheckPassed', 'validatedAt'];
const EVIDENCE_REQUIRED_KEYS = [
  'id', 'title', 'source', 'sourceType', 'location', 'text', 'contentHash',
  'tags', 'knowledgeKind', 'topics', 'supportsRuleIds',
];
const DIAGNOSTICS_KEYS = [
  'mode', 'lexicalCandidates', 'vectorCandidates', 'fusedCandidates', 'vectorUsed',
  'rerankUsed', 'requestedRuleIds', 'matchedRuleIds', 'ruleCandidateIds', 'ruleBoost',
  'warnings',
];
const USER_MESSAGE_KEYS = ['schemaVersion', 'id', 'role', 'content', 'caseHash', 'createdAt'];
const ASSISTANT_MESSAGE_KEYS = [
  'schemaVersion', 'id', 'role', 'content', 'caseHash', 'followUpBundle', 'createdAt',
];

function fail(message) {
  throw new TypeError(`V2 bundle 校验失败：${message}`);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function strictClone(value, label = '输入', ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${label} 含非有限数字`);
    return value;
  }
  if (typeof value !== 'object') fail(`${label} 含不可序列化值`);
  if (ancestors.has(value)) fail(`${label} 含循环引用`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) fail(`${label} 必须使用标准数组`);
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) fail(`${label} 不得为稀疏数组`);
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
          fail(`${label}[${index}] 必须是可枚举 data 字段`);
        }
      }
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key === 'symbol') fail(`${label} 不得含 symbol 字段`);
        if (key === 'length') continue;
        if (!/^(?:0|[1-9]\d*)$/u.test(key) || String(Number(key)) !== key) {
          fail(`${label} 含非规范索引或额外字段`);
        }
        const index = Number(key);
        if (!Number.isSafeInteger(index) || index < 0 || index >= value.length) {
          fail(`${label} 数组索引超出 length`);
        }
      }
      return value.map((entry, index) => strictClone(entry, `${label}[${index}]`, ancestors));
    }
    if (!isPlainRecord(value)) fail(`${label} 必须是普通对象`);
    const clone = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail(`${label} 不得含 symbol 字段`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) {
        fail(`${label}.${key} 不得使用访问器或非枚举字段`);
      }
      if (descriptor.value === undefined) fail(`${label}.${key} 不得为 undefined`);
      clone[key] = strictClone(descriptor.value, `${label}.${key}`, ancestors);
    }
    return clone;
  } finally {
    ancestors.delete(value);
  }
}

function assertExactKeys(value, required, optional = [], label = '对象') {
  if (!isPlainRecord(value)) fail(`${label} 必须是普通对象`);
  const allowed = new Set([...required, ...optional]);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) fail(`${label} 含额外字段`);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${label} 缺少 ${key}`);
  }
}

function assertString(value, label, maximum, { id = false } = {}) {
  if (typeof value !== 'string') fail(`${label} 必须是字符串`);
  if (!value || value !== value.trim()) fail(`${label} 必须是无首尾空白的非空字符串`);
  if (value.length > maximum) fail(`${label} 超过长度上限`);
  if (id && CONTROL_RE.test(value)) fail(`${label} 不得含控制字符`);
  return value;
}

function assertHash(value, label) {
  if (typeof value !== 'string' || !HASH_RE.test(value)) fail(`${label} 必须是小写 64 位十六进制`);
  return value;
}

function assertExactIso(value, label) {
  if (typeof value !== 'string') fail(`${label} 必须是字符串`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) fail(`${label} 必须是标准 UTC ISO 时间`);
  return value;
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} 必须是非负安全整数`);
  return value;
}

function assertStringArray(value, label, maximumItems, maximumLength = 256, { unique = true } = {}) {
  if (!Array.isArray(value)) fail(`${label} 必须是数组`);
  if (value.length > maximumItems) fail(`${label} 超过数量上限`);
  const result = value.map((entry, index) => assertString(entry, `${label}[${index}]`, maximumLength, { id: true }));
  if (unique && new Set(result).size !== result.length) fail(`${label} 不得重复`);
  return result;
}

function assertCorpusRefV2(value, label = 'corpusRef') {
  const owned = strictClone(value, label);
  assertExactKeys(owned, ['version', 'hash'], [], label);
  if (!Number.isSafeInteger(owned.version) || owned.version < 1) fail(`${label}.version 必须是正安全整数`);
  assertHash(owned.hash, `${label}.hash`);
  return owned;
}

function corpusRefsEqual(left, right) {
  return left.version === right.version && left.hash === right.hash;
}

function assertExpectedBoundary(options) {
  if (!isPlainRecord(options)) fail('校验选项必须是普通对象');
  assertExactKeys(options, ['expectedCaseHash', 'expectedCorpusRef'], [], '校验选项');
  const expectedCaseHash = assertHash(options.expectedCaseHash, 'expectedCaseHash');
  const expectedCorpusRef = assertCorpusRefV2(options.expectedCorpusRef, 'expectedCorpusRef');
  return { expectedCaseHash, expectedCorpusRef };
}

function assertClaim(value, index) {
  assertExactKeys(value, CLAIM_KEYS, [], `claims[${index}]`);
  const id = assertString(value.id, `claims[${index}].id`, 64, { id: true });
  if (!SECTIONS.has(value.section)) fail(`claims[${index}].section 无效`);
  const text = assertString(value.text, `claims[${index}].text`, 1200);
  if (!CONFIDENCE.has(value.confidence)) fail(`claims[${index}].confidence 无效`);
  return {
    id,
    section: value.section,
    text,
    factIds: assertStringArray(value.factIds, `claims[${index}].factIds`, 16),
    ruleIds: assertStringArray(value.ruleIds, `claims[${index}].ruleIds`, 16),
    evidenceIds: assertStringArray(value.evidenceIds, `claims[${index}].evidenceIds`, 8),
    confidence: value.confidence,
  };
}

function assertValidatedReport(value, { expectedCaseHash, followUp }) {
  assertExactKeys(value, REPORT_KEYS, [], followUp ? 'followUp' : 'report');
  if (value.schemaVersion !== '2.0.0') fail(`${followUp ? 'followUp' : 'report'}.schemaVersion 无效`);
  assertHash(value.caseHash, `${followUp ? 'followUp' : 'report'}.caseHash`);
  if (value.caseHash !== expectedCaseHash) fail(`${followUp ? 'followUp' : 'report'}.caseHash 与 bundle 不一致`);
  if (!Array.isArray(value.claims)) fail('claims 必须是数组');
  const minimum = followUp ? 1 : 6;
  const maximum = followUp ? 8 : 24;
  if (value.claims.length < minimum || value.claims.length > maximum) fail(`claims 数量必须为 ${minimum}–${maximum}`);
  const claims = value.claims.map(assertClaim);
  if (new Set(claims.map(({ id }) => id)).size !== claims.length) fail('claim ID 不得重复');
  if (!followUp) {
    for (const section of SECTIONS) {
      if (!claims.some((claim) => claim.section === section)) fail(`report 缺少 ${section} section`);
    }
  }
  const uncertainties = assertStringArray(value.uncertainties, 'uncertainties', 12, 500);
  assertExactKeys(value.validation, VALIDATION_KEYS, [], 'validation');
  if (
    value.validation.status !== 'validated'
    || value.validation.factCheckPassed !== true
    || value.validation.citationCheckPassed !== true
  ) fail('validation 必须由 validator 标记为 validated');
  const validation = {
    status: 'validated',
    factCheckPassed: true,
    citationCheckPassed: true,
    validatedAt: assertExactIso(value.validation.validatedAt, 'validation.validatedAt'),
  };
  return { schemaVersion: '2.0.0', caseHash: value.caseHash, claims, uncertainties, validation };
}

function assertEvidence(value, index) {
  assertExactKeys(value, EVIDENCE_REQUIRED_KEYS, ['pageImage'], `canonicalEvidence[${index}]`);
  const text = assertString(value.text, `canonicalEvidence[${index}].text`, 32_000);
  const contentHash = assertHash(value.contentHash, `canonicalEvidence[${index}].contentHash`);
  const actualHash = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  if (contentHash !== actualHash) fail(`canonicalEvidence[${index}].contentHash 与正文不一致`);
  if (!['original', 'summary'].includes(value.sourceType)) {
    fail(`canonicalEvidence[${index}].sourceType 无效`);
  }
  if (!['rule', 'case', 'doctrine'].includes(value.knowledgeKind)) {
    fail(`canonicalEvidence[${index}].knowledgeKind 无效`);
  }
  return {
    id: assertString(value.id, `canonicalEvidence[${index}].id`, 256, { id: true }),
    title: assertString(value.title, `canonicalEvidence[${index}].title`, 500),
    source: assertString(value.source, `canonicalEvidence[${index}].source`, 500),
    sourceType: assertString(value.sourceType, `canonicalEvidence[${index}].sourceType`, 100),
    location: assertString(value.location, `canonicalEvidence[${index}].location`, 500),
    text,
    contentHash,
    tags: assertStringArray(value.tags, `canonicalEvidence[${index}].tags`, 64),
    knowledgeKind: assertString(value.knowledgeKind, `canonicalEvidence[${index}].knowledgeKind`, 100),
    topics: assertStringArray(value.topics, `canonicalEvidence[${index}].topics`, 64),
    ...(Object.hasOwn(value, 'pageImage')
      ? { pageImage: assertString(value.pageImage, `canonicalEvidence[${index}].pageImage`, 2000) }
      : {}),
    supportsRuleIds: assertStringArray(
      value.supportsRuleIds, `canonicalEvidence[${index}].supportsRuleIds`, 256,
    ),
  };
}

function assertDiagnostics(value, evidenceById) {
  assertExactKeys(value, DIAGNOSTICS_KEYS, [], 'retrievalDiagnostics');
  if (!MODES.has(value.mode)) fail('retrievalDiagnostics.mode 无效');
  if (typeof value.vectorUsed !== 'boolean' || typeof value.rerankUsed !== 'boolean') {
    fail('retrievalDiagnostics vectorUsed/rerankUsed 必须是 boolean');
  }
  if (value.mode === 'hybrid-reranked' && !value.rerankUsed) fail('hybrid-reranked 必须标记 rerankUsed');
  if (value.mode === 'hybrid-fused' && (!value.vectorUsed || value.rerankUsed)) fail('hybrid-fused 标记不一致');
  if (value.mode === 'lexical-fallback' && (value.vectorUsed || value.rerankUsed)) fail('lexical-fallback 标记不一致');
  const requestedRuleIds = assertStringArray(value.requestedRuleIds, 'retrievalDiagnostics.requestedRuleIds', 2048);
  const matchedRuleIds = assertStringArray(value.matchedRuleIds, 'retrievalDiagnostics.matchedRuleIds', 2048);
  if (matchedRuleIds.some((ruleId) => !requestedRuleIds.includes(ruleId))) {
    fail('retrievalDiagnostics.matchedRuleIds 必须属于 requestedRuleIds');
  }
  const ruleCandidateIds = assertStringArray(value.ruleCandidateIds, 'retrievalDiagnostics.ruleCandidateIds', 100);
  if (ruleCandidateIds.some((id) => !evidenceById.has(id))) {
    fail('retrievalDiagnostics.ruleCandidateIds 必须存在于 canonicalEvidence');
  }
  if (ruleCandidateIds.some((id) => (
    !evidenceById.get(id).supportsRuleIds.some((ruleId) => matchedRuleIds.includes(ruleId))
  ))) fail('retrievalDiagnostics.ruleCandidateIds 必须支持 matchedRuleIds 中的规则');
  if (typeof value.ruleBoost !== 'number' || !Number.isFinite(value.ruleBoost) || value.ruleBoost < 0) {
    fail('retrievalDiagnostics.ruleBoost 必须是非负有限数字');
  }
  const lexicalCandidates = assertNonNegativeInteger(
    value.lexicalCandidates, 'retrievalDiagnostics.lexicalCandidates',
  );
  const vectorCandidates = assertNonNegativeInteger(
    value.vectorCandidates, 'retrievalDiagnostics.vectorCandidates',
  );
  const fusedCandidates = assertNonNegativeInteger(
    value.fusedCandidates, 'retrievalDiagnostics.fusedCandidates',
  );
  if (value.vectorUsed !== (vectorCandidates > 0)) {
    fail('retrievalDiagnostics.vectorUsed 与 vectorCandidates 不一致');
  }
  return {
    mode: value.mode,
    lexicalCandidates,
    vectorCandidates,
    fusedCandidates,
    vectorUsed: value.vectorUsed,
    rerankUsed: value.rerankUsed,
    requestedRuleIds,
    matchedRuleIds,
    ruleCandidateIds,
    ruleBoost: value.ruleBoost,
    warnings: assertStringArray(value.warnings, 'retrievalDiagnostics.warnings', 100, 2000, { unique: false }),
  };
}

function assertCitationCoherence(report, canonicalEvidence) {
  const evidenceById = new Map(canonicalEvidence.map((entry) => [entry.id, entry]));
  if (evidenceById.size !== canonicalEvidence.length) fail('canonicalEvidence ID 不得重复');
  for (const claim of report.claims) {
    const cited = claim.evidenceIds.map((id) => {
      const entry = evidenceById.get(id);
      if (!entry) fail(`claim ${claim.id} 引用的证据 ${id} 不在 canonicalEvidence`);
      return entry;
    });
    if (cited.length && claim.ruleIds.length) {
      const supported = new Set(cited.flatMap((entry) => entry.supportsRuleIds));
      for (const ruleId of claim.ruleIds) {
        if (!supported.has(ruleId)) fail(`claim ${claim.id} 的证据不支持规则 ${ruleId}`);
      }
    }
  }
}

function assertBundle(value, options, { followUp }) {
  const boundary = assertExpectedBoundary(options);
  const owned = strictClone(value, followUp ? 'ValidatedFollowUpBundleV2' : 'ValidatedAnalysisBundleV2');
  assertExactKeys(
    owned,
    followUp ? FOLLOW_UP_BUNDLE_KEYS : ANALYSIS_BUNDLE_KEYS,
    [],
    followUp ? 'ValidatedFollowUpBundleV2' : 'ValidatedAnalysisBundleV2',
  );
  if (owned.schemaVersion !== '2.0.0') fail('bundle.schemaVersion 无效');
  assertHash(owned.caseHash, 'bundle.caseHash');
  if (owned.caseHash !== boundary.expectedCaseHash) fail('bundle.caseHash 与当前 Case 不一致');
  if (!ORIGINS.has(owned.analysisOrigin)) fail('bundle.analysisOrigin 无效');
  const report = assertValidatedReport(owned[followUp ? 'followUp' : 'report'], {
    expectedCaseHash: owned.caseHash,
    followUp,
  });
  if (!Array.isArray(owned.canonicalEvidence)) fail('canonicalEvidence 必须是数组');
  if (owned.canonicalEvidence.length > 100) fail('canonicalEvidence 超过数量上限');
  const canonicalEvidence = owned.canonicalEvidence.map(assertEvidence);
  assertCitationCoherence(report, canonicalEvidence);
  const evidenceById = new Map(canonicalEvidence.map((entry) => [entry.id, entry]));
  const retrievalDiagnostics = assertDiagnostics(owned.retrievalDiagnostics, evidenceById);
  const corpusRef = assertCorpusRefV2(owned.corpusRef);
  if (!corpusRefsEqual(corpusRef, boundary.expectedCorpusRef)) fail('bundle.corpusRef 与当前权威语料不一致');
  return {
    schemaVersion: '2.0.0',
    caseHash: owned.caseHash,
    analysisOrigin: owned.analysisOrigin,
    [followUp ? 'followUp' : 'report']: report,
    canonicalEvidence,
    retrievalDiagnostics,
    corpusRef,
  };
}

function assertValidatedAnalysisBundleV2(value, options) {
  return assertBundle(value, options, { followUp: false });
}

function assertValidatedFollowUpBundleV2(value, options) {
  return assertBundle(value, options, { followUp: true });
}

function assertMessageBase(value, role, label, requiredKeys) {
  assertExactKeys(value, requiredKeys, [], label);
  if (value.schemaVersion !== '2.0.0') fail(`${label}.schemaVersion 无效`);
  if (value.role !== role) fail(`${label}.role 角色无效`);
  return {
    schemaVersion: '2.0.0',
    id: assertString(value.id, `${label}.id`, 256, { id: true }),
    role,
    content: assertString(value.content, `${label}.content`, role === 'user' ? 500 : 16_000),
    caseHash: assertHash(value.caseHash, `${label}.caseHash`),
    createdAt: assertExactIso(value.createdAt, `${label}.createdAt`),
  };
}

function assertAuthoritativeFollowUpPairV2(value, options) {
  if (!isPlainRecord(options)) fail('追问校验选项必须是普通对象');
  assertExactKeys(
    options,
    ['expectedCaseHash', 'expectedCorpusRef', 'deriveFollowUpContentV2'],
    [],
    '追问校验选项',
  );
  if (typeof options.deriveFollowUpContentV2 !== 'function') fail('deriveFollowUpContentV2 派生器无效');
  const expectedCaseHash = assertHash(options.expectedCaseHash, 'expectedCaseHash');
  const expectedCorpusRef = assertCorpusRefV2(options.expectedCorpusRef, 'expectedCorpusRef');
  const owned = strictClone(value, 'V2 message pair');
  if (!Array.isArray(owned) || owned.length !== 2) fail('V2 message pair 必须恰好包含两条消息');
  const user = assertMessageBase(owned[0], 'user', 'user message', USER_MESSAGE_KEYS);
  const assistantBase = assertMessageBase(owned[1], 'assistant', 'assistant message', ASSISTANT_MESSAGE_KEYS);
  if (user.id === assistantBase.id) fail('V2 message pair ID 冲突');
  if (user.caseHash !== expectedCaseHash || assistantBase.caseHash !== expectedCaseHash) {
    fail('V2 message pair caseHash 与当前 Case 不一致');
  }
  if (Date.parse(assistantBase.createdAt) < Date.parse(user.createdAt)) {
    fail('assistant message.createdAt 不得先于 user message.createdAt');
  }
  const followUpBundle = assertValidatedFollowUpBundleV2(owned[1].followUpBundle, {
    expectedCaseHash,
    expectedCorpusRef,
  });
  const derived = options.deriveFollowUpContentV2(followUpBundle.followUp);
  if (typeof derived !== 'string' || !derived || derived !== assistantBase.content) {
    fail('assistant message.content 必须完全等于共享 helper 派生正文');
  }
  return [
    user,
    { ...assistantBase, followUpBundle },
  ];
}

module.exports = {
  assertAuthoritativeFollowUpPairV2,
  assertCorpusRefV2,
  assertValidatedAnalysisBundleV2,
  assertValidatedFollowUpBundleV2,
  corpusRefsEqual,
};
