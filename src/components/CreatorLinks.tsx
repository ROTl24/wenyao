import { ExternalLink, GitFork, Heart } from 'lucide-react';
import { useState } from 'react';
import { desktop } from '../lib/desktop';
import type { PublicLinkId } from '../types/desktop';

interface Props {
  variant: 'compact' | 'panel';
}

const OPEN_ERROR = '暂时无法打开链接，请稍后重试。';

export function CreatorLinks({ variant }: Props) {
  const [opening, setOpening] = useState<PublicLinkId | null>(null);
  const [error, setError] = useState('');

  const open = async (id: PublicLinkId) => {
    setOpening(id);
    setError('');
    try {
      if (!await desktop.externalLinks.open(id)) setError(OPEN_ERROR);
    } catch {
      setError(OPEN_ERROR);
    } finally {
      setOpening(null);
    }
  };

  return (
    <section
      className={`creator-links creator-links--${variant}`}
      aria-label={variant === 'compact' ? '作者链接' : '找到作者'}
    >
      {variant === 'panel' ? (
        <div className="creator-links__intro">
          <strong>找到作者</strong>
          <span>问爻由「孤独的数字游民」开源制作</span>
        </div>
      ) : <span className="creator-links__signature">孤独的数字游民</span>}
      <div className="creator-links__actions">
        <button type="button" disabled={opening !== null} onClick={() => void open('repository')}>
          <GitFork size={variant === 'compact' ? 14 : 17} aria-hidden="true" />
          <span>{variant === 'compact' ? '开源仓库' : '访问开源仓库'}</span>
          {variant === 'panel' ? <ExternalLink size={13} aria-hidden="true" /> : null}
        </button>
        <button type="button" disabled={opening !== null} onClick={() => void open('xiaohongshu')}>
          <Heart size={variant === 'compact' ? 14 : 17} aria-hidden="true" />
          <span>{variant === 'compact' ? '小红书' : '关注小红书'}</span>
          {variant === 'panel' ? <ExternalLink size={13} aria-hidden="true" /> : null}
        </button>
      </div>
      {error ? <p className="creator-links__error" role="alert">{error}</p> : null}
    </section>
  );
}
