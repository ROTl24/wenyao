const ELEMENT_GENERATES = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

const ELEMENT_CONTROLS = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

const BRANCH_HARMONIES = new Set(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']);
const BRANCH_CLASHES = new Set(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']);
const BRANCH_ELEMENTS = {
  子: '水', 亥: '水',
  寅: '木', 卯: '木',
  巳: '火', 午: '火',
  申: '金', 酉: '金',
  辰: '土', 戌: '土', 丑: '土', 未: '土',
};
const VOID_SCOPE_RULE = '旬空只作用于具体卦爻；月建和日辰本身不论旬空。月支或日支与空亡支同名时，仍只能按 lines 或 fuShen 中具体爻的 void 状态判断，不得削弱月建或日辰本身。';

const CATEGORY_USE_GOD_RULES = {
  career: {
    selectionMode: 'six-relation',
    primaryRelation: '官鬼',
    secondaryRelations: ['父母'],
    rule: '事业事项以官鬼为主用神，父母用于复核职位、手续与文书条件，世爻代表求测者。',
  },
  wealth: {
    selectionMode: 'six-relation',
    primaryRelation: '妻财',
    secondaryRelations: ['子孙', '兄弟'],
    rule: '求财事项以妻财为主用神，子孙看财源，兄弟看竞争与耗财，世爻代表求测者。',
  },
  study: {
    selectionMode: 'six-relation',
    primaryRelation: '父母',
    secondaryRelations: ['官鬼'],
    rule: '学业事项以父母为主用神，官鬼只辅助判断考试名次、录取与外部评价，世爻代表求测者。',
  },
  health: {
    selectionMode: 'line-role',
    primaryRole: '世',
    secondaryRelations: ['官鬼', '子孙'],
    rule: '自占健康以世爻为主用神，官鬼看病因压力，子孙看制化与恢复条件。',
  },
  relationship: {
    selectionMode: 'question-specific',
    secondaryRelations: ['官鬼', '妻财'],
    rule: '感情事项必须先根据求测者与对象身份确定六亲用神，再结合世应，不得只用世应替代取用。',
  },
  lost_item: {
    selectionMode: 'question-specific',
    secondaryRelations: [],
    rule: '失物事项必须先按失物类别确定对应六亲用神，再判断方位、动静与冲合。',
  },
  travel: {
    selectionMode: 'question-specific',
    secondaryRelations: [],
    rule: '出行事项必须先根据所问是自身出行还是他人行踪确定用神，再看世应、动爻与日月。',
  },
  other: {
    selectionMode: 'question-specific',
    secondaryRelations: [],
    rule: '先根据具体事项在父母、官鬼、妻财、子孙、兄弟或世应中确定主用神，再进入旺衰生克分析。',
  },
};

function elementRelation(left, right) {
  if (!left || !right) return '未知';
  if (left === right) return '比和';
  if (ELEMENT_GENERATES[left] === right) return '左生右';
  if (ELEMENT_GENERATES[right] === left) return '右生左';
  if (ELEMENT_CONTROLS[left] === right) return '左克右';
  if (ELEMENT_CONTROLS[right] === left) return '右克左';
  return '未知';
}

function branchRelation(left, right) {
  if (!left || !right) return '无';
  if (BRANCH_HARMONIES.has(`${left}${right}`) || BRANCH_HARMONIES.has(`${right}${left}`)) return '六合';
  if (BRANCH_CLASHES.has(`${left}${right}`) || BRANCH_CLASHES.has(`${right}${left}`)) return '六冲';
  return '无';
}

function canonicalBranchPair(left, right, relation) {
  const pairs = relation === '六合' ? BRANCH_HARMONIES : BRANCH_CLASHES;
  if (pairs.has(`${left}${right}`)) return `${left}${right}`;
  if (pairs.has(`${right}${left}`)) return `${right}${left}`;
  return '';
}

function interactionFactStatement(interaction) {
  const left = `${interaction.leftGanZhi}${interaction.leftElement}`;
  const right = `${interaction.rightGanZhi}${interaction.rightElement}`;
  const elementText = {
    左生右: `${left}生${right}`,
    右生左: `${right}生${left}`,
    左克右: `${left}克${right}`,
    右克左: `${right}克${left}`,
    比和: `${left}与${right}五行比和`,
    未知: `${left}与${right}的五行关系未锁定`,
  }[interaction.elementRelation];
  const pair = canonicalBranchPair(interaction.leftBranch, interaction.rightBranch, interaction.branchRelation);
  return pair ? `${elementText}，${pair}${interaction.branchRelation}` : elementText;
}

function visibleCandidate(line) {
  return {
    source: 'visible',
    lineIndex: line.index,
    relation: line.relation,
    ganZhi: line.ganZhi,
    branch: line.branch,
    element: line.element,
    role: line.role || '',
    moving: Boolean(line.moving),
    void: Boolean(line.void),
    monthBreak: Boolean(line.monthBreak),
    dayClash: Boolean(line.dayClash),
  };
}

function hiddenCandidate(item) {
  return {
    source: 'hidden',
    lineIndex: item.lineIndex,
    relation: item.relation,
    ganZhi: item.ganZhi,
    branch: item.branch,
    element: item.element,
    role: '',
    moving: false,
    void: Boolean(item.void),
    monthBreak: Boolean(item.monthBreak),
    dayClash: Boolean(item.dayClash),
  };
}

function selectionCandidates(rule, plate) {
  const visible = plate.lines.map(visibleCandidate);
  const hidden = (plate.fuShen || []).map(hiddenCandidate);
  if (rule.selectionMode === 'six-relation') {
    return [...visible, ...hidden].filter((candidate) => candidate.relation === rule.primaryRelation);
  }
  if (rule.selectionMode === 'line-role') {
    return visible.filter((candidate) => candidate.role === rule.primaryRole);
  }
  return [...visible, ...hidden];
}

function inverseElement(mapping, target) {
  return Object.keys(mapping).find((element) => mapping[element] === target) || '';
}

function relationForElement(element, palaceElement) {
  if (!element || !palaceElement) return '';
  if (element === palaceElement) return '兄弟';
  if (ELEMENT_GENERATES[palaceElement] === element) return '子孙';
  if (ELEMENT_GENERATES[element] === palaceElement) return '父母';
  if (ELEMENT_CONTROLS[palaceElement] === element) return '妻财';
  if (ELEMENT_CONTROLS[element] === palaceElement) return '官鬼';
  return '';
}

function candidateReference(candidate) {
  return {
    source: candidate.source,
    lineIndex: candidate.lineIndex,
    relation: candidate.relation,
    ganZhi: candidate.ganZhi,
  };
}

function spiritRoleFact(label, element, plate, allCandidates) {
  return {
    label,
    element,
    relation: relationForElement(element, plate.baseHexagram?.palaceElement),
    lineRefs: allCandidates.filter((candidate) => candidate.element === element).map(candidateReference),
  };
}

function spiritRoleFacts(useGodElement, plate) {
  const allCandidates = [
    ...plate.lines.map(visibleCandidate),
    ...(plate.fuShen || []).map(hiddenCandidate),
  ];
  const originalElement = inverseElement(ELEMENT_GENERATES, useGodElement);
  const tabooElement = inverseElement(ELEMENT_CONTROLS, useGodElement);
  const enemyElement = inverseElement(ELEMENT_GENERATES, tabooElement);
  return {
    useGodElement,
    original: spiritRoleFact('原神', originalElement, plate, allCandidates),
    taboo: spiritRoleFact('忌神', tabooElement, plate, allCandidates),
    enemy: spiritRoleFact('仇神', enemyElement, plate, allCandidates),
  };
}

function lineInteractions(lines) {
  const interactions = [];
  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      const left = lines[leftIndex];
      const right = lines[rightIndex];
      const interaction = {
        leftLineIndex: left.index,
        rightLineIndex: right.index,
        leftGanZhi: left.ganZhi,
        rightGanZhi: right.ganZhi,
        leftBranch: left.branch,
        rightBranch: right.branch,
        leftElement: left.element,
        rightElement: right.element,
        leftRelation: left.relation,
        rightRelation: right.relation,
        leftRole: left.role || '',
        rightRole: right.role || '',
        elementRelation: elementRelation(left.element, right.element),
        branchRelation: branchRelation(left.branch, right.branch),
      };
      interactions.push({ ...interaction, factStatement: interactionFactStatement(interaction) });
    }
  }
  return interactions;
}

function requiredInteractionFacts(candidate, rule, plate, interactions) {
  const primaryLine = candidate.source === 'visible'
    ? plate.lines.find((line) => line.index === candidate.lineIndex && line.ganZhi === candidate.ganZhi)
    : null;
  const worldLines = plate.lines.filter((line) => line.role === '世');
  const responseLines = plate.lines.filter((line) => line.role === '应');
  const secondaryLines = plate.lines.filter((line) => rule.secondaryRelations.includes(line.relation));
  const pairs = new Set();

  function addPair(left, right) {
    if (!left || !right || left.index === right.index) return;
    const lower = Math.min(left.index, right.index);
    const upper = Math.max(left.index, right.index);
    pairs.add(`${lower}:${upper}`);
  }

  for (const world of worldLines) {
    for (const response of responseLines) addPair(world, response);
    for (const secondary of secondaryLines) addPair(world, secondary);
    addPair(primaryLine, world);
  }
  for (const response of responseLines) addPair(primaryLine, response);
  for (const secondary of secondaryLines) addPair(primaryLine, secondary);

  return [...pairs].map((key) => {
    const [leftIndex, rightIndex] = key.split(':').map(Number);
    return interactions.find((interaction) => (
      Math.min(interaction.leftLineIndex, interaction.rightLineIndex) === leftIndex
      && Math.max(interaction.leftLineIndex, interaction.rightLineIndex) === rightIndex
    ));
  }).filter(Boolean);
}

function buildProfessionalContext(category, plate) {
  const rule = CATEGORY_USE_GOD_RULES[category] || CATEGORY_USE_GOD_RULES.other;
  const candidates = selectionCandidates(rule, plate);
  const useGodElements = [...new Set(candidates.map((candidate) => candidate.element).filter(Boolean))];
  const interactions = lineInteractions(plate.lines);
  return {
    voidScopeRule: VOID_SCOPE_RULE,
    useGod: {
      ...rule,
      candidates,
      alternativeCandidatesByPrimary: candidates.map((candidate) => ({
        primary: candidateReference(candidate),
        alternatives: candidates
          .filter((alternative) => alternative.relation === candidate.relation && !sameCandidate(alternative, candidate))
          .map(candidateReference),
      })),
      requiresExplicitSelection: true,
      requiresAlternativeAnalysis: candidates.length > 1,
    },
    spiritRoleFacts: useGodElements.map((element) => spiritRoleFacts(element, plate)),
    lineInteractions: interactions,
    requiredInteractionFactsByUseGod: candidates.map((candidate) => ({
      primary: candidateReference(candidate),
      checks: requiredInteractionFacts(candidate, rule, plate, interactions),
    })),
  };
}

function sameCandidate(candidate, selection) {
  return candidate.source === selection?.source
    && candidate.lineIndex === selection?.lineIndex
    && candidate.relation === selection?.relation
    && candidate.ganZhi === selection?.ganZhi;
}

function sameReference(left, right) {
  return left.source === right?.source
    && left.lineIndex === right?.lineIndex
    && left.relation === right?.relation
    && left.ganZhi === right?.ganZhi;
}

function validateSpiritRoles(input, expected) {
  const spiritRoles = input?.spiritRoles;
  if (!spiritRoles?.original || !spiritRoles?.taboo || !spiritRoles?.enemy) {
    throw new Error('AI 报告缺少原神、忌神、仇神生克角色结构');
  }
  for (const roleKey of ['original', 'taboo', 'enemy']) {
    const actual = spiritRoles[roleKey];
    const fact = expected[roleKey];
    const actualRefs = Array.isArray(actual.lineRefs) ? actual.lineRefs : [];
    const refsMatch = actualRefs.length === fact.lineRefs.length
      && fact.lineRefs.every((expectedRef) => actualRefs.some((actualRef) => sameReference(expectedRef, actualRef)));
    if (actual.element !== fact.element || actual.relation !== fact.relation || !refsMatch) {
      throw new Error(`AI 报告的${fact.label}六亲、五行或落爻与程序锁定事实不一致`);
    }
    if (typeof actual.assessment !== 'string' || !actual.assessment.trim()) {
      throw new Error(`AI 报告没有说明${fact.label}的作用状态`);
    }
  }
  const relations = String(input.relations || '');
  for (const roleKey of ['original', 'taboo', 'enemy']) {
    const fact = expected[roleKey];
    if (!relations.includes(fact.label) || !relations.includes(fact.relation)) {
      throw new Error(`AI 报告没有在生克制化章节明确展示${fact.label}及对应六亲`);
    }
  }
}

function sameLinePair(left, right) {
  return left.leftLineIndex === right?.leftLineIndex && left.rightLineIndex === right?.rightLineIndex;
}

function contradictsLockedBranchRelation(text, branchRelationValue) {
  const value = String(text || '');
  if (branchRelationValue === '六合') {
    return /不生合|(?:并不|并未|不|无|没有|未能)(?:构成|形成|存在)?(?:相合|六合|合)/.test(value);
  }
  if (branchRelationValue === '六冲') {
    return /(?:并不|并未|不|无|没有|未能)(?:构成|形成|存在)?(?:相冲|六冲|冲)/.test(value);
  }
  return false;
}

function endpointAliases(fact, side) {
  const ganZhi = fact[`${side}GanZhi`];
  const branch = fact[`${side}Branch`];
  const element = fact[`${side}Element`];
  const role = fact[`${side}Role`];
  const relation = fact[`${side}Relation`];
  return [ganZhi, branch && element ? `${branch}${element}` : '', role ? `${role}爻` : relation].filter(Boolean);
}

function directedRelationPolarity(beforeVerb) {
  return /(?:并不|并未|不再|没有|不能|无法|未|不|无)\s*$/.test(beforeVerb)
    ? 'negated'
    : 'affirmed';
}

function clauseHasDirectedRelation(clause, fromAliases, verb, toAliases, polarity = 'affirmed') {
  for (const from of fromAliases) {
    let fromIndex = clause.indexOf(from);
    while (fromIndex >= 0) {
      const verbIndex = clause.indexOf(verb, fromIndex + from.length);
      if (verbIndex >= 0) {
        const toIndexes = toAliases
          .map((alias) => clause.indexOf(alias, verbIndex + verb.length))
          .filter((index) => index >= 0)
          .sort((left, right) => left - right);
        for (const toIndex of toIndexes) {
          const beforeVerb = clause.slice(fromIndex + from.length, verbIndex);
          const afterVerb = clause.slice(verbIndex + verb.length, toIndex);
          if (beforeVerb.length <= 12
            && afterVerb.length <= 12
            && !/[，,、：:]/.test(beforeVerb)
            && !/[，,、：:]/.test(afterVerb)
            && directedRelationPolarity(beforeVerb) === polarity) return true;
        }
      }
      fromIndex = clause.indexOf(from, fromIndex + from.length);
    }
  }
  return false;
}

function clauseContradictsElementRelation(clause, fact, leftAliases, rightAliases) {
  const relationParts = {
    左生右: [leftAliases, '生', rightAliases],
    右生左: [rightAliases, '生', leftAliases],
    左克右: [leftAliases, '克', rightAliases],
    右克左: [rightAliases, '克', leftAliases],
  };
  const expectedParts = relationParts[fact.elementRelation];
  if (expectedParts && clauseHasDirectedRelation(clause, ...expectedParts, 'negated')) return true;

  const leftGeneratesRight = clauseHasDirectedRelation(clause, leftAliases, '生', rightAliases);
  const rightGeneratesLeft = clauseHasDirectedRelation(clause, rightAliases, '生', leftAliases);
  const leftControlsRight = clauseHasDirectedRelation(clause, leftAliases, '克', rightAliases);
  const rightControlsLeft = clauseHasDirectedRelation(clause, rightAliases, '克', leftAliases);
  const observed = {
    左生右: leftGeneratesRight,
    右生左: rightGeneratesLeft,
    左克右: leftControlsRight,
    右克左: rightControlsLeft,
  };
  if (fact.elementRelation === '比和') return Object.values(observed).some(Boolean);
  if (fact.elementRelation === '未知') return false;
  return Object.entries(observed).some(([relation, present]) => present && relation !== fact.elementRelation);
}

function contradictoryClause(text, fact) {
  const leftAliases = endpointAliases(fact, 'left');
  const rightAliases = endpointAliases(fact, 'right');
  return String(text || '').split(/[。；\n]/).find((clause) => (
    leftAliases.some((alias) => clause.includes(alias))
    && rightAliases.some((alias) => clause.includes(alias))
    && (contradictsLockedBranchRelation(clause, fact.branchRelation)
      || clauseContradictsElementRelation(clause, fact, leftAliases, rightAliases))
  )) || '';
}

function visibleTextContradictsFact(text, fact) {
  return Boolean(contradictoryClause(text, fact));
}

function surfaceMissingInteractionFacts(text, checks, beforeHeading = '') {
  const value = String(text || '');
  const missing = checks.filter((fact) => !value.includes(fact.factStatement));
  if (!missing.length) return value;
  const factBlock = `程序锁定的关系事实：${missing.map((fact) => fact.factStatement).join('；')}。\n`;
  const insertionIndex = beforeHeading ? value.indexOf(beforeHeading) : -1;
  if (insertionIndex < 0) return `${value}\n${factBlock.trimEnd()}`;
  return `${value.slice(0, insertionIndex)}${factBlock}${value.slice(insertionIndex)}`;
}

function validateTemporalVoidScope(input, plate) {
  const visibleText = [input.summary, input.focus, input.relations, input.moving, input.synthesis]
    .filter(Boolean)
    .join('\n');
  const directTemporalVoid = /(?:月建|月令|日辰|日建)(?:本身|[甲乙丙丁戊己庚辛壬癸]?[子丑寅卯辰巳午未申酉戌亥](?:木|火|土|金|水)?)?(?:也|亦|仍|为|是|属|逢|落|入|临|处于)?(?:旬空|空亡)/;
  if (directTemporalVoid.test(visibleText)) {
    throw new Error('AI 报告错误地把月建或日辰本身判为旬空');
  }

  const monthBranch = plate.monthBranch || String(plate.monthGanZhi || '').slice(-1);
  const monthElement = BRANCH_ELEMENTS[monthBranch];
  if (!monthBranch || !monthElement) return;
  const voidLineGanZhi = [
    ...(plate.lines || []),
    ...(plate.fuShen || []),
  ].filter((item) => item.void && item.branch === monthBranch).map((item) => item.ganZhi);
  const ambiguousMonthVoid = new RegExp(`${monthBranch}${monthElement}(?:本身|也|亦|仍|为|是|属|逢|落|入|临)?(?:旬空|空亡)`);
  for (const clause of visibleText.split(/[。；\n]/)) {
    const mentionsMonthBuild = clause.includes('月建')
      || clause.includes('月令')
      || (plate.monthGanZhi && clause.includes(plate.monthGanZhi));
    const identifiesVoidLine = voidLineGanZhi.some((ganZhi) => clause.includes(ganZhi));
    if (mentionsMonthBuild && ambiguousMonthVoid.test(clause) && !identifiesVoidLine) {
      throw new Error('AI 报告混淆了月建与同支卦爻的旬空状态');
    }
  }
}

function validateInteractionChecks(input, context, primary) {
  if (!Array.isArray(input?.interactionChecks)) {
    throw new Error('AI 报告缺少关键生克关系校验结构');
  }
  const expected = context.requiredInteractionFactsByUseGod
    .find((item) => sameCandidate(item.primary, primary))?.checks || [];
  const visibleText = `${input.relations || ''}\n${input.moving || ''}`;
  for (const fact of expected) {
    const actual = input.interactionChecks.find((item) => sameLinePair(fact, item));
    if (!actual) throw new Error('AI 报告遗漏主用神、世应或辅助六亲之间的关键关系');
    if (actual.elementRelation !== fact.elementRelation
      || actual.branchRelation !== fact.branchRelation
      || actual.factStatement !== fact.factStatement) {
      throw new Error('AI 报告的关键生克或六合六冲关系与程序锁定事实不一致');
    }
    if (typeof actual.interpretation !== 'string' || !actual.interpretation.trim()) {
      throw new Error('AI 报告没有解释关键生克关系对所问事项的影响');
    }
    const interpretationContradiction = contradictoryClause(actual.interpretation, fact);
    if (interpretationContradiction) {
      throw new Error(`AI 报告的正文解释与程序锁定事实“${fact.factStatement}”相互矛盾：${interpretationContradiction.trim()}`);
    }
    const visibleContradiction = contradictoryClause(visibleText, fact);
    if (visibleContradiction) {
      throw new Error(`AI 报告的可见正文与程序锁定事实“${fact.factStatement}”相互矛盾：${visibleContradiction.trim()}`);
    }
  }
  for (const actual of input.interactionChecks) {
    const locked = context.lineInteractions.find((fact) => sameLinePair(fact, actual));
    if (!locked
      || actual.elementRelation !== locked.elementRelation
      || actual.branchRelation !== locked.branchRelation
      || actual.factStatement !== locked.factStatement) {
      throw new Error('AI 报告包含未经程序锁定或不正确的爻间关系');
    }
  }
  return expected.map((fact) => ({
    ...fact,
    interpretation: input.interactionChecks.find((item) => sameLinePair(fact, item)).interpretation,
  }));
}

function validateProfessionalAnalysis(input, category, plate) {
  const context = buildProfessionalContext(category, plate);
  validateTemporalVoidScope(input, plate);
  const selection = input?.useGodSelection;
  if (!selection || typeof selection !== 'object' || !selection.primary) {
    throw new Error('AI 报告缺少具体主用神取用结构');
  }
  const primary = context.useGod.candidates.find((candidate) => sameCandidate(candidate, selection.primary));
  if (!primary) {
    throw new Error('AI 报告选择的主用神不在程序锁定的候选爻中');
  }
  if (typeof selection.reason !== 'string' || !selection.reason.trim()) {
    throw new Error('AI 报告没有说明主用神取舍理由');
  }
  const secondaryRelations = Array.isArray(selection.secondaryRelations) ? selection.secondaryRelations : [];
  if (secondaryRelations.length !== context.useGod.secondaryRelations.length
    || context.useGod.secondaryRelations.some((relation) => !secondaryRelations.includes(relation))) {
    throw new Error('AI 报告的辅助六亲与程序锁定的取用合同不一致');
  }
  const alternatives = Array.isArray(selection.alternatives) ? selection.alternatives : [];
  const lockedAlternativeRefs = context.useGod.alternativeCandidatesByPrimary
    .find((item) => sameCandidate(item.primary, primary))?.alternatives || [];
  const otherCandidates = lockedAlternativeRefs.map((reference) => (
    context.useGod.candidates.find((candidate) => sameCandidate(candidate, reference))
  )).filter(Boolean);
  for (const candidate of otherCandidates) {
    const alternative = alternatives.find((item) => sameCandidate(candidate, item));
    if (!alternative || typeof alternative.reason !== 'string' || !alternative.reason.trim()) {
      throw new Error('AI 报告遇到用神两现时没有比较其他候选爻并说明取舍');
    }
  }
  if (alternatives.length !== otherCandidates.length) {
    throw new Error('AI 报告包含程序未锁定的用神候选爻');
  }
  const focus = String(input.focus || '');
  if (!focus.includes(primary.relation) || !focus.includes(primary.ganZhi) || !/(?:主用神|最终取用|取[^。；\n]{0,20}为用神)/.test(focus)) {
    throw new Error('AI 报告没有在用神章节明确展示具体主用神');
  }
  if (otherCandidates.some((candidate) => !focus.includes(candidate.ganZhi))) {
    throw new Error('AI 报告没有在用神章节展示两现候选的比较结果');
  }
  const expectedSpiritRoles = spiritRoleFacts(primary.element, plate);
  validateSpiritRoles(input, expectedSpiritRoles);
  const interactionChecks = validateInteractionChecks(input, context, primary);
  return {
    context,
    selection: { ...selection, primary },
    interactionChecks,
    relations: surfaceMissingInteractionFacts(input.relations, interactionChecks),
  };
}

function validateProfessionalFollowUp(content, professional, plate) {
  if (!professional?.useGodSelection?.primary || !Array.isArray(professional.interactionChecks)) {
    throw new Error('原报告缺少已校验的专业取用结构，请先重新生成主报告');
  }
  const text = String(content || '');
  validateTemporalVoidScope({ focus: text }, plate);
  const primary = professional.useGodSelection.primary;
  const primaryPattern = new RegExp(
    `(?:${primary.relation}${primary.ganZhi}[^。；\\n]{0,20}(?:主用神|为用神)|(?:主用神|最终取用)[^。；\\n]{0,24}${primary.relation}?${primary.ganZhi})`,
  );
  if (!primaryPattern.test(text)) {
    throw new Error('追问回答没有沿用原报告已选定的具体主用神');
  }
  for (const alternative of professional.useGodSelection.alternatives || []) {
    if (!text.includes(alternative.ganZhi)) throw new Error('追问回答遗漏原报告中的用神两现取舍');
  }
  for (const [key, label] of [['original', '原神'], ['taboo', '忌神'], ['enemy', '仇神']]) {
    const role = professional.spiritRoles?.[key];
    if (!role || !text.includes(label) || !text.includes(role.relation)) {
      throw new Error(`追问回答没有沿用原报告的${label}结构`);
    }
  }
  for (const fact of professional.interactionChecks) {
    const contradiction = contradictoryClause(text, fact);
    if (contradiction) {
      throw new Error(`追问回答与原报告已锁定的五行生克或冲合事实相互矛盾：${contradiction.trim()}`);
    }
  }
  return surfaceMissingInteractionFacts(text, professional.interactionChecks, '6. 动爻与变爻分析');
}

module.exports = {
  VOID_SCOPE_RULE,
  buildProfessionalContext,
  validateProfessionalAnalysis,
  validateProfessionalFollowUp,
};
