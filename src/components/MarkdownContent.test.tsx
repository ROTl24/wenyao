import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent';

describe('MarkdownContent', () => {
  it('renders GFM headings, lists, basis quotes and tables', () => {
    const { container } = render(
      <MarkdownContent markdown={`## 核心判断

- 先稳步推进
- 暂不硬定应期

> **依据：** 本卦无动爻，日辰为戊子。

| 项目 | 状态 |
| --- | --- |
| 用神 | 父母 |
`} />,
    );

    expect(screen.getByRole('heading', { name: '核心判断' })).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(container.querySelector('blockquote')).toHaveTextContent(/依据：\s*本卦无动爻，日辰为戊子。/);
    expect(screen.getByRole('table')).toBeVisible();
  });

  it('does not execute or mount raw HTML from model output', () => {
    const { container } = render(
      <MarkdownContent markdown={'正常内容\n\n<script>window.__unsafe = true</script>\n\n<img src=x onerror="window.__unsafe = true">'} />,
    );

    expect(screen.getByText('正常内容')).toBeVisible();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('ignores malformed evidence anchors without throwing', () => {
    render(<MarkdownContent markdown={'[异常依据](#evidence-])'} />);

    expect(() => fireEvent.click(screen.getByRole('link', { name: '异常依据' }))).not.toThrow();
  });

  it('only keeps evidence anchors and explicit HTTP links navigable', () => {
    render(<MarkdownContent markdown={'[内部依据](#evidence-E1) [排盘事实](#plate-facts) [官网](https://example.com) [协议相对](//example.com) [相对路径](/settings) [邮件](mailto:test@example.com)'} />);

    expect(screen.getByRole('link', { name: '内部依据' })).toHaveAttribute('href', '#evidence-E1');
    expect(screen.getByRole('link', { name: '内部依据' })).toHaveClass('markdown-evidence-citation');
    expect(screen.getByRole('link', { name: '排盘事实' })).toHaveAttribute('href', '#plate-facts');
    expect(screen.getByRole('link', { name: '排盘事实' })).toHaveClass('markdown-evidence-citation');
    expect(screen.getByRole('link', { name: '官网' })).toHaveAttribute('target', '_blank');
    for (const label of ['协议相对', '相对路径', '邮件']) {
      expect(screen.getByText(label).closest('a')).toBeNull();
    }
  });
});
