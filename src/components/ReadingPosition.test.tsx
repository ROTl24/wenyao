import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ReadingPosition } from './ReadingPosition';

afterEach(() => vi.restoreAllMocks());

it('preserves the visible source paragraph when the completed report adds a summary above it', () => {
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains('result-navigation') ? 50 : Number(this.dataset.top ?? 0);
    return { top, bottom: top + 60, height: 60, width: 500, left: 0, right: 500, x: 0, y: top, toJSON() {} };
  });
  const view = render(<ReadingPosition sessionId="s" requestId="r"><nav className="result-navigation" /><div className="generation-text"><p data-reading-offset="100" data-top="125">正在阅读的条件</p></div></ReadingPosition>);
  view.rerender(<ReadingPosition sessionId="s" requestId="r"><nav className="result-navigation" /><aside><p data-reading-offset="100" data-top="120">摘要中的相同偏移不能误匹配</p></aside><div className="analysis-body"><p data-reading-offset="100" data-top="925">正在阅读的条件</p></div></ReadingPosition>);
  expect(scroll).toHaveBeenCalledWith({ top: 800, behavior: 'instant' });
  scroll.mockClear();
  view.rerender(<ReadingPosition sessionId="other" requestId="other"><div className="analysis-body">切换记录</div></ReadingPosition>);
  expect(scroll).not.toHaveBeenCalled();
});

it('scrolls the result pane and leaves navigation outside the draft alone', () => {
  const paneScroll = vi.fn();
  const windowScroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = Number(this.dataset.top ?? 0);
    return { top, bottom: top + 60, height: 60, width: 500, left: 0, right: 500, x: 0, y: top, toJSON() {} };
  });
  const children = (top: number) => <main className="result-screen"><div className="generation-text"><p data-reading-offset="100" data-top={top}>条件</p></div></main>;
  const view = render(<ReadingPosition sessionId="s" requestId="r">{children(125)}</ReadingPosition>);
  Object.defineProperty(view.container.querySelector('main'), 'scrollBy', { value: paneScroll });
  view.rerender(<ReadingPosition sessionId="s" requestId="r">{children(425)}</ReadingPosition>);
  expect(paneScroll).toHaveBeenCalledWith({ top: 300, behavior: 'instant' });
  expect(windowScroll).not.toHaveBeenCalled();
  view.rerender(<ReadingPosition sessionId="s" requestId="r">{children(-4000)}</ReadingPosition>);
  paneScroll.mockClear();
  view.rerender(<ReadingPosition sessionId="s" requestId="r">{children(-4200)}</ReadingPosition>);
  expect(paneScroll).not.toHaveBeenCalled();
});
