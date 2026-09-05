import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

export interface MarkdownBlock { start: number; text: string }
export interface StreamingMarkdownState {
  source: string;
  blocks: MarkdownBlock[];
  tail: MarkdownBlock;
  wholeDocument: boolean;
}

export const emptyStreamingMarkdown = (): StreamingMarkdownState => ({ source: '', blocks: [], tail: { start: 0, text: '' }, wholeDocument: false });

// Definitions can change references anywhere earlier in the document.
function hasDefinition(node: { type: string; children?: unknown[] }): boolean {
  return node.type === 'definition' || node.type === 'footnoteDefinition'
    || Boolean(node.children?.some((child) => hasDefinition(child as typeof node)));
}

export function appendStreamingMarkdown(previous: StreamingMarkdownState, source: string): StreamingMarkdownState {
  const state = source.startsWith(previous.source) ? previous : emptyStreamingMarkdown();
  if (state.wholeDocument) return { ...state, source, tail: { start: 0, text: source } };
  const text = source.slice(state.tail.start);
  const tree = fromMarkdown(text, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  if (hasDefinition(tree)) return { source, blocks: [], tail: { start: 0, text: source }, wholeDocument: true };
  // Keep two trailing blocks mutable: a later line may extend a list, finish a
  // fence, or turn a paragraph into a Setext heading or GFM table.
  const settled = tree.children.slice(0, -2);
  const blocks = settled.map((node, index) => {
    const start = index === 0 ? 0 : node.position!.start.offset!;
    const end = tree.children[index + 1].position!.start.offset!;
    return { start: state.tail.start + start, text: text.slice(start, end) };
  });
  const tailStart = blocks.length ? state.tail.start + tree.children[blocks.length].position!.start.offset! : state.tail.start;
  return { source, blocks: [...state.blocks, ...blocks], tail: { start: tailStart, text: source.slice(tailStart) }, wholeDocument: false };
}
