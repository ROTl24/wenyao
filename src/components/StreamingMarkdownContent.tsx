import { PureComponent } from 'react';
import { appendStreamingMarkdown, emptyStreamingMarkdown } from '../lib/streamingMarkdown';
import { MarkdownContent } from './MarkdownContent';

export class StreamingMarkdownContent extends PureComponent<{ markdown: string; evidenceAnchorPrefix: string }> {
  state = emptyStreamingMarkdown();

  static getDerivedStateFromProps(props: { markdown: string }, state: ReturnType<typeof emptyStreamingMarkdown>) {
    return props.markdown === state.source ? null : appendStreamingMarkdown(state, props.markdown);
  }

  render() {
    return <div className="streaming-markdown">{[...this.state.blocks, this.state.tail].map((block) =>
      <MarkdownContent key={block.start} markdown={block.text} sourceOffset={block.start} evidenceAnchorPrefix={this.props.evidenceAnchorPrefix} allowExternalLinks={false} />,
    )}</div>;
  }
}
