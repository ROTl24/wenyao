const { buildAnalysisSystemPrompt, buildFollowUpSystemPrompt } = require('./system-prompt.cjs');
const { buildProfessionalContext, validateProfessionalAnalysis, validateProfessionalFollowUp } = require('./liuyao-domain.cjs');

function fuShenSummary(plate) {
  const fuShen = plate.fuShen || [];
  if (!fuShen.length) return '本卦六亲齐全，程序未生成伏神候选。';
  return `伏神候选：${fuShen.map((item) => `${item.relation}${item.ganZhi}伏于第${item.lineIndex}爻，飞神为${item.flyRelation}${item.flyGanZhi}（${item.status}）`).join('；')}。`;
}

function createLocalReport({ question, category, plate, evidence, retrievalDiagnostics }) {
  const professionalContext = buildProfessionalContext(category, plate);
  const moving = plate.movingLines.length ? `动爻在第 ${plate.movingLines.join('、')} 爻。` : '本卦无动爻，宜重视卦的整体格局与日月作用。';
  const claims = evidence.map((entry) => ({
    text: entry.text,
    evidenceIds: [entry.id],
    confidence: entry.sourceType === 'original' ? '中' : '低',
  }));
  return {
    mode: 'local',
    summary: `所问“${question}”，得${plate.baseHexagram.name}，之${plate.changedHexagram.name}。`,
    focus: `${professionalContext.useGod.rule}${fuShenSummary(plate)}`,
    relations: `${plate.monthGanZhi || '月建未载'}、${plate.dayGanZhi || '日辰未载'}；旬空${(plate.voidBranches || ['未载']).join('、')}。${plate.baseHexagram.shortName || plate.baseHexagram.name}属${plate.baseHexagram.palace}宫${plate.baseHexagram.palaceElement}。`,
    moving,
    synthesis: '当前展示的是本地规则推演，已完成排盘事实与相关证据整理。配置云端模型后，会在同一排盘和证据上生成更完整的综合判断。',
    uncertainties: evidence.some((entry) => entry.sourceType === 'original')
      ? ['当前证据来自用户提供的纯文本古籍，位置以原始文本行号标注；源文件没有纸本页码或扫描页图。']
      : ['当前知识库没有找到足够证据，暂不作确定判断。'],
    guidance: ['先核对所占之事是否单一明确。', '结合动爻、世应和日月旺衰观察后续变化。', '占断仅供传统文化研究与个人反思，不替代专业意见。'],
    claims,
    generatedAt: new Date().toISOString(),
    pipeline: pipelineTrace(retrievalDiagnostics),
  };
}

const REASONING_STAGES = ['锁定排盘事实', '确定用神与问题域', '分析日月动变', '对照规则与占例', '综合判断并校验引用'];
const REPORT_SECTION_HEADINGS = [
  '1. 占问主题',
  '2. 信息完整度判断',
  '3. 用神与世应定位',
  '4. 用神旺衰与状态',
  '5. 生克制化分析',
  '6. 动爻与变爻分析',
  '7. 世应关系分析',
  '8. 辅助因素修正',
  '9. 综合结论',
  '10. 应期判断（若可判断）',
  '11. 最终一句话结论',
];

function pipelineTrace(retrievalDiagnostics) {
  return {
    retrievalMode: retrievalDiagnostics?.mode || 'lexical-fallback',
    factCheckPassed: true,
    citationCheckPassed: true,
    stages: REASONING_STAGES,
    warnings: retrievalDiagnostics?.warnings || [],
  };
}

function reasoningPlan(category, plate) {
  const professionalContext = buildProfessionalContext(category, plate);
  return {
    category,
    useGodRule: professionalContext.useGod.rule,
    useGod: professionalContext.useGod,
    professionalChecks: {
      spiritRoleFacts: professionalContext.spiritRoleFacts,
      requiredInteractionFactsByUseGod: professionalContext.requiredInteractionFactsByUseGod,
    },
    immutableFacts: {
      baseHexagram: plate.baseHexagram.name,
      changedHexagram: plate.changedHexagram.name,
      movingLines: plate.movingLines,
      monthGanZhi: plate.monthGanZhi,
      dayGanZhi: plate.dayGanZhi,
      voidBranches: plate.voidBranches,
      lines: plate.lines,
      fuShen: plate.fuShen,
      voidScopeRule: professionalContext.voidScopeRule,
      lineInteractions: professionalContext.lineInteractions,
    },
    stages: REASONING_STAGES,
  };
}

function ensureString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 报告缺少${label}`);
  return value.trim();
}

function lineRoleFact(plate, role) {
  const line = plate.lines.find((item) => item.role === role);
  return line ? { lineIndex: line.index, relation: line.relation, ganZhi: line.ganZhi } : null;
}

function expectedPlateFacts(plate) {
  return {
    baseHexagram: plate.baseHexagram.name,
    changedHexagram: plate.changedHexagram.name,
    movingLines: plate.movingLines,
    monthGanZhi: plate.monthGanZhi,
    dayGanZhi: plate.dayGanZhi,
    voidBranches: plate.voidBranches || [],
    worldLine: lineRoleFact(plate, '世'),
    responseLine: lineRoleFact(plate, '应'),
  };
}

function sameStringSet(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && expected.every((item) => actual.includes(item));
}

function sameRoleLine(actual, expected) {
  return Boolean(actual && expected)
    && actual.lineIndex === expected.lineIndex
    && actual.relation === expected.relation
    && actual.ganZhi === expected.ganZhi;
}

function validateStructuredPlateFacts(input, plate) {
  const actual = input?.plateFacts;
  const expected = expectedPlateFacts(plate);
  if (!actual
    || actual.baseHexagram !== expected.baseHexagram
    || actual.changedHexagram !== expected.changedHexagram
    || actual.monthGanZhi !== expected.monthGanZhi
    || actual.dayGanZhi !== expected.dayGanZhi
    || !sameStringSet(actual.movingLines, expected.movingLines)
    || !sameStringSet(actual.voidBranches, expected.voidBranches)
    || !sameRoleLine(actual.worldLine, expected.worldLine)
    || !sameRoleLine(actual.responseLine, expected.responseLine)) {
    throw new Error('AI 报告的结构化排盘、月建日辰、旬空或世应事实与程序锁定结果不一致');
  }
  return expected;
}

function validateHeadingOrder(value, headings) {
  let previousIndex = -1;
  for (const heading of headings) {
    const index = value.indexOf(heading);
    if (index < 0) throw new Error(`AI 报告未按规定输出完整且有序的 11 节结构：缺少“${heading}”`);
    if (index <= previousIndex) throw new Error(`AI 报告未按规定输出完整且有序的 11 节结构：“${heading}”顺序错误`);
    previousIndex = index;
  }
}

function validateReportStructure(report) {
  validateHeadingOrder(report.summary, REPORT_SECTION_HEADINGS.slice(0, 2));
  validateHeadingOrder(report.focus, REPORT_SECTION_HEADINGS.slice(2, 4));
  validateHeadingOrder(report.relations, REPORT_SECTION_HEADINGS.slice(4, 5));
  validateHeadingOrder(report.moving, REPORT_SECTION_HEADINGS.slice(5, 8));
  validateHeadingOrder(report.synthesis, REPORT_SECTION_HEADINGS.slice(8));
}

function validatePlateReferences(report, plate, evidence) {
  const factText = [report.summary, report.focus, report.relations, report.moving, report.synthesis].join('\n');
  const allowedGanZhi = new Set([
    plate.dayGanZhi, plate.monthGanZhi,
    ...plate.lines.flatMap((line) => [line.ganZhi, line.changedGanZhi]),
    ...(plate.fuShen || []).flatMap((item) => [item.ganZhi, item.flyGanZhi]),
    ...evidence.flatMap((entry) => String(entry.text || '').match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || []),
  ].filter(Boolean));
  const mentionedGanZhi = factText.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || [];
  if (mentionedGanZhi.some((value) => !allowedGanZhi.has(value))) throw new Error('AI 报告包含排盘中不存在的干支事实');
  const lineNumbers = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6 };
  const movingReferences = [...factText.matchAll(/([初二三四五上])爻[^。；\n]{0,14}(?:发动|为动爻|动化)/g)].map((match) => lineNumbers[match[1]]);
  if (movingReferences.some((line) => !plate.movingLines.includes(line))) throw new Error('AI 报告中的动爻与实际排盘不一致');
}

function validateCloudReport(input, plate, evidence, retrievalDiagnostics, category) {
  if (!input || typeof input !== 'object') throw new Error('AI 报告不是有效对象');
  const summary = ensureString(input.summary, '排盘摘要');
  if (!summary.includes(plate.baseHexagram.name) || !summary.includes(plate.changedHexagram.name)) {
    throw new Error('AI 报告中的排盘事实与实际排盘不一致');
  }
  const plateFacts = validateStructuredPlateFacts(input, plate);
  const professional = validateProfessionalAnalysis({ ...input, summary }, category, plate);
  const normalizedReport = { ...input, summary, relations: professional.relations };
  const allowedIds = new Set(evidence.map((entry) => entry.id));
  const claims = Array.isArray(input.claims) ? input.claims.map((claim) => {
    const evidenceIds = Array.isArray(claim.evidenceIds) ? claim.evidenceIds.filter((id) => typeof id === 'string') : [];
    if (!evidenceIds.length || evidenceIds.some((id) => !allowedIds.has(id))) {
      throw new Error('AI 报告包含不存在的古籍证据');
    }
    return {
      text: ensureString(claim.text, '古籍判断'),
      evidenceIds,
      confidence: ['高', '中', '低'].includes(claim.confidence) ? claim.confidence : '低',
    };
  }) : [];
  if (evidence.length > 0 && claims.length === 0) throw new Error('AI 报告没有为古籍判断提供可校验引用');
  validatePlateReferences(normalizedReport, plate, evidence);
  validateReportStructure(normalizedReport);
  return {
    mode: 'cloud',
    summary,
    focus: ensureString(input.focus, '用神分析'),
    relations: ensureString(professional.relations, '生克关系'),
    moving: ensureString(input.moving, '动爻分析'),
    synthesis: ensureString(input.synthesis, '综合判断'),
    uncertainties: Array.isArray(input.uncertainties) ? input.uncertainties.filter((item) => typeof item === 'string') : [],
    guidance: Array.isArray(input.guidance) ? input.guidance.filter((item) => typeof item === 'string') : [],
    claims,
    professional: {
      plateFacts,
      useGodSelection: professional.selection,
      spiritRoles: input.spiritRoles,
      interactionChecks: professional.interactionChecks,
    },
    generatedAt: new Date().toISOString(),
    pipeline: pipelineTrace(retrievalDiagnostics),
  };
}

function stripJsonFence(value) {
  return String(value).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

const SIX_RELATIONS = ['父母', '官鬼', '妻财', '子孙', '兄弟'];

function lineReferenceSchema({ withReason = false } = {}) {
  const properties = {
    source: { type: 'string', enum: ['visible', 'hidden'] },
    lineIndex: { type: 'integer', minimum: 1, maximum: 6 },
    relation: { type: 'string', enum: SIX_RELATIONS },
    ganZhi: { type: 'string' },
  };
  if (withReason) properties.reason = { type: 'string' };
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: withReason
      ? ['source', 'lineIndex', 'relation', 'ganZhi', 'reason']
      : ['source', 'lineIndex', 'relation', 'ganZhi'],
  };
}

function spiritRoleSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      element: { type: 'string', enum: ['木', '火', '土', '金', '水'] },
      relation: { type: 'string', enum: SIX_RELATIONS },
      lineRefs: { type: 'array', items: lineReferenceSchema() },
      assessment: { type: 'string' },
    },
    required: ['element', 'relation', 'lineRefs', 'assessment'],
  };
}

function evidenceIdSchema(evidence) {
  const ids = [...new Set(evidence.map((entry) => entry.id).filter(Boolean))];
  return {
    ids,
    items: ids.length ? { type: 'string', enum: ids } : { type: 'string' },
  };
}

function itemCountRange(counts) {
  if (!counts.length) return { minItems: 0, maxItems: 0 };
  return { minItems: Math.min(...counts), maxItems: Math.max(...counts) };
}

function lockedArraySchema(values, itemType) {
  return {
    type: 'array',
    minItems: values.length,
    maxItems: values.length,
    items: values.length ? { type: itemType, enum: [...new Set(values)] } : { type: itemType },
  };
}

function lockedRoleLineSchema(line) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      lineIndex: { type: 'integer', enum: [line.lineIndex] },
      relation: { type: 'string', enum: [line.relation] },
      ganZhi: { type: 'string', enum: [line.ganZhi] },
    },
    required: ['lineIndex', 'relation', 'ganZhi'],
  };
}

function lockedPlateFactsSchema(plate) {
  const facts = expectedPlateFacts(plate);
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      baseHexagram: { type: 'string', enum: [facts.baseHexagram] },
      changedHexagram: { type: 'string', enum: [facts.changedHexagram] },
      movingLines: lockedArraySchema(facts.movingLines, 'integer'),
      monthGanZhi: { type: 'string', enum: [facts.monthGanZhi] },
      dayGanZhi: { type: 'string', enum: [facts.dayGanZhi] },
      voidBranches: lockedArraySchema(facts.voidBranches, 'string'),
      worldLine: lockedRoleLineSchema(facts.worldLine),
      responseLine: lockedRoleLineSchema(facts.responseLine),
    },
    required: ['baseHexagram', 'changedHexagram', 'movingLines', 'monthGanZhi', 'dayGanZhi', 'voidBranches', 'worldLine', 'responseLine'],
  };
}

function reportSchema(evidence, plan, plate) {
  const allowedEvidence = evidenceIdSchema(evidence);
  const secondaryCount = plan.useGod.secondaryRelations.length;
  const alternativeRange = itemCountRange(plan.useGod.alternativeCandidatesByPrimary.map((item) => item.alternatives.length));
  const interactionRange = itemCountRange(plan.professionalChecks.requiredInteractionFactsByUseGod.map((item) => item.checks.length));
  return {
    name: 'liuyao_analysis_report',
    schema: {
    type: 'object', additionalProperties: false,
    properties: {
      summary: { type: 'string', description: '必须依次包含标题“1. 占问主题”和“2. 信息完整度判断”。' },
      focus: { type: 'string', description: '必须依次包含标题“3. 用神与世应定位”和“4. 用神旺衰与状态”。' },
      relations: { type: 'string', description: '必须包含标题“5. 生克制化分析”。' },
      moving: { type: 'string', description: '必须依次包含标题“6. 动爻与变爻分析”“7. 世应关系分析”“8. 辅助因素修正”。' },
      synthesis: { type: 'string', description: '必须依次包含标题“9. 综合结论”“10. 应期判断（若可判断）”“11. 最终一句话结论”。' },
      uncertainties: { type: 'array', items: { type: 'string' } },
      guidance: { type: 'array', items: { type: 'string' } },
      plateFacts: lockedPlateFactsSchema(plate),
      claims: {
        type: 'array',
        ...(allowedEvidence.ids.length ? {} : { maxItems: 0 }),
        items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, evidenceIds: { type: 'array', items: allowedEvidence.items }, confidence: { type: 'string', enum: ['高', '中', '低'] } }, required: ['text', 'evidenceIds', 'confidence'] },
      },
      useGodSelection: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primary: { ...lineReferenceSchema(), description: '只能复制 reasoningPlan.useGod.candidates 中最终选定的一条。' },
          reason: { type: 'string' },
          secondaryRelations: { type: 'array', minItems: secondaryCount, maxItems: secondaryCount, description: '必须与 reasoningPlan.useGod.secondaryRelations 完全相同。', items: { type: 'string', enum: SIX_RELATIONS } },
          alternatives: { type: 'array', ...alternativeRange, description: '只复制 alternativeCandidatesByPrimary 对应项中的同六亲候选；若为空则返回空数组，禁止放入辅助六亲。', items: lineReferenceSchema({ withReason: true }) },
        },
        required: ['primary', 'reason', 'secondaryRelations', 'alternatives'],
      },
      spiritRoles: {
        type: 'object',
        additionalProperties: false,
        properties: {
          original: spiritRoleSchema(),
          taboo: spiritRoleSchema(),
          enemy: spiritRoleSchema(),
        },
        required: ['original', 'taboo', 'enemy'],
      },
      interactionChecks: {
        type: 'array',
        ...interactionRange,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            leftLineIndex: { type: 'integer', minimum: 1, maximum: 6 },
            rightLineIndex: { type: 'integer', minimum: 1, maximum: 6 },
            elementRelation: { type: 'string', enum: ['比和', '左生右', '右生左', '左克右', '右克左', '未知'] },
            branchRelation: { type: 'string', enum: ['六合', '六冲', '无'] },
            factStatement: { type: 'string' },
            interpretation: { type: 'string' },
          },
          required: ['leftLineIndex', 'rightLineIndex', 'elementRelation', 'branchRelation', 'factStatement', 'interpretation'],
        },
      },
    },
    required: ['summary', 'focus', 'relations', 'moving', 'synthesis', 'uncertainties', 'guidance', 'claims', 'plateFacts', 'useGodSelection', 'spiritRoles', 'interactionChecks'],
    },
  };
}

function followUpSchema(evidence) {
  const allowedEvidence = evidenceIdSchema(evidence);
  return {
    name: 'liuyao_follow_up',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        content: { type: 'string' },
        evidenceIds: {
          type: 'array',
          ...(allowedEvidence.ids.length ? {} : { maxItems: 0 }),
          items: allowedEvidence.items,
        },
      },
      required: ['content', 'evidenceIds'],
    },
  };
}

async function postChat({ baseUrl, model, apiKey, messages, responseSchema, signal }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    // Bailian Chat Completions does not support structured response_format while thinking mode is enabled.
    body: JSON.stringify({ model, temperature: 0, max_tokens: 8192, enable_thinking: false, response_format: { type: 'json_schema', json_schema: { ...responseSchema, strict: true } }, messages }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(response.status === 401 || response.status === 403 ? 'AI 密钥无效或没有模型权限' : `AI 服务请求失败（${response.status}）`);
    error.status = response.status;
    error.providerBody = body.slice(0, 500);
    throw error;
  }
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 服务没有返回有效内容');
  return JSON.parse(stripJsonFence(content));
}

async function analyzeCloud({ baseUrl, model, apiKey, question, category, plate, evidence, retrievalDiagnostics, signal }) {
  const system = buildAnalysisSystemPrompt(plate);
  const plan = reasoningPlan(category, plate);
  const payload = { question, reasoningPlan: plan, retrievalDiagnostics, evidence: evidence.map(({ id, source, location, text, sourceType, knowledgeKind, topics }) => ({ id, source, location, text, sourceType, knowledgeKind, topics })) };
  const raw = await postChat({ baseUrl, model, apiKey, signal, responseSchema: reportSchema(evidence, plan, plate), messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ] });
  return validateCloudReport(raw, plate, evidence, retrievalDiagnostics, category);
}

async function followUpCloud({ baseUrl, model, apiKey, question, session, evidence, signal }) {
  const system = buildFollowUpSystemPrompt();
  const history = (session.messages || []).slice(-12).map((message) => ({ role: message.role, content: message.content }));
  const raw = await postChat({ baseUrl, model, apiKey, signal, responseSchema: followUpSchema(evidence), messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ plate: session.plate, report: session.analysis, evidence }) },
    ...history,
    { role: 'user', content: question },
  ] });
  const allowed = new Set(evidence.map((item) => item.id));
  const evidenceIds = Array.isArray(raw.evidenceIds) ? raw.evidenceIds.filter((id) => allowed.has(id)) : [];
  const rawContent = ensureString(raw.content, '追问回答');
  validateHeadingOrder(rawContent, REPORT_SECTION_HEADINGS);
  const content = validateProfessionalFollowUp(rawContent, session.analysis?.professional, session.plate);
  validatePlateReferences({ summary: content, focus: content, relations: content, moving: content, synthesis: content }, session.plate, evidence);
  return { content, evidenceIds };
}

module.exports = { createLocalReport, validateCloudReport, analyzeCloud, followUpCloud, reasoningPlan, postChat };
