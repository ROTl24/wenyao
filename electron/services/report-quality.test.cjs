const test = require('node:test');
const assert = require('node:assert/strict');

// Authored independently of the evaluator; synthetic prose, not a real prediction.
const markdown = `## 1. 占问主题
核对这份合成解读是否完整回答测试问题。
## 2. 信息完整度判断
信息不足会影响判断；没有现实事件结果。
## 3. 用神与世应定位
需要逐项对照[锁定排盘](#plate-facts)。
## 4. 用神旺衰与状态
这里仅保留评测结构，不作实际占断。
## 5. 生克制化分析
读者应检查方向，不因出现术语就给满分。
## 6. 动爻与变爻分析
参见[原文](#evidence-E1)，引用有效仍需核对论断。
## 7. 世应关系分析
需要人工对照实际问题与排盘。
## 8. 辅助因素修正
辅助因素不能替代主要依据。
## 9. 综合结论
前提是信息经确认；这份材料只供软件测试。
## 10. 应期判断（若可判断）
目前无法判断日期。
## 11. 最终一句话结论
结构齐全不等于推断正确。`;
const sample = () => ({ id: 'synthetic', question: '软件评测合成问题', category: 'other', plate: { id: 'plate' }, analysis: { mode: 'cloud', analysisId: 'analysis', markdown, evidenceSnapshot: { evidence: [{ id: 'E1', text: '合成原文' }] } } });

test('complete structure and valid references are measured without inventing quality scores', async () => {
  const { evaluateReport, summarizeReports } = await import('../../scripts/lib/report-quality.mjs');
  const result = evaluateReport(sample());
  assert.equal(result.automatic.sectionCount, 11);
  assert.equal(result.automatic.citationCount, 2);
  assert.deepEqual(result.automatic.invalidCitations, []);
  const summary = summarizeReports([result], 1);
  assert.equal(summary.unfinishedDraftsExcluded, 1);
  assert.equal(summary.manual.reviewedReports, 0);
  assert.equal(summary.manual.averageByDimension.facts, null);
});

test('quoted and fenced headings do not hide omissions, and missing evidence is flagged', async () => {
  const { evaluateReport } = await import('../../scripts/lib/report-quality.mjs');
  const record = sample();
  record.analysis.markdown = markdown.replace('## 9. 综合结论', '> ## 9. 综合结论').replace('## 11. 最终一句话结论', '```markdown\n## 11. 最终一句话结论\n```').replace('#evidence-E1', '#evidence-missing');
  const result = evaluateReport(record);
  assert.deepEqual(result.automatic.missingSections, ['9. 综合结论', '11. 最终一句话结论']);
  assert.equal(result.automatic.invalidCitations[0].target, 'evidence-missing');
  record.analysis.markdown = markdown.replace('目前无法判断日期。', '');
  assert.deepEqual(evaluateReport(record).automatic.emptySections, ['10. 应期判断（若可判断）']);
  delete record.analysis;
  record.generationDraft = { content: markdown, status: 'stopped' };
  assert.equal(evaluateReport(record), null);
});

test('manual reviews require reasons and bind to the exact report, plate and evidence', async () => {
  const { evaluateReport, reviewTemplate, applyReviews, summarizeReports } = await import('../../scripts/lib/report-quality.mjs');
  const results = [evaluateReport(sample())];
  const reviews = reviewTemplate(results);
  const score = reviews.reviews[0].dimensions;
  score.facts.score = 0;
  assert.throws(() => applyReviews(results, reviews), /理由/);
  for (const [key, value] of Object.entries(score)) { value.score = key === 'facts' ? 0 : 1; value.reason = '合成测试：说明可定位的错误或遗漏。'; }
  const summary = summarizeReports(applyReviews(results, reviews));
  assert.equal(summary.manual.reviewedReports, 1);
  assert.equal(summary.manual.averageByDimension.facts, 0);
  const changed = sample(); changed.plate.id = 'different-plate';
  assert.throws(() => applyReviews([evaluateReport(changed)], reviews), /不一致/);
});
