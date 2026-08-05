const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CorpusLibrary } = require('./corpus-library.cjs');

function fixture(now = new Date('2026-08-05T00:00:00.000Z')) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-corpus-library-'));
  let sequence = 0;
  const library = new CorpusLibrary({
    rootPath: root,
    builtInCorpus: [{ id: 'B-1', title: '用神章', source: '内置书', text: '凡占事业以官鬼为用神。', tags: ['用神'], sourceType: 'original', knowledgeKind: 'rule' }],
    builtInManifest: { sources: [{ id: 'BUILTIN', title: '内置书', sha256: 'builtin-hash' }] },
    now: () => new Date(now),
    randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  });
  library.initialize();
  return { root, library };
}

function writeBook(root, name, body = '凡占求财，以妻财为用神，世爻旺相则财源可求。'.repeat(8)) {
  const filePath = path.join(root, name);
  fs.writeFileSync(filePath, body, 'utf8');
  return filePath;
}

test('预览并原子导入用户古籍，内置书保持独立', () => {
  const { root, library } = fixture();
  const preview = library.previewFiles([writeBook(root, '新书.txt')]);
  assert.equal(preview.previews[0].error, null);
  const committed = library.commitImport({
    batchId: preview.batchId,
    sendForIndex: true,
    books: [{ draftId: preview.previews[0].draftId, title: '新书', author: '某氏', edition: '整理本' }],
  });
  assert.equal(committed.results[0].ok, true);
  assert.equal(committed.results[0].book.indexState, 'pending');
  assert.equal(library.listBooks().total, 2);
  const detail = library.getBook(committed.results[0].book.id);
  assert.equal(detail.origin, 'user');
  assert.match(detail.samples.first, /妻财/);
});

test('完全相同内容拒绝重复导入，同名不同内容允许共存', () => {
  const { root, library } = fixture();
  const firstPath = writeBook(root, '同名.txt');
  let preview = library.previewFiles([firstPath]);
  library.commitImport({ batchId: preview.batchId, books: [{ draftId: preview.previews[0].draftId, title: '同名' }] });

  preview = library.previewFiles([firstPath]);
  assert.equal(preview.previews[0].error.code, 'CORPUS_DUPLICATE');

  preview = library.previewFiles([writeBook(root, '同名.md', '山川星辰，各有其理。'.repeat(20))]);
  const committed = library.commitImport({ batchId: preview.batchId, books: [{ draftId: preview.previews[0].draftId, title: '同名', edition: '异本' }] });
  assert.equal(committed.results[0].ok, true);
});

test('未确认外部索引的本地书不能直接启用 AI 检索', () => {
  const { root, library } = fixture();
  const preview = library.previewFiles([writeBook(root, '本地书.txt')]);
  const committed = library.commitImport({ batchId: preview.batchId, books: [{ draftId: preview.previews[0].draftId, title: '本地书' }] });
  const id = committed.results[0].book.id;
  assert.throws(() => library.setEnabled(id, true), (error) => error.code === 'CORPUS_INDEX_CONSENT_REQUIRED');
  assert.equal(library.setEnabled(id, true, { requestIndex: true }).indexState, 'pending');
});

test('删除进入恢复区，恢复后还原启用状态，到期后永久清理', () => {
  const initial = new Date('2026-08-05T00:00:00.000Z');
  const { root, library } = fixture(initial);
  const preview = library.previewFiles([writeBook(root, '可恢复.txt')]);
  const committed = library.commitImport({ batchId: preview.batchId, sendForIndex: true, books: [{ draftId: preview.previews[0].draftId, title: '可恢复' }] });
  const id = committed.results[0].book.id;
  const deleted = library.moveToTrash(id);
  assert.equal(deleted.enabled, false);
  assert.equal(library.listBooks({ includeDeleted: true }).total, 1);
  assert.equal(library.restore(id).enabled, true);
  library.moveToTrash(id);

  const later = new Date(initial.getTime() + 31 * 24 * 60 * 60 * 1000);
  library.now = () => later;
  assert.equal(library.purgeExpired(), 1);
  assert.equal(library.getBook(id), null);
});

test('修改书名只使该用户书索引待重建', () => {
  const { root, library } = fixture();
  const preview = library.previewFiles([writeBook(root, '旧名.txt')]);
  const committed = library.commitImport({ batchId: preview.batchId, sendForIndex: true, books: [{ draftId: preview.previews[0].draftId, title: '旧名' }] });
  const id = committed.results[0].book.id;
  library.markIndexState(id, 'ready', { progress: 100 });
  const updated = library.updateMetadata(id, { title: '新名', author: '作者' });
  assert.equal(updated.requiresIndex, true);
  assert.equal(updated.book.indexState, 'pending');
  assert.equal(library.getBookEntries(id)[0].source, '新名');
});

test('提交失败的预览批次可以修正元数据后重试', () => {
  const { root, library } = fixture();
  const preview = library.previewFiles([writeBook(root, '待修正.txt')]);
  const draftId = preview.previews[0].draftId;
  const failed = library.commitImport({ batchId: preview.batchId, books: [{ draftId, title: '   ' }] });
  assert.equal(failed.results[0].ok, false);
  const retried = library.commitImport({ batchId: preview.batchId, books: [{ draftId, title: '修正书名' }] });
  assert.equal(retried.results[0].ok, true);
  assert.equal(retried.results[0].book.title, '修正书名');
});

test('书库概览统计不受列表分页上限影响', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-corpus-overview-'));
  const builtInCorpus = Array.from({ length: 101 }, (_, index) => ({
    id: `B-${index + 1}`,
    title: '章节',
    source: `内置书${index + 1}`,
    text: '天地定位，山泽通气。',
    tags: [],
    sourceType: 'original',
    knowledgeKind: 'doctrine',
  }));
  const library = new CorpusLibrary({ rootPath: root, builtInCorpus });
  const overview = library.initialize();
  assert.equal(library.listBooks({ limit: 10_000 }).items.length, 100);
  assert.equal(overview.bookCount, 101);
  assert.equal(overview.builtInBookCount, 101);
});

test('批量预览按文件隔离无法读取的项目', () => {
  const { root, library } = fixture();
  const preview = library.previewFiles([
    writeBook(root, '可读取.txt'),
    path.join(root, '已不存在.txt'),
  ]);
  assert.equal(preview.previews[0].error, null);
  assert.equal(preview.previews[1].error.code, 'CORPUS_FILE_UNREADABLE');
});

test('与内置原始文件哈希相同的上传也会被拒绝', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wenyao-corpus-builtin-duplicate-'));
  const body = Buffer.from('凡占求财，以妻财为用神。'.repeat(10));
  const sourcePath = path.join(root, '内置书.txt');
  fs.writeFileSync(sourcePath, body);
  const hash = crypto.createHash('sha256').update(body).digest('hex');
  const library = new CorpusLibrary({
    rootPath: path.join(root, 'library'),
    builtInCorpus: [{ id: 'B-1', title: '正文', source: '内置书', text: body.toString('utf8'), tags: [], sourceType: 'original', knowledgeKind: 'rule' }],
    builtInManifest: { sources: [{ id: 'BUILTIN', title: '内置书', sha256: hash }] },
  });
  library.initialize();
  const preview = library.previewFiles([sourcePath]);
  assert.equal(preview.previews[0].error.code, 'CORPUS_DUPLICATE');
});
