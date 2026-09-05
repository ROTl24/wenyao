import type { SessionCategory } from './session';

export const QUESTION_TEMPLATES: Record<SessionCategory, string> = {
  career: '未来三个月，我正在推进的这个项目能否顺利落地？目前进展是：',
  relationship: '未来一个月，我与这位相处对象的关系会如何发展？目前关系是：',
  wealth: '未来三个月，我这笔约定的款项能否按期收回？目前情况是：',
  study: '在接下来这次考试中，我能否达到计划的目标？考试时间与准备情况是：',
  health: '未来一个月，我调整作息的计划能否持续落实？目前情况是：',
  lost_item: '我遗失的这件物品近期能否找回？最后见到它的时间和地点是：',
  travel: '下个月计划的这次出行能否顺利成行？目的与当前安排是：',
  other: '未来一个月，我正在考虑的这件事能否按计划推进？具体情况是：',
};
