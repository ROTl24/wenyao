import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CoinScene from './CoinScene';

describe('CoinScene 测试模式', () => {
  it('不创建 WebGL，暴露三枚可访问节点与随新轮次更新的 data-toss-id', async () => {
    const onRigReady = vi.fn();
    const faces = ['text', 'reverse', 'text'] as const;
    const props = {
      tossId: 'toss-a',
      visualSeed: 'same-faces-new-round',
      faces,
      lineIndex: 2,
      active: true,
      onRigReady,
    };
    const { container, rerender } = render(<CoinScene {...props} />);

    let stage = container.querySelector('.coin-test-stage');
    expect(stage).toHaveAttribute('data-toss-id', 'toss-a');
    expect(stage?.querySelectorAll('[data-coin-index]')).toHaveLength(3);
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    await waitFor(() => expect(onRigReady).toHaveBeenCalled());

    rerender(<CoinScene {...props} tossId="toss-b" />);
    stage = container.querySelector('.coin-test-stage');
    expect(stage).toHaveAttribute('data-toss-id', 'toss-b');
    expect(stage?.querySelectorAll('[data-coin-index]')).toHaveLength(3);
  });
});
