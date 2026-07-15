const assert = require('node:assert/strict');
const test = require('node:test');
const {
  analyzeCloud,
  createLocalReport,
  followUpCloud,
  postChat: requestAIResponse,
  reasoningPlan,
  validateMarkdownReport,
} = require('./ai.cjs');
const {
  buildAnalysisSystemPrompt,
  buildFollowUpSystemPrompt,
} = require('./system-prompt.cjs');

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
  fuShen: [{ lineIndex: 4, relation: '子孙', ganZhi: '庚午', branch: '午', element: '火', flyRelation: '父母', flyGanZhi: '丁亥', void: true, monthBreak: false, dayClash: true }],
};

const evidence = [{
  id: 'E1',
  source: '增删卜易',
  location: '用神章',
  text: '占学业以父母为用神，考试名次兼看官鬼。',
  sourceType: 'original',
  knowledgeKind: 'rule',
  topics: ['学业'],
}];

const plateCitation = '[排盘事实](#plate-facts)';
const evidenceCitation = '[《增删卜易》·用神章](#evidence-E1)';

const markdown = `## 核心判断

**判断：** 当前宜保持既定目标。

> **依据：** 本卦泽雷随，无动爻；父母庚子临日辰戊子，学业载体有现实支撑。
>
> **古籍来源：** 《增删卜易》·用神章（证据 E1）

### 建议

**判断：** 按既定计划推进。

> **依据：** 本卦泽雷随无动爻，宜保持既定节奏。

**判断：** 当前不硬定日期。

> **依据：** 原卦无动爻，日辰戊子未提供足够触发信息。
`;

const strictMarkdown = [
  '## 1. 占问主题',
  `- 核心问题是学业会好吗，属于学业占问，当前目标是判断结果如何。${plateCitation}`,
  '',
  '## 2. 信息完整度判断',
  `- 已知本卦泽雷随、变卦泽雷随、月建乙未、日辰戊子且本卦无动爻。${plateCitation}`,
  `- 信息不足会影响判断，当前可以做有限分析但不能精断应期。${plateCitation}`,
  '',
  '## 3. 用神与世应定位',
  `- 当前取父母爻为学业用神，主用神候选为父母庚子和父母丁亥；另一种取法会改变旺衰比较的重点。${evidenceCitation}`,
  `- 世爻为第3爻妻财庚辰，应爻为第6爻妻财丁未，分别代表问卦者与外部结果对应面。${plateCitation}`,
  '',
  '## 4. 用神旺衰与状态',
  `- 父母庚子临日辰戊子，当前用神状态有可核对的日辰支撑。${evidenceCitation}`,
  `- 盘面同时提供旬空与伏神信息，但完整旺衰仍需结合月建和日辰细判。${plateCitation}`,
  '',
  '## 5. 生克制化分析',
  `- 原神、忌神和仇神需要围绕父母用神逐一核对，当前不把古籍规则直接当作本卦结论。${evidenceCitation}`,
  '',
  '## 6. 动爻与变爻分析',
  `- 本卦无动爻，因此没有可据以判断动而化进、化退或回头生克的动变链条。${evidenceCitation}`,
  '',
  '## 7. 世应关系分析',
  `- 世爻为第3爻妻财庚辰，应爻为第6爻妻财丁未，世应关系应结合旺衰再判断主动被动。${evidenceCitation}`,
  '',
  '## 8. 辅助因素修正',
  `- 伏神子孙庚午伏于第4爻，可作为用神不现或取用争议时的辅助信息。${evidenceCitation}`,
  '',
  '## 9. 综合结论',
  `- 当前只能作不足判断，不能据现有信息确定学业结果为吉或凶。${evidenceCitation}`,
  `- 最大限制是缺少足够动变信息，因此关键转机和卡点暂不能精断。${plateCitation}`,
  '',
  '## 10. 应期判断（若可判断）',
  `- 应期不足以精断，当前不硬猜具体日期。${evidenceCitation}`,
  '',
  '## 11. 最终一句话结论',
  `- 前提是补充完整排盘与占问背景后，才能进一步判断学业结果。${evidenceCitation}`,
].join('\n');

function mockDeepSeek(content, inspect) {
  const originalFetch = global.fetch;
  const responses = Array.isArray(content) ? content : [content];
  let callIndex = 0;
  global.fetch = async (url, options) => {
    inspect?.(url, options, callIndex);
    const responseContent = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: responseContent } }] }),
    };
  };
  return () => { global.fetch = originalFetch; };
}

async function validateRequestedMarkdown(options) {
  const content = await requestAIResponse(options);
  return validateMarkdownReport(content, 'AI 解读', {
    plate: options.plate,
    evidence: options.evidence,
    strictStructure: options.strictStructure,
  });
}

// Validation remains testable as an optional diagnostic, but it is deliberately
// no longer part of the production response-delivery path.
const validateMarkdownDiagnostic = validateRequestedMarkdown;

test('initial analysis prompt requires the strict 11-section Markdown contract with inline citations', () => {
  const analysisPrompt = buildAnalysisSystemPrompt(studyPlate);

  assert.match(analysisPrompt, /Markdown/);
  assert.match(analysisPrompt, /严格按以下 11 个章节和顺序输出/);
  assert.match(analysisPrompt, /信息不足会影响判断/);
  assert.match(analysisPrompt, /每个判断句、事实句、条件句、应期句和最终结论句的句末/);
  assert.match(analysisPrompt, /\[排盘事实\]\(#plate-facts\)/);
  assert.match(analysisPrompt, /\[《书名》·位置\]\(#evidence-ID\)/);
  assert.match(analysisPrompt, /禁止把八字、奇门、紫微等其他体系混入六爻判断/);
  assert.doesNotMatch(analysisPrompt, /不要求固定章节|自行组织标题/);
});

test('follow-up prompt requires a focused conversational answer instead of the initial 11-section report', () => {
  const followUpPrompt = buildFollowUpSystemPrompt();

  assert.match(followUpPrompt, /Markdown/);
  assert.match(followUpPrompt, /先直接回答/);
  assert.match(followUpPrompt, /只展开与本次追问直接相关/);
  assert.match(followUpPrompt, /不得重起卦/);
  assert.match(followUpPrompt, /\[排盘事实\]\(#plate-facts\)/);
  assert.match(followUpPrompt, /\[《书名》·位置\]\(#evidence-ID\)/);
  assert.doesNotMatch(followUpPrompt, /严格按以下 11 个章节和顺序输出/);
  assert.doesNotMatch(followUpPrompt, /章节标题必须严格使用以下文本并保持顺序/);
  assert.doesNotMatch(followUpPrompt, /仍必须输出完整 11 个章节/);
});

test('postChat requests text output and returns the response verbatim without JSON parsing', async () => {
  let requestBody;
  const restore = mockDeepSeek(markdown, (_url, options) => {
    requestBody = JSON.parse(options.body);
  });
  try {
    const result = await requestAIResponse({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });

    assert.equal(result, markdown);
    assert.equal(Object.hasOwn(requestBody, 'response_format'), false);
  } finally {
    restore();
  }
});

test('postChat returns any non-empty AI response verbatim without format-gated failure or rewrite', async () => {
  const unstructuredResponse = '先说结论：这次可以继续推进。\n\n这里没有编号章节，也没有引用标签。';
  const requests = [];
  const restore = mockDeepSeek(unstructuredResponse, (_url, options) => {
    requests.push(JSON.parse(options.body));
  });
  try {
    const result = await requestAIResponse({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
      strictStructure: true,
    });

    assert.equal(result, unstructuredResponse);
    assert.equal(requests.length, 1);
  } finally {
    restore();
  }
});

test('optional Markdown diagnostics accept a real chapter heading found inside the supplied evidence text', async () => {
  const chapterEvidence = [{
    ...evidence[0],
    id: 'E2',
    location: '具体占例标题 · 原文第 100-120 行',
    text: '两现章第三十二。用神两现，宜比较旺衰动静。',
  }];
  const chapterMarkdown = `## 用神取舍

**判断：** 用神两现时需要比较两爻状态。

> **依据：** 本卦泽雷随无动爻，父母庚子与父母丁亥同现。
>
> **古籍来源：** 《增删卜易》·两现章第三十二（证据 E2）`;
  const restore = mockDeepSeek(chapterMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence: chapterEvidence,
    });
    assert.equal(result, chapterMarkdown);
  } finally {
    restore();
  }

  const shortChapterMarkdown = chapterMarkdown.replace('两现章第三十二', '两现章');
  const restoreShortChapter = mockDeepSeek(shortChapterMarkdown);
  try {
    assert.equal(await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence: chapterEvidence,
    }), shortChapterMarkdown);
  } finally {
    restoreShortChapter();
  }
});

test('postChat preserves standalone disclaimers instead of rewriting the AI response', async () => {
  for (const disclaimer of [
    '以上分析仅供传统文化研究参考，不构成学业决策依据。',
    '以上推算结果由DeepSeek生成，仅供传统文化研究参考，切勿将其作为现实决策依据。',
    '## 风险边界\n\n**判断：** 本解读仅供娱乐。\n\n> **依据：** 本卦泽雷随无动爻。',
  ]) {
    const markdownWithDisclaimer = `${markdown}\n\n${disclaimer}`;
    let requestCount = 0;
    const restore = mockDeepSeek(markdownWithDisclaimer, () => { requestCount += 1; });
    try {
      const result = await requestAIResponse({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate: studyPlate,
        evidence,
      });
      assert.equal(result, markdownWithDisclaimer);
      assert.equal(requestCount, 1);
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics reject structured output and basis blocks without plate facts', async () => {
  for (const invalidContent of [
    '{"summary":"结构化结果"}',
    '## 判断\n\n建议继续推进。',
    '## 判断\n\n建议继续推进。\n\n> **依据：** 《增删卜易》说应当如此。',
  ]) {
    const restore = mockDeepSeek(invalidContent);
    try {
      await assert.rejects(
        validateMarkdownDiagnostic({
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          apiKey: 'secret',
          messages: [{ role: 'user', content: '分析' }],
          plate: studyPlate,
          evidence,
        }),
        /结构化内容|没有在判断后提供|可核对的本卦事实|只给古籍规则|只能写当前排盘事实/,
      );
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics accept links at the start and nested list basis quotes', async () => {
  const flexibleMarkdown = `[查看依据](#evidence-E1)

- 建议继续推进。
  > **依据：** 本卦泽雷随无动爻，日辰为戊子。`;
  const restore = mockDeepSeek(flexibleMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });
    assert.equal(result, flexibleMarkdown);
  } finally {
    restore();
  }
});

test('optional Markdown diagnostics distinguish visible-line, changed-line and hidden-spirit facts', async () => {
  const hiddenSpiritMarkdown = `## 取用提示

**判断：** 学业用神需要结合飞伏关系判断。

> **依据：** 第四爻本爻父母丁亥，下伏伏神子孙庚午；飞神父母丁亥。`;
  const restore = mockDeepSeek(hiddenSpiritMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });
    assert.equal(result, hiddenSpiritMarkdown);
  } finally {
    restore();
  }

  const changingPlate = {
    ...studyPlate,
    movingLines: [4],
    lines: studyPlate.lines.map((line) => line.index === 4
      ? { ...line, moving: true, changedRelation: '官鬼', changedGanZhi: '甲申' }
      : line),
  };
  const changedLineMarkdown = `## 动变

**判断：** 第四爻发动会带来新的约束阶段。

> **依据：** 第四爻本爻父母丁亥发动，动化官鬼甲申。`;
  const restoreChanged = mockDeepSeek(changedLineMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: changingPlate,
      evidence,
    });
    assert.equal(result, changedLineMarkdown);
  } finally {
    restoreChanged();
  }

  const adjacentTopicMarkdown = `## 用神

**判断：** 学业应以父母爻为主要观察对象。

> **依据：** 第三爻妻财庚辰为世爻，父母为学业用神；第四爻本爻父母丁亥。`;
  const restoreAdjacent = mockDeepSeek(adjacentTopicMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });
    assert.equal(result, adjacentTopicMarkdown);
  } finally {
    restoreAdjacent();
  }

  const statusMarkdown = `## 爻位状态

**判断：** 当前盘里需要留意旬空与日冲。

> **依据：** 第六爻妻财丁未旬空；第四爻下伏伏神子孙庚午日冲。`;
  const restoreStatus = mockDeepSeek(statusMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });
    assert.equal(result, statusMarkdown);
  } finally {
    restoreStatus();
  }

  const roleMarkdown = `## 世爻

**判断：** 当前问题在于精力分散，难以专注，而非能力不足。

> **依据：** 第一爻父母庚子水被世爻之土所克（庚辰土克庚子水）；第三爻世爻妻财辰土直接克制用神父母庚子水；日辰戊子。`;
  const restoreRole = mockDeepSeek(roleMarkdown);
  try {
    const result = await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });
    assert.equal(result, roleMarkdown);
  } finally {
    restoreRole();
  }

  for (const scopedBasis of ['本爻官鬼甲申', '变卦爻父母丁亥', '变为父母丁亥', '变出父母丁亥', '变作父母丁亥', '化作父母丁亥']) {
    const invalidScopedMarkdown = `## 动变

**判断：** 第四爻本变信息需要复核。

> **依据：** ${scopedBasis}，日辰戊子。`;
    const restoreScoped = mockDeepSeek(invalidScopedMarkdown);
    try {
      await assert.rejects(
        validateMarkdownDiagnostic({
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          apiKey: 'secret',
          messages: [{ role: 'user', content: '分析' }],
          plate: changingPlate,
          evidence,
        }),
        /当前盘面不存在的(?:本爻|变爻)/,
      );
    } finally {
      restoreScoped();
    }
  }
});

test('optional Markdown diagnostics reject shared basis blocks and facts that contradict the current plate', async () => {
  for (const [caseIndex, invalidContent] of [
    `## 判断

第一条判断。

第二条判断。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

第三爻是关键动爻。

> **依据：** 三爻发动，甲子日冲。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《未知古籍》·未知位置（证据 UNKNOWN）`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。

- 保持耐心。`,
    `## 判断

**判断：** 当前条件仍需谨慎核对。

> **依据：** 第五爻为世爻，月建戊子，日辰乙未。`,
    `## 判断

**判断：** 当前条件仍需谨慎核对。

> **依据：** 世爻父母辰土，日辰戊子。`,
    `## 判断

**判断：** 三爻是本次分析重点。

> **依据：** 第三爻庚子。`,
    `## 判断

**判断：** 四爻伏神是分析重点。

> **依据：** 第四爻下伏官鬼庚午。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《伪造书》·伪造章（证据 E1）`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
> 第五爻为世爻，月建戊子；第四爻伏神官鬼庚午。`,
    `## 判断

**判断：** 初爻状态不稳。

> **依据：** 第一爻父母庚子旬空。`,
    `## 判断

**判断：** 初爻状态不稳。

> **依据：** 第一爻父母庚子月破。`,
    `## 判断

**判断：** 初爻状态不稳。

> **依据：** 第一爻父母庚子日冲。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《伪造书》·伪造章`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** [《火珠林》·卷九](#evidence-E1)`,
    `## 判断

**判断：** 当前可以推进；下周会有结果。

> **依据：** 本卦泽雷随无动爻。`,
    `## 结论：事业必成

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**事业必成**

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **判断：** 下周必成。`,
    `## 判断

**判断：** 初爻状态不稳。

> **依据：** 第一爻父母庚子，旬空。`,
    `## 判断

**判断：** 当前状态不稳。

> **依据：** 世爻妻财辰土旬空。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子发动。`,
    `## 判断

**判断：** 当前可以推进，下周会有结果。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

| 项目 | 判断 |
| --- | --- |
| 行动 | 可以推进 |
| 应期 | 下周有结果 |

> **依据：** 本卦泽雷随无动爻。`,
    `## 大吉

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 事业可期

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 是否能成：一定能成

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

事业必成，仅供传统文化研究。

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。下周必成。`,
    `## 判断

**判断：** 当前可以推进，最快下周有结果。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 父母爻受制，下周会失败。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 父母爻受制，建议暂缓。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 父母爻受制，最好暂缓。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 父母爻受制，必须暂缓。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 父母爻受制，不应继续。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前可以推进，七日内有结果。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前可以推进，约一周后有结果。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前可以推进，待到申日有结果。

> **依据：** 本卦泽雷随无动爻。`,
    ...['宜进不宜退', '先难后易', '谨慎推进', '暂缓为宜', '吉', '宜行', '前途不错', '吉凶参半'].map((heading) => `## ${heading}

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`),
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 第一爻动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 第四爻独动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子已动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 第四爻也动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 第一爻（动），日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子爻动，日辰戊子。`,
    ...['静卦之说不但不成立', '静卦之说不仅不成立'].map((movementFact) => `## 判断

**判断：** 当前事情会有变化。

> **依据：** 本卦泽雷随${movementFact}，日辰戊子。`),
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 本卦泽雷随静卦之说既不成立也不准确，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子不受制而发动，日辰戊子。`,
    ...['未受制而发动', '并非受制而发动', '没有受制而发动', '未受克而发动'].map((movementFact) => `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子${movementFact}，日辰戊子。`),
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子并非没有发动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子不受制所以发动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子不受制并发动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 父母庚子不能简单地说没有发动，日辰戊子。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 世爻妻财庚辰动，日辰戊子。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 世爻（父母庚子），日辰戊子。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建（戊子）—日辰（乙未）。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建即戊子，日辰即乙未。`,
    `## 宜进策略

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻，故此事能成。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻，故结果不错。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻，故以后走势较好。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻，因此用不了多久就会见效。`,
    `## 判断

**判断：** 当前受阻，故应暂缓。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《增删卜易》·用神章（证据 E1）
> **判断：** 下周必成。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《增删卜易》·用神章（证据 E1）
> 下周必成。`,
    `## 判断

**判断：** 当前计划可以继续推进。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** 《增删卜易》·用神章（证据 E1）${'  '}
> 下周必成。`,
    `## 判断

**判断：** 当前事情会有变化。

> **依据：** 本卦泽雷随有动爻。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建对应戊子，日辰对应乙未。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建对应的干支为戊子，日辰对应的干支为乙未。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建的干支是戊子，日辰的干支是乙未。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建干支为戊子，日辰干支为乙未。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建干支：戊子，日辰干支：乙未。`,
    `## 判断

**判断：** 当前信息需要复核。

> **依据：** 月建干支乃戊子，日辰干支乃乙未。`,
    `## 判断

**判断：** 当前资料需要复核。

> **依据：** 本卦泽雷随无动爻。
>
> **古籍来源：** [查看原文](#evidence-E1)`,
    ...['父母（丁酉）', '父母—丁酉', '父母即丁酉'].map((fact) => `## 判断

**判断：** 当前六亲信息需要复核。

> **依据：** ${fact}，日辰戊子。`),
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 父母持世，日辰戊子。`,
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 父母爻（持世），日辰戊子。`,
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 父母 持世，日辰戊子。`,
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 父母爻为世，日辰戊子。`,
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 世爻属父母，日辰戊子。`,
    `## 判断

**判断：** 当前世爻信息需要复核。

> **依据：** 父母爻居世位，日辰戊子。`,
    `## 判断

**判断：** 当前伏神信息需要复核。

> **依据：** 伏神父母庚子，日辰戊子。`,
    `## 判断

**判断：** 当前本爻信息需要复核。

> **依据：** 本爻子孙庚午，日辰戊子。`,
    `## 吉中有忧

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
    `## 稳中向好

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
    `## 稳中趋好

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

[事业必成](https://example.com)

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
    `## 判断

[依据：事业必成](#evidence-E1)

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
  ].entries()) {
    const restore = mockDeepSeek(invalidContent);
    try {
      await assert.rejects(
        validateMarkdownDiagnostic({
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          apiKey: 'secret',
          messages: [{ role: 'user', content: '分析' }],
          plate: studyPlate,
          evidence,
        }),
        /不能共用|没有立即给出|不存在的干支|当前盘面不存在|误写成动爻|误写成“世爻”|月建误写|日辰误写|干支误写|六亲误写|状态误写|错误配对|动静状态误写|写成了有动爻|未提供的古籍证据|必须标明.*证据 ID|必须同时标明书名和位置|必须单独标明书名和位置|书名误写|位置误写|多条独立判断|标题不能|不是中性主题|引用块只能|表格可能合并|段内夹带|只能写当前排盘事实|模型署名|免责声明|通用尾注/,
        `invalid Markdown case ${caseIndex} should be rejected: ${invalidContent.replace(/\s+/g, ' ').slice(0, 100)}`,
      );
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics validate terse moving-line wording and comma continuations', async () => {
  const movingPlate = {
    ...studyPlate,
    movingLines: [4],
    lines: studyPlate.lines.map((line) => line.index === 4 ? { ...line, moving: true } : line),
  };
  const invalidStaticClaims = [
    '第四爻本爻父母丁亥，不动',
    '父母丁亥，静爻',
    '父母丁亥不动',
    '第四爻安静不动',
    '父母丁亥未动',
    '父母丁亥未曾发动',
    '父母丁亥未见发动',
    '父母丁亥未见有发动',
    '父母丁亥未见爻动',
    '父母丁亥未见明显发动',
    '父母丁亥没有任何爻动',
    '父母丁亥未观察到发动',
    '父母丁亥没有再发动',
    '父母丁亥没有发动',
    '父母丁亥并未因此发动',
    '父母丁亥未见后续发动',
    '父母丁亥未转而发动',
    '第四爻不受制而未直接发动',
    '第四爻未受制而没有直接发动',
    '第四爻不受制但未转而发动',
    '第四爻目前并未直接发动',
    '第四爻不但没有发动而且保持安静',
    '第四爻不仅没有发动而且保持安静',
    '第四爻不但未发动',
    '第四爻发动之说不但不成立',
    '第四爻发动之说不仅不成立',
    '第四爻发动之说不成立',
    '第四爻静',
    '第四爻不受制而静',
    '第四爻未受制而静',
    '第四爻并非受制而静',
    '第四爻没有受制而静',
    '第四爻未受克而静',
    '本卦泽雷随没有动爻',
    '本卦泽雷随整卦皆静',
    '本卦泽雷随六爻皆不动',
    '本卦泽雷随全卦均未发动',
    '本卦泽雷随整卦没有一爻发动',
  ];
  for (const basis of invalidStaticClaims) {
    const invalidMarkdown = `## 动爻

**判断：** 当前动静信息需要复核。

> **依据：** ${basis}，日辰戊子。`;
    const restore = mockDeepSeek(invalidMarkdown);
    try {
      await assert.rejects(
        validateMarkdownDiagnostic({
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          apiKey: 'secret',
          messages: [{ role: 'user', content: '分析' }],
          plate: movingPlate,
          evidence,
        }),
        /动静状态误写|写成了静卦/,
      );
    } finally {
      restore();
    }
  }

  for (const basis of [
    '第四爻动',
    '父母丁亥动',
    '父母丁亥爻动',
    '父母丁亥不受制而发动',
    '父母丁亥并非没有发动',
    '父母丁亥不受制所以发动',
    '父母丁亥不受制并发动',
    '父母丁亥不受制依然发动',
    '父母丁亥不受制直接发动',
    '父母丁亥不受制依旧发动',
    '父母丁亥不受制照常发动',
    '父母丁亥未受制而发动',
    '父母丁亥并非受制而发动',
    '父母丁亥没有受制而发动',
    '父母丁亥未受克而发动',
    '父母丁亥不受制而直接发动',
    '父母丁亥未受制但转而发动',
    '父母丁亥目前直接发动',
    '父母丁亥不但发动',
    '父母丁亥不仅发动',
    '全卦静卦之说不但不成立',
    '全卦静卦之说不仅不成立',
    '全卦静卦之说既不成立也不准确',
    '父母丁亥不能简单地说没有发动',
    '全卦无动爻之说并不成立',
  ]) {
    const validMarkdown = `## 动爻

**判断：** 第四爻是当前变化来源。

> **依据：** ${basis}，日辰戊子。`;
    const restore = mockDeepSeek(validMarkdown);
    try {
      assert.equal(await validateMarkdownDiagnostic({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate: movingPlate,
        evidence,
      }), validMarkdown);
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics handle natural role, calendar, advice, title and negated movement wording', async () => {
  const movingPlate = {
    ...studyPlate,
    movingLines: [4],
    lines: studyPlate.lines.map((line) => line.index === 4 ? { ...line, moving: true } : line),
  };
  const invalidCases = [
    {
      content: `## 动静

**判断：** 当前排盘存在变化。

> **依据：** 本卦泽雷随，当前不是静卦；日辰戊子。`,
      expected: /写成了有动爻/,
    },
    ...[
      `> **古籍来源：** 《增删卜易》·用神章（证据 E1）

## 判断

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
      `## 判断

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。

> **古籍来源：** 《增删卜易》·用神章（证据 E1）`,
    ].map((content) => ({ content, expected: /古籍来源.*必须位于对应.*依据/ })),
    ...['当前若干信息不足，建议暂缓', '父母爻宛若受制，建议暂缓', '父母爻宛若不稳，建议暂缓', '当前表现不若以往，建议暂缓', '当前神情若有所思，建议暂缓'].map((judgment) => ({
      content: `## 判断

**判断：** ${judgment}。

> **依据：** 本卦泽雷随无动爻。`,
      expected: /多条独立判断/,
    })),
    {
      content: `## 判断

**判断：** 父母爻受制，可暂缓。

> **依据：** 本卦泽雷随无动爻。`,
      expected: /多条独立判断/,
    },
    {
      content: `## 判断

**判断：** 父母爻受制，不妨等待。

> **依据：** 本卦泽雷随无动爻。`,
      expected: /多条独立判断/,
    },
    {
      content: `## 判断

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻，可暂缓。`,
      expected: /只能写当前排盘事实/,
    },
    ...['乐观展望', '悲观预期', '形势改善', '走势恶化', '前景堪忧', '后市看好', '可暂缓', '不妨等待'].map((heading) => ({
      content: `## ${heading}

**判断：** 当前计划需要继续观察。

> **依据：** 本卦泽雷随无动爻。`,
      expected: /不是中性主题/,
    })),
    ...['父母爻处于世位', '父母爻位于世位', '世位落在父母爻'].map((roleFact) => ({
      content: `## 世应

**判断：** 当前世爻信息需要复核。

> **依据：** ${roleFact}，日辰戊子。`,
      expected: /六亲误写/,
    })),
  ];

  for (const { content, expected } of invalidCases) {
    const restore = mockDeepSeek(content);
    try {
      await assert.rejects(validateMarkdownDiagnostic({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate: studyPlate,
        evidence,
      }), expected, content.replace(/\s+/g, ' ').slice(0, 100));
    } finally {
      restore();
    }
  }

  const validCases = [
    {
      plate: studyPlate,
      basis: '[查看证据（E1）](#evidence-E1)\n\n## 证据导航\n\n**判断：** 当前排盘适合继续观察。\n\n> **依据：** 本卦泽雷随无动爻，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 动爻\n\n**判断：** 全卦当前没有动爻。\n\n> **依据：** 全卦有动爻之说并不成立，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 动爻\n\n**判断：** 全卦当前没有动爻。\n\n> **依据：** 本卦泽雷随，全卦有动爻之说并非事实；日辰戊子。',
    },
    {
      plate: movingPlate,
      basis: '## 动爻\n\n**判断：** 全卦当前存在动爻。\n\n> **依据：** 全卦无动爻之说并不成立，日辰戊子。',
    },
    {
      plate: movingPlate,
      basis: '## 动爻\n\n**判断：** 全卦当前存在动爻。\n\n> **依据：** 本卦泽雷随，全卦无动爻之说并非事实；日辰戊子。',
    },
    ...['未见有动爻', '尚未有动爻', '不曾有动爻'].map((movementFact) => ({
      plate: studyPlate,
      basis: `## 动爻\n\n**判断：** 全卦当前没有动爻。\n\n> **依据：** 本卦泽雷随，${movementFact}；日辰戊子。`,
    })),
    ...['并非没有动爻', '不是没有动爻'].map((movementFact) => ({
      plate: movingPlate,
      basis: `## 动爻\n\n**判断：** 全卦当前存在动爻。\n\n> **依据：** 本卦泽雷随，${movementFact}；日辰戊子。`,
    })),
    ...['当前并非静卦', '当前不是静卦', '静卦之说并不成立'].map((movementFact) => ({
      plate: movingPlate,
      basis: `## 动静\n\n**判断：** 全卦当前存在动爻。\n\n> **依据：** 本卦泽雷随，${movementFact}；日辰戊子。`,
    })),
    {
      plate: studyPlate,
      basis: '## 日月\n\n**判断：** 日月与爻位关系需要结合分析。\n\n> **依据：** 月建作用于父母庚子，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 日月\n\n**判断：** 月建干支为乙未。\n\n> **依据：** 月建并非戊子而是乙未，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 取用\n\n**判断：** 卦中父母两现，应优先选取初爻庚子父母为当前主要判断坐标。\n\n> **依据：** 初爻父母庚子与四爻父母丁亥同现，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 学业\n\n**判断：** 学业若要有所成，必须借助师长的指导。\n\n> **依据：** 初爻父母庚子与五爻官鬼丁酉同现，日辰戊子。',
    },
    ...[
      ['健康', '健康若要好转，需要持续调养'],
      ['出行', '出行若要顺利，需要提前准备'],
      ['失物', '失物若要寻回，需要尽快查找'],
    ].map(([heading, judgment]) => ({
      plate: studyPlate,
      basis: `## ${heading}\n\n**判断：** ${judgment}。\n\n> **依据：** 本卦泽雷随无动爻，日辰戊子。`,
    })),
    {
      plate: studyPlate,
      basis: '## 世应\n\n**判断：** 世爻是当前分析重点。\n\n> **依据：** 妻财爻处于世位，世位落在妻财爻，日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 世应\n\n**判断：** 世爻与官鬼之间存在相互作用。\n\n> **依据：** 世爻庚辰土与官鬼丁酉金形成辰酉六合互动；日辰戊子。',
    },
    {
      plate: studyPlate,
      basis: '## 取用\n\n**判断：** 兄弟爻不作为当前主要判断依据。\n\n> **依据：** 第二爻兄弟庚寅，日辰戊子。',
    },
  ];

  for (const { plate, basis } of validCases) {
    const restore = mockDeepSeek(basis);
    try {
      assert.equal(await validateMarkdownDiagnostic({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate,
        evidence,
      }), basis);
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics keep neutral free-form headings, multi-sentence facts and correct negative movement', async () => {
  const validCases = [
    `[查看证据 E1](#evidence-E1)

## 证据导航

**判断：** 当前排盘适合继续观察。

> **依据：** 本卦泽雷随无动爻，日辰戊子。`,
    `[查看证据：E1](#evidence-E1)

## 证据导航

**判断：** 当前排盘适合继续观察。

> **依据：** 本卦泽雷随无动爻，日辰戊子。`,
    `## 关键依据

**判断：** 当前排盘适合继续观察。

> **依据：** 本卦泽雷随，无动爻。月建乙未，日辰戊子。`,
    `## 动爻

**判断：** 当前排盘不存在动爻。

> **依据：** 本卦泽雷随，当前没有动爻；日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 第一爻父母庚子未发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子没有发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未曾发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未见发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未见有发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未见爻动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未见明显发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子没有任何爻动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子未观察到发动，日辰戊子。`,
    `## 动爻

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子没有再发动，日辰戊子。`,
    `## 动静

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子不受制而静，日辰戊子。`,
    ...['未受制而静', '并非受制而静', '没有受制而静', '未受克而静'].map((movementFact) => `## 动静

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子${movementFact}，日辰戊子。`),
    ...[
      '不受制而未直接发动',
      '未受制而没有直接发动',
      '不受制但未转而发动',
      '目前并未直接发动',
      '不但没有发动而且保持安静',
      '不仅没有发动而且保持安静',
      '不但未发动',
    ].map((movementFact) => `## 动静

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子${movementFact}，日辰戊子。`),
    ...['发动之说不但不成立', '发动之说不仅不成立'].map((movementFact) => `## 动静

**判断：** 初爻当前保持安静。

> **依据：** 父母庚子${movementFact}，日辰戊子。`),
    `## 动静

**判断：** 第四爻当前保持安静。

> **依据：** 第四爻发动之说不成立，日辰戊子。`,
    `## 考试表现

**判断：** 官鬼丁酉得世爻相生，考试名次与外部评价可获助力。

> **依据：** 第五爻官鬼丁酉，第三爻世爻妻财庚辰土生酉金；日辰戊子。`,
    `## 世爻状态

**判断：** 当前需要留意世爻对学业用神的影响。

> **依据：** 妻财持世，日辰戊子；初爻父母庚子为学业用神。`,
    `## 学业分析：用神取舍

**判断：** 当前需要比较两处父母爻。

> **依据：** 初爻父母庚子与四爻父母丁亥同现；日辰戊子。`,
  ];
  for (const validMarkdown of validCases) {
    const restore = mockDeepSeek(validMarkdown);
    try {
      assert.equal(await validateMarkdownDiagnostic({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate: studyPlate,
        evidence,
      }), validMarkdown);
    } finally {
      restore();
    }
  }
});

test('optional Markdown diagnostics validate every literal evidence citation on the same line', async () => {
  const evidenceWithSecondSource = [
    ...evidence,
    {
      ...evidence[0],
      id: 'E2',
      source: '火珠林',
      location: '卷一',
      text: '占事先观用神。',
    },
  ];
  const invalidMarkdown = `## 用神

**判断：** 当前用神需要结合两条资料复核。

> **依据：** 本卦泽雷随无动爻，日辰戊子。
>
> **古籍来源：** 《增删卜易》·用神章（证据 E1）；《增删卜易》·用神章（证据 E2）`;
  const restore = mockDeepSeek(invalidMarkdown);
  try {
    await assert.rejects(
      validateMarkdownDiagnostic({
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-pro',
        apiKey: 'secret',
        messages: [{ role: 'user', content: '分析' }],
        plate: studyPlate,
        evidence: evidenceWithSecondSource,
      }),
      /证据 E2 的书名误写/,
    );
  } finally {
    restore();
  }

  const bareIdMarkdown = `## 用神

**判断：** 学业用神需要结合古籍规则复核。

> **依据：** 本卦泽雷随无动爻，日辰戊子。
>
> **古籍来源：** 《增删卜易》·用神章（E1）`;
  const restoreBareId = mockDeepSeek(bareIdMarkdown);
  try {
    assert.equal(await validateMarkdownDiagnostic({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    }), bareIdMarkdown);
  } finally {
    restoreBareId();
  }
});

test('optional Markdown diagnostics reject swapped base and changed hexagram labels', async () => {
  const distinctPlate = {
    ...studyPlate,
    baseHexagram: { ...studyPlate.baseHexagram, name: '乾为天' },
    changedHexagram: { ...studyPlate.changedHexagram, name: '坤为地' },
  };
  for (const swappedBasis of [
    '本卦坤为地，变卦乾为天；日辰戊子。',
    '本卦 **坤为地**，变卦 **乾为天**；日辰戊子。',
    '坤为地为本卦，乾为天为变卦；日辰戊子。',
    '主卦坤为地，变卦乾为天；日辰戊子。',
    '本卦（坤为地）—变卦（乾为天）；日辰戊子。',
    '本卦即坤为地，变卦即乾为天；日辰戊子。',
  ]) {
    const swappedMarkdown = `## 卦象

**判断：** 当前卦象需要继续观察。

> **依据：** ${swappedBasis}`;
    const restore = mockDeepSeek(swappedMarkdown);
    try {
      await assert.rejects(
        validateMarkdownDiagnostic({
          baseUrl: 'https://api.deepseek.com',
          model: 'deepseek-v4-pro',
          apiKey: 'secret',
          messages: [{ role: 'user', content: '分析' }],
          plate: distinctPlate,
          evidence,
        }),
        /误写成了本卦|误写成了变卦/,
      );
    } finally {
      restore();
    }
  }
});

test('postChat returns an invalidly formatted draft without issuing a rewrite request', async () => {
  const invalidDraft = `## 判断

第一条判断。

第二条判断。

> **依据：** 本卦泽雷随无动爻。`;
  const requests = [];
  const restore = mockDeepSeek(invalidDraft, (_url, options) => requests.push(JSON.parse(options.body)));
  try {
    const result = await requestAIResponse({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      messages: [{ role: 'user', content: '分析' }],
      plate: studyPlate,
      evidence,
    });

    assert.equal(result, invalidDraft);
    assert.equal(requests.length, 1);
  } finally {
    restore();
  }
});

test('cloud analysis requests the strict 11-section structure and returns the AI response in one Markdown field', async () => {
  let requestBody;
  const restore = mockDeepSeek(strictMarkdown, (_url, options) => {
    requestBody = JSON.parse(options.body);
  });
  try {
    const report = await analyzeCloud({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      question: '学业会好吗？',
      category: 'study',
      plate: studyPlate,
      evidence,
      retrievalDiagnostics: { mode: 'hybrid-fused', warnings: [] },
    });

    assert.equal(report.mode, 'cloud');
    assert.equal(report.markdown, strictMarkdown.trim());
    assert.equal(Object.hasOwn(report, 'summary'), false);
    assert.equal(Object.hasOwn(report, 'claims'), false);
    assert.equal(Object.hasOwn(requestBody, 'response_format'), false);
    const payload = JSON.parse(requestBody.messages[1].content);
    assert.equal(payload.question, '学业会好吗？');
    assert.equal(payload.responseFormat, 'markdown');
    assert.deepEqual(payload.evidence.map((item) => item.id), ['E1']);
    assert.equal(payload.reasoningPlan.immutableFacts.baseHexagram, '泽雷随');
  } finally {
    restore();
  }
});

test('cloud analysis and follow-up preserve unstructured AI responses', async () => {
  const initialResponse = '首次解读没有标题，但内容可以直接展示。';
  const followUpResponse = '{"answer":"追问也按原样展示"}';
  const restore = mockDeepSeek([initialResponse, followUpResponse]);
  try {
    const report = await analyzeCloud({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      question: '学业会好吗？',
      category: 'study',
      plate: studyPlate,
      evidence,
      retrievalDiagnostics: { mode: 'hybrid-fused', warnings: [] },
    });
    const answer = await followUpCloud({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      question: '再说具体一点',
      session: {
        question: '学业会好吗？',
        category: 'study',
        plate: studyPlate,
        analysis: report,
        messages: [],
      },
      evidence,
    });

    assert.equal(report.markdown, initialResponse);
    assert.deepEqual(answer, { content: followUpResponse });
  } finally {
    restore();
  }
});

test('follow-up continues the same plate with a focused conversational response contract', async () => {
  let requestBody;
  const followUpMarkdown = `午日或未日是这次恢复最值得观察的时间点。${plateCitation}\n\n判断依据是世爻午火与变爻未土当前旬空，待出空后恢复信号才会真正落实。${plateCitation}`;
  const restore = mockDeepSeek(followUpMarkdown, (_url, options) => {
    requestBody = JSON.parse(options.body);
  });
  try {
    const answer = await followUpCloud({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
      apiKey: 'secret',
      question: '什么时候有结果？',
      session: {
        question: '学业会好吗？',
        category: 'study',
        plate: studyPlate,
        analysis: { mode: 'cloud', markdown, generatedAt: new Date().toISOString() },
        messages: [{ role: 'user', content: '什么时候有结果？' }],
      },
      evidence,
    });

    assert.deepEqual(answer, { content: followUpMarkdown });
    assert.equal(Object.hasOwn(requestBody, 'response_format'), false);
    const context = JSON.parse(requestBody.messages[1].content);
    assert.equal(context.originalReport, markdown);
    assert.equal(context.plate.baseHexagram.name, '泽雷随');
    assert.equal(context.responseMode, 'focused-follow-up');
    assert.match(requestBody.messages[0].content, /先直接回答/);
    assert.doesNotMatch(requestBody.messages[0].content, /严格按以下 11 个章节和顺序输出/);
  } finally {
    restore();
  }
});

test('local report uses the strict 11-section Markdown contract', async () => {
  const report = createLocalReport({
    question: '学业会好吗？',
    category: 'study',
    plate: studyPlate,
    evidence,
    retrievalDiagnostics: { mode: 'lexical-fallback', warnings: [] },
  });

  assert.equal(report.mode, 'local');
  assert.match(report.markdown, /^## 1\. 占问主题/);
  assert.match(report.markdown, /## 11\. 最终一句话结论/);
  assert.match(report.markdown, /#plate-facts/);
  assert.match(report.markdown, /第1爻父母庚子/);
  assert.match(report.markdown, /第4爻父母丁亥/);
  assert.match(report.markdown, /第5爻官鬼丁酉/);
  assert.match(report.markdown, /第3爻妻财庚辰（世）/);
  assert.equal(await validateMarkdownReport(report.markdown, '本地报告', {
    plate: studyPlate,
    evidence: [],
    strictStructure: true,
  }), report.markdown);
  assert.equal(Object.hasOwn(report, 'claims'), false);
});

test('strict report validation rejects missing sentence citations and missing sections', async () => {
  const missingCitation = strictMarkdown.replace(`${plateCitation}`, '');
  await assert.rejects(
    validateMarkdownReport(missingCitation, '严格报告', { plate: studyPlate, evidence, strictStructure: true }),
    /缺少句末引用标签/,
  );

  const missingSection = strictMarkdown.replace('## 8. 辅助因素修正\n', '');
  await assert.rejects(
    validateMarkdownReport(missingSection, '严格报告', { plate: studyPlate, evidence, strictStructure: true }),
    /第8节应为“8\. 辅助因素修正”|必须完整输出 11 个章节/,
  );
});

test('reasoning plan still locks the plate facts supplied to the Markdown model', () => {
  const plan = reasoningPlan('study', studyPlate);

  assert.deepEqual(plan.useGod.candidates.map(({ lineIndex, ganZhi }) => ({ lineIndex, ganZhi })), [
    { lineIndex: 1, ganZhi: '庚子' },
    { lineIndex: 4, ganZhi: '丁亥' },
  ]);
  assert.ok(plan.professionalChecks.requiredInteractionFactsByUseGod[0].checks.some((interaction) => (
    interaction.factStatement === '庚辰土生丁酉金，辰酉六合'
  )));
});
