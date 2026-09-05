import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

export interface ReportSection {
  id: string;
  title: string;
  start: number;
  end: number;
  number: number | null;
}

export function headingId(offset: number) { return `report-section-${offset}`; }

function nodeText(value: unknown): string {
  const node = value as { value?: string; children?: unknown[] };
  return node.value ?? (node.children || []).map(nodeText).join('');
}

export function reportOutline(markdown: string): { sections: ReportSection[]; summary: string } {
  const tree = fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
  const headings = tree.children.filter((node) => node.type === 'heading' && node.depth <= 2);
  const sections = headings.map((node, index) => {
    const start = node.position?.start.offset ?? 0;
    const title = nodeText(node);
    const match = title.match(/^(\d{1,2})[.．、\s]+/);
    return { id: headingId(start), title, start, end: headings[index + 1]?.position?.start.offset ?? markdown.length, number: match ? Number(match[1]) : null };
  });
  // Preserve complete sections, including every condition and citation. Never summarize with another model call.
  const summary = sections.filter((section) => [9, 10, 11].includes(section.number ?? 0))
    .map((section) => markdown.slice(section.start, section.end).trim()).join('\n\n');
  return { sections, summary };
}

export function navigateToResult(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView?.({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
