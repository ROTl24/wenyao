const test = require('node:test');
const assert = require('node:assert/strict');
const { buildProfessionalContext } = require('./liuyao-domain.cjs');

function visibleLine(index, relation, ganZhi, branch, element, role = '') {
  return {
    index,
    relation,
    ganZhi,
    branch,
    element,
    role,
    moving: false,
    void: false,
    monthBreak: false,
    dayClash: false,
  };
}

test('visible use-god candidates retain classified day-clash evidence', () => {
  const lines = [
    visibleLine(1, '父母', '甲子', '子', '水'),
    visibleLine(2, '子孙', '辛亥', '亥', '水'),
    visibleLine(3, '兄弟', '庚申', '申', '金', '世'),
    visibleLine(4, '官鬼', '壬午', '午', '火'),
    visibleLine(5, '父母', '壬辰', '辰', '土'),
    visibleLine(6, '兄弟', '壬戌', '戌', '土', '应'),
  ];
  lines[0].dayClash = true;
  lines[0].dayClashAssessment = {
    kind: 'hidden-movement',
    seasonalStrength: '旺',
    dayToLineElementRelation: '同类',
  };

  const context = buildProfessionalContext('study', {
    baseHexagram: { palaceElement: '金' },
    lines,
    fuShen: [],
  });

  assert.deepEqual(context.useGod.candidates[0].dayClashAssessment, lines[0].dayClashAssessment);
});

test('hidden use-god candidates retain month-day strength and flying-spirit action facts', () => {
  const plate = {
    baseHexagram: { palaceElement: '金' },
    lines: [
      visibleLine(1, '父母', '甲子', '子', '水'),
      visibleLine(2, '子孙', '辛亥', '亥', '水'),
      visibleLine(3, '兄弟', '庚申', '申', '金', '世'),
      visibleLine(4, '官鬼', '壬午', '午', '火'),
      visibleLine(5, '父母', '壬辰', '辰', '土'),
      visibleLine(6, '兄弟', '壬戌', '戌', '土', '应'),
    ],
    fuShen: [{
      lineIndex: 2,
      relation: '妻财',
      ganZhi: '甲寅',
      branch: '寅',
      element: '木',
      seasonalStrength: '囚',
      dayToHiddenElementRelation: '被克',
      void: false,
      monthBreak: false,
      dayClash: false,
      monthCombine: false,
      dayCombine: false,
      flyGanZhi: '辛亥',
      flyRelation: '子孙',
      flyElement: '水',
      flyEffect: '飞生伏',
      flyVoid: false,
      flyMonthBreak: false,
      flyDayClash: false,
      flyMonthCombine: false,
      flyDayCombine: false,
      activeSourceActions: [{
        id: 'active:4>hidden:2',
        sourceLineIndex: 4,
        sourceActivity: 'explicit-moving',
        target: 'hidden-spirit',
        elementRelation: '生',
        branchRelation: 'none',
        effects: ['生'],
      }],
      activationFactors: ['飞生伏', '动爻4生扶伏神'],
      blockingFactors: [],
      cautionFactors: ['旺衰仍需结合事项'],
      status: '受扶倾向',
    }],
  };

  const context = buildProfessionalContext('wealth', plate);
  const hidden = context.useGod.candidates.find((candidate) => candidate.source === 'hidden');

  assert.deepEqual(hidden.hiddenSpiritFacts, {
    calendar: {
      seasonalStrength: '囚',
      dayToHiddenElementRelation: '被克',
      void: false,
      monthBreak: false,
      dayClash: false,
      monthCombine: false,
      dayCombine: false,
    },
    flying: {
      ganZhi: '辛亥',
      relation: '子孙',
      element: '水',
      effect: '飞生伏',
      void: false,
      monthBreak: false,
      dayClash: false,
      monthCombine: false,
      dayCombine: false,
    },
    activeSourceActions: [{
      id: 'active:4>hidden:2',
      sourceLineIndex: 4,
      sourceActivity: 'explicit-moving',
      target: 'hidden-spirit',
      elementRelation: '生',
      branchRelation: 'none',
      effects: ['生'],
    }],
    assessment: {
      activationFactors: ['飞生伏', '动爻4生扶伏神'],
      blockingFactors: [],
      cautionFactors: ['旺衰仍需结合事项'],
      status: '受扶倾向',
    },
  });
});
