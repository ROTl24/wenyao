import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { headingId } from '../lib/reportOutline';

interface Props {
  markdown: string;
  className?: string;
  allowExternalLinks?: boolean;
  reportHeadings?: boolean;
  evidenceAnchorPrefix?: string;
  sourceOffset?: number;
}

function readingOffsets({ offset = 0 }: { offset?: number }) {
  return (tree: { type: string; position?: { start: { offset?: number } }; data?: Record<string, unknown>; children?: unknown[] }) => {
    const visit = (node: typeof tree) => {
      if (['paragraph', 'heading', 'code', 'tableRow'].includes(node.type) && node.position?.start.offset !== undefined) {
        node.data = { ...node.data, hProperties: { 'data-reading-offset': offset + node.position.start.offset } };
      }
      node.children?.forEach((child) => visit(child as typeof tree));
    };
    visit(tree);
  };
}

export const MarkdownContent = memo(function MarkdownContent({ markdown, className = '', allowExternalLinks = true, reportHeadings = false, evidenceAnchorPrefix = 'evidence-', sourceOffset = 0 }: Props) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [readingOffsets, { offset: sourceOffset }]]}
        skipHtml
        components={{
          h1({ node, children, ...props }) { return <h1 {...props} id={reportHeadings ? headingId(node?.position?.start.offset ?? 0) : undefined}>{children}</h1>; },
          h2({ node, children, ...props }) { return <h2 {...props} id={reportHeadings ? headingId(node?.position?.start.offset ?? 0) : undefined}>{children}</h2>; },
          a({ href, children, ...props }) {
            const evidenceAnchor = Boolean(href?.startsWith('#evidence-'));
            const plateAnchor = href === '#plate-facts';
            const resolvedHref = evidenceAnchor ? `#${evidenceAnchorPrefix}${href!.slice('#evidence-'.length)}` : href;
            const external = Boolean(href && /^https?:\/\//i.test(href));
            if (!evidenceAnchor && !plateAnchor && (!external || !allowExternalLinks)) return <span>{children}</span>;
            return (
              <a
                {...props}
                href={resolvedHref}
                className={evidenceAnchor || plateAnchor ? 'markdown-evidence-citation' : undefined}
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                onClick={(event) => {
                  if ((!evidenceAnchor && !plateAnchor) || !href) return;
                  const target = document.getElementById(resolvedHref!.slice(1));
                  if (target instanceof HTMLDetailsElement) target.open = true;
                  if (target instanceof HTMLElement) {
                    target.classList.remove('is-citation-target');
                    void target.offsetWidth;
                    target.classList.add('is-citation-target');
                    target.focus({ preventScroll: true });
                    target.addEventListener('animationend', () => {
                      target.classList.remove('is-citation-target');
                    }, { once: true });
                  }
                  if (target && typeof target.scrollIntoView === 'function') {
                    const reducedMotion = typeof window.matchMedia === 'function'
                      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
                  }
                  event.preventDefault();
                }}
              >
                {children}
              </a>
            );
          },
          img({ alt = '', ...props }) {
            if (!allowExternalLinks) return <span>{alt ? `［图片：${alt}］` : '［图片已隐藏］'}</span>;
            return <img {...props} alt={alt} />;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
});
