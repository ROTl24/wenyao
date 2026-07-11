const assert = require('node:assert/strict');
const test = require('node:test');
const { createLocalReport, validateCloudReport, postChat } = require('./ai.cjs');

const plate = {
  baseHexagram: { name: '天风姤', palace: '乾', palaceElement: '金' },
  changedHexagram: { name: '乾为天' },
  movingLines: [1],
  dayGanZhi: '丙戌',
  monthGanZhi: '乙未',
  lines: [{ index: 1, relation: '父母', role: null, moving: true }],
};

const evidence = [{ id: 'E1', source: '规则摘要', location: '用神', text: '占事业重官鬼兼看世爻。', sourceType: 'summary' }];

test('local report uses only supplied evidence ids', () => {
  const report = createLocalReport({ question: '事业发展如何？', category: 'career', plate, evidence, retrievalDiagnostics: { mode: 'lexical-fallback', warnings: ['test'] } });
  assert.equal(report.mode, 'local');
  assert.deepEqual(report.claims.flatMap((claim) => claim.evidenceIds), ['E1']);
  assert.equal(report.pipeline.factCheckPassed, true);
  assert.equal(report.pipeline.retrievalMode, 'lexical-fallback');
});

test('cloud report rejects fabricated evidence ids and wrong plate facts', () => {
  const invalid = {
    summary: '本卦坤为地，变卦乾为天。',
    focus: '官鬼', relations: '关系', moving: '动爻', synthesis: '结论',
    uncertainties: [], guidance: [],
    claims: [{ text: '伪造', evidenceIds: ['FAKE'], confidence: '高' }],
  };
  assert.throws(() => validateCloudReport(invalid, plate, evidence), /证据|排盘/);
});

test('validated cloud report exposes completed reasoning and verification stages', () => {
  const valid = {
    summary: '本卦天风姤，变卦乾为天。',
    focus: '官鬼为用神。', relations: '官鬼得日月作用。', moving: '初爻发动。', synthesis: '谨慎推进。',
    uncertainties: ['应期仍需结合后续实际。'], guidance: ['观察下一阶段变化。'],
    claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
  };
  const report = validateCloudReport(valid, plate, evidence, { mode: 'hybrid-reranked', warnings: [] });
  assert.equal(report.pipeline.factCheckPassed, true);
  assert.equal(report.pipeline.citationCheckPassed, true);
  assert.deepEqual(report.pipeline.stages, ['锁定排盘事实', '确定用神与问题域', '分析日月动变', '对照规则与占例', '综合判断并校验引用']);
});

test('cloud report rejects invented stem-branch facts and moving lines', () => {
  const invalid = {
    summary: '本卦天风姤，变卦乾为天。', focus: '官鬼为用神。', relations: '甲子得月建。', moving: '二爻发动。', synthesis: '谨慎。',
    uncertainties: [], guidance: [], claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
  };
  assert.throws(() => validateCloudReport(invalid, plate, evidence), /干支|动爻/);
});

test('cloud report may compare a stem-branch explicitly present in cited evidence', () => {
  const sourcedEvidence = [{ ...evidence[0], text: '甲子日占事业，以官鬼为用。' }];
  const valid = {
    summary: '本卦天风姤，变卦乾为天。', focus: '官鬼为用神。', relations: '古例记载甲子日，但本卦仍以实际日辰为准。', moving: '初爻发动。', synthesis: '谨慎。',
    uncertainties: [], guidance: ['观察变化。'], claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
  };
  assert.doesNotThrow(() => validateCloudReport(valid, plate, sourcedEvidence));
});

test('chat requests enforce a strict JSON schema instead of best-effort JSON mode', async () => {
  let body;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"answer":"ok"}' } }] }) };
  };
  try {
    await postChat({ baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret', messages: [], responseSchema: { name: 'test', schema: { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false } } });
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
  } finally { global.fetch = originalFetch; }
});
