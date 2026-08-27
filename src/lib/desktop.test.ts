import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTossFromValue } from './divination';
import { desktop, resolvePlatformApi } from './desktop';
import {
  confirmCurrentToss,
  createSession,
  prepareToss,
  type DivinationSession,
  type PreparedCoinLine,
} from './session';

const STORAGE_KEY = 'wenyao-browser-sessions';
const castAt = new Date('2026-07-11T04:00:00.000Z');

function completedDigitalSession(id = 'digital-session'): DivinationSession {
  let session = createSession('浏览器会话契约测试', 'other', castAt);
  for (const [index, value] of ([6, 7, 8, 9, 7, 8] as const).entries()) {
    session = confirmCurrentToss(
      prepareToss(session, createTossFromValue(value), `digital-seed-${index}`),
    );
  }
  return {
    ...session,
    id,
    analysis: {
      mode: 'cloud',
      markdown: '旧解读保持不变。',
      generatedAt: castAt.toISOString(),
    },
    messages: [{
      id: 'message-1',
      role: 'user',
      content: '旧追问保持不变。',
      createdAt: castAt.toISOString(),
    }],
  };
}

function completedPhysicalSession(id = 'physical-session'): DivinationSession {
  const digital = completedDigitalSession(id);
  return {
    ...digital,
    castingMethod: 'physical',
    castingBasis: { kind: 'physical', algorithm: 'three_coin_manual_v1' },
    lines: digital.lines.map((line) => ({
      ...line,
      coin: line.coin ? { faces: line.coin.faces } : undefined,
    })),
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('浏览器公共外链', () => {
  it('opens predefined links in a safe new tab and reports popup blocking', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    await expect(desktop.externalLinks.open('repository')).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith(
      'https://github.com/ROTl24/wenyao',
      '_blank',
      'noopener,noreferrer',
    );

    open.mockReturnValueOnce(null);
    await expect(desktop.externalLinks.open('xiaohongshu')).resolves.toBe(false);
  });
});

describe('平台能力', () => {
  it('enables session-only browser AI in trusted builds without claiming secure storage', async () => {
    expect(desktop.runtime).toEqual({
      kind: 'web',
      platform: 'browser',
      arch: 'web',
      isPackaged: false,
      updateMode: 'none',
      secureStorage: 'memory',
      capabilities: {
        ai: true,
        corpusImport: false,
      },
    });

    const status = await desktop.aiConfig.getStatus();
    const result = await desktop.aiConfig.testCapability({ capability: 'generation', apiUrl: '', model: '' });

    expect(status.message).toContain('当前页面会话');
    expect(result.error?.code).toMatch(/^WEB_AI_(?:RUNTIME|LOCKS)_UNAVAILABLE$/);
    expect(`${result.error?.message}${result.error?.nextAction}`).not.toContain('Electron');
  });

  it('uses the runtime profile supplied by the Electron preload seam', () => {
    const bridge = {
      ...desktop,
      runtime: {
        kind: 'electron' as const,
        platform: 'win32' as const,
        arch: 'x64',
        isPackaged: true,
        updateMode: 'native' as const,
        secureStorage: 'dpapi' as const,
        capabilities: { ai: true, corpusImport: true },
      },
    };
    const resolved = resolvePlatformApi(bridge);

    expect(resolved.runtime).toEqual({
      kind: 'electron',
      platform: 'win32',
      arch: 'x64',
      isPackaged: true,
      updateMode: 'native',
      secureStorage: 'dpapi',
      capabilities: {
        ai: true,
        corpusImport: true,
      },
    });
    expect(resolved.sessions).toBe(bridge.sessions);
    expect(resolved.ai).toBe(bridge.ai);
  });

  it('exposes the classified built-in corpus to browser UI and book browsing', async () => {
    await expect(desktop.corpus.status()).resolves.toMatchObject({
      count: 1263,
      bookCount: 5,
      ruleCount: 495,
      caseCount: 190,
      doctrineCount: 578,
    });

    const listing = await desktop.corpus.books({ query: '易隐', limit: 10 });
    const entries = await desktop.corpus.bookEntries({
      bookId: listing.items[0].id,
      query: '卜筮者，隐君子',
      limit: 10,
    });

    expect(entries.items).toEqual([
      expect.objectContaining({ id: 'YIYIN-0001', knowledgeKind: 'rule' }),
    ]);
  });
});

describe('浏览器会话存储', () => {
  it('reads a legacy session as digital without rewriting localStorage', async () => {
    const {
      castingMethod: _castingMethod,
      ...legacy
    } = completedDigitalSession();
    const raw = JSON.stringify([legacy]);
    localStorage.setItem(STORAGE_KEY, raw);

    const sessions = await desktop.sessions.list();

    expect(sessions).toHaveLength(1);
    expect(sessions[0].castingMethod).toBe('digital');
    expect(sessions[0].plate).toEqual(legacy.plate);
    expect(sessions[0].analysis).toEqual(legacy.analysis);
    expect(sessions[0].messages).toEqual(legacy.messages);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('rejects an invalid method and prevents changing the method of an existing id', async () => {
    const invalidMethod = {
      ...completedDigitalSession('invalid-method'),
      castingMethod: 'manual',
    } as unknown as DivinationSession;
    await expect(desktop.sessions.save(invalidMethod)).rejects.toThrow(
      '起卦方式无效',
    );

    const {
      castingMethod: _castingMethod,
      ...legacy
    } = completedDigitalSession('immutable-method');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([legacy]));

    await expect(
      desktop.sessions.save(completedPhysicalSession('immutable-method')),
    ).rejects.toThrow('起卦方式不可更改');
  });

  it('rejects an explicitly invalid method already present in browser storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...completedDigitalSession('invalid-stored-method'),
      castingMethod: 'manual',
    }]));

    await expect(desktop.sessions.list()).rejects.toThrow('起卦方式无效');
    await expect(desktop.sessions.get('invalid-stored-method')).rejects.toThrow(
      '起卦方式无效',
    );
  });

  it('stores the same canonical allowlisted shape used by Electron IPC', async () => {
    const input = {
      ...completedDigitalSession('canonical-session'),
      forgedTopLevel: { accepted: true },
      lines: completedDigitalSession().lines.map((line) => ({
        ...line,
        forgedLineField: { accepted: true },
      })),
    } as unknown as DivinationSession;

    const saved = await desktop.sessions.save(input);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as Array<
      Record<string, unknown>
    >;
    const storedLines = stored[0].lines as Array<Record<string, unknown>>;

    expect(saved).not.toHaveProperty('forgedTopLevel');
    expect(saved.lines[0]).not.toHaveProperty('forgedLineField');
    expect(stored[0]).not.toHaveProperty('forgedTopLevel');
    expect(storedLines[0]).not.toHaveProperty('forgedLineField');
    expect(saved.plate).toEqual(input.plate);
    expect(saved.analysis).toEqual(input.analysis);
    expect(saved.messages).toEqual(input.messages);
  });

  it('rejects inconsistent coin evidence and non-contiguous line indexes', async () => {
    const wrongFaces = structuredClone(completedDigitalSession('corrupt-faces'));
    wrongFaces.lines[0].coin!.faces = ['reverse', 'reverse', 'reverse'];
    await expect(desktop.sessions.save(wrongFaces)).rejects.toThrow('六爻记录冲突');

    const wrongValue = structuredClone(completedDigitalSession('corrupt-value'));
    wrongValue.lines[0].value = 9;
    await expect(desktop.sessions.save(wrongValue)).rejects.toThrow('六爻记录冲突');

    const badIndex = completedDigitalSession('bad-index');
    badIndex.lines[1].lineIndex = 3;
    await expect(desktop.sessions.save(badIndex)).rejects.toThrow(
      '六爻记录冲突',
    );
  });

  it('requires non-empty visual seeds for digital confirmed and current tosses', async () => {
    const confirmed = completedDigitalSession('confirmed-without-seed');
    confirmed.lines[0].coin!.visualSeed = ' ';
    await expect(desktop.sessions.save(confirmed)).rejects.toThrow(
      '六爻记录冲突',
    );

    const current = prepareToss(
      createSession('当前爻 seed 测试', 'other', castAt),
      createTossFromValue(7),
      ' ',
    );
    await expect(desktop.sessions.save(current)).rejects.toThrow(
      '当前投币状态冲突',
    );
  });

  it('accepts only complete seed-free physical sessions', async () => {
    const valid = completedPhysicalSession('valid-physical');
    await expect(desktop.sessions.save(valid)).resolves.toEqual(valid);
    await expect(desktop.sessions.get(valid.id)).resolves.toEqual(valid);

    const incomplete = completedPhysicalSession('incomplete-physical');
    incomplete.lines.pop();
    await expect(desktop.sessions.save(incomplete)).rejects.toThrow(
      '线下起卦只能保存完整六爻',
    );

    const casting = completedPhysicalSession('casting-physical');
    casting.status = 'casting';
    await expect(desktop.sessions.save(casting)).rejects.toThrow(
      '线下起卦只能保存完整六爻',
    );

    const withCurrent = completedPhysicalSession('physical-with-current');
    withCurrent.currentLine = {
      ...createTossFromValue(7),
      id: 'physical-current',
      lineIndex: 7,
      visualSeed: 'physical-seed',
    } as PreparedCoinLine;
    await expect(desktop.sessions.save(withCurrent)).rejects.toThrow(
      '线下起卦只能保存完整六爻',
    );

    const withOwnedSeed = completedPhysicalSession('physical-with-owned-seed');
    withOwnedSeed.lines[0].coin!.visualSeed = undefined;
    expect(Object.hasOwn(withOwnedSeed.lines[0].coin!, 'visualSeed')).toBe(true);
    await expect(desktop.sessions.save(withOwnedSeed)).rejects.toThrow(
      '六爻记录冲突',
    );
  });

  it('stores and returns detached structured clones', async () => {
    const input = completedDigitalSession('detached-session');
    const saved = await desktop.sessions.save(input);

    expect(saved).not.toBe(input);
    expect(saved.messages).not.toBe(input.messages);

    input.question = '调用方随后改写输入';
    input.messages[0].content = '调用方随后改写输入消息';
    saved.question = '调用方随后改写返回值';
    saved.messages[0].content = '调用方随后改写返回消息';

    const stored = await desktop.sessions.get('detached-session');
    expect(stored?.question).toBe('浏览器会话契约测试');
    expect(stored?.messages[0].content).toBe('旧追问保持不变。');
  });
});
