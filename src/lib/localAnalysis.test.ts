import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { buildPlate } from './divination';
import { createBrowserLocalReport } from './localAnalysis';
import type { EvidenceEntry } from './retrieval';
import type { DivinationSession } from './session';

const require = createRequire(import.meta.url);
const { validateMarkdownReport } = require('../../electron/services/ai.cjs') as {
  validateMarkdownReport: (markdown: string, label: string, context: {
    plate: DivinationSession['plate'];
    evidence: EvidenceEntry[];
    strictStructure?: boolean;
  }) => Promise<string>;
};

describe('createBrowserLocalReport', () => {
  it('returns a Markdown report that passes the production 11-section contract', async () => {
    const castAt = new Date('2026-07-13T08:00:00.000Z');
    const session: DivinationSession = {
      id: 'session-1',
      question: '事业发展如何？',
      category: 'career',
      castAt: castAt.toISOString(),
      updatedAt: castAt.toISOString(),
      status: 'complete',
      tosses: [],
      plate: buildPlate([6, 7, 8, 7, 8, 7], castAt),
      messages: [],
    };
    const evidence: EvidenceEntry[] = [{
      id: 'evidence-1',
      title: '用神规则',
      source: '增删卜易',
      location: '用神章',
      text: '占事业重官鬼兼看世爻。',
      tags: ['事业'],
      sourceType: 'original',
      knowledgeKind: 'rule',
    }];

    const report = createBrowserLocalReport(session, evidence);

    expect(report.mode).toBe('local');
    expect(report.markdown).toMatch(/^## 1\. 占问主题/);
    expect(report.markdown).toContain('## 11. 最终一句话结论');
    expect(report.markdown).toContain(`本卦${session.plate!.baseHexagram.name}`);
    expect(report.markdown).toContain(`日辰${session.plate!.dayGanZhi}`);
    expect(report.markdown).toContain('#plate-facts');
    const careerLine = session.plate!.lines.find((line) => line.relation === '官鬼');
    const hiddenCareerLine = session.plate!.fuShen.find((line) => line.relation === '官鬼');
    const worldLine = session.plate!.lines.find((line) => line.role === '世')!;
    if (careerLine) {
      expect(report.markdown).toContain(`第${careerLine.index}爻${careerLine.relation}${careerLine.ganZhi}`);
    } else if (hiddenCareerLine) {
      expect(report.markdown).toContain(`${hiddenCareerLine.relation}${hiddenCareerLine.ganZhi}伏于第${hiddenCareerLine.lineIndex}爻`);
    } else {
      expect(report.markdown).toContain('当前盘明爻与伏神中未见官鬼爻候选');
    }
    expect(report.markdown).toContain(`第${worldLine.index}爻${worldLine.relation}${worldLine.ganZhi}（世爻`);
    expect(report.markdown).not.toContain(evidence[0].text);
    await expect(validateMarkdownReport(report.markdown, '浏览器本地报告', {
      plate: session.plate,
      evidence: [],
      strictStructure: true,
    })).resolves.toBe(report.markdown);
    expect(report).not.toHaveProperty('claims');
  });
});
