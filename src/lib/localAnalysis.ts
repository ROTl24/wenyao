import type { EvidenceEntry } from './retrieval';
import type { DivinationSession } from './session';
import type { AnalysisReport } from './types';
import type { DivinationPlate, SixRelation } from './divination';

const ANALYSIS_SECTION_HEADINGS = [
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

interface LocalFocus {
  guidance: string;
  relations: SixRelation[];
  primaryRelation?: SixRelation;
  includeAllLines?: boolean;
}

const focusByCategory: Record<string, LocalFocus> = {
  career: { guidance: '事业占问通常以官鬼爻为用神，兼看世爻与父母爻。', relations: ['官鬼', '父母'], primaryRelation: '官鬼' },
  wealth: { guidance: '求财占问通常以妻财爻为用神，兼看子孙财源与兄弟耗财。', relations: ['妻财', '子孙', '兄弟'], primaryRelation: '妻财' },
  relationship: { guidance: '感情占问以世应关系为主，并结合官鬼、妻财与动爻变化。', relations: ['官鬼', '妻财'] },
  health: { guidance: '健康占问以世爻为自身，结合官鬼病因、子孙制化与忌神。', relations: ['官鬼', '子孙'] },
  study: { guidance: '学业占问通常以父母爻为用神，考试名次兼看官鬼爻。', relations: ['父母', '官鬼'], primaryRelation: '父母' },
  lost_item: { guidance: '寻物占问结合用神所在六亲、方位、动静与冲合判断。', relations: [], includeAllLines: true },
  travel: { guidance: '出行占问结合世应、动爻、日月冲合与行人用神判断。', relations: [], includeAllLines: true },
  other: { guidance: '应先依具体问题确定用神，再看世应、日月与动变关系。', relations: [], includeAllLines: true },
};

function localFocusBasis(plate: DivinationPlate, focus: LocalFocus) {
  const relatedRelations = new Set(focus.relations);
  const primaryVisible = focus.primaryRelation && plate.lines.some((line) => line.relation === focus.primaryRelation);
  const primaryHidden = focus.primaryRelation && plate.fuShen.some((item) => item.relation === focus.primaryRelation);
  const visibleFacts = plate.lines
    .filter((line) => focus.includeAllLines || relatedRelations.has(line.relation) || Boolean(line.role))
    .map((line) => {
      const states = [line.role && `${line.role}爻`, line.moving && '动爻', line.void && '旬空', line.monthBreak && '月破', line.dayClash && '日冲'].filter(Boolean);
      return `第${line.index}爻${line.relation}${line.ganZhi}${states.length ? `（${states.join('、')}）` : ''}`;
    });
  const hiddenFacts = plate.fuShen
    .filter((item) => focus.includeAllLines || relatedRelations.has(item.relation))
    .map((item) => `${item.relation}${item.ganZhi}伏于第${item.lineIndex}爻`);
  const facts = [...visibleFacts, ...hiddenFacts];
  if (focus.primaryRelation && !primaryVisible && !primaryHidden) {
    facts.unshift(`当前盘明爻与伏神中未见${focus.primaryRelation}爻候选`);
  }
  return facts.length
    ? `当前盘用于取用核对的具体爻为：${facts.join('；')}。`
    : '当前排盘没有可供这条取用提示核对的具体爻，因此本地模式不作进一步判断。';
}

export function createBrowserLocalReport(session: DivinationSession, _evidence: EvidenceEntry[]): AnalysisReport {
  const plate = session.plate!;
  const movement = plate.movingLines.length ? `动爻为第 ${plate.movingLines.join('、')} 爻` : '本卦无动爻';
  const focus = focusByCategory[session.category] || focusByCategory.other;
  const worldLine = plate.lines.find((line) => line.role === '世');
  const responseLine = plate.lines.find((line) => line.role === '应');
  const fact = (text: string) => `- ${text} [排盘事实](#plate-facts)`;
  const question = session.question.replace(/[。！？!?]+$/g, '');
  return {
    mode: 'local',
    markdown: [
      `## ${ANALYSIS_SECTION_HEADINGS[0]}`,
      fact(`核心问题：${question}`),
      fact(`类别：${session.category}`),
      fact('分析目标：当前浏览器预览只整理排盘事实与取用提示，不作完整综合判断'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[1]}`,
      fact(`已提供关键信息：本卦${plate.baseHexagram.name}，变卦${plate.changedHexagram.name}，${movement}，月建${plate.monthGanZhi}，日辰${plate.dayGanZhi}`),
      fact('信息完整度：信息不足会影响判断，当前仅保留可由程序事实支持的有限分析'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[2]}`,
      fact(`取用主线：${focus.guidance}`),
      fact(`候选事实：${localFocusBasis(plate, focus)}`),
      fact(`世应定位：世爻为${worldLine ? `第${worldLine.index}爻${worldLine.relation}${worldLine.ganZhi}` : '未载'}，应爻为${responseLine ? `第${responseLine.index}爻${responseLine.relation}${responseLine.ganZhi}` : '未载'}`),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[3]}`,
      fact('用神旺衰与状态：浏览器预览暂不代替完整的月日旺衰、空破和伏藏综合判断'),
      fact(`当前状态事实：${localFocusBasis(plate, focus)}`),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[4]}`,
      fact('生克制化分析：浏览器预览暂不作完整原神、忌神、仇神的力量比较'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[5]}`,
      fact(`动爻与变爻分析：${movement}，当前报告只展示程序锁定的动静事实`),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[6]}`,
      fact('世应关系分析：当前仅保留世爻与应爻定位，暂不作完整互动强弱判断'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[7]}`,
      fact('辅助因素修正：六神、冲合、伏神等辅助因素需要在云端完整解读中结合用神统一判断'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[8]}`,
      fact('综合结论：不足判断，当前浏览器预览没有足够分析链条支持确定的成败结论'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[9]}`,
      fact('应期不足以精断，当前浏览器预览不硬猜日期'),
      '',
      `## ${ANALYSIS_SECTION_HEADINGS[10]}`,
      fact('最终一句话结论：当前只完成排盘事实整理，配置云端 AI 后再生成完整六爻解读'),
    ].join('\n'),
    generatedAt: new Date().toISOString(),
  };
}
