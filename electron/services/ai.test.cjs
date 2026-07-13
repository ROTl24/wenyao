const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCloud, createLocalReport, followUpCloud, validateCloudReport, postChat, reasoningPlan } = require('./ai.cjs');

const plate = {
  baseHexagram: { name: '天风姤', palace: '乾', palaceElement: '金' },
  changedHexagram: { name: '乾为天' },
  movingLines: [1],
  dayGanZhi: '丙戌',
  monthGanZhi: '乙未',
  lines: [{ index: 1, relation: '父母', role: null, moving: true }],
  fuShen: [],
};

const evidence = [{ id: 'E1', source: '规则摘要', location: '用神', text: '占事业重官鬼兼看世爻。', sourceType: 'summary' }];
const studyEvidence = [{ id: 'E1', source: '规则摘要', location: '用神', text: '占学业以父母为用神，考试名次兼看官鬼。', sourceType: 'summary' }];

const studyPlate = {
  baseHexagram: { name: '泽雷随', palace: '震', palaceElement: '木' },
  changedHexagram: { name: '泽雷随' },
  movingLines: [],
  dayGanZhi: '戊子',
  monthGanZhi: '乙未',
  voidBranches: ['午', '未'],
  lines: [
    { index: 1, relation: '父母', ganZhi: '庚子', branch: '子', element: '水', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
    { index: 2, relation: '兄弟', ganZhi: '庚寅', branch: '寅', element: '木', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
    { index: 3, relation: '妻财', ganZhi: '庚辰', branch: '辰', element: '土', role: '世', moving: false, void: false, monthBreak: false, dayClash: false },
    { index: 4, relation: '父母', ganZhi: '丁亥', branch: '亥', element: '水', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
    { index: 5, relation: '官鬼', ganZhi: '丁酉', branch: '酉', element: '金', role: '', moving: false, void: false, monthBreak: false, dayClash: false },
    { index: 6, relation: '妻财', ganZhi: '丁未', branch: '未', element: '土', role: '应', moving: false, void: true, monthBreak: false, dayClash: false },
  ],
  fuShen: [{ lineIndex: 4, relation: '子孙', ganZhi: '庚午', branch: '午', element: '火', flyRelation: '父母', flyGanZhi: '丁亥' }],
};

function studyReport(overrides = {}) {
  return {
    summary: '1. 占问主题：学业会好吗。\n2. 信息完整度判断：本卦泽雷随，变卦泽雷随。',
    focus: '3. 用神与世应定位：父母两现，比较庚子与丁亥后，最终取父母庚子为主用神，丁亥为辅，官鬼辅助判断。\n4. 用神旺衰与状态：庚子临日建。',
    relations: '5. 生克制化分析：父母庚子水的原神为官鬼丁酉金；忌神为妻财庚辰土、丁未土；仇神为伏神子孙庚午火。关键关系：庚辰土与丁未土五行比和；庚辰土生丁酉金，辰酉六合；庚辰土克庚子水；丁未土克庚子水；丁酉金生庚子水。',
    moving: '6. 动爻与变爻分析：无动爻。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：六神只作辅助。',
    synthesis: '9. 综合结论：倾向谨慎。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：暂时观察。',
    uncertainties: [],
    guidance: [],
    claims: [{ text: '学业以父母为用。', evidenceIds: ['E1'], confidence: '中' }],
    plateFacts: {
      baseHexagram: '泽雷随',
      changedHexagram: '泽雷随',
      movingLines: [],
      monthGanZhi: '乙未',
      dayGanZhi: '戊子',
      voidBranches: ['午', '未'],
      worldLine: { lineIndex: 3, relation: '妻财', ganZhi: '庚辰' },
      responseLine: { lineIndex: 6, relation: '妻财', ganZhi: '丁未' },
    },
    useGodSelection: {
      primary: { source: 'visible', lineIndex: 1, relation: '父母', ganZhi: '庚子' },
      reason: '庚子临日建，较丁亥更有力。',
      secondaryRelations: ['官鬼'],
      alternatives: [{ source: 'visible', lineIndex: 4, relation: '父母', ganZhi: '丁亥', reason: '丁亥受未月制，退作辅看。' }],
    },
    spiritRoles: {
      original: {
        element: '金',
        relation: '官鬼',
        lineRefs: [{ source: 'visible', lineIndex: 5, relation: '官鬼', ganZhi: '丁酉' }],
        assessment: '原神官鬼丁酉金可生父母水。',
      },
      taboo: {
        element: '土',
        relation: '妻财',
        lineRefs: [
          { source: 'visible', lineIndex: 3, relation: '妻财', ganZhi: '庚辰' },
          { source: 'visible', lineIndex: 6, relation: '妻财', ganZhi: '丁未' },
        ],
        assessment: '忌神妻财土克父母水。',
      },
      enemy: {
        element: '火',
        relation: '子孙',
        lineRefs: [{ source: 'hidden', lineIndex: 4, relation: '子孙', ganZhi: '庚午' }],
        assessment: '仇神子孙火伏于四爻，可生忌神土并克原神金。',
      },
    },
    interactionChecks: [
      { leftLineIndex: 3, rightLineIndex: 6, elementRelation: '比和', branchRelation: '无', factStatement: '庚辰土与丁未土五行比和', interpretation: '世应同为妻财土，需结合旬空区分强弱。' },
      { leftLineIndex: 3, rightLineIndex: 5, elementRelation: '左生右', branchRelation: '六合', factStatement: '庚辰土生丁酉金，辰酉六合', interpretation: '世爻生合官鬼，外部考试评价与求测者投入存在联系。' },
      { leftLineIndex: 1, rightLineIndex: 3, elementRelation: '右克左', branchRelation: '无', factStatement: '庚辰土克庚子水', interpretation: '世爻为用神之忌神，主观投入与学业载体之间有压力。' },
      { leftLineIndex: 1, rightLineIndex: 6, elementRelation: '右克左', branchRelation: '无', factStatement: '丁未土克庚子水', interpretation: '应爻妻财土克主用神，但旬空会改变实际作用力。' },
      { leftLineIndex: 1, rightLineIndex: 5, elementRelation: '右生左', branchRelation: '无', factStatement: '丁酉金生庚子水', interpretation: '官鬼原神可生主用神，辅助判断考试评价。' },
    ],
    ...overrides,
  };
}

test('study reasoning plan locks use-god candidates and exact line interactions', () => {
  const plan = reasoningPlan('study', studyPlate);

  assert.equal(plan.useGod.selectionMode, 'six-relation');
  assert.equal(plan.useGod.primaryRelation, '父母');
  assert.deepEqual(plan.useGod.secondaryRelations, ['官鬼']);
  assert.deepEqual(plan.useGod.candidates.map(({ lineIndex, ganZhi }) => ({ lineIndex, ganZhi })), [
    { lineIndex: 1, ganZhi: '庚子' },
    { lineIndex: 4, ganZhi: '丁亥' },
  ]);
  assert.deepEqual(plan.useGod.alternativeCandidatesByPrimary, [
    {
      primary: { source: 'visible', lineIndex: 1, relation: '父母', ganZhi: '庚子' },
      alternatives: [{ source: 'visible', lineIndex: 4, relation: '父母', ganZhi: '丁亥' }],
    },
    {
      primary: { source: 'visible', lineIndex: 4, relation: '父母', ganZhi: '丁亥' },
      alternatives: [{ source: 'visible', lineIndex: 1, relation: '父母', ganZhi: '庚子' }],
    },
  ]);
  assert.deepEqual(plan.professionalChecks.spiritRoleFacts[0], {
    useGodElement: '水',
    original: { label: '原神', element: '金', relation: '官鬼', lineRefs: [{ source: 'visible', lineIndex: 5, relation: '官鬼', ganZhi: '丁酉' }] },
    taboo: {
      label: '忌神',
      element: '土',
      relation: '妻财',
      lineRefs: [
        { source: 'visible', lineIndex: 3, relation: '妻财', ganZhi: '庚辰' },
        { source: 'visible', lineIndex: 6, relation: '妻财', ganZhi: '丁未' },
      ],
    },
    enemy: { label: '仇神', element: '火', relation: '子孙', lineRefs: [{ source: 'hidden', lineIndex: 4, relation: '子孙', ganZhi: '庚午' }] },
  });
  assert.ok(plan.professionalChecks.requiredInteractionFactsByUseGod[0].checks.some((interaction) => (
    interaction.leftLineIndex === 3
    && interaction.rightLineIndex === 5
    && interaction.factStatement === '庚辰土生丁酉金，辰酉六合'
  )));
  assert.ok(plan.immutableFacts.lineInteractions.some((interaction) => (
    interaction.leftLineIndex === 3
    && interaction.rightLineIndex === 5
    && interaction.elementRelation === '左生右'
    && interaction.branchRelation === '六合'
  )));
});

test('locked branch relations are order-independent for harmony and clash pairs', () => {
  const interactionPlate = {
    baseHexagram: { name: '测试卦', palace: '坎', palaceElement: '水' },
    changedHexagram: { name: '测试卦' },
    movingLines: [],
    dayGanZhi: '甲子',
    monthGanZhi: '乙丑',
    lines: [
      { index: 1, relation: '兄弟', ganZhi: '甲丑', branch: '丑', element: '土', role: '', moving: false },
      { index: 2, relation: '兄弟', ganZhi: '甲子', branch: '子', element: '水', role: '', moving: false },
      { index: 3, relation: '妻财', ganZhi: '甲午', branch: '午', element: '火', role: '', moving: false },
    ],
    fuShen: [],
  };

  const interactions = reasoningPlan('other', interactionPlate).immutableFacts.lineInteractions;
  assert.equal(interactions.find((item) => item.leftLineIndex === 1 && item.rightLineIndex === 2)?.branchRelation, '六合');
  assert.equal(interactions.find((item) => item.leftLineIndex === 2 && item.rightLineIndex === 3)?.branchRelation, '六冲');
});

test('required professional checks do not depend on whether plate lines are stored bottom-up or top-down', () => {
  const reversedPlate = { ...studyPlate, lines: [...studyPlate.lines].reverse() };
  const plan = reasoningPlan('study', reversedPlate);
  const primaryFacts = plan.professionalChecks.requiredInteractionFactsByUseGod
    .find((item) => item.primary.ganZhi === '庚子').checks;

  assert.ok(primaryFacts.some((interaction) => (
    new Set([interaction.leftLineIndex, interaction.rightLineIndex]).has(3)
    && new Set([interaction.leftLineIndex, interaction.rightLineIndex]).has(5)
    && interaction.factStatement === '庚辰土生丁酉金，辰酉六合'
  )));
});

test('study report rejects category mapping that never selects one concrete use-god line', () => {
  const generic = {
    summary: '1. 占问主题：学业会好吗。\n2. 信息完整度判断：本卦泽雷随，变卦泽雷随。',
    focus: '3. 用神与世应定位：以父母爻为学业，兼看官鬼。\n4. 用神旺衰与状态：父母爻两现。',
    relations: '5. 生克制化分析：结合日月判断。',
    moving: '6. 动爻与变爻分析：无动爻。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：六神只作辅助。',
    synthesis: '9. 综合结论：倾向谨慎。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：暂时观察。',
    uncertainties: [],
    guidance: [],
    claims: [{ text: '学业以父母为用。', evidenceIds: ['E1'], confidence: '中' }],
    plateFacts: studyReport().plateFacts,
  };

  assert.throws(
    () => validateCloudReport(generic, studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /具体主用神|取用结构/,
  );
});

test('study report must compare every other parent line before choosing the primary use god', () => {
  const incompleteSelection = {
    summary: '1. 占问主题：学业会好吗。\n2. 信息完整度判断：本卦泽雷随，变卦泽雷随。',
    focus: '3. 用神与世应定位：最终取父母庚子为主用神，官鬼辅助判断。\n4. 用神旺衰与状态：庚子临日建。',
    relations: '5. 生克制化分析：结合日月判断。',
    moving: '6. 动爻与变爻分析：无动爻。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：六神只作辅助。',
    synthesis: '9. 综合结论：倾向谨慎。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：暂时观察。',
    uncertainties: [],
    guidance: [],
    claims: [{ text: '学业以父母为用。', evidenceIds: ['E1'], confidence: '中' }],
    plateFacts: studyReport().plateFacts,
    useGodSelection: {
      primary: { source: 'visible', lineIndex: 1, relation: '父母', ganZhi: '庚子' },
      reason: '庚子临日建。',
      secondaryRelations: ['官鬼'],
      alternatives: [],
    },
  };

  assert.throws(
    () => validateCloudReport(incompleteSelection, studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /两现|其他候选|取舍/,
  );
});

test('study report rejects auxiliary relations or alternative candidates outside the locked use-god contract', () => {
  const invalidRelations = {
    ...studyReport().useGodSelection,
    secondaryRelations: ['官鬼', '妻财'],
  };
  const invalidAlternatives = {
    ...studyReport().useGodSelection,
    alternatives: [
      ...studyReport().useGodSelection.alternatives,
      { source: 'visible', lineIndex: 2, relation: '兄弟', ganZhi: '庚寅', reason: '额外候选。' },
    ],
  };

  assert.throws(
    () => validateCloudReport(studyReport({ useGodSelection: invalidRelations }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /辅助六亲|候选.*锁定|取用合同/,
  );
  assert.throws(
    () => validateCloudReport(studyReport({ useGodSelection: invalidAlternatives }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /未锁定.*候选|候选.*锁定|取用合同/,
  );
});

test('study report must identify original, taboo, and enemy spirits from the selected use god', () => {
  const missingSpiritRoles = {
    summary: '1. 占问主题：学业会好吗。\n2. 信息完整度判断：本卦泽雷随，变卦泽雷随。',
    focus: '3. 用神与世应定位：父母两现，比较庚子与丁亥后，最终取父母庚子为主用神，丁亥为辅，官鬼辅助判断。\n4. 用神旺衰与状态：庚子临日建。',
    relations: '5. 生克制化分析：结合日月判断。',
    moving: '6. 动爻与变爻分析：无动爻。\n7. 世应关系分析：结合世应判断。\n8. 辅助因素修正：六神只作辅助。',
    synthesis: '9. 综合结论：倾向谨慎。\n10. 应期判断（若可判断）：应期不足以精断。\n11. 最终一句话结论：暂时观察。',
    uncertainties: [],
    guidance: [],
    claims: [{ text: '学业以父母为用。', evidenceIds: ['E1'], confidence: '中' }],
    plateFacts: studyReport().plateFacts,
    useGodSelection: {
      primary: { source: 'visible', lineIndex: 1, relation: '父母', ganZhi: '庚子' },
      reason: '庚子临日建，较丁亥更有力。',
      secondaryRelations: ['官鬼'],
      alternatives: [{ source: 'visible', lineIndex: 4, relation: '父母', ganZhi: '丁亥', reason: '丁亥受未月制，退作辅看。' }],
    },
  };

  assert.throws(
    () => validateCloudReport(missingSpiritRoles, studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /原神.*忌神.*仇神|生克角色/,
  );
});

test('study report must provide locked checks for key use-god, world, response, and secondary-line interactions', () => {
  const { interactionChecks, ...missingInteractionChecks } = studyReport();
  assert.throws(
    () => validateCloudReport(missingInteractionChecks, studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /关键.*关系|关系校验结构|生克校验/,
  );
});

test('validated report surfaces every locked interaction fact even when model prose omits one', () => {
  const valid = studyReport();
  const relations = valid.relations.replace('；丁酉金生庚子水', '');

  const report = validateCloudReport(
    studyReport({ relations }),
    studyPlate,
    studyEvidence,
    { mode: 'hybrid-fused', warnings: [] },
    'study',
  );

  assert.match(report.relations, /程序锁定的关系事实：丁酉金生庚子水/);
});

test('study report rejects the current false claim that world earth neither generates nor harmonizes with official metal', () => {
  const interactionChecks = studyReport().interactionChecks.map((item) => (
    item.leftLineIndex === 3 && item.rightLineIndex === 5
      ? { ...item, elementRelation: '右生左', branchRelation: '无', factStatement: '丁酉金生庚辰土' }
      : item
  ));

  assert.throws(
    () => validateCloudReport(studyReport({ interactionChecks }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /生克|六合六冲|锁定事实/,
  );
});

test('study report rejects prose that contradicts a locked harmony fact even when structured fields are correct', () => {
  const interactionChecks = studyReport().interactionChecks.map((item) => (
    item.leftLineIndex === 3 && item.rightLineIndex === 5
      ? { ...item, interpretation: '官鬼丁酉金与世爻庚辰土并不相合。' }
      : item
  ));

  assert.throws(
    () => validateCloudReport(studyReport({ interactionChecks }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /正文解释.*锁定|相互矛盾|六合/,
  );
});

test('study report rejects the original visible wording that official metal does not generate or harmonize with the world line', () => {
  const valid = studyReport();
  const relations = `${valid.relations} 官鬼酉金不生合世爻。`;

  assert.throws(
    () => validateCloudReport(studyReport({ relations }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /可见正文.*锁定|相互矛盾|六合/,
  );
});

test('study report rejects prose that reverses a locked five-element direction', () => {
  const valid = studyReport();
  const relations = `${valid.relations} 丁酉金克庚辰土。`;

  assert.throws(
    () => validateCloudReport(studyReport({ relations }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /五行|生克方向|相互矛盾/,
  );
});

test('study report rejects prose that negates a locked five-element relation', () => {
  const valid = studyReport();
  const relations = `${valid.relations} 庚辰土不生丁酉金。`;

  assert.throws(
    () => validateCloudReport(studyReport({ relations }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /五行|生克方向|相互矛盾/,
  );
});

test('study report rejects treating the month build itself as void', () => {
  const valid = studyReport();
  const focus = `${valid.focus} 月建乙未：未土旬空，所以月建克力减弱。`;

  assert.throws(
    () => validateCloudReport(studyReport({ focus }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /月建|日辰|旬空|空亡/,
  );
});

test('study report accepts a concrete use-god choice with verified spirit roles and line interactions', () => {
  const report = validateCloudReport(studyReport(), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study');

  assert.equal(report.pipeline.factCheckPassed, true);
  assert.match(report.focus, /父母庚子.*主用神/);
  assert.match(report.relations, /庚辰土生丁酉金，辰酉六合/);
  assert.equal(report.professional.useGodSelection.primary.ganZhi, '庚子');
  assert.equal(report.professional.plateFacts.monthGanZhi, '乙未');
  assert.ok(report.professional.interactionChecks.some((item) => item.leftGanZhi === '庚辰' && item.rightGanZhi === '丁酉'));
});

test('study report rejects structured month, day, void, world, or response facts that differ from the plate', () => {
  const plateFacts = {
    ...studyReport().plateFacts,
    monthGanZhi: '甲寅',
    responseLine: { lineIndex: 5, relation: '官鬼', ganZhi: '丁酉' },
  };

  assert.throws(
    () => validateCloudReport(studyReport({ plateFacts }), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study'),
    /结构化排盘|月建|世应/,
  );
});

test('local report uses only supplied evidence ids', () => {
  const report = createLocalReport({ question: '事业发展如何？', category: 'career', plate, evidence, retrievalDiagnostics: { mode: 'lexical-fallback', warnings: ['test'] } });
  assert.equal(report.mode, 'local');
  assert.deepEqual(report.claims.flatMap((claim) => claim.evidenceIds), ['E1']);
  assert.match(report.focus, /本卦六亲齐全/);
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
  const report = validateCloudReport(studyReport({
    uncertainties: ['应期仍需结合后续实际。'],
    guidance: ['观察下一阶段变化。'],
  }), studyPlate, studyEvidence, { mode: 'hybrid-reranked', warnings: [] }, 'study');
  assert.equal(report.pipeline.factCheckPassed, true);
  assert.equal(report.pipeline.citationCheckPassed, true);
  assert.deepEqual(report.pipeline.stages, ['锁定排盘事实', '确定用神与问题域', '分析日月动变', '对照规则与占例', '综合判断并校验引用']);
});

test('cloud report rejects output that omits the required eleven-section structure', () => {
  const incomplete = studyReport({
    synthesis: '9. 综合结论：谨慎推进。\n10. 应期判断（若可判断）：应期不足以精断。',
  });
  assert.throws(() => validateCloudReport(incomplete, studyPlate, studyEvidence, undefined, 'study'), /11 节|结构/);
});

test('cloud report rejects invented stem-branch facts and moving lines', () => {
  const valid = studyReport();
  const invalid = studyReport({
    relations: `${valid.relations} 另称甲卯得月建。`,
    moving: `${valid.moving} 二爻发动。`,
  });
  assert.throws(() => validateCloudReport(invalid, studyPlate, studyEvidence, undefined, 'study'), /干支|动爻/);
});

test('cloud report may compare a stem-branch explicitly present in cited evidence', () => {
  const sourcedEvidence = [{ ...studyEvidence[0], text: '甲子日占学业，以父母为用。' }];
  const valid = studyReport();
  const sourcedReport = studyReport({ relations: `${valid.relations} 古例记载甲子日，但本卦仍以实际日辰为准。` });
  assert.doesNotThrow(() => validateCloudReport(sourcedReport, studyPlate, sourcedEvidence, undefined, 'study'));
});

test('cloud report accepts only program-provided hidden-line stem-branch facts', () => {
  const valid = studyReport();
  const createReport = (relationText) => studyReport({ relations: `${valid.relations} ${relationText}` });

  assert.doesNotThrow(() => validateCloudReport(createReport('伏神庚午，飞神丁亥。'), studyPlate, studyEvidence, undefined, 'study'));
  assert.throws(() => validateCloudReport(createReport('伏神甲卯，飞神丁亥。'), studyPlate, studyEvidence, undefined, 'study'), /干支/);
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
    assert.equal(body.enable_thinking, false);
    assert.equal(body.temperature, 0);
    assert.equal(body.max_tokens, 8192);
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
            content: JSON.stringify(studyReport({
              uncertainties: ['应期不足以精断。'],
              guidance: ['补充明确的占问背景。'],
            })),
          },
        }],
      }),
    };
  };

  try {
    await analyzeCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '学业会好吗？', category: 'study', plate: studyPlate, evidence: studyEvidence,
      retrievalDiagnostics: { mode: 'hybrid-reranked', warnings: [] },
    });
    const system = body.messages[0].content;
    const payload = JSON.parse(body.messages[1].content);
    const schema = body.response_format.json_schema.schema;
    assert.equal(body.messages[0].role, 'system');
    assert.match(system, /只能依据输入中明确提供的卦象信息/);
    assert.match(system, /信息不足会影响判断/);
    assert.match(system, /确定判断、倾向判断、不足判断/);
    assert.match(system, /禁止把八字、奇门、紫微/);
    assert.match(system, /明确动爻是在帮局还是坏局/);
    assert.match(system, /世爻代表我方，应爻代表对方、外部或结果对应面/);
    assert.match(system, /immutableFacts\.fuShen/);
    assert.match(system, /类别映射不等于完成取用/);
    assert.match(system, /useGodSelection/);
    assert.match(system, /spiritRoles/);
    assert.match(system, /interactionChecks/);
    assert.match(system, /不使用 Markdown/);
    assert.match(system, /月建和日辰本身不论旬空/);
    assert.deepEqual(payload.reasoningPlan.immutableFacts.fuShen, studyPlate.fuShen);
    assert.match(payload.reasoningPlan.immutableFacts.voidScopeRule, /旬空只作用于具体卦爻/);
    assert.deepEqual(payload.reasoningPlan.useGod.candidates.map((item) => item.ganZhi), ['庚子', '丁亥']);
    assert.ok(payload.reasoningPlan.professionalChecks.requiredInteractionFactsByUseGod[0].checks.some((item) => item.factStatement === '庚辰土生丁酉金，辰酉六合'));
    for (const field of ['plateFacts', 'useGodSelection', 'spiritRoles', 'interactionChecks']) {
      assert.ok(schema.required.includes(field));
    }
    assert.deepEqual(schema.properties.plateFacts.properties.monthGanZhi.enum, ['乙未']);
    assert.deepEqual(schema.properties.claims.items.properties.evidenceIds.items.enum, ['E1']);
    assert.equal(schema.properties.useGodSelection.properties.secondaryRelations.minItems, 1);
    assert.equal(schema.properties.useGodSelection.properties.secondaryRelations.maxItems, 1);
    assert.equal(schema.properties.useGodSelection.properties.alternatives.minItems, 1);
    assert.equal(schema.properties.useGodSelection.properties.alternatives.maxItems, 1);
    assert.equal(schema.properties.interactionChecks.minItems, 5);
    assert.equal(schema.properties.interactionChecks.maxItems, 5);
    assert.match(schema.properties.synthesis.description, /9\..*10\..*11\./);
    for (const heading of ['1. 占问主题', '2. 信息完整度判断', '3. 用神与世应定位', '4. 用神旺衰与状态', '5. 生克制化分析', '6. 动爻与变爻分析', '7. 世应关系分析', '8. 辅助因素修正', '9. 综合结论', '10. 应期判断（若可判断）', '11. 最终一句话结论']) {
      assert.match(system, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.match(system, /本卦“泽雷随”/);
    assert.match(system, /变卦“泽雷随”/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('follow-up analysis keeps the same built-in discipline without restarting the divination', async () => {
  let body;
  const mainReport = validateCloudReport(studyReport(), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study');
  const visibleReport = studyReport();
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    const content = [visibleReport.summary, visibleReport.focus, visibleReport.relations, visibleReport.moving, visibleReport.synthesis].join('\n');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ content, evidenceIds: ['E1'] }) } }] }) };
  };

  try {
    const answer = await followUpCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '那什么时候有变化？',
      session: { plate: studyPlate, analysis: mainReport, messages: [] },
      evidence: studyEvidence,
    });
    const system = body.messages[0].content;
    assert.match(system, /只能依据输入中明确提供的卦象信息/);
    assert.match(system, /不得重起卦，不得修改 plate/);
    assert.match(system, /report\.professional/);
    assert.match(system, /content 必须严格保留上述 1 至 11 节的标题与顺序/);
    assert.deepEqual(body.response_format.json_schema.schema.properties.evidenceIds.items.enum, ['E1']);
    for (const heading of ['1. 占问主题', '2. 信息完整度判断', '3. 用神与世应定位', '4. 用神旺衰与状态', '5. 生克制化分析', '6. 动爻与变爻分析', '7. 世应关系分析', '8. 辅助因素修正', '9. 综合结论', '10. 应期判断（若可判断）', '11. 最终一句话结论']) {
      assert.match(system, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.deepEqual(answer.evidenceIds, ['E1']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('follow-up analysis rejects changing the concrete use god selected by the verified main report', async () => {
  const mainReport = validateCloudReport(studyReport(), studyPlate, studyEvidence, { mode: 'hybrid-fused', warnings: [] }, 'study');
  const visibleReport = studyReport();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const changedFocus = visibleReport.focus.replace('最终取父母庚子为主用神', '改取父母丁亥为主用神');
    const content = [visibleReport.summary, changedFocus, visibleReport.relations, visibleReport.moving, visibleReport.synthesis].join('\n');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ content, evidenceIds: ['E1'] }) } }] }) };
  };

  try {
    await assert.rejects(() => followUpCloud({
      baseUrl: 'https://example.com/v1', model: 'qwen', apiKey: 'secret',
      question: '那什么时候有变化？',
      session: { plate: studyPlate, analysis: mainReport, messages: [] },
      evidence: studyEvidence,
    }), /主用神|取用/);
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
