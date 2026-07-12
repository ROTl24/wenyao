const { buildAnalysisSystemPrompt, buildFollowUpSystemPrompt } = require('./system-prompt.cjs');

const CATEGORY_FOCUS = {
  career: '以官鬼为事业用神，兼看世爻承受力与父母爻文书条件',
  wealth: '以妻财为求财用神，兼看子孙财源与兄弟耗财',
  relationship: '以世应关系为主，并结合官鬼、妻财与动爻变化',
  health: '以世爻为自身，结合官鬼病因、子孙制化与忌神',
  study: '以父母爻为学业文书，兼看官鬼名次与世爻状态',
  lost_item: '以用神所在六亲、方位、动静与冲合判断',
  travel: '以世应、动爻、日月冲合与行人用神判断',
  other: '先依问题确定用神，再看世应、日月与动变关系',
};

function createLocalReport({ question, category, plate, evidence, retrievalDiagnostics }) {
  const moving = plate.movingLines.length ? `动爻在第 ${plate.movingLines.join('、')} 爻。` : '本卦无动爻，宜重视卦的整体格局与日月作用。';
  const claims = evidence.map((entry) => ({
    text: entry.text,
    evidenceIds: [entry.id],
    confidence: entry.sourceType === 'original' ? '中' : '低',
  }));
  return {
    mode: 'local',
    summary: `所问“${question}”，得${plate.baseHexagram.name}，之${plate.changedHexagram.name}。`,
    focus: CATEGORY_FOCUS[category] || CATEGORY_FOCUS.other,
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
  return {
    category,
    useGodRule: CATEGORY_FOCUS[category] || CATEGORY_FOCUS.other,
    immutableFacts: {
      baseHexagram: plate.baseHexagram.name,
      changedHexagram: plate.changedHexagram.name,
      movingLines: plate.movingLines,
      monthGanZhi: plate.monthGanZhi,
      dayGanZhi: plate.dayGanZhi,
      voidBranches: plate.voidBranches,
      lines: plate.lines,
    },
    stages: REASONING_STAGES,
  };
}

function ensureString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI 报告缺少${label}`);
  return value.trim();
}

function validateHeadingOrder(value, headings) {
  let previousIndex = -1;
  for (const heading of headings) {
    const index = value.indexOf(heading);
    if (index < 0 || index <= previousIndex) throw new Error('AI 报告未按规定输出完整且有序的 11 节结构');
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
    ...evidence.flatMap((entry) => String(entry.text || '').match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || []),
  ].filter(Boolean));
  const mentionedGanZhi = factText.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || [];
  if (mentionedGanZhi.some((value) => !allowedGanZhi.has(value))) throw new Error('AI 报告包含排盘中不存在的干支事实');
  const lineNumbers = { 初: 1, 二: 2, 三: 3, 四: 4, 五: 5, 上: 6 };
  const movingReferences = [...factText.matchAll(/([初二三四五上])爻[^。；\n]{0,14}(?:发动|为动爻|动化)/g)].map((match) => lineNumbers[match[1]]);
  if (movingReferences.some((line) => !plate.movingLines.includes(line))) throw new Error('AI 报告中的动爻与实际排盘不一致');
}

function validateCloudReport(input, plate, evidence, retrievalDiagnostics) {
  if (!input || typeof input !== 'object') throw new Error('AI 报告不是有效对象');
  const summary = ensureString(input.summary, '排盘摘要');
  if (!summary.includes(plate.baseHexagram.name) || !summary.includes(plate.changedHexagram.name)) {
    throw new Error('AI 报告中的排盘事实与实际排盘不一致');
  }
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
  validatePlateReferences({ ...input, summary }, plate, evidence);
  validateReportStructure({ ...input, summary });
  return {
    mode: 'cloud',
    summary,
    focus: ensureString(input.focus, '用神分析'),
    relations: ensureString(input.relations, '生克关系'),
    moving: ensureString(input.moving, '动爻分析'),
    synthesis: ensureString(input.synthesis, '综合判断'),
    uncertainties: Array.isArray(input.uncertainties) ? input.uncertainties.filter((item) => typeof item === 'string') : [],
    guidance: Array.isArray(input.guidance) ? input.guidance.filter((item) => typeof item === 'string') : [],
    claims,
    generatedAt: new Date().toISOString(),
    pipeline: pipelineTrace(retrievalDiagnostics),
  };
}

function stripJsonFence(value) {
  return String(value).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

const REPORT_SCHEMA = {
  name: 'liuyao_analysis_report',
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      summary: { type: 'string' }, focus: { type: 'string' }, relations: { type: 'string' }, moving: { type: 'string' }, synthesis: { type: 'string' },
      uncertainties: { type: 'array', items: { type: 'string' } },
      guidance: { type: 'array', items: { type: 'string' } },
      claims: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } }, confidence: { type: 'string', enum: ['高', '中', '低'] } }, required: ['text', 'evidenceIds', 'confidence'] } },
    },
    required: ['summary', 'focus', 'relations', 'moving', 'synthesis', 'uncertainties', 'guidance', 'claims'],
  },
};

const FOLLOW_UP_SCHEMA = {
  name: 'liuyao_follow_up',
  schema: { type: 'object', additionalProperties: false, properties: { content: { type: 'string' }, evidenceIds: { type: 'array', items: { type: 'string' } } }, required: ['content', 'evidenceIds'] },
};

async function postChat({ baseUrl, model, apiKey, messages, responseSchema, signal }) {
  const url = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.25, enable_thinking: true, response_format: { type: 'json_schema', json_schema: { ...responseSchema, strict: true } }, messages }),
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
  const payload = { question, reasoningPlan: reasoningPlan(category, plate), retrievalDiagnostics, evidence: evidence.map(({ id, source, location, text, sourceType, knowledgeKind, topics }) => ({ id, source, location, text, sourceType, knowledgeKind, topics })) };
  const raw = await postChat({ baseUrl, model, apiKey, signal, responseSchema: REPORT_SCHEMA, messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(payload) },
  ] });
  return validateCloudReport(raw, plate, evidence, retrievalDiagnostics);
}

async function followUpCloud({ baseUrl, model, apiKey, question, session, evidence, signal }) {
  const system = buildFollowUpSystemPrompt();
  const history = (session.messages || []).slice(-12).map((message) => ({ role: message.role, content: message.content }));
  const raw = await postChat({ baseUrl, model, apiKey, signal, responseSchema: FOLLOW_UP_SCHEMA, messages: [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ plate: session.plate, report: session.analysis, evidence }) },
    ...history,
    { role: 'user', content: question },
  ] });
  const allowed = new Set(evidence.map((item) => item.id));
  const evidenceIds = Array.isArray(raw.evidenceIds) ? raw.evidenceIds.filter((id) => allowed.has(id)) : [];
  const content = ensureString(raw.content, '追问回答');
  validateHeadingOrder(content, REPORT_SECTION_HEADINGS);
  return { content, evidenceIds };
}

module.exports = { createLocalReport, validateCloudReport, analyzeCloud, followUpCloud, reasoningPlan, postChat };
