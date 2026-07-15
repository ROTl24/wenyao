import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  markdown: string;
  className?: string;
}

export function MarkdownContent({ markdown, className = '' }: Props) {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ href, children, ...props }) {
            const evidenceAnchor = Boolean(href?.startsWith('#evidence-'));
            const plateAnchor = href === '#plate-facts';
            const external = Boolean(href && /^https?:\/\//i.test(href));
            if (!evidenceAnchor && !plateAnchor && !external) return <span>{children}</span>;
            return (
              <a
                {...props}
                href={href}
                className={evidenceAnchor || plateAnchor ? 'markdown-evidence-citation' : undefined}
                {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                onClick={(event) => {
                  if ((!evidenceAnchor && !plateAnchor) || !href) return;
                  const target = document.getElementById(href.slice(1));
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
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
