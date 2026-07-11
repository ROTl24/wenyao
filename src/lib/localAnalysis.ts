import type { EvidenceEntry } from './retrieval';
import type { DivinationSession } from './session';
import type { AnalysisReport } from './types';

const focusByCategory: Record<string, string> = {
  career: '以官鬼爻为事业用神，兼看世爻承受力与父母爻所代表的单位、文书和条件。',
  wealth: '以妻财爻为求财用神，兼看子孙财源与兄弟耗财。',
  relationship: '以世应关系为主，并结合官鬼、妻财以及动爻变化。',
  health: '以世爻为自身，结合官鬼病因、子孙制化与忌神。',
  study: '以父母爻为学业文书，兼看官鬼名次与世爻状态。',
  lost_item: '以用神所在六亲、方位、动静与冲合判断。',
  travel: '以世应、动爻、日月冲合与行人用神判断。',
  other: '先依具体问题确定用神，再看世应、日月与动变关系。',
};

export function createBrowserLocalReport(session: DivinationSession, evidence: EvidenceEntry[]): AnalysisReport {
  const plate = session.plate!;
  return {
    mode: 'local',
    summary: `所问“${session.question}”，得${plate.baseHexagram.name}，之${plate.changedHexagram.name}。`,
    focus: focusByCategory[session.category] || focusByCategory.other,
    relations: `${plate.monthGanZhi}月、${plate.dayGanZhi}日，旬空${plate.voidBranches.join('、')}。本卦属${plate.baseHexagram.palace}宫${plate.baseHexagram.palaceElement}。`,
    moving: plate.movingLines.length ? `第 ${plate.movingLines.join('、')} 爻发动，应结合所临六亲、世应与变爻关系判断。` : '六爻安静，以本卦整体格局、世用旺衰和日月作用为主。',
    synthesis: '这是本地基础推演。应用已锁定排盘事实并整理相关规则；配置云端 AI 后，会在同一卦象和证据上补充综合分析。',
    uncertainties: ['当前内置内容为演示摘要；导入你提供并校订的古籍后，才会显示真实原页引用。'],
    guidance: ['把问题限定为一个明确事项。', '重点观察动爻、世应和日月旺衰。', '占断仅供传统文化研究与个人反思。'],
    claims: evidence.map((entry) => ({ text: entry.text, evidenceIds: [entry.id], confidence: '低' })),
    generatedAt: new Date().toISOString(),
  };
}
