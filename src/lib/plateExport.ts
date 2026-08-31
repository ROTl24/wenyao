import type {
  ActiveActionFact,
  BaseRelationFact,
  FuShen,
  Hexagram,
  HexagramDynamics,
  PlateLine,
  ShenSha,
  TransformationReturnFact,
} from './divination';
import { zhouyiClassics } from './classics';
import { CASTING_METHOD_LABELS, type CastingBasis, type LineRecord } from './casting';
import type { DivinationSession } from './session';
import { SESSION_CATEGORY_LABELS } from './sessionCategories';
import { formatShanghaiDateTime, shanghaiTime } from './shanghaiTime';
import {
  BRANCH_RELATION_SCOPE,
  branchRelationLabel,
  directedActionEffectLabels,
  directedElementRelationLabel,
  presentTransformationReturn,
  TRANSFORMATION_RETURN_SCOPE,
  type TransformationReturnPresentation,
  type TransformationReturnScope,
} from './relationLabels';

export type PlateExportFormat = 'text' | 'markdown' | 'json';

export const PLATE_EXPORT_FORMAT_LABELS: Record<PlateExportFormat, string> = {
  text: '纯文本',
  markdown: 'Markdown',
  json: 'JSON',
};

const LINE_POSITIONS = ['', '初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];
const SOURCE_ACTIVITY_LABELS = {
  static: '静爻',
  'explicit-moving': '明动',
  'hidden-moving': '暗动',
} as const;
const SIX_RELATION_LABELS = {
  'six-harmony': '六合',
  'six-clash': '六冲',
  none: '无六合六冲',
} as const;
const TRANSITION_LABELS = {
  'clash-to-harmony': '六冲变六合',
  'harmony-to-clash': '六合变六冲',
  'clash-to-clash': '六冲变六冲',
  'harmony-to-harmony': '六合变六合',
  none: '无六合六冲转化',
} as const;

const FACT_BOUNDARY_INSTRUCTION = '请严格依据以下文王纳甲排盘事实解读，不要自行改盘或虚构经文、经历。';
const ANALYSIS_INSTRUCTION = '请明确所取用神及理由，再分析月日旺衰、动爻、变爻、世应、生克冲合与伏神。';
const CONCLUSION_INSTRUCTION = '请区分程序提供的事实、你的推断与不确定内容，最后给出结论、成立条件和可能应期，不强造确定日期。';
const BRANCH_SCOPE_LABEL = BRANCH_RELATION_SCOPE.join('与');

function exportInstructions(hasMovingLines: boolean): string[] {
  const plateSummaryInstruction = hasMovingLines
    ? '请先复述本卦、变卦、动爻与起卦方式；本卦与变卦的排列表示成卦变化，回头关系固定表示变爻对同位本爻的作用；如发现输入矛盾，请停止分析并指出矛盾。'
    : '请先复述本卦与起卦方式；本盘无动爻和变卦；如发现输入矛盾，请停止分析并指出矛盾。';
  return [FACT_BOUNDARY_INSTRUCTION, plateSummaryInstruction, ANALYSIS_INSTRUCTION, CONCLUSION_INSTRUCTION];
}

function linePosition(index: number): string {
  return LINE_POSITIONS[index] || `第${index}爻`;
}

function hexagramSummary(hexagram: Hexagram) {
  return {
    name: hexagram.name,
    shortName: hexagram.shortName,
    upperTrigram: `${hexagram.upper.symbol}${hexagram.upper.key}（${hexagram.upper.nature}、${hexagram.upper.element}）`,
    lowerTrigram: `${hexagram.lower.symbol}${hexagram.lower.key}（${hexagram.lower.nature}、${hexagram.lower.element}）`,
    palace: `${hexagram.palace}宫`,
    palaceElement: hexagram.palaceElement,
    generation: hexagram.generation,
    worldLine: linePosition(hexagram.shiLine),
    responseLine: linePosition(hexagram.yingLine),
  };
}

function booleanFacts(line: PlateLine, changed = false): string[] {
  const value = <T>(base: T, transformed: T): T => (changed ? transformed : base);
  const facts = [
    value(line.void, line.changedVoid) ? '旬空' : '',
    value(line.monthBreak, line.changedMonthBreak) ? '月破' : '',
    value(line.dayClash, line.changedDayClash) ? (line.dayClashAssessment.kind === 'hidden-movement' && !changed ? '暗动' : '日冲') : '',
    value(line.monthCombine, line.changedMonthCombine) ? '月合' : '',
    value(line.dayCombine, line.changedDayCombine) ? '日合' : '',
  ].filter(Boolean);
  if (!changed) {
    facts.unshift(`旺衰：${line.dayClashAssessment.seasonalStrength}`);
    facts.push(`月令十二长生：${line.twelveStages.month}`, `日辰十二长生：${line.twelveStages.day}`);
  } else if (line.twelveStages.transformation) {
    facts.push(`化爻十二长生：${line.twelveStages.transformation}`);
  }
  return facts.length ? facts : [changed ? '变爻无附加状态' : '无附加状态'];
}

function originalLine(record: LineRecord) {
  return {
    position: linePosition(record.lineIndex),
    value: record.value,
    recordedAt: record.recordedAt,
    ...(record.coin ? {
      coins: record.coin.faces.map((face) => face === 'text' ? '字（2）' : '背（3）'),
    } : {}),
  };
}

function castingBasis(basis: CastingBasis) {
  if (basis.kind !== 'time') return { algorithm: basis.algorithm };
  return {
    algorithm: basis.algorithm,
    castAt: basis.castAt,
    calendar: structuredClone(basis.calendar),
    upperTrigramNumber: basis.upperTrigramNumber,
    lowerTrigramNumber: basis.lowerTrigramNumber,
    movingLine: linePosition(basis.movingLine),
  };
}

function exportLine(line: PlateLine, hasMovingLines: boolean) {
  return {
    position: linePosition(line.index),
    spirit: line.beast,
    originalValue: line.value,
    lineType: line.label,
    moving: line.moving ? '动爻' : '静爻',
    base: {
      polarity: line.baseYang ? '阳' : '阴',
      relation: line.relation,
      stemBranch: line.ganZhi,
      element: line.element,
      role: line.role || '无',
      facts: booleanFacts(line),
    },
    ...(hasMovingLines ? {
      changed: {
        polarity: line.changedYang ? '阳' : '阴',
        relation: line.changedRelation,
        stemBranch: line.changedGanZhi,
        element: line.changedElement,
        role: line.changedRole || '无',
        facts: booleanFacts(line, true),
      },
    } : {}),
  };
}

function exportShenSha(item: ShenSha) {
  return {
    name: item.name,
    basis: item.basis,
    branches: item.branches,
    baseLines: item.baseLineIndexes.map(linePosition),
    changedLines: item.changedLineIndexes.map(linePosition),
  };
}

function exportFuShen(item: FuShen) {
  return {
    position: linePosition(item.lineIndex),
    source: `${item.sourcePalace}宫${item.sourceHexagram}`,
    hiddenSpirit: `${item.relation} ${item.ganZhi}${item.element}`,
    flyingSpirit: `${item.flyRelation} ${item.flyGanZhi}${item.flyElement}`,
    flyingEffect: item.flyEffect,
    seasonalStrength: item.seasonalStrength,
    facts: [
      item.void ? '旬空' : '', item.monthBreak ? '月破' : '', item.dayClash ? '日冲' : '',
      item.monthCombine ? '月合' : '', item.dayCombine ? '日合' : '',
    ].filter(Boolean),
    status: item.status,
    activationFactors: item.activationFactors,
    blockingFactors: item.blockingFactors,
    cautionFactors: item.cautionFactors,
  };
}

function exportBaseRelation(item: BaseRelationFact) {
  const leftLine = linePosition(item.leftLineIndex);
  const rightLine = linePosition(item.rightLineIndex);
  return {
    leftLine,
    rightLine,
    leftActivity: SOURCE_ACTIVITY_LABELS[item.leftActivity],
    rightActivity: SOURCE_ACTIVITY_LABELS[item.rightActivity],
    elementRelation: item.elementRelation,
    elementRelationLabel: directedElementRelationLabel(item.elementRelation, leftLine, rightLine),
    branchRelation: item.branchRelation,
    branchRelationLabel: branchRelationLabel(item.branchRelation),
  };
}

function exportActiveAction(item: ActiveActionFact) {
  const sourceLine = linePosition(item.sourceLineIndex);
  const target = item.targetKind === 'line' ? linePosition(item.targetLineIndex) : `${linePosition(item.targetLineIndex)}伏神`;
  return {
    sourceLine,
    sourceActivity: SOURCE_ACTIVITY_LABELS[item.sourceActivity],
    target,
    targetStemBranch: item.targetGanZhi,
    elementRelation: item.elementRelation,
    elementRelationLabel: directedElementRelationLabel(item.elementRelation, sourceLine, target),
    branchRelation: item.branchRelation,
    branchRelationLabel: branchRelationLabel(item.branchRelation),
    effects: item.effects,
    effectLabels: directedActionEffectLabels(item.effects, sourceLine, target),
  };
}

type TransformationReturnExport = TransformationReturnPresentation & { line: string };

function exportTransformationReturn(item: TransformationReturnFact): TransformationReturnExport {
  return {
    line: linePosition(item.lineIndex),
    ...presentTransformationReturn(item),
  };
}

function exportDynamics(item: HexagramDynamics) {
  return {
    base: SIX_RELATION_LABELS[item.baseSixRelation],
    changed: SIX_RELATION_LABELS[item.changedSixRelation],
    transition: TRANSITION_LABELS[item.transition],
    innerTrigram: {
      hexagramFanYin: item.inner.guaFanYin ? '是' : '否',
      lineFanYin: item.inner.yaoFanYin ? '是' : '否',
      fuYin: item.inner.fuYin ? '是' : '否',
    },
    outerTrigram: {
      hexagramFanYin: item.outer.guaFanYin ? '是' : '否',
      lineFanYin: item.outer.yaoFanYin ? '是' : '否',
      fuYin: item.outer.fuYin ? '是' : '否',
    },
  };
}

export function buildPlateExportDocument(session: DivinationSession) {
  if (!session.plate) throw new Error('完整排盘缺失，无法复制');
  const plate = session.plate;
  const hasMovingLines = plate.movingLines.length > 0;
  const baseClassic = zhouyiClassics.forHexagram(plate.baseHexagram.name);
  const changedClassic = zhouyiClassics.forHexagram(plate.changedHexagram.name);
  const movingClassics = plate.movingLines.map((index) => {
    const line = baseClassic.lines[index - 1];
    if (!line) throw new Error(`未找到${linePosition(index)}爻辞`);
    return { position: linePosition(index), label: line.label, text: line.text };
  });
  const special = plate.movingLines.length === 6 ? baseClassic.special : undefined;
  const warnings = session.lines.length === 6
    ? []
    : ['原始起卦逐爻记录缺失，以下盘面来自已保存的结构化排盘。'];

  return {
    schema: 'wenyao.plate-export' as const,
    schemaVersion: 2 as const,
    instructions: exportInstructions(hasMovingLines),
    warnings,
    question: {
      text: session.question,
      category: SESSION_CATEGORY_LABELS[session.category],
    },
    casting: {
      method: CASTING_METHOD_LABELS[session.castingMethod],
      methodCode: session.castingMethod,
      castAt: session.castAt,
      localTime: formatShanghaiDateTime(new Date(session.castAt)),
      timezone: shanghaiTime.timezone,
      basis: castingBasis(session.castingBasis),
      originalLines: [...session.lines].sort((left, right) => left.lineIndex - right.lineIndex).map(originalLine),
    },
    plate: {
      calendar: {
        pillars: plate.pillars.map((pillar) => ({
          label: pillar.label,
          stemBranch: pillar.ganZhi,
          voidBranches: pillar.voidBranches,
        })),
        monthBranch: plate.monthBranch,
        dayStemBranch: plate.dayGanZhi,
        voidBranches: plate.voidBranches,
      },
      baseHexagram: hexagramSummary(plate.baseHexagram),
      ...(hasMovingLines ? { changedHexagram: hexagramSummary(plate.changedHexagram) } : {}),
      movingLines: plate.movingLines.map(linePosition),
      lines: [...plate.lines].reverse().map((line) => exportLine(line, hasMovingLines)),
      shenSha: plate.shenSha.map(exportShenSha),
      hiddenSpirits: plate.fuShen.map(exportFuShen),
      relations: {
        base: plate.relationFacts.baseRelations.map(exportBaseRelation),
        activeActions: plate.relationFacts.activeActions.map(exportActiveAction),
        ...(hasMovingLines ? {
          transformationReturnScope: {
            ...TRANSFORMATION_RETURN_SCOPE,
            branchRelations: [...BRANCH_RELATION_SCOPE] as ['六合', '六冲'],
          },
        } : {}),
        transformationReturns: plate.relationFacts.transformationReturns.map(exportTransformationReturn),
        dynamics: exportDynamics(plate.relationFacts.hexagramDynamics),
      },
    },
    classics: {
      source: {
        title: zhouyiClassics.source.title,
        provider: zhouyiClassics.source.provider,
        indexPage: zhouyiClassics.source.indexPage,
        sourceStatus: zhouyiClassics.source.sourceStatus,
        transcriptionLicense: zhouyiClassics.source.transcriptionLicense,
        licenseUrl: zhouyiClassics.source.licenseUrl,
        indexRevision: zhouyiClassics.source.indexRevision,
      },
      base: {
        hexagram: baseClassic.appName,
        judgment: baseClassic.judgment,
        sourcePage: baseClassic.sourcePage,
        sourceRevision: baseClassic.sourceRevision,
      },
      ...(hasMovingLines ? {
        changed: {
          hexagram: changedClassic.appName,
          judgment: changedClassic.judgment,
          sourcePage: changedClassic.sourcePage,
          sourceRevision: changedClassic.sourceRevision,
        },
      } : {}),
      movingLines: movingClassics,
      ...(special ? { special } : {}),
    },
  };
}

export type PlateExportDocument = ReturnType<typeof buildPlateExportDocument>;

function joinFacts(values: readonly string[]): string {
  return values.length ? values.join('、') : '无';
}

function transformationReturnLine(item: TransformationReturnExport, scope: TransformationReturnScope): string {
  const returnEffects = item.returnEffectLabels.length ? item.returnEffectLabels.join('、') : '未命中已建模作用';
  return `${item.line}回头关系（${item.directionLabel}）：变爻 ${item.changedLine}；本爻 ${item.baseLine}；五行：${item.elementRelationLabel}；回头作用（仅标注生、克、比和、合、冲）：${returnEffects}；地支（仅判断${scope.branchRelations.join('与')}）：${item.branchRelationLabel}`;
}

function transformationReturnLines(document: PlateExportDocument): string[] {
  const items = document.plate.relations.transformationReturns;
  if (!items.length) return [];
  const scope = document.plate.relations.transformationReturnScope;
  if (!scope) throw new Error('动卦缺少回头关系范围，无法复制');
  return items.map((item) => transformationReturnLine(item, scope));
}

function basisLines(document: PlateExportDocument): string[] {
  const basis = document.casting.basis;
  const calendar = 'calendar' in basis ? basis.calendar : undefined;
  if (!calendar) return [`起卦算法：${basis.algorithm}`];
  return [
    `起卦算法：${basis.algorithm}`,
    `传统历日：${calendar.traditionalDate}；${calendar.lunarLabel}${calendar.leapMonth ? '（闰月）' : ''}`,
    `年月日时数：${calendar.numbers.year} + ${calendar.numbers.month} + ${calendar.numbers.day} + ${calendar.numbers.hour}`,
    `成卦数字：上卦 ${basis.upperTrigramNumber}；下卦 ${basis.lowerTrigramNumber}；${basis.movingLine}动`,
  ];
}

function plainText(document: PlateExportDocument): string {
  const output: string[] = ['【解卦要求】'];
  document.instructions.forEach((item, index) => output.push(`${index + 1}. ${item}`));
  output.push('', '【所问事项】', `问题：${document.question.text}`, `分类：${document.question.category}`);
  output.push('', '【起卦信息】', `方式：${document.casting.method}（${document.casting.methodCode}）`, `时间：${document.casting.localTime}（${document.casting.timezone}；${document.casting.castAt}）`, ...basisLines(document));
  if (document.casting.originalLines.length) {
    output.push('原始起卦记录：');
    document.casting.originalLines.forEach((line) => output.push(`- ${line.position}：${line.value}${line.coins ? `；${line.coins.join('、')}` : ''}；记录于 ${line.recordedAt}`));
  }
  document.warnings.forEach((warning) => output.push(`资料提示：${warning}`));

  output.push('', '【历法与神煞】');
  document.plate.calendar.pillars.forEach((pillar) => output.push(`${pillar.label}：${pillar.stemBranch}；旬空 ${pillar.voidBranches.join('、')}`));
  document.plate.shenSha.forEach((item) => output.push(`${item.name}（取${item.basis}）：${item.branches.join('、')}；本卦 ${joinFacts(item.baseLines)}；变卦 ${joinFacts(item.changedLines)}`));

  const base = document.plate.baseHexagram;
  output.push('', '【本卦与变卦】', `本卦：${base.name}；${base.palace}${base.generation}；上卦 ${base.upperTrigram}；下卦 ${base.lowerTrigram}；世爻 ${base.worldLine}；应爻 ${base.responseLine}`);
  if (document.plate.changedHexagram) {
    const changed = document.plate.changedHexagram;
    output.push(`变卦：${changed.name}；${changed.palace}${changed.generation}；上卦 ${changed.upperTrigram}；下卦 ${changed.lowerTrigram}；世爻 ${changed.worldLine}；应爻 ${changed.responseLine}`);
    output.push(`动爻：${document.plate.movingLines.join('、')}`);
  } else output.push('动爻：无（静卦）');

  output.push('', '【六爻排盘（上爻至初爻）】');
  document.plate.lines.forEach((line) => {
    output.push(`${line.position}｜${line.spirit}｜${line.lineType}（${line.originalValue}，${line.moving}）`);
    output.push(`  本卦：${line.base.relation} ${line.base.stemBranch}${line.base.element}；${line.base.polarity}；${line.base.role}；${line.base.facts.join('；')}`);
    if (line.changed) output.push(`  变卦：${line.changed.relation} ${line.changed.stemBranch}${line.changed.element}；${line.changed.polarity}；${line.changed.role}；${line.changed.facts.join('；')}`);
  });

  output.push('', '【伏神】');
  if (!document.plate.hiddenSpirits.length) output.push('无');
  document.plate.hiddenSpirits.forEach((item) => output.push(`${item.position}：伏神 ${item.hiddenSpirit}；飞神 ${item.flyingSpirit}；${item.flyingEffect}；旺衰 ${item.seasonalStrength}；${item.status}；状态 ${joinFacts(item.facts)}；激活 ${joinFacts(item.activationFactors)}；阻滞 ${joinFacts(item.blockingFactors)}；谨慎 ${joinFacts(item.cautionFactors)}`));

  output.push('', '【关系事实】');
  document.plate.relations.base.forEach((item) => output.push(`${item.leftLine}（${item.leftActivity}）与${item.rightLine}（${item.rightActivity}）：五行${item.elementRelationLabel}；地支（仅判断${BRANCH_SCOPE_LABEL}）：${item.branchRelationLabel}`));
  document.plate.relations.activeActions.forEach((item) => output.push(`${item.sourceLine}（${item.sourceActivity}）作用于${item.target} ${item.targetStemBranch}（地支仅判断${BRANCH_SCOPE_LABEL}）：${item.effectLabels.join('、') || item.elementRelationLabel}`));
  output.push(...transformationReturnLines(document));
  const dynamics = document.plate.relations.dynamics;
  output.push(`卦体：本卦${dynamics.base}；变卦${dynamics.changed}；${dynamics.transition}`);
  output.push(`内卦：卦反吟${dynamics.innerTrigram.hexagramFanYin}、爻反吟${dynamics.innerTrigram.lineFanYin}、伏吟${dynamics.innerTrigram.fuYin}`);
  output.push(`外卦：卦反吟${dynamics.outerTrigram.hexagramFanYin}、爻反吟${dynamics.outerTrigram.lineFanYin}、伏吟${dynamics.outerTrigram.fuYin}`);

  output.push('', '【相关经文】', `经文来源：${document.classics.source.provider}${document.classics.source.title}（${document.classics.source.indexPage}）；${document.classics.source.sourceStatus}；转录 ${document.classics.source.transcriptionLicense}（${document.classics.source.licenseUrl}）`);
  output.push(`本卦卦辞（${document.classics.base.hexagram}；${document.classics.base.sourcePage} 修订 ${document.classics.base.sourceRevision}）：${document.classics.base.judgment}`);
  if (document.classics.changed) output.push(`变卦卦辞（${document.classics.changed.hexagram}；${document.classics.changed.sourcePage} 修订 ${document.classics.changed.sourceRevision}）：${document.classics.changed.judgment}`);
  document.classics.movingLines.forEach((line) => output.push(`${line.position}爻辞（${line.label}）：${line.text}`));
  if (document.classics.special) output.push(`${document.classics.special.label}：${document.classics.special.text}`);
  return `${output.join('\n').trim()}\n`;
}

function markdown(document: PlateExportDocument): string {
  const output: string[] = ['# 六爻排盘', '', '## 解卦要求', ''];
  document.instructions.forEach((item, index) => output.push(`${index + 1}. ${item}`));
  output.push('', '## 所问事项', '', `- **问题：** ${document.question.text}`, `- **分类：** ${document.question.category}`);
  output.push('', '## 起卦信息', '', `- **方式：** ${document.casting.method}（\`${document.casting.methodCode}\`）`, `- **时间：** ${document.casting.localTime}（${document.casting.timezone}；\`${document.casting.castAt}\`）`);
  basisLines(document).forEach((line) => output.push(`- **${line.replace('：', '：** ')}`));
  if (document.casting.originalLines.length) {
    output.push('', '### 原始起卦记录', '');
    document.casting.originalLines.forEach((line) => output.push(`- ${line.position}：${line.value}${line.coins ? `；${line.coins.join('、')}` : ''}；记录于 ${line.recordedAt}`));
  }
  document.warnings.forEach((warning) => output.push('', `> 资料提示：${warning}`));

  output.push('', '## 历法与神煞', '');
  document.plate.calendar.pillars.forEach((pillar) => output.push(`- **${pillar.label}：** ${pillar.stemBranch}；旬空 ${pillar.voidBranches.join('、')}`));
  document.plate.shenSha.forEach((item) => output.push(`- **${item.name}（取${item.basis}）：** ${item.branches.join('、')}；本卦 ${joinFacts(item.baseLines)}；变卦 ${joinFacts(item.changedLines)}`));

  const base = document.plate.baseHexagram;
  output.push('', '## 本卦与变卦', '', `- **本卦：** ${base.name}；${base.palace}${base.generation}；上卦 ${base.upperTrigram}；下卦 ${base.lowerTrigram}；世爻 ${base.worldLine}；应爻 ${base.responseLine}`);
  if (document.plate.changedHexagram) {
    const changed = document.plate.changedHexagram;
    output.push(`- **变卦：** ${changed.name}；${changed.palace}${changed.generation}；上卦 ${changed.upperTrigram}；下卦 ${changed.lowerTrigram}；世爻 ${changed.worldLine}；应爻 ${changed.responseLine}`);
    output.push(`- **动爻：** ${document.plate.movingLines.join('、')}`);
  } else output.push('- **动爻：** 无（静卦）');

  output.push('', '## 六爻排盘（上爻至初爻）', '', '| 爻位 | 六神 | 爻类 | 本卦 | 变卦 |', '| --- | --- | --- | --- | --- |');
  document.plate.lines.forEach((line) => {
    const baseCell = `${line.base.relation} ${line.base.stemBranch}${line.base.element}；${line.base.polarity}；${line.base.role}；${line.base.facts.join('；')}`;
    const changedCell = line.changed ? `${line.changed.relation} ${line.changed.stemBranch}${line.changed.element}；${line.changed.polarity}；${line.changed.role}；${line.changed.facts.join('；')}` : '—';
    output.push(`| ${line.position} | ${line.spirit} | ${line.lineType}（${line.originalValue}，${line.moving}） | ${baseCell} | ${changedCell} |`);
  });

  output.push('', '## 伏神', '');
  if (!document.plate.hiddenSpirits.length) output.push('无');
  document.plate.hiddenSpirits.forEach((item) => output.push(`- **${item.position}：** 伏神 ${item.hiddenSpirit}；飞神 ${item.flyingSpirit}；${item.flyingEffect}；旺衰 ${item.seasonalStrength}；${item.status}；状态 ${joinFacts(item.facts)}；激活 ${joinFacts(item.activationFactors)}；阻滞 ${joinFacts(item.blockingFactors)}；谨慎 ${joinFacts(item.cautionFactors)}`));

  output.push('', '## 关系事实', '');
  document.plate.relations.base.forEach((item) => output.push(`- ${item.leftLine}（${item.leftActivity}）与${item.rightLine}（${item.rightActivity}）：五行${item.elementRelationLabel}；地支（仅判断${BRANCH_SCOPE_LABEL}）：${item.branchRelationLabel}`));
  document.plate.relations.activeActions.forEach((item) => output.push(`- ${item.sourceLine}（${item.sourceActivity}）作用于${item.target} ${item.targetStemBranch}（地支仅判断${BRANCH_SCOPE_LABEL}）：${item.effectLabels.join('、') || item.elementRelationLabel}`));
  transformationReturnLines(document).forEach((item) => output.push(`- ${item}`));
  const dynamics = document.plate.relations.dynamics;
  output.push(`- 卦体：本卦${dynamics.base}；变卦${dynamics.changed}；${dynamics.transition}`);
  output.push(`- 内卦：卦反吟${dynamics.innerTrigram.hexagramFanYin}、爻反吟${dynamics.innerTrigram.lineFanYin}、伏吟${dynamics.innerTrigram.fuYin}`);
  output.push(`- 外卦：卦反吟${dynamics.outerTrigram.hexagramFanYin}、爻反吟${dynamics.outerTrigram.lineFanYin}、伏吟${dynamics.outerTrigram.fuYin}`);

  output.push('', '## 相关经文', '', `> 经文来源：[${document.classics.source.provider}${document.classics.source.title}](${document.classics.source.indexPage})；${document.classics.source.sourceStatus}；转录 [${document.classics.source.transcriptionLicense}](${document.classics.source.licenseUrl})`);
  output.push('', `- **本卦卦辞（${document.classics.base.hexagram}；${document.classics.base.sourcePage} 修订 ${document.classics.base.sourceRevision}）：** ${document.classics.base.judgment}`);
  if (document.classics.changed) output.push(`- **变卦卦辞（${document.classics.changed.hexagram}；${document.classics.changed.sourcePage} 修订 ${document.classics.changed.sourceRevision}）：** ${document.classics.changed.judgment}`);
  document.classics.movingLines.forEach((line) => output.push(`- **${line.position}爻辞（${line.label}）：** ${line.text}`));
  if (document.classics.special) output.push(`- **${document.classics.special.label}：** ${document.classics.special.text}`);
  return `${output.join('\n').trim()}\n`;
}

export function formatPlateExport(session: DivinationSession, format: PlateExportFormat): string {
  const document = buildPlateExportDocument(session);
  if (format === 'json') return `${JSON.stringify(document, null, 2)}\n`;
  if (format === 'markdown') return markdown(document);
  return plainText(document);
}
