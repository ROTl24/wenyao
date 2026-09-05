import { createHash } from 'node:crypto';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfm } from 'micromark-extension-gfm';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import prompt from '../../electron/services/system-prompt.cjs';

export const REVIEW_DIMENSIONS = {
  facts: '盘面事实：爻位、六亲、世应、旬空和作用方向是否与锁定排盘一致',
  reasoning: '推断逻辑：取用、旺衰、生克与动变是否有依据且前后一致',
  evidence: '证据支撑：引用原文是否真实支持相邻论断，是否把类比占例当成定论',
  conditions: '结论条件：是否保留信息缺口、成立前提、应期边界与替代解释',
  relevance: '回答针对性：是否回答当前问题，术语是否结合本卦解释',
};

const nodeText = (node) => typeof node.value === 'string' ? node.value : (node.children || []).map(nodeText).join('');
const normalizeHeading = (text) => text.replace(/\s+/g, '').replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/^(\d+)[、．]/, '$1.');
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function walk(node, visit) {
  visit(node);
  if (node.type !== 'code' && node.type !== 'inlineCode') for (const child of node.children || []) walk(child, visit);
}

/** Offline diagnostics only. Structural checks cannot establish semantic or predictive accuracy. */
export function evaluateReport(session) {
  const report = session.analysis;
  if (report?.mode !== 'cloud' || typeof report.markdown !== 'string' || !report.markdown.trim()) return null;
  const evidence = report.evidenceSnapshot?.evidence;
  const tree = fromMarkdown(report.markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const headings = tree.children.filter((node) => node.type === 'heading' && node.depth <= 2);
  const normalized = headings.map((node) => normalizeHeading(nodeText(node)));
  const missingSections = prompt.ANALYSIS_SECTION_HEADINGS.filter((heading) => !normalized.includes(normalizeHeading(heading)));
  const emptySections = headings.filter((heading) => {
    if (!prompt.ANALYSIS_SECTION_HEADINGS.some((required) => normalizeHeading(required) === normalizeHeading(nodeText(heading)))) return false;
    const start = tree.children.indexOf(heading) + 1;
    let end = start;
    while (end < tree.children.length && !(tree.children[end].type === 'heading' && tree.children[end].depth <= 2)) end += 1;
    return !tree.children.slice(start, end).some((node) => node.type !== 'definition' && nodeText(node).trim());
  }).map(nodeText);
  const orderedSections = normalized.filter((heading) => prompt.ANALYSIS_SECTION_HEADINGS.some((required) => normalizeHeading(required) === heading));
  const sectionsInOrder = orderedSections.every((heading, index) => index === 0 || Number.parseInt(heading) > Number.parseInt(orderedSections[index - 1]));
  const definitions = new Map();
  walk(tree, (node) => { if (node.type === 'definition') definitions.set(node.identifier, node.url); });
  const citations = [];
  walk(tree, (node) => {
    const url = node.type === 'link' ? node.url : node.type === 'linkReference' ? definitions.get(node.identifier) : null;
    if (typeof url !== 'string' || !url.startsWith('#')) return;
    let target;
    try { target = decodeURIComponent(url.slice(1)); } catch { target = url.slice(1); }
    if (!target.startsWith('evidence-') && target !== 'plate-facts') return;
    citations.push({ target, label: nodeText(node) });
  });
  const evidenceIds = new Set((Array.isArray(evidence) ? evidence : []).map((item) => item.id));
  const invalidCitations = citations.filter(({ target }) => target === 'plate-facts' ? !session.plate : !evidenceIds.has(target.slice('evidence-'.length)));
  const citedEvidenceIds = [...new Set(citations.filter(({ target }) => target.startsWith('evidence-')).map(({ target }) => target.slice('evidence-'.length)))];
  return {
    sessionId: session.id,
    analysisId: report.analysisId || null,
    question: session.question,
    category: session.category,
    fingerprint: digest({ question: session.question, category: session.category, plate: session.plate, evidence, markdown: report.markdown }),
    automatic: {
      sectionCount: prompt.ANALYSIS_SECTION_HEADINGS.length - missingSections.length,
      requiredSectionCount: prompt.ANALYSIS_SECTION_HEADINGS.length,
      missingSections,
      emptySections,
      sectionsInOrder,
      citationCount: citations.length,
      citedEvidenceIds,
      invalidCitations,
      hasEvidenceSnapshot: Array.isArray(evidence),
      hasPlateReference: citations.some(({ target }) => target === 'plate-facts'),
    },
  };
}

export function reviewTemplate(results) {
  return {
    format: 'wenyao-report-review', version: 1,
    rubric: { scores: '0 = 明确错误或缺失；1 = 部分满足或有重要遗漏；2 = 满足且有可定位依据；null = 尚未审阅。每项打分须写理由。', dimensions: REVIEW_DIMENSIONS },
    reviews: results.map((result) => ({ sessionId: result.sessionId, fingerprint: result.fingerprint, question: result.question, dimensions: Object.fromEntries(Object.keys(REVIEW_DIMENSIONS).map((key) => [key, { score: null, reason: '' }])) })),
  };
}

export function applyReviews(results, input) {
  if (!input || input.format !== 'wenyao-report-review' || input.version !== 1 || !Array.isArray(input.reviews)) throw new Error('人工评测文件格式无效。');
  const seen = new Set();
  for (const review of input.reviews) {
    if (seen.has(review.sessionId)) throw new Error('人工评测包含重复记录。');
    seen.add(review.sessionId);
    const target = results.find((result) => result.sessionId === review.sessionId);
    if (!target || target.fingerprint !== review.fingerprint) throw new Error('人工评分与当前报告、排盘或证据不一致，请重新审阅。');
    for (const key of Object.keys(REVIEW_DIMENSIONS)) {
      const value = review.dimensions?.[key];
      if (!value || ![null, 0, 1, 2].includes(value.score) || typeof value.reason !== 'string' || (value.score !== null && !value.reason.trim())) throw new Error(`人工评分 ${key} 缺少有效分数或理由。`);
    }
    target.manual = { dimensions: review.dimensions, complete: Object.keys(REVIEW_DIMENSIONS).every((key) => review.dimensions[key].score !== null) };
  }
  return results;
}

export function summarizeReports(results, drafts = 0) {
  const reviewed = results.filter((result) => result.manual?.complete);
  return {
    evaluatedReports: results.length, unfinishedDraftsExcluded: drafts,
    automatic: {
      completeSectionReports: results.filter((result) => !result.automatic.missingSections.length && !result.automatic.emptySections.length && result.automatic.sectionsInOrder).length,
      reportsWithInvalidCitations: results.filter((result) => result.automatic.invalidCitations.length).length,
      reportsWithoutCitations: results.filter((result) => !result.automatic.citationCount).length,
      reportsWithoutEvidenceSnapshot: results.filter((result) => !result.automatic.hasEvidenceSnapshot).length,
    },
    manual: {
      reviewedReports: reviewed.length,
      pendingReports: results.length - reviewed.length,
      averageByDimension: Object.fromEntries(Object.keys(REVIEW_DIMENSIONS).map((key) => [key, reviewed.length ? reviewed.reduce((sum, item) => sum + item.manual.dimensions[key].score, 0) / reviewed.length : null])),
    },
    boundary: '自动检查仅覆盖章节与引用可定位性；事实正确、证据支持程度和推断质量须逐份人工审阅。结果不代表现实预测准确率。',
  };
}
