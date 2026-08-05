import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { desktop } from '../lib/desktop';
import type { AIConfigStatus, CorpusBookSummary, CorpusStatus } from '../types/desktop';
import { CorpusLibraryPanel } from './CorpusLibraryPanel';

const readyAI: AIConfigStatus = {
  status: 'ready', message: '已就绪', activeFingerprint: 'fingerprint', corpusCount: 1263,
  consentAcceptedAt: '2026-08-05T00:00:00.000Z', connections: [], activePipeline: null, draft: null, usage: [],
  activeCapabilities: {
    generation: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'chat' },
    embedding: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'Qwen-Embedding' },
    rerank: { connectionId: 'sf', providerId: 'siliconflow', label: 'SiliconFlow', model: 'Qwen-Reranker' },
  },
};

const builtIn: CorpusBookSummary = {
  id: 'builtin-1', origin: 'builtin', title: '增删卜易', author: '', edition: '', fileName: '', extension: '.json', encoding: 'utf-8', contentHash: 'a',
  charCount: 1000, chapterCount: 20, chunkCount: 50, createdAt: '', updatedAt: '', enabled: true, deletedAt: null, purgeAt: null,
  indexRequested: true, indexState: 'ready', indexProgress: 100, indexError: null,
};
const localBook: CorpusBookSummary = {
  ...builtIn, id: 'user-1', origin: 'user', title: '用户易书', fileName: '用户易书.txt', contentHash: 'b', enabled: false,
  indexRequested: false, indexState: 'local-only', indexProgress: 0,
};
const status: CorpusStatus = {
  count: 60, bookCount: 2, builtInBookCount: 1, userBookCount: 1, enabledBookCount: 1, chunkCount: 60,
  deletedBookCount: 0, pendingIndexCount: 0, originalCount: 60, summaryCount: 0, ruleCount: 10, caseCount: 10, doctrineCount: 40,
  vectorReady: true, vectorModel: 'Qwen-Embedding', readyShardIds: ['builtin'], ready: true,
};

describe('CorpusLibraryPanel 古籍书库', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    desktop.platform = 'win32';
    vi.spyOn(desktop.corpus, 'status').mockResolvedValue(status);
    vi.spyOn(desktop.corpus, 'books').mockResolvedValue({ items: [builtIn, localBook], total: 2 });
    vi.spyOn(desktop.corpus, 'onState').mockReturnValue(() => {});
    vi.spyOn(desktop.corpus, 'book').mockResolvedValue({ ...builtIn, samples: { first: '首段', last: '末段' } });
    vi.spyOn(desktop.corpus, 'bookEntries').mockResolvedValue({ items: [{ id: 'E1', title: '用神章', location: '第一行', text: '凡占以用神为要。', tags: ['用神'], knowledgeKind: 'rule' }], total: 1 });
  });

  it('区分内置与用户来源，并按需查看原文片段', async () => {
    render(<CorpusLibraryPanel aiStatus={readyAI} onClose={vi.fn()} />);
    expect(await screen.findByText('《增删卜易》')).toBeVisible();
    expect(screen.getByText('《用户易书》')).toBeVisible();
    expect(screen.getAllByText('内置').length).toBeGreaterThan(0);
    expect(screen.getAllByText('用户导入').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('《增删卜易》').closest('button')!);
    expect(await screen.findByText('凡占以用神为要。')).toBeVisible();
    expect(desktop.corpus.bookEntries).toHaveBeenCalledWith({ bookId: 'builtin-1', limit: 30 });
  });

  it('预览确认后携带书籍元数据和逐批索引许可导入', async () => {
    vi.spyOn(desktop.corpus, 'selectImportFiles').mockResolvedValue({
      ok: true,
      batch: {
        batchId: 'batch-1', totalBytes: 100,
        previews: [{ draftId: 'draft-1', fileName: '新书.txt', extension: '.txt', bytes: 100, suggestedTitle: '新书', encoding: 'utf-8', charCount: 800, chapterCount: 2, chunkCount: 3, samples: { first: '首段', last: '末段' }, error: null }],
      },
    });
    const commit = vi.spyOn(desktop.corpus, 'commitImport').mockResolvedValue({ ok: true, results: [{ draftId: 'draft-1', ok: true, book: localBook }] });
    render(<CorpusLibraryPanel aiStatus={readyAI} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /导入古籍/ }));
    expect(await screen.findByRole('heading', { name: '确认导入古籍' })).toBeVisible();
    fireEvent.click(screen.getByRole('checkbox', { name: /确认发送上述古籍正文/ }));
    fireEvent.click(screen.getByRole('button', { name: '导入并建立索引' }));
    await waitFor(() => expect(commit).toHaveBeenCalledWith({
      batchId: 'batch-1', sendForIndex: true,
      books: [{ draftId: 'draft-1', title: '新书', author: '', edition: '' }],
    }));
  });

  it('本地书首次启用时要求明确确认索引发送', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const setEnabled = vi.spyOn(desktop.corpus, 'setEnabled').mockResolvedValue({ ok: true, book: { ...localBook, enabled: true, indexRequested: true, indexState: 'pending' } });
    render(<CorpusLibraryPanel aiStatus={readyAI} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '启用：用户易书' }));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('user-1', true, true));
  });

  it('书籍超过单页上限时可以继续加载而不限制书库总量', async () => {
    vi.mocked(desktop.corpus.books)
      .mockResolvedValueOnce({ items: [builtIn], total: 2 })
      .mockResolvedValueOnce({ items: [localBook], total: 2 });
    render(<CorpusLibraryPanel aiStatus={readyAI} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: '加载更多（1/2）' }));
    expect(await screen.findByText('《用户易书》')).toBeVisible();
    expect(desktop.corpus.books).toHaveBeenLastCalledWith({ includeDeleted: false, query: '', offset: 1, limit: 100 });
  });
});
