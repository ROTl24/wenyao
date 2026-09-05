import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { appendStreamingMarkdown, emptyStreamingMarkdown } from '../lib/streamingMarkdown';
import { MarkdownContent } from './MarkdownContent';
import { StreamingMarkdownContent } from './StreamingMarkdownContent';

function renderedHTML(container: HTMLElement) {
  const root = container.cloneNode(true) as HTMLElement;
  root.querySelectorAll('.streaming-markdown, .markdown-content').forEach((element) => element.replaceWith(...element.childNodes));
  root.querySelectorAll('[data-reading-offset]').forEach((element) => element.removeAttribute('data-reading-offset'));
  return root.innerHTML.replace(/\s+</g, '<').replace(/>\s+/g, '>');
}

describe('incremental Markdown reading', () => {
  it('keeps complete Markdown semantics across partial tables, fences, lists, quotes and late definitions', () => {
    const report = '\n\n## 1. 起始\n\n条件**必须成立**。\n\n标题\n---\n\n| 项目 | 条件 |\n| --- | --- |\n| 甲 | 待定 |\n\n- 第一项\n\n  仍属于第一项\n- 第二项\n\n> 引用\n>\n> 后续条件\n\n```text\n## 伪标题\n\n不得拆分\n```\n\n[依据][source]和脚注[^1]\n\n## 2. 后续\n\n检查原文。\n\n[source]: #evidence-local\n\n[^1]: 末尾补充。\n';
    const streamed = render(<StreamingMarkdownContent markdown="" evidenceAnchorPrefix="evidence-" />);
    const complete = render(<MarkdownContent markdown="" allowExternalLinks={false} />);
    for (let end = 7; end < report.length + 7; end += 7) {
      const markdown = report.slice(0, end);
      streamed.rerender(<StreamingMarkdownContent markdown={markdown} evidenceAnchorPrefix="evidence-" />);
      complete.rerender(<MarkdownContent markdown={markdown} allowExternalLinks={false} />);
      expect(renderedHTML(streamed.container)).toBe(renderedHTML(complete.container));
    }
  });

  it('reuses settled blocks across a 60k-character report and retains every character and source offset', () => {
    const report = Array.from({ length: 440 }, (_, index) => `### 条件 ${index}\r\n\r\n${'这是合成的长文阅读验收内容，只有条件成立才能继续。'.repeat(5)}\r\n\r\n`).join('');
    expect(report.length).toBeGreaterThan(60_000);
    let state = emptyStreamingMarkdown();
    for (let end = 131; end < report.length + 131; end += 131) {
      const previous = state;
      const source = report.slice(0, end);
      state = appendStreamingMarkdown(state, source);
      expect([...state.blocks, state.tail].map((block) => block.text).join('')).toBe(source);
      if (previous.blocks.length) expect(state.blocks[0]).toBe(previous.blocks[0]);
      expect(state.tail.text.length).toBeLessThan(600);
      for (const block of state.blocks.slice(-2)) expect(source.slice(block.start, block.start + block.text.length)).toBe(block.text);
    }
    state = appendStreamingMarkdown(state, '新的报告\n\n下一段');
    expect(state.source).toBe('新的报告\n\n下一段');
    expect(state.blocks).toHaveLength(0);
  });
});
