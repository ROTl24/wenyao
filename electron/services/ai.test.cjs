const assert = require('node:assert/strict');
const test = require('node:test');
const { createLocalReport, validateCloudReport } = require('./ai.cjs');

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
  const report = createLocalReport({ question: '事业发展如何？', category: 'career', plate, evidence });
  assert.equal(report.mode, 'local');
  assert.deepEqual(report.claims.flatMap((claim) => claim.evidenceIds), ['E1']);
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
