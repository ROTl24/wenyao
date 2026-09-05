import { describe, expect, it } from 'vitest';
import { reportOutline } from './reportOutline';

describe('report outline', () => {
  it('keeps complete conditional conclusions, uncertainty and original citations', () => {
    const markdown = '## 1. 占问主题\n问题。\n\n## 9. 综合结论\n只有条件成立时才可成。[依据](#evidence-one)\n\n否则仍不足判断。\n\n## 10. 应期判断（若可判断）\n应期不足以精断。\n\n## 11. 最终一句话结论\n前提未满足时不能确定。';
    const outline = reportOutline(markdown);
    expect(outline.summary).toBe(markdown.slice(markdown.indexOf('## 9.')));
    expect(outline.sections.map((section) => section.number)).toEqual([1, 9, 10, 11]);
    expect(outline.sections.every((section) => markdown.slice(section.start).startsWith('## '))).toBe(true);
  });
  it('does not mistake code fences and quoted headings for report conclusions', () => {
    const outline = reportOutline('## 分析\n正文。\n\n```md\n## 9. 综合结论\n伪结论\n```\n\n> ## 11. 最终一句话结论\n> 引文');
    expect(outline.sections).toHaveLength(1);
    expect(outline.summary).toBe('');
  });
});
