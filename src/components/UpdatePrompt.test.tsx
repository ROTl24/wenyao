import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdatePrompt } from './UpdatePrompt';

describe('软件更新提示', () => {
  it('requires confirmation before downloading an available update', () => {
    const download = vi.fn();
    const dismiss = vi.fn();
    render(
      <UpdatePrompt
        state={{ status: 'available', currentVersion: '0.3.0', availableVersion: '0.3.1' }}
        onDownload={download}
        onInstall={vi.fn()}
        onDismiss={dismiss}
      />,
    );

    expect(screen.getByRole('heading', { name: '发现新版本' })).toBeVisible();
    expect(download).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '下载更新' }));
    expect(download).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '稍后' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('shows deterministic progress and lets the user continue using the app', () => {
    const dismiss = vi.fn();
    render(
      <UpdatePrompt
        state={{ status: 'downloading', currentVersion: '0.3.0', availableVersion: '0.3.1', progress: 48.6 }}
        onDownload={vi.fn()}
        onInstall={vi.fn()}
        onDismiss={dismiss}
      />,
    );

    expect(screen.getByRole('progressbar', { name: '更新下载进度' })).toHaveAttribute('aria-valuenow', '48.6');
    expect(screen.getByText('48.6%')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '收起并继续使用' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('explains deferred installation and can restart immediately', () => {
    const install = vi.fn();
    render(
      <UpdatePrompt
        state={{ status: 'downloaded', currentVersion: '0.3.0', availableVersion: '0.3.1' }}
        onDownload={vi.fn()}
        onInstall={install}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText(/正常退出问爻后自动安装/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '立即重启安装' }));
    expect(install).toHaveBeenCalledTimes(1);
  });
});
