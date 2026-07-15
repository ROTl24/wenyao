const {
  ANALYSIS_SECTION_HEADINGS,
  buildAnalysisSystemPrompt,
  buildFollowUpSystemPrompt,
} = require('./system-prompt.cjs');
const { buildProfessionalContext, QUESTION_SUBJECTS } = require('./liuyao-domain.cjs');
const { createDeepSeekClient } = require('./deepseek.cjs');

const REASONING_STAGES = ['锁定排盘事实', '确定用神与问题域', '分析日月动变', '对照规则与占例', '综合判断'];

function pipelineTrace(retrievalDiagnostics) {
  return {
    retrievalMode: retrievalDiagnostics?.mode || 'lexical-fallback',
    stages: REASONING_STAGES,
    warnings: retrievalDiagnostics?.warnings || [],
  };
}

function localUseGodBasis(professionalContext, plate) {
  const secondaryRelations = new Set(professionalContext.useGod.secondaryRelations || []);
  const missingPrimaryFact = professionalContext.useGod.primaryRelation && professionalContext.useGod.candidates.length === 0
    ? `当前盘明爻与伏神中未见${professionalContext.useGod.primaryRelation}爻候选`
    : null;
  const supportingCandidates = [
    ...professionalContext.useGod.candidates,
    ...plate.lines
      .filter((line) => secondaryRelations.has(line.relation) || line.role)
      .map((line) => ({ ...line, source: 'visible', lineIndex: line.index })),
    ...(plate.fuShen || [])
      .filter((item) => secondaryRelations.has(item.relation))
      .map((item) => ({ ...item, source: 'hidden' })),
  ];
  const uniqueCandidates = [...new Map(supportingCandidates.map((candidate) => (
    [`${candidate.source}:${candidate.lineIndex}:${candidate.relation}:${candidate.ganZhi}`, candidate]
  ))).values()];
  const facts = uniqueCandidates.map((candidate) => {
    const location = candidate.source === 'hidden'
      ? `${candidate.relation}${candidate.ganZhi}伏于第${candidate.lineIndex}爻`
      : `第${candidate.lineIndex}爻${candidate.relation}${candidate.ganZhi}${candidate.role ? `（${candidate.role}）` : ''}`;
    const classifiedDayClash = candidate.source === 'visible'
      ? ({ 'hidden-movement': '暗动', 'day-break': '日破', 'ordinary-clash': '日冲' }[candidate.dayClashAssessment?.kind] || '')
      : candidate.dayClash ? '日冲' : '';
    const states = [candidate.moving && '动爻', candidate.void && '旬空', candidate.monthBreak && '月破', classifiedDayClash].filter(Boolean);
    return states.length ? `${location}，${states.join('、')}` : location;
  });
  if (missingPrimaryFact) facts.unshift(missingPrimaryFact);
  return facts.length
    ? `当前盘用于取用核对的具体爻为：${facts.join('；')}。`
    : '当前排盘没有可供这条取用提示核对的具体爻，因此本地模式不作进一步判断。';
}

function localUseGodJudgment(professionalContext) {
  if (professionalContext.useGod.primaryRelation) {
    return `本地模式以${professionalContext.useGod.primaryRelation}爻作为当前取用主线。`;
  }
  if (professionalContext.useGod.primaryRole) {
    return `本地模式以${professionalContext.useGod.primaryRole}爻作为当前取用主线。`;
  }
  return '本地模式需要先结合具体事项确定主用神。';
}

function reasoningPlan(category, plate) {
  const professionalContext = buildProfessionalContext(category, plate);
  return {
    category,
    useGodRule: professionalContext.useGod.rule,
    useGod: professionalContext.useGod,
    professionalChecks: {
      spiritRoleFacts: professionalContext.spiritRoleFacts,
    },
    immutableFacts: {
      baseHexagram: plate.baseHexagram.name,
      changedHexagram: plate.changedHexagram.name,
      movingLines: plate.movingLines,
      monthGanZhi: plate.monthGanZhi,
      dayGanZhi: plate.dayGanZhi,
      voidBranches: plate.voidBranches,
      shenSha: plate.shenSha,
      lines: plate.lines,
      fuShen: plate.fuShen,
      relationFacts: plate.relationFacts,
      voidScopeRule: professionalContext.voidScopeRule,
      lineInteractions: professionalContext.lineInteractions,
    },
    stages: REASONING_STAGES,
  };
}

function createLocalReport({ question, category, plate, retrievalDiagnostics }) {
  const professionalContext = buildProfessionalContext(category, plate);
  const worldLine = plate.lines.find((line) => line.role === '世');
  const responseLine = plate.lines.find((line) => line.role === '应');
  const movement = plate.movingLines.length
    ? `动爻：第 ${plate.movingLines.join('、')} 爻。`
    : '动爻：无。';
  const fact = (text) => `- ${text} [排盘事实](#plate-facts)`;
  const questionText = String(question || '当前占问').replace(/[。！？!?]+$/g, '');
  const markdown = [
    `## ${ANALYSIS_SECTION_HEADINGS[0]}`,
    fact(`核心问题：${questionText}`),
    fact(`类别：${category}`),
    fact('分析目标：当前本地模式只整理排盘事实与取用提示，不作完整综合判断'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[1]}`,
    fact(`已提供关键信息：本卦${plate.baseHexagram.name}，变卦${plate.changedHexagram.name}，${movement}月建${plate.monthGanZhi || '未载'}，日辰${plate.dayGanZhi || '未载'}`),
    fact('信息完整度：信息不足会影响判断，当前仅保留可由程序事实支持的有限分析'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[2]}`,
    fact(`取用主线：${localUseGodJudgment(professionalContext)}`),
    fact(`候选事实：${localUseGodBasis(professionalContext, plate)}`),
    fact(`世应定位：世爻为${worldLine ? `第${worldLine.index}爻${worldLine.relation}${worldLine.ganZhi}` : '未载'}，应爻为${responseLine ? `第${responseLine.index}爻${responseLine.relation}${responseLine.ganZhi}` : '未载'}`),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[3]}`,
    fact('用神旺衰与状态：本地模式暂不代替完整的月日旺衰、空破和伏藏综合判断'),
    fact(`当前状态事实：${localUseGodBasis(professionalContext, plate)}`),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[4]}`,
    fact('生克制化分析：本地模式暂不作完整原神、忌神、仇神的力量比较'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[5]}`,
    fact(`动爻与变爻分析：${movement}当前报告只展示程序锁定的动静事实`),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[6]}`,
    fact('世应关系分析：当前仅保留世爻与应爻定位，暂不作完整互动强弱判断'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[7]}`,
    fact('辅助因素修正：六神、冲合、伏神等辅助因素需要在云端完整解读中结合用神统一判断'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[8]}`,
    fact('综合结论：不足判断，当前本地模式没有足够分析链条支持确定的成败结论'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[9]}`,
    fact('应期不足以精断，当前本地报告不硬猜日期'),
    '',
    `## ${ANALYSIS_SECTION_HEADINGS[10]}`,
    fact('最终一句话结论：当前只完成排盘事实整理，配置云端 AI 后再生成完整六爻解读'),
  ].join('\n');
  return {
    mode: 'local',
    markdown,
    generatedAt: new Date().toISOString(),
    pipeline: pipelineTrace(retrievalDiagnostics),
  };
}

function markdownNodeText(node) {
  if (node?.type === 'break') return '\n';
  if (typeof node?.value === 'string') return node.value;
  return (node?.children || []).map(markdownNodeText).join('');
}

function findProhibitedMetaContent(markdown) {
  return String(markdown || '').match(/(?:由(?:DeepSeek|[A-Za-z0-9._-]{1,24}(?:AI|模型))生成|免责声明|(?:本解读|本内容|以上(?:分析|内容|推算结果)|占断)?(?:仅供|只供|仅作|只作)(?:娱乐|参考|传统文化研究|个人反思)|(?:本解读|本内容|以上(?:分析|内容|结果)|推算结果|分析结果|模型输出|AI解读)[^。；;\n]{0,16}(?:不构成|不作为)[^。；;\n]{0,40}(?:依据|建议)|切勿(?:将)?(?:本解读|本内容|以上结果|其)(?:作为|用作|当作)[^。；;\n]{0,40}(?:依据|建议))/i)?.[0] || null;
}

function isEvidenceNavigationParagraph(node) {
  return node.type === 'paragraph'
    && node.children?.length > 0
    && node.children.every((child) => {
      if (child.type === 'text') return !child.value.trim();
      if (child.type !== 'link' || !String(child.url || '').startsWith('#evidence-')) return false;
      return /^(?:(?:查看)?(?:证据|原文|依据|古籍)(?:[ \t]*[:：]?[ \t]*[（(]?[A-Za-z0-9][A-Za-z0-9._-]*[）)]?)?|《[^》]+》(?:[·・].+)?)$/.test(markdownNodeText(child).trim());
    });
}

function isStrongOnlyLabel(node) {
  if (node.type !== 'paragraph' || !node.children?.length) return false;
  const onlyLabelMarkup = node.children.every((child) => child.type === 'strong' || (child.type === 'text' && !child.value.trim()));
  const text = markdownNodeText(node).trim();
  const neutralLabel = /^(?:(?:核心|总体|主要|阶段性|综合)?(?:判断|结论|建议|应期|取用|用神|卦象|世应|日月|动变|风险|边界|提示|说明|提醒|注意事项|分析|解读))$/;
  return onlyLabelMarkup && neutralLabel.test(text);
}

function isUseGodSelectionClause(text) {
  const clause = String(text || '').trim().split(/[，,。；;\n]/, 1)[0];
  return /^(?:(?:(?:应|宜|可)(?:当|该)?)?(?:优先|首先)?(?:取|选|选取|定|确定)[^，。；]{0,30}(?:用神|此爻|判断坐标|分析坐标|主要坐标|主线)|以[^，。；]{1,20}为(?:主)?用神|用[^，。；]{1,20}(?:为|作)(?:主)?用神|舍[^，。；]{1,16}用[^，。；]{1,16}|比较[^，。；]{1,20}(?:取|选))/.test(clause);
}

function isNeutralHeading(text) {
  const normalized = text.trim();
  if (!normalized || normalized.length > 36 || /[，,；;。！!]/.test(normalized)) return false;
  if (/(?:^|[:：])(?:宜|不宜|应当|应该|应先|应立即|不妨|可(?:暂缓|继续|推进|等待|停止|放弃)|谨慎推进|暂缓|立即|继续|停止|放弃|等待)/.test(normalized)
    || /建议(?:暂缓|推进|等待|停止|放弃)/.test(normalized)
    || /^先.{1,10}后/.test(normalized)
    || /^(?:吉|凶)$/.test(normalized)
    || /^(?:吉中|凶中)|(?:有忧|有凶|有险)$/.test(normalized)
    || /(?:大吉|小吉|吉利|大凶|凶险|可期|必成|必败|能成|可成|难成|不成|必得|必失|有望|无望|成功|失败|顺利|顺遂|不顺|受阻|有利|不利|可行|不可行|光明|黯淡|和合|破裂|圆满|动荡|获利|亏损|录取|落选|复合|分手|升职|降职|发财|破财|好转|恶化|改善|成行|一定|注定|如愿|乐观|悲观|堪忧|看好|[向趋转渐](?:好|坏|佳|差|强|弱|稳)|走高|走低|渐衰|前途不错|吉凶参半)/.test(normalized)) return false;
  return true;
}

function validateSingleJudgment(node, label, scope) {
  if (node.type !== 'paragraph') return;
  const text = markdownNodeText(node).trim();
  const body = text.replace(/^判断[:：]\s*/, '').trim();
  const withoutFinalPunctuation = body.replace(/[。！？!?]+\s*$/, '');
  const clauses = body.split(/[，,]/);
  const firstClause = clauses[0].trim();
  const questionSubject = QUESTION_SUBJECTS.join('|');
  const conditionSubject = `(?:(?:当前|本次)?(?:${questionSubject})|(?:父母|官鬼|妻财|兄弟|子孙)(?:爻)?|世爻|应爻|用神|忌神|求测者|对方)`;
  const ruoPredicate = '(?:要|想|欲|需|能|可|会|将|是|非|有|无|遇|逢|按|从|以|对|不|未|再|仍|只|受|得|临|处|值|被|遭|见|取|用|选|定|继续|选择|采用|出现|保持|获得|达到|希望|打算|计划)';
  const firstClauseIntroducesMainStatement = /^(?:[^，,]{0,12})?(?:如果|倘若|只要|除非)/.test(firstClause)
    || new RegExp(`^(?:若(?:${conditionSubject}|${ruoPredicate})|${conditionSubject}若${ruoPredicate})`).test(firstClause)
    || /^(?:在|从|对于|关于|就|想要|要想|为了|考虑到)/.test(firstClause)
    || /^当.+时/.test(firstClause);
  const firstClauseIsPlatePremise = /(?:本卦|原卦|主卦|变卦|之卦|[初一二三四五六上1-6]爻|世爻|应爻|父母|官鬼|妻财|兄弟|子孙|日辰|日建|月建|月令|伏神|飞神|动爻|旬空|月破|日冲)/.test(firstClause);
  const temporalClaim = /(?:本周|下周|近期|随后|之后|明日|本月|下月|今年|明年|未来|[一二三四五六七八九十百两0-9]+(?:日|天|周|月|年)(?:之内|以内|内|以后|后|之前|前|左右|上下)?|(?:待到|待至|到)[甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥](?:日|月)|[子丑寅卯辰巳午未申酉戌亥](?:日|月))/;
  const introducesNewClaim = clauses.slice(1).some((clause, index) => {
    const normalized = clause.trim();
    if (index === 0 && clauses.length === 2 && firstClauseIntroducesMainStatement) return false;
    if (temporalClaim.test(normalized)) return true;
    if (/^(?:建议|最好|务必|必须|需要|需|不?应|宜|不宜|不妨|可(?:暂缓|继续|推进|等待|停止|放弃)|不可|不得|切勿|暂缓|立即|继续|停止|放弃|等待)/.test(normalized) && !isUseGodSelectionClause(normalized)) return true;
    const causalBody = normalized.match(/^(?:故而|故|因此|所以|因而|从而|由此|可见|足见|进而|则)(.*)$/)?.[1];
    if (causalBody !== undefined && !isUseGodSelectionClause(causalBody)) return true;
    if (index === 0 && clauses.length === 2 && (firstClauseIntroducesMainStatement || firstClauseIsPlatePremise)) return false;
    if (/^(?:而|但|却|只是|即|也就是|尤其|主要|难以|并非|并不)/.test(normalized)) return false;
    return /^(?:并且|同时|另外|此外|其次|再者|建议|应当|应该|宜|不宜|可以|不可|会|将|有望|无望|预计|预期|本周|下周|近期|随后|之后|明日|今年|你|对方|财运|事业|婚姻|工作|考试|结果|应期)/.test(normalized)
      || /^(?:本月|下月|明年|未来)[^，]{0,10}(?:会|将|可以|有望)/.test(normalized);
  });
  if (/[；;]/.test(body) || /[。！？!?]/.test(withoutFinalPunctuation) || introducesNewClaim) {
    throw new Error(`${label}${scope}第${claimLine(node)}行“${claimExcerpt(node)}”包含多条独立判断，必须拆开并分别给出依据`);
  }
}

function validateBasisContent(basis, label) {
  const causalViolation = [...basis.matchAll(/(?:^|[，,。；;\s])(?:故而|故|因此|所以|因而|从而|由此|可见|足见|进而)/g)]
    .find((match) => !isUseGodSelectionClause(basis.slice((match.index ?? 0) + match[0].length)));
  const violation = basis.match(/(?:\*\*)?判断[:：]/)
    || causalViolation
    || basis.match(/(?:建议|最好|务必|必须|需要|不应(?!爻|期)|应当|应该|应予|不宜|不妨|可(?:暂缓|继续|推进|等待|停止|放弃)|不可|不得|切勿|有望|无望|必成|必败|能成|可成|难成|可以推进|谨慎推进|暂缓|预计|预期|下周|明日|未来)/);
  if (violation) {
    const excerpt = basis.trim().replace(/\s+/g, ' ').slice(0, 100);
    throw new Error(`${label}的“依据”只能写当前排盘事实，不能夹带另一条判断、建议或应期（触发词：“${violation[0].trim()}”；原文：“${excerpt}”）`);
  }
}

function claimLine(node) {
  return node.position?.start?.line || '?';
}

function claimExcerpt(node) {
  const text = markdownNodeText(node).replace(/\s+/g, ' ').trim();
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

function validateBasisBlockStructure(node, label, scope) {
  const blocks = (node.children || []).filter((child) => markdownNodeText(child).trim());
  const basisText = markdownNodeText(blocks[0]).trim();
  const basisBody = basisText.replace(/^依据[:：]\s*/, '');
  if (/(?:判断|古籍来源)[:：]/.test(basisBody)) {
    throw new Error(`${label}${scope}第${claimLine(node)}行的“依据”段内夹带了判断或古籍来源；必须拆成独立 Markdown 段落`);
  }
  const sourceBlocks = blocks.slice(1);
  if (sourceBlocks.length > 1) {
    throw new Error(`${label}${scope}第${claimLine(node)}行的“依据”引用块只能包含一个盘面依据段和一个可选古籍来源段`);
  }
  for (const sourceBlock of sourceBlocks) {
    const sourceText = markdownNodeText(sourceBlock).trim();
    if (sourceBlock.type !== 'paragraph' || !/^古籍来源[:：]/.test(sourceText)) {
      throw new Error(`${label}${scope}第${claimLine(node)}行的“依据”引用块只能包含盘面依据和可选古籍来源，不能夹带另一条判断`);
    }
    const sourceBody = sourceText.replace(/^古籍来源[:：]\s*/, '');
    if (/\n/.test(sourceBody) || /(?:判断|依据|古籍来源)[:：]/.test(sourceBody)) {
      throw new Error(`${label}${scope}第${claimLine(sourceBlock)}行的“古籍来源”段内夹带了另一条判断或依据`);
    }
  }
}

function validateClaimBasisSequence(children, label, scope = '正文') {
  let pendingClaim = null;
  for (const node of children || []) {
    const text = markdownNodeText(node).trim();
    const basisBlock = node.type === 'blockquote' && /^依据[:：]/.test(text);
    const ancientSourceBlock = node.type === 'blockquote' && /^古籍来源[:：]/.test(text);
    const ignorable = ['heading', 'thematicBreak', 'definition'].includes(node.type)
      || isEvidenceNavigationParagraph(node)
      || isStrongOnlyLabel(node);

    if (node.type === 'html') throw new Error(`${label}包含不会被界面解析的原始 HTML`);
    if (node.type === 'heading' && !isNeutralHeading(text)) {
      throw new Error(`${label}${scope}第${claimLine(node)}行的标题“${claimExcerpt(node)}”不是中性主题；标题不能写结论、趋势、应期或建议`);
    }
    if (basisBlock) {
      if (!pendingClaim) throw new Error(`${label}${scope}第${claimLine(node)}行的“依据”前没有对应判断`);
      validateBasisBlockStructure(node, label, scope);
      pendingClaim = null;
      continue;
    }
    if (ancientSourceBlock) {
      if (pendingClaim) throw new Error(`${label}${scope}第${claimLine(pendingClaim)}行“${claimExcerpt(pendingClaim)}”的判断后没有立即给出“依据”`);
      throw new Error(`${label}${scope}第${claimLine(node)}行的“古籍来源”必须位于对应“依据”引用块的第二个段落，不能独立存在`);
    }
    if (ignorable) {
      if (pendingClaim) throw new Error(`${label}${scope}第${claimLine(pendingClaim)}行“${claimExcerpt(pendingClaim)}”的判断后没有立即给出“依据”`);
      continue;
    }
    if (node.type === 'list') {
      if (pendingClaim) throw new Error(`${label}${scope}第${claimLine(pendingClaim)}行“${claimExcerpt(pendingClaim)}”的判断后没有立即给出“依据”`);
      node.children.forEach((item, index) => validateClaimBasisSequence(item.children, label, `${scope}列表第${index + 1}项`));
      continue;
    }
    if (node.type === 'table') {
      throw new Error(`${label}${scope}第${claimLine(node)}行的表格可能合并多条判断；请改为逐条判断并分别给出依据`);
    }
    if (pendingClaim) {
      throw new Error(`${label}${scope}第${claimLine(pendingClaim)}行“${claimExcerpt(pendingClaim)}”与第${claimLine(node)}行“${claimExcerpt(node)}”是两条独立判断，不能共用一个“依据”`);
    }
    validateSingleJudgment(node, label, scope);
    pendingClaim = node;
  }
  if (pendingClaim) throw new Error(`${label}${scope}第${claimLine(pendingClaim)}行“${claimExcerpt(pendingClaim)}”的判断后没有立即给出“依据”`);
}

function isCitationLink(node) {
  const url = String(node?.url || '');
  return node?.type === 'link' && (url === '#plate-facts' || /^#evidence-[^\s)#]+$/.test(url));
}

function citationLinks(node, result = []) {
  if (isCitationLink(node)) result.push(node);
  for (const child of node?.children || []) citationLinks(child, result);
  return result;
}

function plainNodeText(node) {
  if (isCitationLink(node)) return '';
  if (node?.type === 'break') return '\n';
  if (typeof node?.value === 'string') return node.value;
  return (node?.children || []).map((child) => plainNodeText(child)).join('');
}

function lastMeaningfulChild(children) {
  return [...(children || [])].reverse().find((child) => {
    if (child.type === 'text') return child.value.trim();
    return true;
  });
}

function validateStrictClaimParagraph(node, label, scope, evidence) {
  const text = markdownNodeText(node).trim();
  if (!text || isEvidenceNavigationParagraph(node) || isStrongOnlyLabel(node)) return;
  const links = citationLinks(node);
  if (!links.length) {
    throw new Error(`${label}${scope}第${claimLine(node)}行缺少句末引用标签；盘面事实使用“[排盘事实](#plate-facts)”，古籍依据使用 evidence 标签`);
  }
  const lastChild = lastMeaningfulChild(node.children);
  if (!isCitationLink(lastChild)) {
    throw new Error(`${label}${scope}第${claimLine(node)}行的引用标签必须紧跟在句子末尾`);
  }
  const plain = plainNodeText(node).replace(/\s+/g, '').trim();
  const sentenceEndings = plain.match(/[。！？!?]/g) || [];
  if (sentenceEndings.length > 1) {
    throw new Error(`${label}${scope}第${claimLine(node)}行包含多个句子，必须拆开并分别引用`);
  }
  if (evidence.length === 0 && links.some((link) => String(link.url).startsWith('#evidence-'))) {
    throw new Error(`${label}${scope}第${claimLine(node)}行引用了不存在的古籍证据`);
  }
}

function validateStrictBodyNodes(nodes, label, scope, evidence) {
  for (const node of nodes || []) {
    if (node.type === 'html') throw new Error(`${label}${scope}包含不会被界面解析的原始 HTML`);
    if (node.type === 'paragraph') {
      validateStrictClaimParagraph(node, label, scope, evidence);
      continue;
    }
    if (node.type === 'list') {
      node.children.forEach((item, index) => validateStrictBodyNodes(item.children, label, `${scope}列表第${index + 1}项`, evidence));
      continue;
    }
    if (node.type === 'blockquote') {
      // 证据引用标签必须位于对应判断句末；引用块只允许承载补充事实或原文摘录。
      validateStrictBodyNodes(node.children, label, `${scope}依据`, evidence);
      continue;
    }
    if (node.type === 'table') throw new Error(`${label}${scope}不得使用表格承载多条判断`);
    if (node.type === 'thematicBreak' || node.type === 'definition') continue;
    if (node.type === 'heading') throw new Error(`${label}${scope}不允许嵌套未编号章节标题`);
  }
}

function validateStrictReportStructure(tree, label, evidence) {
  const sections = [];
  let current = null;
  for (const node of tree.children || []) {
    if (node.type === 'heading') {
      if (node.depth !== 2) throw new Error(`${label}章节标题必须使用二级 Markdown 标题`);
      const heading = markdownNodeText(node).replace(/\s+/g, ' ').trim();
      const expected = ANALYSIS_SECTION_HEADINGS[sections.length];
      if (heading !== expected) {
        throw new Error(`${label}未按规定输出 11 个章节：第${sections.length + 1}节应为“${expected || '已无更多章节'}”，实际为“${heading}”`);
      }
      current = { heading, nodes: [] };
      sections.push(current);
      continue;
    }
    if (!current) throw new Error(`${label}在第一个编号章节前出现了无标题正文`);
    current.nodes.push(node);
  }
  if (sections.length !== ANALYSIS_SECTION_HEADINGS.length) {
    throw new Error(`${label}必须完整输出 11 个章节，当前只有 ${sections.length} 个`);
  }
  sections.forEach((section, index) => {
    const meaningfulNodes = section.nodes.filter((node) => markdownNodeText(node).trim());
    if (!meaningfulNodes.length) throw new Error(`${label}缺少“${section.heading}”章节正文`);
    validateStrictBodyNodes(section.nodes, label, `“${section.heading}”`, evidence);
    if (evidence.length > 0 && index >= 2 && !citationLinks({ children: section.nodes }).some((link) => String(link.url).startsWith('#evidence-'))) {
      throw new Error(`${label}“${section.heading}”至少需要一条真实古籍 evidence 引用`);
    }
  });
}

function validateStrictReportFacts(markdown, plate, label) {
  if (!plate) throw new Error(`${label}缺少排盘上下文，无法核对 11 节报告`);
  if (!markdown.includes(plate.baseHexagram?.name) || !markdown.includes(plate.changedHexagram?.name)) {
    throw new Error(`${label}没有同时写出当前本卦和变卦`);
  }
  validateBasisAgainstPlate(markdown, plate, label);
}

function collectBasisTexts(nodes, collected = []) {
  for (const node of nodes || []) {
    if (node.type === 'blockquote') {
      const parts = [];
      let collecting = false;
      for (const child of node.children || []) {
        const text = markdownNodeText(child).trim();
        if (!collecting && /^依据[:：]/.test(text)) {
          collecting = true;
          parts.push(text.replace(/^依据[:：]\s*/, ''));
        } else if (collecting && /^古籍来源[:：]/.test(text)) {
          break;
        } else if (collecting && text) {
          parts.push(text);
        }
      }
      if (collecting) collected.push(parts.join('\n').trim());
      continue;
    }
    if (node.children) collectBasisTexts(node.children, collected);
  }
  return collected;
}

const LINE_INDEX = { 初: 1, 一: 1, '1': 1, 二: 2, '2': 2, 三: 3, '3': 3, 四: 4, '4': 4, 五: 5, '5': 5, 六: 6, 上: 6, '6': 6 };
const GAN_ZHI_PATTERN = /[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g;
const LINE_STATUS_TERM_SOURCE = '(?:不旬空|非旬空|不空|非空|旬空|空亡|临空|逢空|值空|不月破|非月破|月破|不日冲|非日冲|日冲|不日破|非日破|日破|不月合|非月合|月合|不日合|非日合|日合)';
const MOVEMENT_BOUNDARY_SOURCE = '(?=$|[ \\t，,。；;）)】\\]])';
const MOVEMENT_NEGATION_SOURCE = '(?:并没有|没有|未曾|不曾|从未|并未|未|不)[ \\t]*(?:(?:见|再|曾|有|继续|重新|再次|发生|出现|爻)[ \\t]*){0,3}(?:发动|爻动|动)';
const STATIC_LINE_TERM_SOURCE = `(?:没有动爻|无动爻|安静不动|静爻|${MOVEMENT_NEGATION_SOURCE}|静${MOVEMENT_BOUNDARY_SOURCE})`;
const MOVING_LINE_TERM_SOURCE = `(?:(?<!没)有动爻|为动爻|发动|动而|动化|动爻|爻动)`;
const LINE_MOVEMENT_TERM_SOURCE = `(?:${STATIC_LINE_TERM_SOURCE}|${MOVING_LINE_TERM_SOURCE})`;
const LINE_ENTITY_SEPARATOR_SOURCE = '(?:[ \\t]*爻)?[ \\t]*(?:[（(—–-][ \\t]*)?(?:即|为|是)?[ \\t]*';
const MOVEMENT_NEGATION_TOKEN_SOURCE = '(?:并没有|没有|未曾|不曾|从未|并未|并非|不是|未|不|无|非)';
const MOVEMENT_NON_NEGATING_CONNECTOR_SOURCE = '(?:不只是|不单是|不但|不仅|不只|不光|不单|不独)';
const MOVEMENT_CONNECTOR_SOURCE = `(?:${MOVEMENT_NON_NEGATING_CONNECTOR_SOURCE}|但是|可是|不过|所以|因此|因而|从而|于是|故而|转而|继而|随后|然后|进而|依然|依旧|仍然|照常|直接|但|却|而|便|就|遂|并|且|又)`;
const MOVEMENT_OPERATOR_SOURCE = '(?:观察到|重新|再次|继续|发生|出现|后续|直接|转而|继而|随后|然后|进而|依然|依旧|仍然|照常|所以|因此|因而|从而|于是|故而|但是|可是|不过|见|有|能|法|再|曾|但|却|而|便|就|遂|并|且|又)';

function normalizeMovementNegationText(text) {
  return String(text || '').replace(new RegExp(MOVEMENT_NON_NEGATING_CONNECTOR_SOURCE, 'g'), '');
}

function countMovementNegations(text) {
  return (normalizeMovementNegationText(text).match(new RegExp(MOVEMENT_NEGATION_TOKEN_SOURCE, 'g')) || []).length;
}

function verdictRejectsClaim(verdict) {
  const normalizedVerdict = normalizeMovementNegationText(verdict);
  const parallelBranches = normalizedVerdict.split(/(?:而且|并且|同时|以及|也|又|且|或(?:者)?|、)/);
  return parallelBranches.some((branch) => {
    const validityPredicates = [...branch.matchAll(/成立|属实|正确|准确|可信|事实|实情|真实|真的/g)];
    return validityPredicates.some((predicate) => {
      const predicatePrefix = branch.slice(0, predicate.index).split(/(?:但是|但|却|然而|可是|不过)/).at(-1);
      return countMovementNegations(predicatePrefix) % 2 === 1;
    });
  });
}

function hasPostposedClaimRejection(suffix) {
  const reportedClaimVerdict = suffix.match(/^(?:(?:之|的)?说|(?:这一|这种)说法)([^，,。；;\n]{0,20})/)?.[1];
  if (reportedClaimVerdict !== undefined) return verdictRejectsClaim(reportedClaimVerdict);
  const directVerdict = suffix.match(/^([^，,。；;\n]{0,20})/)?.[1] || '';
  return verdictRejectsClaim(directVerdict);
}

function movementNegationCount(movementScope) {
  const hasCompletedPredicate = (text) => {
    const semanticRemainder = normalizeMovementNegationText(text)
      .replace(new RegExp(MOVEMENT_NEGATION_TOKEN_SOURCE, 'g'), '')
      .replace(new RegExp(MOVEMENT_OPERATOR_SOURCE, 'g'), '')
      .replace(/[也尚还仅只才已的地得 \t]/g, '');
    return Boolean(semanticRemainder);
  };
  const hasOpenMovementNegation = (text) => {
    const normalizedText = normalizeMovementNegationText(text);
    const negations = [...normalizedText.matchAll(new RegExp(MOVEMENT_NEGATION_TOKEN_SOURCE, 'g'))];
    const lastNegation = negations.at(-1);
    if (!lastNegation) return false;
    const negationEnd = (lastNegation.index ?? 0) + lastNegation[0].length;
    return !hasCompletedPredicate(normalizedText.slice(negationEnd));
  };
  const connectors = [...movementScope.matchAll(new RegExp(MOVEMENT_CONNECTOR_SOURCE, 'g'))];
  for (const connector of connectors.reverse()) {
    const beforeConnector = movementScope.slice(0, connector.index);
    // “未直接发动”中的“直接”仍受“未”管辖；只有前置谓词已经闭合时，连接词才切开否定作用域。
    if (hasCompletedPredicate(beforeConnector) && !hasOpenMovementNegation(beforeConnector)) {
      return countMovementNegations(movementScope.slice((connector.index ?? 0) + connector[0].length));
    }
  }
  return countMovementNegations(movementScope);
}

function findMovementClaim(text) {
  const source = String(text || '');
  const candidates = [];
  for (const match of source.matchAll(/静卦|静爻|静(?=$|[ \t，,。；;）)】\]])/g)) {
    const index = match.index ?? 0;
    const movementScope = source.slice(0, index).split(/[，,。；;\n]/).at(-1).slice(-40);
    const negationCount = movementNegationCount(movementScope);
    let moving = negationCount % 2 === 1;
    const suffix = source.slice(index + match[0].length);
    if (hasPostposedClaimRejection(suffix)) moving = !moving;
    candidates.push({ index: moving ? index - movementScope.length : index, moving, term: `${movementScope}${match[0]}` });
  }
  const movementTerms = [...source.matchAll(new RegExp(MOVING_LINE_TERM_SOURCE, 'g'))];
  for (const match of source.matchAll(new RegExp(`动${MOVEMENT_BOUNDARY_SOURCE}`, 'g'))) {
    const index = match.index ?? 0;
    const prefix = source.slice(0, index);
    const syntacticBoundary = index === 0 || /[爻（( \t，,]$/.test(prefix);
    const explicitNegation = /(?:并没有|没有|未曾|不曾|从未|并未|未|不)[ \t]*(?:(?:见|再|曾|有|继续|重新|再次|发生|出现|爻)[ \t]*){0,3}$/.test(prefix);
    const movementModifier = /(?:独|已|已然|亦|也|又|仍|仍然|依然|依旧|照常|再|再度|再次|同|齐|皆|俱|均|全|只|仅|一并|同时|随之|继而|随后|进而|转而|开始|继续|重新|尚在)$/.test(prefix);
    if (syntacticBoundary || explicitNegation || movementModifier) movementTerms.push(match);
  }
  movementTerms.sort((left, right) => (left.index ?? 0) - (right.index ?? 0));
  for (const match of movementTerms) {
    const index = match.index ?? 0;
    const prefix = source.slice(0, index);
    const movementScope = prefix.split(/[，,。；;\n]/).at(-1).slice(-40);
    // 动、静共用同一否定作用域，避免把“不受制”中的“不”错指向动静事实。
    const negationCount = movementNegationCount(movementScope);
    let moving = negationCount % 2 === 0;
    const suffix = source.slice(index + match[0].length);
    const movementAssignment = suffix.match(/^[ \t]*(?::|：|为|是)[ \t]*([^，,。；;\n]{1,16})/)?.[1];
    if (movementAssignment && /(?:无|有|没有|未|不|非|存在)/.test(movementAssignment)) {
      const assignmentNegations = (movementAssignment.match(/没有|未|不|无|非/g) || []).length;
      moving = assignmentNegations % 2 === 0;
    }
    if (hasPostposedClaimRejection(suffix)) moving = !moving;
    candidates.push({
      index: moving ? index : index - movementScope.length,
      moving,
      term: moving ? match[0] : `${movementScope}${match[0]}`,
    });
  }
  return candidates.sort((left, right) => left.index - right.index)[0] || null;
}

function validateBasisAgainstPlate(basis, plate, label) {
  if (!plate) throw new Error(`${label}缺少排盘上下文，无法核对“依据”`);
  const exactTokens = [
    plate.baseHexagram?.name,
    plate.changedHexagram?.name,
    plate.yearGanZhi,
    plate.monthGanZhi,
    plate.dayGanZhi,
    plate.timeGanZhi,
    ...(plate.pillars || []).map((pillar) => pillar.ganZhi),
    ...(plate.lines || []).map((line) => line.ganZhi),
    ...(plate.lines || []).map((line) => line.changedGanZhi),
    ...(plate.fuShen || []).map((item) => item.ganZhi),
    ...(plate.fuShen || []).map((item) => item.flyGanZhi),
  ].filter(Boolean);
  const indexedLines = [...basis.matchAll(/(?:第[ \t]*)?([初一二三四五六上1-6])[ \t]*爻/g)].map((match) => LINE_INDEX[match[1]]);
  const shortHexagramFact = [plate.baseHexagram?.shortName, plate.changedHexagram?.shortName]
    .filter(Boolean)
    .some((shortName) => basis.includes(`${shortName}卦`));
  const monthBranchFact = plate.monthBranch && (basis.includes(`月建${plate.monthBranch}`) || basis.includes(`月令${plate.monthBranch}`));
  const wholeMovementClaim = [...basis.matchAll(/(?:本卦|主卦|原卦|全卦|整卦|六爻)[^，,。；;\n]{0,32}/g)]
    .map((match) => findMovementClaim(match[0]))
    .find(Boolean) || null;
  const generalMovementClaim = basis.split(/[，,。；;\n]/)
    .filter((clause) => /(?:动爻|静卦)/.test(clause)
      && !/(?:第[ 	]*)?[初一二三四五六上1-6][ 	]*爻|父母|官鬼|妻财|兄弟|子孙|世爻|应爻|伏神|变爻/.test(clause))
    .map((clause) => findMovementClaim(clause))
    .find(Boolean) || null;
  const resolvedWholeMovementClaim = wholeMovementClaim || generalMovementClaim;
  const claimsNoMovement = resolvedWholeMovementClaim?.moving === false;
  const claimsMovement = resolvedWholeMovementClaim?.moving === true;
  const noMovingFact = claimsNoMovement && (plate.movingLines || []).length === 0;
  const movingFact = claimsMovement && (plate.movingLines || []).length > 0;
  const lineFactSignatures = (plate.lines || []).flatMap((line) => [
    `${line.relation}${line.ganZhi}`,
    `${line.relation}${line.branch}${line.element}`,
    line.role ? `${line.role}爻${line.relation}` : null,
    line.role ? `${line.role}爻${line.relation}${line.branch}${line.element}` : null,
    line.role ? `${line.relation}持${line.role}` : null,
    line.role ? `${line.relation}临${line.role}` : null,
  ]).filter(Boolean);
  const hiddenFactSignatures = (plate.fuShen || []).flatMap((item) => [
    `伏神${item.relation}${item.ganZhi}`,
    `伏神${item.relation}${item.branch}${item.element}`,
  ]);
  const lineSignatureFact = [...lineFactSignatures, ...hiddenFactSignatures].some((signature) => basis.includes(signature));
  if (!exactTokens.some((token) => basis.includes(token)) && !lineSignatureFact && !shortHexagramFact && !indexedLines.length && !monthBranchFact && !noMovingFact && !movingFact) {
    const excerpt = basis.trim().replace(/\s+/g, ' ').slice(0, 100);
    throw new Error(`${label}的“依据”必须包含当前卦名、具体爻位、日月干支或其他可核对的本卦事实，不能只给古籍规则（原文：“${excerpt}”）`);
  }

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const compactBasis = basis.replace(/[\s*_`~（）()—-]/g, '');
  const labeledName = (labels, name) => {
    if (!name) return false;
    const escapedName = escapeRegExp(name);
    return new RegExp(`(?:${labels})(?:为|是|得|即|[:：])?[“”"'《》]*${escapedName}`).test(compactBasis)
      || new RegExp(`${escapedName}[“”"'《》]*(?:为|是)?(?:${labels})`).test(compactBasis);
  };
  const baseName = plate.baseHexagram?.name;
  const changedName = plate.changedHexagram?.name;
  if (baseName && changedName && baseName !== changedName) {
    if (labeledName('本卦|原卦|主卦', changedName)) throw new Error(`${label}把变卦“${changedName}”误写成了本卦`);
    if (labeledName('变卦|之卦', baseName)) throw new Error(`${label}把本卦“${baseName}”误写成了变卦`);
  }

  const allowedGanZhi = new Set(exactTokens.flatMap((token) => token.match(GAN_ZHI_PATTERN) || []));
  for (const ganZhi of basis.match(GAN_ZHI_PATTERN) || []) {
    if (!allowedGanZhi.has(ganZhi)) throw new Error(`${label}的“依据”引用了当前排盘不存在的干支“${ganZhi}”`);
  }

  const lineEntities = [
    ...(plate.lines || []).flatMap((line) => [
      { relation: line.relation, ganZhi: line.ganZhi, branch: line.branch, element: line.element },
      line.changedGanZhi ? { relation: line.changedRelation, ganZhi: line.changedGanZhi, branch: line.changedBranch, element: line.changedElement } : null,
    ]),
    ...(plate.fuShen || []).map((item) => ({ relation: item.relation, ganZhi: item.ganZhi, branch: item.branch, element: item.element })),
  ].filter(Boolean);
  const compactEntityBasis = basis.replace(/[\s*_`~（）()—–\-:：]/g, '');
  const normalizedEntityBasis = compactEntityBasis
    .replace(/(父母|官鬼|妻财|兄弟|子孙)(?:爻)?(?:即|为|是)(?=[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])/g, '$1')
    .replace(/(父母|官鬼|妻财|兄弟|子孙)爻(?=[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])/g, '$1');
  for (const pair of normalizedEntityBasis.matchAll(/(父母|官鬼|妻财|兄弟|子孙)([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])/g)) {
    if (!lineEntities.some((entity) => entity.relation === pair[1] && entity.ganZhi === pair[2])) {
      throw new Error(`${label}把六亲“${pair[1]}”与干支“${pair[2]}”错误配对`);
    }
  }
  for (const pair of normalizedEntityBasis.matchAll(/(父母|官鬼|妻财|兄弟|子孙)([子丑寅卯辰巳午未申酉戌亥])([金木水火土])/g)) {
    if (!lineEntities.some((entity) => entity.relation === pair[1] && entity.branch === pair[2] && entity.element === pair[3])) {
      throw new Error(`${label}把六亲“${pair[1]}”与地支五行“${pair[2]}${pair[3]}”错误配对`);
    }
  }

  const scopedEntityGroups = [
    {
      label: '本爻',
      prefix: '(?:本爻|原爻)',
      entities: (plate.lines || []).map((line) => ({ relation: line.relation, ganZhi: line.ganZhi, branch: line.branch, element: line.element })),
    },
    {
      label: '伏神',
      prefix: '(?:伏神|伏藏|下伏|所伏|伏于|伏有)',
      entities: (plate.fuShen || []).map((item) => ({ relation: item.relation, ganZhi: item.ganZhi, branch: item.branch, element: item.element })),
    },
    {
      label: '飞神',
      prefix: '飞神',
      entities: (plate.fuShen || []).map((item) => ({ relation: item.flyRelation, ganZhi: item.flyGanZhi, branch: item.flyBranch, element: item.flyElement })),
    },
    {
      label: '变爻',
      prefix: '(?:变爻|变卦爻|变为|变出|变作|化出|化为|化作|动化)',
      entities: (plate.lines || []).filter((line) => line.changedRelation || line.changedGanZhi).map((line) => ({
        relation: line.changedRelation,
        ganZhi: line.changedGanZhi,
        branch: line.changedBranch,
        element: line.changedElement,
      })),
    },
  ];
  for (const group of scopedEntityGroups) {
    const scopedPattern = new RegExp(`${group.prefix}(?:为|是|即)?(父母|官鬼|妻财|兄弟|子孙)(?:爻)?(?:([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|([子丑寅卯辰巳午未申酉戌亥])([金木水火土]))?`, 'g');
    for (const scoped of compactEntityBasis.matchAll(scopedPattern)) {
      const matched = group.entities.some((entity) => entity.relation === scoped[1]
        && (!scoped[2] || entity.ganZhi === scoped[2])
        && (!scoped[3] || (entity.branch === scoped[3] && entity.element === scoped[4])));
      if (!matched) {
        const detail = scoped[2] || (scoped[3] ? `${scoped[3]}${scoped[4]}` : '');
        throw new Error(`${label}引用了当前盘面不存在的${group.label}“${scoped[1]}${detail}”`);
      }
    }
  }

  if (claimsNoMovement && (plate.movingLines || []).length > 0) {
    throw new Error(`${label}把有动爻的当前排盘写成了静卦`);
  }
  if (claimsMovement && (plate.movingLines || []).length === 0) {
    throw new Error(`${label}把无动爻的当前排盘写成了有动爻`);
  }
  const assertLineFact = (index, scope, kind, value, segment) => {
    const line = (plate.lines || []).find((item) => item.index === index);
    const hidden = (plate.fuShen || []).find((item) => item.lineIndex === index);
    const expected = scope === 'hidden'
      ? hidden?.[kind]
      : scope === 'changed'
        ? line?.[kind === 'relation' ? 'changedRelation' : 'changedGanZhi']
        : line?.[kind];
    if (scope === 'calendar') return;
    const scopeLabel = scope === 'hidden' ? '伏神' : scope === 'changed' ? '变爻' : '本爻';
    const kindLabel = kind === 'relation' ? '六亲' : '干支';
    const excerpt = segment.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!expected) throw new Error(`${label}引用了当前盘面不存在的第${index}爻${scopeLabel}${kindLabel}（原文片段：“${excerpt}”）`);
    if (expected !== value) throw new Error(`${label}把第${index}爻${scopeLabel}${kindLabel}误写为“${value}”（原文片段：“${excerpt}”）`);
  };

  const assertLineStatus = (index, scope, field, claimed, term, segment) => {
    const line = (plate.lines || []).find((item) => item.index === index);
    const hidden = (plate.fuShen || []).find((item) => item.lineIndex === index);
    const changedFields = {
      void: 'changedVoid',
      monthBreak: 'changedMonthBreak',
      dayClash: 'changedDayClash',
      monthCombine: 'changedMonthCombine',
      dayCombine: 'changedDayCombine',
    };
    const target = scope === 'hidden' ? hidden : line;
    const property = scope === 'changed' ? changedFields[field] : field;
    const expected = target?.[property];
    if (scope === 'calendar') return;
    const scopeLabel = scope === 'hidden' ? '伏神' : scope === 'changed' ? '变爻' : '本爻';
    const excerpt = segment.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (typeof expected !== 'boolean') throw new Error(`${label}引用了当前盘面无法核对的第${index}爻${scopeLabel}状态“${term}”（原文片段：“${excerpt}”）`);
    if (expected !== claimed) throw new Error(`${label}把第${index}爻${scopeLabel}状态误写为“${term}”（原文片段：“${excerpt}”）`);
  };

  const assertStatusTerm = (index, scope, term, segment) => {
    const claimed = !/^(?:不|非)/.test(term);
    const field = /空/.test(term)
      ? 'void'
      : /月破/.test(term)
        ? 'monthBreak'
        : /日(?:冲|破)/.test(term)
          ? 'dayClash'
          : /月合/.test(term)
            ? 'monthCombine'
            : 'dayCombine';
    assertLineStatus(index, scope, field, claimed, term, segment);
  };

  const assertLineMovement = (index, claimedMoving, term, segment) => {
    const expected = (plate.movingLines || []).includes(index);
    if (expected !== claimedMoving) {
      const excerpt = segment.trim().replace(/\s+/g, ' ').slice(0, 60);
      throw new Error(`${label}把第${index}爻动静状态误写为“${term}”（原文片段：“${excerpt}”）`);
    }
  };

  const validateLineSegment = (index, segment) => {
    const movementClaim = findMovementClaim(segment);
    if (movementClaim) assertLineMovement(index, movementClaim.moving, movementClaim.term, segment);
    const events = segment.matchAll(new RegExp(`(伏神|伏藏|下伏|所伏|伏于|伏有|飞神|本爻|该爻|${LINE_MOVEMENT_TERM_SOURCE}|化为|化出|化作|化|变爻|变为|变出|变作|日辰|日建|月建|月令)|(父母|官鬼|妻财|兄弟|子孙)|([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])|(${LINE_STATUS_TERM_SOURCE})`, 'g'));
    let scope = 'base';
    const validatedFacts = new Set();
    for (const event of events) {
      if (event[1]) {
        if (/^(?:伏神|伏藏|下伏|所伏|伏于|伏有)$/.test(event[1])) scope = 'hidden';
        else if (/^(?:动化|化为|化出|化作|化|变爻|变为|变出|变作)$/.test(event[1])) scope = 'changed';
        else if (/^(?:日辰|日建|月建|月令)$/.test(event[1])) scope = 'calendar';
        else if (!new RegExp(`^${LINE_MOVEMENT_TERM_SOURCE}$`).test(event[1])) scope = 'base';
      } else if (event[2]) {
        const key = `${scope}:relation`;
        if (!validatedFacts.has(key)) {
          assertLineFact(index, scope, 'relation', event[2], segment);
          validatedFacts.add(key);
        }
      } else if (event[3]) {
        const key = `${scope}:ganZhi`;
        const prefix = segment.slice(0, event.index ?? 0);
        const afterInteractionBoundary = /(?:克制?|生扶?|冲|合|作用|影响|泄|耗|助|用神|忌神|被)/.test(prefix);
        if (!validatedFacts.has(key) && !afterInteractionBoundary) {
          assertLineFact(index, scope, 'ganZhi', event[3], segment);
          validatedFacts.add(key);
        }
      } else if (event[4]) {
        assertStatusTerm(index, scope, event[4], segment);
      }
    }
  };

  // A line may contain three different entities: the visible/base line, its changed line,
  // and a hidden spirit beneath it. A comma ends the current line phrase unless the next
  // phrase explicitly continues with a scope marker such as “下伏” or “动化”.
  for (const sentence of basis.split(/[。；;\n]/)) {
    let carriedIndex = null;
    for (const phrase of sentence.split(/[，,、]/)) {
      const lineRefs = [...phrase.matchAll(/(?:第[ \t]*)?([初一二三四五六上1-6])[ \t]*爻/g)];
      if (lineRefs.length) {
        lineRefs.forEach((lineRef, position) => {
          const index = LINE_INDEX[lineRef[1]];
          const start = (lineRef.index ?? 0) + lineRef[0].length;
          const end = position + 1 < lineRefs.length ? lineRefs[position + 1].index : phrase.length;
          validateLineSegment(index, phrase.slice(start, end));
        });
        carriedIndex = LINE_INDEX[lineRefs.at(-1)[1]];
        continue;
      }
      const explicitContinuation = phrase.match(new RegExp(`^\\s*(?:并|且|又|其)?\\s*(?:伏神|伏藏|下伏|所伏|伏于|伏有|飞神|本爻|该爻|${LINE_MOVEMENT_TERM_SOURCE}|化为|化出|化作|化|变爻|变为|变出|变作|${LINE_STATUS_TERM_SOURCE})`));
      if (carriedIndex && (explicitContinuation || findMovementClaim(phrase))) {
        validateLineSegment(carriedIndex, phrase);
      } else {
        carriedIndex = null;
      }
    }
  }

  const assertRoleAtIndex = (indexToken, role) => {
    const index = LINE_INDEX[indexToken];
    const line = (plate.lines || []).find((item) => item.index === index);
    if (line && line.role !== role) throw new Error(`${label}把第${index}爻误写成“${role}爻”`);
  };
  for (const match of basis.matchAll(/(?:第[ \t]*)?([初一二三四五六上1-6])[ \t]*爻(?:为|是|临|持)[ \t]*([世应])爻?/g)) {
    assertRoleAtIndex(match[1], match[2]);
  }
  for (const match of basis.matchAll(/([世应])爻(?:在|为)?[ \t]*(?:第[ \t]*)?([初一二三四五六上1-6])[ \t]*爻/g)) {
    assertRoleAtIndex(match[2], match[1]);
  }
  for (const match of compactEntityBasis.matchAll(/(父母|官鬼|妻财|兄弟|子孙)(?:爻)?(?:持|临|为|是|居|处于|位于|在)(世|应)(?:位|爻)?/g)) {
    const roleLine = (plate.lines || []).find((line) => line.role === match[2]);
    if (!roleLine) throw new Error(`${label}引用了当前盘面不存在的“${match[2]}爻”`);
    if (roleLine.relation !== match[1]) throw new Error(`${label}把${match[2]}爻六亲误写为“${match[1]}”`);
  }
  for (const match of compactEntityBasis.matchAll(/(世|应)(?:爻|位)?(?:落在|位于|处于|为|是|属|系|对应)(父母|官鬼|妻财|兄弟|子孙)(?:爻)?/g)) {
    const roleLine = (plate.lines || []).find((line) => line.role === match[1]);
    if (!roleLine) throw new Error(`${label}引用了当前盘面不存在的“${match[1]}爻”`);
    if (roleLine.relation !== match[2]) throw new Error(`${label}把${match[1]}爻六亲误写为“${match[2]}”`);
  }
  for (const match of basis.matchAll(/([世应])爻([^，。；;\n]{0,24})/g)) {
    const line = (plate.lines || []).find((item) => item.role === match[1]);
    if (!line) throw new Error(`${label}引用了当前盘面不存在的“${match[1]}爻”`);
    const identity = match[2].match(/^[ \t]*(?:[（(:：][ \t]*)?(?:为|是|属|系|临|持)?[ \t]*(父母|官鬼|妻财|兄弟|子孙)?(?:爻)?[ \t]*([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])?[ \t]*([子丑寅卯辰巳午未申酉戌亥])?([金木水火土])?/);
    if (!identity) continue;
    if (identity[1] && identity[1] !== line.relation) throw new Error(`${label}把${match[1]}爻六亲误写为“${identity[1]}”`);
    if (identity[2] && identity[2] !== line.ganZhi) throw new Error(`${label}把${match[1]}爻干支误写为“${identity[2]}”`);
    if (identity[3] && identity[3] !== line.branch) throw new Error(`${label}把${match[1]}爻地支误写为“${identity[3]}”`);
    if (identity[4] && identity[4] !== line.element) throw new Error(`${label}把${match[1]}爻五行误写为“${identity[4]}”`);
    for (const status of match[2].matchAll(new RegExp(LINE_STATUS_TERM_SOURCE, 'g'))) {
      assertStatusTerm(line.index, 'base', status[0], match[0]);
    }
    const movement = findMovementClaim(match[2]);
    if (movement) assertLineMovement(line.index, movement.moving, movement.term, match[0]);
    const afterRole = basis.slice((match.index ?? 0) + match[0].length);
    const continuationPhrase = afterRole.match(/^[，,]\s*([^，,。；;\n]{0,30})/)?.[1];
    const continuationMovement = findMovementClaim(continuationPhrase);
    if (continuationMovement) assertLineMovement(line.index, continuationMovement.moving, continuationMovement.term, `${match[0]}${afterRole.slice(0, 30)}`);
    const continuationStatus = afterRole.match(new RegExp(`^[，,]\\s*(${LINE_STATUS_TERM_SOURCE})`));
    if (continuationStatus) assertStatusTerm(line.index, 'base', continuationStatus[1], `${match[0]}${afterRole.slice(0, 20)}`);
  }

  for (const line of plate.lines || []) {
    const signatures = [
      new RegExp(`${escapeRegExp(line.relation)}${LINE_ENTITY_SEPARATOR_SOURCE}${escapeRegExp(line.ganZhi)}`, 'g'),
      new RegExp(`${escapeRegExp(line.relation)}${LINE_ENTITY_SEPARATOR_SOURCE}${escapeRegExp(`${line.branch}${line.element}`)}`, 'g'),
    ];
    for (const signature of signatures) {
      for (const match of basis.matchAll(signature)) {
        const after = basis.slice((match.index ?? 0) + match[0].length);
        const samePhrase = after.match(/^[^，,。；;\n]{0,18}/)?.[0] || '';
        const movement = findMovementClaim(samePhrase);
        if (movement) assertLineMovement(line.index, movement.moving, movement.term, `${match[0]}${samePhrase}`);
        for (const status of samePhrase.matchAll(new RegExp(LINE_STATUS_TERM_SOURCE, 'g'))) {
          assertStatusTerm(line.index, 'base', status[0], `${match[0]}${samePhrase}`);
        }
        const statusContinuation = after.slice(samePhrase.length).match(new RegExp(`^[，,]\\s*(${LINE_STATUS_TERM_SOURCE})`));
        if (statusContinuation) assertStatusTerm(line.index, 'base', statusContinuation[1], `${match[0]}${after.slice(0, 30)}`);
        const movementContinuationPhrase = after.slice(samePhrase.length).match(/^[，,]\s*([^，,。；;\n]{0,30})/)?.[1];
        const movementContinuation = findMovementClaim(movementContinuationPhrase);
        if (movementContinuation) assertLineMovement(line.index, movementContinuation.moving, movementContinuation.term, `${match[0]}${after.slice(0, 30)}`);
      }
    }
  }

  const calendarClaim = (calendarLabel) => {
    const ganZhi = '([甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])';
    const correction = compactBasis.match(new RegExp(`${calendarLabel}(?:并非|不是)${ganZhi}[，,]?(?:而)?(?:是|为|乃|即)${ganZhi}`));
    if (correction) return correction[2];
    const assignment = compactBasis.match(new RegExp(`${calendarLabel}(?:(?:(?:所)?对应(?:的)?(?:干支)?|(?:的)?干支)(?:为|是|乃|即|[:：])?|(?:为|是|临|乃|即|值|逢|作|[:：]))?${ganZhi}`));
    if (assignment) return assignment[1];
    return compactBasis.match(new RegExp(`${ganZhi}(?:为|是|即|乃)${calendarLabel}`))?.[1] || null;
  };
  const monthGanZhi = calendarClaim('月(?:建|令)');
  if (monthGanZhi && monthGanZhi !== plate.monthGanZhi) throw new Error(`${label}把月建误写为“${monthGanZhi}”`);
  const monthBranch = compactBasis.match(/月(?:建|令)(?:为|是|临|即|[:：])?([子丑寅卯辰巳午未申酉戌亥])/);
  if (monthBranch && plate.monthBranch && monthBranch[1] !== plate.monthBranch) throw new Error(`${label}把月建地支误写为“${monthBranch[1]}”`);
  const dayGanZhi = calendarClaim('日(?:辰|建)');
  if (dayGanZhi && dayGanZhi !== plate.dayGanZhi) throw new Error(`${label}把日辰误写为“${dayGanZhi}”`);
}

function validateEvidenceReferences(markdown, evidence, label) {
  const evidenceById = new Map((evidence || []).map((item) => [String(item.id), item]));
  const referencedIds = [
    ...[...markdown.matchAll(/#evidence-([^\s)#]+)/g)].map((match) => match[1]),
    ...[...markdown.matchAll(/证据(?:[ \t]*ID)?[ \t]*[:：]?[ \t]*([A-Za-z0-9][A-Za-z0-9._-]*)/gi)].map((match) => match[1]),
    ...[...markdown.matchAll(/《[^》]+》[ \t]*[·・][^（(\]\n]+[（(](?!证据(?:[ \t]*ID)?\b)([A-Za-z0-9][A-Za-z0-9._-]*)[）)]/gi)].map((match) => match[1]),
  ];
  for (const id of referencedIds) {
    if (!evidenceById.has(id)) throw new Error(`${label}引用了未提供的古籍证据 ID“${id}”`);
  }

  const validateCitation = (id, citationText) => {
    const item = evidenceById.get(id);
    if (!item) return;
    const sourceMatch = citationText.match(/《([^》]+)》/);
    const locationMatch = citationText.match(/》[ \t]*[·・][ \t]*([^（(\]\n]+?)(?:[ \t]*[（(]|[ \t]*\]|[ \t]*$)/i);
    if (!sourceMatch || !locationMatch) throw new Error(`${label}引用证据 ${id} 时必须同时标明书名和位置`);
    if (sourceMatch[1].trim() !== String(item.source).trim()) {
      throw new Error(`${label}把证据 ${id} 的书名误写为《${sourceMatch[1].trim()}》`);
    }
    const citedLocation = locationMatch[1].trim();
    const actualLocation = String(item.location).trim();
    const citedLocationAppearsInEvidence = [...citedLocation].length >= 3 && String(item.text || '').includes(citedLocation);
    if (!actualLocation.includes(citedLocation) && !citedLocation.includes(actualLocation) && !citedLocationAppearsInEvidence) {
      throw new Error(`${label}把证据 ${id} 的位置误写为“${citedLocation}”`);
    }
  };

  for (const line of markdown.split('\n')) {
    const anchorMatches = [...line.matchAll(/\[([^\]]+)\]\(#evidence-([^\s)#]+)\)/g)];
    const citationLine = line.replace(/\[[^\]]+\]\(#evidence-[^\s)#]+\)/g, (anchor) => ' '.repeat(anchor.length));
    const literalIdMatches = [...citationLine.matchAll(/证据(?:[ \t]*ID)?[ \t]*[:：]?[ \t]*([A-Za-z0-9][A-Za-z0-9._-]*)/gi)];
    const bareCitationMatches = [...citationLine.matchAll(/《[^》]+》[ \t]*[·・][^（(\]\n]+[（(](?!证据(?:[ \t]*ID)?\b)([A-Za-z0-9][A-Za-z0-9._-]*)[）)]/gi)];
    const sourceClaim = /古籍来源[:：]|《[^》]+》/.test(line);
    if (/古籍来源[:：]/.test(line) && /未引用古籍/.test(line) && !/《[^》]+》/.test(line)) continue;
    if (sourceClaim && !literalIdMatches.length && !bareCitationMatches.length && !anchorMatches.length) {
      throw new Error(`${label}引用古籍时必须标明输入 evidence 中的证据 ID`);
    }
    literalIdMatches.forEach((idMatch, index) => {
      const previousIdEnd = index === 0
        ? -1
        : (literalIdMatches[index - 1].index ?? 0) + literalIdMatches[index - 1][0].length;
      const citationStart = line.lastIndexOf('《', idMatch.index);
      if (citationStart <= previousIdEnd) {
        throw new Error(`${label}引用证据 ${idMatch[1]} 时必须单独标明书名和位置`);
      }
      const closeParenCandidates = [line.indexOf('）', idMatch.index), line.indexOf(')', idMatch.index)]
        .filter((position) => position >= 0);
      const citationEnd = closeParenCandidates.length ? Math.min(...closeParenCandidates) + 1 : idMatch.index + idMatch[0].length;
      validateCitation(idMatch[1], line.slice(citationStart, citationEnd));
    });
    bareCitationMatches.forEach((citation) => validateCitation(citation[1], citation[0]));
    if (/古籍来源[:：]/.test(line)) {
      anchorMatches.forEach((anchor) => validateCitation(anchor[2], anchor[1]));
    }
  }

  for (const anchor of markdown.matchAll(/\[([^\]]+)\]\(#evidence-([^\s)#]+)\)/g)) {
    if (/《[^》]+》|[·・]/.test(anchor[1])) validateCitation(anchor[2], anchor[1]);
  }
}

async function ensureMarkdown(value, label = 'AI 解读', { plate, evidence = [], strictStructure = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}没有返回有效 Markdown 内容`);
  const markdown = value.trim();
  const prohibitedMeta = findProhibitedMetaContent(markdown);
  if (prohibitedMeta) throw new Error(`${label}包含模型署名、免责声明或通用尾注“${prohibitedMeta}”，必须删除`);
  if (/^[{[]/.test(markdown)) {
    try {
      const parsed = JSON.parse(markdown);
      if (parsed && typeof parsed === 'object') throw new Error(`${label}返回了结构化内容，而不是 Markdown 正文`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        // A Markdown link may legitimately start with "["; only valid JSON is structural output.
      } else {
        throw error;
      }
    }
  }
  if (/^```(?:markdown)?\s*[\s\S]*```$/i.test(markdown)) throw new Error(`${label}不应使用代码围栏包裹 Markdown 正文`);
  const [{ fromMarkdown }, { gfmFromMarkdown }, { gfm }] = await Promise.all([
    import('mdast-util-from-markdown'),
    import('mdast-util-gfm'),
    import('micromark-extension-gfm'),
  ]);
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  if (strictStructure) {
    validateStrictReportStructure(tree, label, evidence);
    validateStrictReportFacts(markdown, plate, label);
  } else {
    const basisTexts = collectBasisTexts(tree.children);
    if (!basisTexts.length) throw new Error(`${label}没有在判断后提供“依据”`);
    validateClaimBasisSequence(tree.children, label);
    basisTexts.forEach((basis) => {
      validateBasisContent(basis, label);
      validateBasisAgainstPlate(basis, plate, label);
    });
  }
  validateEvidenceReferences(markdown, evidence, label);
  return markdown;
}

function evidencePayload(evidence) {
  return (evidence || []).map(({ id, source, location, text, sourceType, knowledgeKind, topics }) => ({
    id,
    source,
    location,
    text,
    sourceType,
    knowledgeKind,
    topics,
  }));
}

function requireAIResponse(value, label = 'AI 解读') {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}没有返回可展示的内容`);
  return value;
}

async function postChat({ baseUrl, model, apiKey, messages, provider = 'deepseek', signal }) {
  if (provider !== 'deepseek') throw new Error(`不支持的解读 provider：${provider}`);
  const client = createDeepSeekClient({ apiKey, baseUrl });
  const { content } = await client.chat({ model, messages, responseFormat: null, signal });
  return requireAIResponse(content);
}

async function analyzeCloud({ baseUrl, model, apiKey, provider = 'deepseek', question, category, plate, evidence = [], retrievalDiagnostics, signal }) {
  const plan = reasoningPlan(category, plate);
  const payload = {
    responseFormat: 'markdown',
    question,
    reasoningPlan: plan,
    retrievalDiagnostics,
    evidence: evidencePayload(evidence),
    writingRequirements: [
      `必须完整输出并按顺序使用：${ANALYSIS_SECTION_HEADINGS.join('；')}。`,
      '每个章节用短段落或项目符号，每个项目只写一个完整句子；每个句末立即附行内引用标签。',
      '盘面事实使用 [排盘事实](#plate-facts)，古籍规则、占例或义理使用输入 evidence 中真实存在的 [《书名》·位置](#evidence-ID)。',
      '不得用一个章节末尾的来源列表替代逐句引用，不得虚构古籍、位置、证据 ID 或排盘事实。',
      '第 10 节资料不足时写“应期不足以精断”，第 11 节只写一句最终结论。',
    ],
  };
  const markdown = await postChat({
    baseUrl,
    model,
    apiKey,
    provider,
    signal,
    messages: [
      { role: 'system', content: buildAnalysisSystemPrompt(plate) },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });
  return {
    mode: 'cloud',
    markdown,
    generatedAt: new Date().toISOString(),
    pipeline: pipelineTrace(retrievalDiagnostics),
  };
}

async function followUpCloud({ baseUrl, model, apiKey, provider = 'deepseek', question, session, evidence = [], signal }) {
  const originalReport = session?.analysis?.markdown;
  if (!session?.plate || typeof originalReport !== 'string' || !originalReport.trim()) {
    throw new Error('原报告没有可用于追问的文本内容，请先生成主报告');
  }
  const sessionMessages = session.messages || [];
  const historyMessages = sessionMessages.at(-1)?.role === 'user' && sessionMessages.at(-1)?.content === question
    ? sessionMessages.slice(0, -1)
    : sessionMessages;
  const history = historyMessages.slice(-12).flatMap((message) => {
    if (message.role === 'user') return [{ role: 'user', content: message.content }];
    if (message.role === 'assistant' && message.kind === 'markdown-answer' && typeof message.content === 'string') {
      return [{ role: 'assistant', content: message.content }];
    }
    return [];
  });
  const context = {
    responseFormat: 'markdown',
    responseMode: 'focused-follow-up',
    originalQuestion: session.question,
    category: session.category,
    plate: session.plate,
    reasoningPlan: reasoningPlan(session.category, session.plate),
    originalReport,
    evidence: evidencePayload(evidence),
  };
  const content = await postChat({
    baseUrl,
    model,
    apiKey,
    provider,
    signal,
    messages: [
      { role: 'system', content: buildFollowUpSystemPrompt() },
      { role: 'user', content: JSON.stringify(context) },
      ...history,
      { role: 'user', content: question },
    ],
  });
  return { content };
}

module.exports = {
  analyzeCloud,
  createLocalReport,
  followUpCloud,
  postChat,
  reasoningPlan,
  validateMarkdownReport: ensureMarkdown,
};
