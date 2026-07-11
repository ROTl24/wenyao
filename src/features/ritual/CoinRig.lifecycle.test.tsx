import { Component, StrictMode, useLayoutEffect, useRef, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoinRig } from './CoinRig';

const lifecycle = vi.hoisted(() => ({
  geometryDisposals: [] as Array<ReturnType<typeof vi.fn>>,
  textureSetDisposals: [] as Array<ReturnType<typeof vi.fn>>,
  textureError: null as Error | null,
}));
const fiberState = vi.hoisted(() => ({
  gl: {},
  invalidate: vi.fn(),
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: typeof fiberState) => unknown) => selector(fiberState),
}));

vi.mock('./coinGeometry', async () => {
  const THREE = await import('three');
  return {
    createQianlongCoinGeometry: () => {
      const geometry = new THREE.BufferGeometry();
      const dispose = vi.fn();
      geometry.dispose = dispose;
      lifecycle.geometryDisposals.push(dispose);
      return geometry;
    },
  };
});

vi.mock('./coinTextures', () => ({
  DEFAULT_COIN_TEXTURE_QUALITY: 'balanced',
  createQianlongTextureSet: () => {
    if (lifecycle.textureError) throw lifecycle.textureError;
    const dispose = vi.fn();
    lifecycle.textureSetDisposals.push(dispose);
    return { dispose, materials: [] };
  },
}));

vi.mock('./QianlongCoin', async () => {
  const THREE = await import('three');
  return {
    createQianlongCoinMeshes: () => [
      new THREE.Object3D(),
      new THREE.Object3D(),
      new THREE.Object3D(),
    ],
    QianlongCoin: () => null,
  };
});

beforeEach(() => {
  lifecycle.geometryDisposals.splice(0);
  lifecycle.textureSetDisposals.splice(0);
  lifecycle.textureError = null;
  fiberState.invalidate.mockClear();
});

describe('CoinRig 资源生命周期', () => {
  it('异步资源初始化异常回到 React ErrorBoundary，且不会成为 unhandled rejection', async () => {
    class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
      state = { error: null as Error | null };
      static getDerivedStateFromError(error: Error) { return { error }; }
      render() { return this.state.error ? <span role="alert">{this.state.error.message}</span> : this.props.children; }
    }
    lifecycle.textureError = new Error('texture allocation failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <Boundary>
        <CoinRig
          input={{
            tossId: 'resource-error',
            visualSeed: 'react-boundary',
            faces: ['text', 'reverse', 'text'],
            lineIndex: 1,
          }}
          onReady={vi.fn()}
        />
      </Boundary>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('texture allocation failed');
    expect(lifecycle.geometryDisposals[0]).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
  it('首个提交不创建 Canvas/材质，资源异步就绪后才暴露 rig', async () => {
    const onReady = vi.fn();
    const view = render(
      <CoinRig
        input={{
          tossId: 'async-resource-ready',
          visualSeed: 'do-not-block-commit',
          faces: ['text', 'reverse', 'text'],
          lineIndex: 1,
        }}
        onReady={onReady}
      />,
    );

    expect(lifecycle.geometryDisposals).toHaveLength(0);
    expect(onReady).not.toHaveBeenCalled();
    await waitFor(() => expect(onReady).toHaveBeenCalled());

    view.unmount();
  });

  it('StrictMode 探测渲染与最终卸载产生的每套资源都恰好释放一次', async () => {
    const onReady = vi.fn();
    const { unmount } = render(
      <StrictMode>
        <CoinRig
          input={{
            tossId: 'strict-resource-lifecycle',
            visualSeed: 'dispose-every-created-set',
            faces: ['text', 'reverse', 'text'],
            lineIndex: 1,
          }}
          onReady={onReady}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(onReady).toHaveBeenCalled());

    unmount();

    expect(lifecycle.geometryDisposals.length).toBeGreaterThan(0);
    expect(lifecycle.textureSetDisposals.length).toBe(lifecycle.geometryDisposals.length);
    lifecycle.geometryDisposals.forEach((dispose) => {
      expect(dispose).toHaveBeenCalledTimes(1);
    });
    lifecycle.textureSetDisposals.forEach((dispose) => {
      expect(dispose).toHaveBeenCalledTimes(1);
    });
  });

  it('input 更新时在父级 commit token 落定后才发出 rig ready', async () => {
    const observations: Array<readonly [number, number]> = [];

    function Parent({ version }: { version: number }) {
      const committedVersion = useRef(0);
      useLayoutEffect(() => {
        committedVersion.current = version;
      }, [version]);
      return (
        <CoinRig
          input={{
            tossId: `passive-ready-${version}`,
            visualSeed: 'committed-parent-token',
            faces: ['text', 'reverse', 'text'],
            lineIndex: version,
          }}
          onReady={() => observations.push([version, committedVersion.current])}
        />
      );
    }

    const view = render(<Parent version={1} />);
    await waitFor(() => expect(observations).toContainEqual([1, 1]));
    view.rerender(<Parent version={2} />);
    await waitFor(() => expect(observations.some(([version]) => version === 2)).toBe(true));

    expect(observations.at(-1)).toEqual([2, 2]);
    view.unmount();
  });
});
