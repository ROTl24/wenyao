import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { desktop } from '../lib/desktop';
import { CreatorLinks } from './CreatorLinks';

afterEach(() => vi.restoreAllMocks());

describe('CreatorLinks', () => {
  it('opens predefined links from the compact author signature', async () => {
    const open = vi.spyOn(desktop.externalLinks, 'open').mockResolvedValue(true);
    render(<CreatorLinks variant="compact" />);

    expect(screen.getByText('孤独的数字游民')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '开源仓库' }));
    await waitFor(() => expect(open).toHaveBeenCalledWith('repository'));
  });

  it('renders the settings copy and reports a non-blocking opening failure', async () => {
    vi.spyOn(desktop.externalLinks, 'open').mockResolvedValue(false);
    render(<CreatorLinks variant="panel" />);

    expect(screen.getByText('问爻由「孤独的数字游民」开源制作')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '关注小红书' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法打开链接，请稍后重试。');
  });
});
