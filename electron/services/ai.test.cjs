const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCloud, createLocalReport, followUpCloud, validateCloudReport, postChat } = require('./ai.cjs');

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
    summary: '1. 占问主题：事业发展。\n2. 信息完整度判断：本卦天风姤，变卦乾为天。',
    focus: '3. 用神与世应定位：官鬼为用神。\n4. 用神旺衰与状态：结合日月判断。',
    relations: '5. 生克制化分析：官鬼得日月作用。',
    moving: '6. 动爻与变爻分析：初爻发动。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：六神仅作辅助。',
    synthesis: '9. 综合结论：谨慎推进。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：当前宜审慎。',
    uncertainties: ['应期仍需结合后续实际。'], guidance: ['观察下一阶段变化。'],
    claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
  };
  const report = validateCloudReport(valid, plate, evidence, { mode: 'hybrid-reranked', warnings: [] });
  assert.equal(report.pipeline.factCheckPassed, true);
  assert.equal(report.pipeline.citationCheckPassed, true);
  assert.deepEqual(report.pipeline.stages, ['锁定排盘事实', '确定用神与问题域', '分析日月动变', '对照规则与占例', '综合判断并校验引用']);
});

test('cloud report rejects output that omits the required eleven-section structure', () => {
  const incomplete = {
    summary: '本卦天风姤，变卦乾为天。',
    focus: '官鬼为用神。', relations: '官鬼得日月作用。', moving: '初爻发动。', synthesis: '谨慎推进。',
    uncertainties: [], guidance: [],
    claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
  };
  assert.throws(() => validateCloudReport(incomplete, plate, evidence), /11 节|结构/);
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
    summary: '1. 占问主题：事业发展。\n2. 信息完整度判断：本卦天风姤，变卦乾为天。',
    focus: '3. 用神与世应定位：官鬼为用神。\n4. 用神旺衰与状态：结合日月判断。',
    relations: '5. 生克制化分析：古例记载甲子日，但本卦仍以实际日辰为准。',
    moving: '6. 动爻与变爻分析：初爻发动。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：古例仅作辅助。',
    synthesis: '9. 综合结论：谨慎。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：当前宜审慎。',
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

test('cloud analysis installs the complete built-in Liuyao discipline as its system message', async () => {
  let body;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              summary: '1. 占问主题：事业发展。\n2. 信息完整度判断：排盘信息完整。本卦天风姤，变卦乾为天。',
              focus: '3. 用神与世应定位：官鬼为用神。\n4. 用神旺衰与状态：力量待辨。',
              relations: '5. 生克制化分析：结合日月判断。',
              moving: '6. 动爻与变爻分析：初爻发动。\n7. 世应关系分析：结合强弱判断。\n8. 辅助因素修正：六神只作辅助。',
              synthesis: '9. 综合结论：倾向判断为谨慎推进。\n10. 应期判断（若可判断）：信息不足，不硬断。\n11. 最终一句话结论：当前宜审慎。',
              uncertainties: ['应期不足以精断。'],
              guidance: ['补充明确的占问背景。'],
              claims: [{ text: '事业以官鬼为用。', evidenceIds: ['E1'], confidence: '中' }],
            }),
          },
        }],
      }),
    };
  };

  try {
    await analyzeCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '事业发展如何？', category: 'career', plate, evidence,
      retrievalDiagnostics: { mode: 'hybrid-reranked', warnings: [] },
    });
    const system = body.messages[0].content;
    assert.equal(body.messages[0].role, 'system');
    assert.match(system, /只能依据输入中明确提供的卦象信息/);
    assert.match(system, /信息不足会影响判断/);
    assert.match(system, /确定判断、倾向判断、不足判断/);
    assert.match(system, /禁止把八字、奇门、紫微/);
    assert.match(system, /明确动爻是在帮局还是坏局/);
    assert.match(system, /世爻代表我方，应爻代表对方、外部或结果对应面/);
    for (const heading of ['1. 占问主题', '2. 信息完整度判断', '3. 用神与世应定位', '4. 用神旺衰与状态', '5. 生克制化分析', '6. 动爻与变爻分析', '7. 世应关系分析', '8. 辅助因素修正', '9. 综合结论', '10. 应期判断（若可判断）', '11. 最终一句话结论']) {
      assert.match(system, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(system, /本卦“天风姤”/);
    assert.match(system, /变卦“乾为天”/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('follow-up analysis keeps the same built-in discipline without restarting the divination', async () => {
  let body;
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    const content = [
      '1. 占问主题：追问应期。',
      '2. 信息完整度判断：信息不足会影响判断。',
      '3. 用神与世应定位：沿用原卦取用。',
      '4. 用神旺衰与状态：沿用原卦状态。',
      '5. 生克制化分析：仍需结合原卦。',
      '6. 动爻与变爻分析：仍需结合原卦。',
      '7. 世应关系分析：仍需结合原卦。',
      '8. 辅助因素修正：无新增信息。',
      '9. 综合结论：倾向判断为暂不精断。',
      '10. 应期判断（若可判断）：应期不足以精断。',
      '11. 最终一句话结论：当前资料不足。',
    ].join('\n');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ content, evidenceIds: ['E1'] }) } }] }) };
  };

  try {
    const answer = await followUpCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '那什么时候有变化？',
      session: { plate, analysis: {}, messages: [] },
      evidence,
    });
    const system = body.messages[0].content;
    assert.match(system, /只能依据输入中明确提供的卦象信息/);
    assert.match(system, /不得重起卦，不得修改 plate/);
    assert.match(system, /content 必须严格保留上述 1 至 11 节的标题与顺序/);
    for (const heading of ['1. 占问主题', '2. 信息完整度判断', '3. 用神与世应定位', '4. 用神旺衰与状态', '5. 生克制化分析', '6. 动爻与变爻分析', '7. 世应关系分析', '8. 辅助因素修正', '9. 综合结论', '10. 应期判断（若可判断）', '11. 最终一句话结论']) {
      assert.match(system, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.deepEqual(answer.evidenceIds, ['E1']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('follow-up analysis rejects an answer that skips the required structure', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"content":"只给一个简短结论。","evidenceIds":[]}' } }] }),
  });

  try {
    await assert.rejects(() => followUpCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '什么时候有变化？',
      session: { plate, analysis: {}, messages: [] },
      evidence: [],
    }), /11 节|结构/);
  } finally {
    global.fetch = originalFetch;
  }
});
