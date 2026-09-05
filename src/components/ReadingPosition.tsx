import { Component, createRef, type ReactNode } from 'react';

interface Props { sessionId: string; requestId?: string; children: ReactNode }
interface Position { offset: string; top: number; kind: string }

// A snapshot runs before React replaces the draft with the completed report.
// Only preserve visible draft text; navigation elsewhere remains the user's choice.
export class ReadingPosition extends Component<Props> {
  private root = createRef<HTMLDivElement>();

  getSnapshotBeforeUpdate(previous: Props): Position | null {
    if (previous.sessionId !== this.props.sessionId || previous.requestId !== this.props.requestId) return null;
    const root = this.root.current;
    const draft = root?.querySelector<HTMLElement>('.generation-text');
    if (!draft) return null;
    const navigation = root?.querySelector('.result-navigation')?.getBoundingClientRect();
    const readingTop = Math.max(0, navigation?.bottom ?? 0) + 12;
    const target = [...draft.querySelectorAll<HTMLElement>('[data-reading-offset]')].find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > readingTop && rect.top < window.innerHeight;
    });
    return target ? { offset: target.dataset.readingOffset!, top: target.getBoundingClientRect().top, kind: draft.dataset.readingKind || 'analysis' } : null;
  }

  componentDidUpdate(_previous: Props, _state: unknown, position: Position | null) {
    if (!position) return;
    const root = this.root.current;
    const container = root?.querySelector('.generation-text')
      ?? (position.kind === 'analysis' ? root?.querySelector('.analysis-body') : root?.querySelector('.chat-message--assistant:last-of-type .markdown-content'));
    const target = container?.querySelector<HTMLElement>(`[data-reading-offset="${position.offset}"]`);
    if (!target) return;
    const delta = target.getBoundingClientRect().top - position.top;
    const scroller = root?.querySelector<HTMLElement>('.result-screen');
    if (Math.abs(delta) > 1) (scroller || window).scrollBy({ top: delta, behavior: 'instant' });
  }

  render() { return <div ref={this.root} className="reading-position">{this.props.children}</div>; }
}
