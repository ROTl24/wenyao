import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebAIClient } from './client';
import type { DesktopApi } from '../../types/desktop';

describe('generation bridge', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stopping while acquiring the page lock prevents worker dispatch', async () => {
    let grant: (() => unknown) | undefined;
    vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => new Promise((resolve) => { grant = () => resolve(callback({})); }) } });
    const worker = vi.fn();
    vi.stubGlobal('Worker', worker);
    const client = new WebAIClient();
    const pending = client.analyze({ requestId: 'request-1' } as Parameters<DesktopApi['ai']['analyze']>[0]);
    expect(await client.cancel('request-1')).toEqual({ stopped: true });
    grant?.();
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AI_GENERATION_STOPPED' } });
    expect(worker).not.toHaveBeenCalled();
  });

  it('routes progress by request and removes listeners when the worker finishes', async () => {
    let receive: ((event: { data: unknown }) => void) | undefined;
    const requests: Array<{ id: string; command: string }> = [];
    class FakeWorker {
      addEventListener(event: string, handler: typeof receive) { if (event === 'message') receive = handler; }
      postMessage(message: typeof requests[number]) { requests.push(message); }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: unknown, callback: (lock: object) => unknown) => callback({}) } });
    const client = new WebAIClient();
    const progress = vi.fn();
    const pending = client.analyze({ requestId: 'report-a' } as Parameters<DesktopApi['ai']['analyze']>[0], progress);
    receive?.({ data: { event: 'generation', requestId: 'report-b', progress: { stage: 'writing', delta: 'wrong' } } });
    receive?.({ data: { event: 'generation', requestId: 'report-a', progress: { stage: 'writing', delta: 'visible' } } });
    expect(progress).toHaveBeenCalledExactlyOnceWith({ stage: 'writing', delta: 'visible' });
    const stop = client.cancel('report-a');
    expect(requests[1].command).toBe('cancelGeneration');
    receive?.({ data: { id: requests[1].id, ok: true, value: { stopped: true } } });
    expect(await stop).toEqual({ stopped: true });
    receive?.({ data: { id: requests[0].id, ok: true, value: { ok: false, error: { code: 'AI_GENERATION_STOPPED' } } } });
    await pending;
    receive?.({ data: { event: 'generation', requestId: 'report-a', progress: { stage: 'writing', delta: 'late' } } });
    expect(progress).toHaveBeenCalledOnce();
    expect(await client.cancel('report-a')).toEqual({ stopped: false });
    client.clearSession();
  });
});
