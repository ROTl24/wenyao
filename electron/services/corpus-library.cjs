const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { lexicalSearch } = require('./retrieval.cjs');
const { normalizeLine, parseBook, sha256 } = require('./corpus-parser.cjs');

const LIBRARY_SCHEMA_VERSION = 1;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_BYTES = 100 * 1024 * 1024;
const MAX_BATCH_FILES = 20;
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function libraryError(message, code, nextAction = '') {
  const error = new Error(message);
  error.code = code;
  error.nextAction = nextAction;
  return error;
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function safeMetadataText(value, maxLength) {
  return normalizeLine(value).slice(0, maxLength);
}

function safeIdentifier(value) {
  const identifier = String(value || '');
  if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) throw libraryError('书籍标识无效。', 'CORPUS_ID_INVALID');
  return identifier;
}

function publicError(error) {
  return {
    code: error?.code || 'CORPUS_IMPORT_FAILED',
    message: error instanceof Error ? error.message : '古籍导入失败。',
    nextAction: error?.nextAction || '请检查文件后重试。',
  };
}

function bookEmbeddingHash(book) {
  return sha256(Buffer.from(`${book.contentHash}\n${book.title}`));
}

class CorpusLibrary {
  constructor({ rootPath, builtInCorpus = [], builtInManifest = {}, now = () => new Date(), randomUUID = () => crypto.randomUUID() }) {
    this.rootPath = path.resolve(rootPath);
    this.manifestPath = path.join(this.rootPath, 'library.json');
    this.booksRoot = path.join(this.rootPath, 'books');
    this.importsRoot = path.join(this.rootPath, 'imports');
    this.now = now;
    this.randomUUID = randomUUID;
    this.builtInCorpus = builtInCorpus.map((entry) => ({ ...entry, origin: 'builtin' }));
    this.builtInManifest = builtInManifest && typeof builtInManifest === 'object' ? builtInManifest : {};
    this.builtInBooks = this.#buildBuiltInBooks();
    this.state = { schemaVersion: LIBRARY_SCHEMA_VERSION, builtinEnabled: {}, books: [] };
    this.lastPurgedBookIds = [];
  }

  initialize() {
    fs.mkdirSync(this.booksRoot, { recursive: true });
    fs.mkdirSync(this.importsRoot, { recursive: true });
    this.state = this.#loadManifest();
    this.#discardStaleImports();
    this.purgeExpired();
    return this.getOverview();
  }

  #loadManifest() {
    if (!fs.existsSync(this.manifestPath)) return { schemaVersion: LIBRARY_SCHEMA_VERSION, builtinEnabled: {}, books: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'));
      if (parsed.schemaVersion !== LIBRARY_SCHEMA_VERSION) throw new Error('书库版本不受支持');
      return {
        schemaVersion: LIBRARY_SCHEMA_VERSION,
        builtinEnabled: parsed.builtinEnabled && typeof parsed.builtinEnabled === 'object' ? parsed.builtinEnabled : {},
        books: Array.isArray(parsed.books) ? parsed.books : [],
      };
    } catch {
      fs.copyFileSync(this.manifestPath, `${this.manifestPath}.corrupt-${Date.now()}`);
      return { schemaVersion: LIBRARY_SCHEMA_VERSION, builtinEnabled: {}, books: [] };
    }
  }

  #writeManifest() {
    atomicWriteJson(this.manifestPath, this.state);
  }

  #discardStaleImports() {
    for (const entry of fs.readdirSync(this.importsRoot, { withFileTypes: true })) {
      if (entry.isDirectory()) fs.rmSync(path.join(this.importsRoot, entry.name), { recursive: true, force: true });
    }
  }

  #buildBuiltInBooks() {
    const manifestSources = Array.isArray(this.builtInManifest.sources) ? this.builtInManifest.sources : [];
    const bySource = new Map();
    for (const entry of this.builtInCorpus) {
      if (!bySource.has(entry.source)) bySource.set(entry.source, []);
      bySource.get(entry.source).push(entry);
    }
    return [...bySource.entries()].map(([title, entries], index) => {
      const source = manifestSources.find((item) => item.title === title) || {};
      const sourceId = String(source.id || `SOURCE-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '-');
      return {
        id: `builtin-${sourceId}`,
        origin: 'builtin',
        title,
        author: '',
        edition: '',
        fileName: source.filename || '',
        extension: '.json',
        encoding: source.encoding || 'utf-8',
        contentHash: source.sha256 || sha256(Buffer.from(entries.map((entry) => `${entry.id}:${entry.text}`).join('\n'))),
        charCount: entries.reduce((sum, entry) => sum + String(entry.text || '').length, 0),
        chapterCount: new Set(entries.map((entry) => entry.title)).size,
        chunkCount: entries.length,
        createdAt: '',
        updatedAt: '',
        deletedAt: null,
        purgeAt: null,
        indexRequested: true,
        indexState: 'ready',
        entries: entries.map((entry) => ({ ...entry, bookId: `builtin-${sourceId}`, origin: 'builtin' })),
      };
    });
  }

  #userBook(id) {
    return this.state.books.find((book) => book.id === id) || null;
  }

  #bookDirectory(id) {
    return path.join(this.booksRoot, safeIdentifier(id));
  }

  #readUserEntries(book) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(this.#bookDirectory(book.id), 'chunks.json'), 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  #publicBook(book) {
    const enabled = book.origin === 'builtin'
      ? this.state.builtinEnabled[book.id] !== false
      : Boolean(book.enabled);
    return {
      id: book.id,
      origin: book.origin,
      title: book.title,
      author: book.author || '',
      edition: book.edition || '',
      fileName: book.fileName || '',
      extension: book.extension,
      encoding: book.encoding,
      contentHash: book.contentHash,
      charCount: book.charCount,
      chapterCount: book.chapterCount,
      chunkCount: book.chunkCount,
      createdAt: book.createdAt || '',
      updatedAt: book.updatedAt || '',
      enabled,
      deletedAt: book.deletedAt || null,
      purgeAt: book.purgeAt || null,
      indexRequested: Boolean(book.indexRequested),
      indexState: book.indexState || (book.origin === 'builtin' ? 'ready' : 'local-only'),
      indexProgress: Number(book.indexProgress || 0),
      indexError: book.indexError || null,
    };
  }

  getOverview() {
    const books = [
      ...this.builtInBooks.map((book) => this.#publicBook(book)),
      ...this.state.books.filter((book) => !book.deletedAt).map((book) => this.#publicBook(book)),
    ];
    return {
      bookCount: books.length,
      builtInBookCount: books.filter((book) => book.origin === 'builtin').length,
      userBookCount: books.filter((book) => book.origin === 'user').length,
      enabledBookCount: books.filter((book) => book.enabled).length,
      chunkCount: books.reduce((sum, book) => sum + book.chunkCount, 0),
      pendingIndexCount: books.filter((book) => ['pending', 'building', 'paused', 'error'].includes(book.indexState)).length,
      deletedBookCount: this.state.books.filter((book) => book.deletedAt).length,
    };
  }

  listBooks({ includeDeleted = false, query = '', offset = 0, limit = 50 } = {}) {
    const normalizedQuery = normalizeLine(query).toLowerCase();
    const builtIn = includeDeleted ? [] : this.builtInBooks.map((book) => this.#publicBook(book));
    const user = this.state.books
      .filter((book) => includeDeleted ? Boolean(book.deletedAt) : !book.deletedAt)
      .map((book) => this.#publicBook(book));
    const filtered = [...builtIn, ...user]
      .filter((book) => !normalizedQuery || `${book.title}${book.author}${book.edition}${book.fileName}`.toLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.origin.localeCompare(right.origin) || right.updatedAt.localeCompare(left.updatedAt) || left.title.localeCompare(right.title, 'zh-CN'));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
    return { items: filtered.slice(safeOffset, safeOffset + safeLimit), total: filtered.length };
  }

  getBook(id) {
    const builtIn = this.builtInBooks.find((book) => book.id === id);
    const book = builtIn || this.#userBook(id);
    if (!book) return null;
    const entries = builtIn ? builtIn.entries : this.#readUserEntries(book);
    return {
      ...this.#publicBook(book),
      samples: {
        first: entries[0]?.text?.slice(0, 500) || '',
        last: entries.at(-1)?.text?.slice(-500) || '',
      },
    };
  }

  getBookEntries(id) {
    const builtIn = this.builtInBooks.find((book) => book.id === id);
    if (builtIn) return structuredClone(builtIn.entries);
    const book = this.#userBook(id);
    return book ? this.#readUserEntries(book) : [];
  }

  getShardDescriptors({ enabledOnly = false, indexRequestedOnly = false, includeDeleted = false } = {}) {
    const enabledBuiltInIds = new Set(this.builtInBooks.filter((book) => this.state.builtinEnabled[book.id] !== false).map((book) => book.id));
    const builtInEntries = this.builtInBooks.flatMap((book) => book.entries);
    const shards = [];
    if (!enabledOnly || enabledBuiltInIds.size > 0) {
      const contentHash = sha256(Buffer.from(builtInEntries.map((entry) => `${entry.id}:${entry.title}:${entry.text}`).join('\n')));
      shards.push({
        id: 'builtin',
        origin: 'builtin',
        title: '内置古籍',
        contentHash,
        entries: structuredClone(builtInEntries),
        enabledEntryIds: new Set(builtInEntries.filter((entry) => enabledBuiltInIds.has(entry.bookId)).map((entry) => entry.id)),
      });
    }
    for (const book of this.state.books) {
      if (!includeDeleted && book.deletedAt) continue;
      if (enabledOnly && !book.enabled) continue;
      if (indexRequestedOnly && !book.indexRequested) continue;
      const entries = this.#readUserEntries(book);
      shards.push({
        id: book.id,
        origin: 'user',
        title: book.title,
        contentHash: bookEmbeddingHash(book),
        entries,
        enabledEntryIds: new Set(entries.map((entry) => entry.id)),
      });
    }
    return shards;
  }

  lexicalSearch({ shards, query, domainTerms, limit = 40 }) {
    const entries = shards.flatMap((shard) => shard.entries.filter((entry) => shard.enabledEntryIds.has(entry.id)));
    return lexicalSearch(entries, query, domainTerms, limit);
  }

  hydrateEntries(ids, shards) {
    const wanted = new Set(ids);
    const output = [];
    for (const shard of shards) {
      for (const entry of shard.entries) {
        if (wanted.has(entry.id) && shard.enabledEntryIds.has(entry.id)) output.push(structuredClone(entry));
      }
    }
    return output;
  }

  searchBookEntries({ bookId, query = '', offset = 0, limit = 30 }) {
    const entries = this.getBookEntries(String(bookId || ''));
    const normalized = normalizeLine(query).toLowerCase();
    const filtered = entries.filter((entry) => !normalized || `${entry.title}${entry.text}${(entry.tags || []).join('')}`.toLowerCase().includes(normalized));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
    return {
      items: filtered.slice(safeOffset, safeOffset + safeLimit).map((entry) => ({
        id: entry.id,
        title: entry.title,
        location: entry.location,
        text: entry.text,
        tags: entry.tags || [],
        knowledgeKind: entry.knowledgeKind || 'doctrine',
      })),
      total: filtered.length,
    };
  }

  previewFiles(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) throw libraryError('请选择至少一本古籍。', 'CORPUS_FILES_REQUIRED');
    if (filePaths.length > MAX_BATCH_FILES) throw libraryError(`每批最多导入 ${MAX_BATCH_FILES} 本古籍。`, 'CORPUS_BATCH_TOO_MANY');
    const inspected = filePaths.map((filePath) => {
      const resolvedPath = path.resolve(String(filePath || ''));
      const fileName = path.basename(resolvedPath);
      const extension = path.extname(resolvedPath).toLowerCase();
      try {
        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) throw libraryError('所选项目不是文件。', 'CORPUS_FILE_INVALID');
        return { resolvedPath, stat, fileName, extension, inspectionError: null };
      } catch (error) {
        const safeError = error?.code?.startsWith?.('CORPUS_')
          ? error
          : libraryError('无法读取所选文件。', 'CORPUS_FILE_UNREADABLE', '请确认文件仍存在且当前用户拥有读取权限。');
        return { resolvedPath, stat: { size: 0 }, fileName, extension, inspectionError: publicError(safeError) };
      }
    });
    const totalBytes = inspected.reduce((sum, item) => sum + item.stat.size, 0);
    if (totalBytes > MAX_BATCH_BYTES) throw libraryError('每批文件合计不能超过 100 MB。', 'CORPUS_BATCH_TOO_LARGE');

    const batchId = this.randomUUID();
    const batchDirectory = path.join(this.importsRoot, safeIdentifier(batchId));
    fs.mkdirSync(batchDirectory, { recursive: true });
    const previews = inspected.map((item) => {
      const draftId = this.randomUUID();
      const title = path.basename(item.fileName, item.extension);
      try {
        if (item.inspectionError) throw libraryError(item.inspectionError.message, item.inspectionError.code, item.inspectionError.nextAction);
        if (!['.txt', '.md'].includes(item.extension)) throw libraryError('仅支持 TXT 和 Markdown 文件。', 'CORPUS_FORMAT_UNSUPPORTED');
        if (item.stat.size > MAX_FILE_BYTES) throw libraryError('单个文件不能超过 20 MB。', 'CORPUS_FILE_TOO_LARGE');
        const bytes = fs.readFileSync(item.resolvedPath);
        if (bytes.length > MAX_FILE_BYTES) throw libraryError('单个文件不能超过 20 MB。', 'CORPUS_FILE_TOO_LARGE');
        const parsed = parseBook(bytes, { extension: item.extension, title });
        const duplicate = [...this.builtInBooks, ...this.state.books].find((book) => book.contentHash === parsed.contentHash);
        if (duplicate) {
          throw libraryError(
            duplicate.deletedAt ? '该文件已在最近删除中，可直接恢复。' : '该文件已经导入书库。',
            duplicate.deletedAt ? 'CORPUS_DUPLICATE_DELETED' : 'CORPUS_DUPLICATE',
            duplicate.deletedAt ? '请前往最近删除恢复原书。' : '无需重复导入。',
          );
        }
        const stagedSource = path.join(batchDirectory, `${safeIdentifier(draftId)}${item.extension}`);
        fs.writeFileSync(stagedSource, bytes, { mode: 0o600 });
        atomicWriteJson(path.join(batchDirectory, `${safeIdentifier(draftId)}.json`), {
          draftId,
          fileName: item.fileName,
          extension: item.extension,
          bytes: item.stat.size,
          parsed,
        });
        return {
          draftId,
          fileName: item.fileName,
          extension: item.extension,
          bytes: item.stat.size,
          suggestedTitle: title,
          encoding: parsed.encoding,
          contentHash: parsed.contentHash,
          charCount: parsed.charCount,
          chapterCount: parsed.chapterCount,
          chunkCount: parsed.chunks.length,
          samples: parsed.samples,
          error: null,
        };
      } catch (error) {
        return { draftId, fileName: item.fileName, extension: item.extension, bytes: item.stat.size, suggestedTitle: title, error: publicError(error) };
      }
    });
    atomicWriteJson(path.join(batchDirectory, 'batch.json'), { batchId, createdAt: this.now().toISOString(), draftIds: previews.map((preview) => preview.draftId) });
    return { batchId, totalBytes, previews };
  }

  commitImport({ batchId, books, sendForIndex = false }) {
    const safeBatchId = safeIdentifier(batchId);
    const batchDirectory = path.join(this.importsRoot, safeBatchId);
    const batchPath = path.join(batchDirectory, 'batch.json');
    if (!fs.existsSync(batchPath)) throw libraryError('导入预览已失效，请重新选择文件。', 'CORPUS_IMPORT_EXPIRED');
    const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
    const requested = new Map((Array.isArray(books) ? books : []).map((book) => [String(book.draftId || ''), book]));
    const results = [];
    const failedDraftIds = [];
    for (const draftId of batch.draftIds) {
      const metadata = requested.get(draftId);
      if (!metadata) continue;
      let temporaryDirectory = '';
      try {
        const previewPath = path.join(batchDirectory, `${safeIdentifier(draftId)}.json`);
        if (!fs.existsSync(previewPath)) throw libraryError('该文件未通过解析预览。', 'CORPUS_PREVIEW_INVALID');
        const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
        const duplicate = [...this.builtInBooks, ...this.state.books].find((book) => book.contentHash === preview.parsed.contentHash);
        if (duplicate) throw libraryError('该文件已经导入书库。', 'CORPUS_DUPLICATE');
        const title = safeMetadataText(metadata.title || path.basename(preview.fileName, preview.extension), 120);
        if (!title) throw libraryError('书名不能为空。', 'CORPUS_TITLE_REQUIRED');
        const author = safeMetadataText(metadata.author, 80);
        const edition = safeMetadataText(metadata.edition, 120);
        const id = `user-${this.randomUUID()}`;
        const createdAt = this.now().toISOString();
        const entries = preview.parsed.chunks.map((chunk, index) => ({
          id: `USR-${id.slice(5)}-${String(index + 1).padStart(6, '0')}`,
          title: chunk.title,
          source: title,
          author,
          edition,
          location: `${chunk.title} · 原文第 ${chunk.startLine}-${chunk.endLine} 行`,
          text: chunk.text,
          tags: chunk.tags,
          sourceType: 'original',
          knowledgeKind: chunk.knowledgeKind,
          topics: chunk.tags,
          origin: 'user',
          bookId: id,
        }));
        const record = {
          id,
          origin: 'user',
          title,
          author,
          edition,
          fileName: preview.fileName,
          extension: preview.extension,
          encoding: preview.parsed.encoding,
          contentHash: preview.parsed.contentHash,
          charCount: preview.parsed.charCount,
          chapterCount: preview.parsed.chapterCount,
          chunkCount: entries.length,
          createdAt,
          updatedAt: createdAt,
          enabled: Boolean(sendForIndex),
          deletedAt: null,
          purgeAt: null,
          indexRequested: Boolean(sendForIndex),
          indexState: sendForIndex ? 'pending' : 'local-only',
          indexProgress: 0,
          indexError: null,
        };
        temporaryDirectory = path.join(this.booksRoot, `.next-${safeIdentifier(id)}`);
        const finalDirectory = this.#bookDirectory(id);
        fs.mkdirSync(temporaryDirectory, { recursive: true });
        fs.copyFileSync(path.join(batchDirectory, `${safeIdentifier(draftId)}${preview.extension}`), path.join(temporaryDirectory, `source${preview.extension}`));
        atomicWriteJson(path.join(temporaryDirectory, 'chunks.json'), entries);
        fs.renameSync(temporaryDirectory, finalDirectory);
        try {
          this.state.books.push(record);
          this.#writeManifest();
        } catch (error) {
          this.state.books = this.state.books.filter((book) => book.id !== id);
          fs.rmSync(finalDirectory, { recursive: true, force: true });
          throw error;
        }
        results.push({ draftId, ok: true, book: this.#publicBook(record) });
      } catch (error) {
        if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
        results.push({ draftId, ok: false, error: publicError(error) });
        failedDraftIds.push(draftId);
      }
    }
    if (failedDraftIds.length) {
      atomicWriteJson(batchPath, { ...batch, draftIds: failedDraftIds, updatedAt: this.now().toISOString() });
    } else {
      fs.rmSync(batchDirectory, { recursive: true, force: true });
    }
    return { results, overview: this.getOverview() };
  }

  setEnabled(id, enabled, { requestIndex = false } = {}) {
    const builtIn = this.builtInBooks.find((book) => book.id === id);
    if (builtIn) {
      this.state.builtinEnabled[id] = Boolean(enabled);
      this.#writeManifest();
      return this.#publicBook(builtIn);
    }
    const book = this.#userBook(id);
    if (!book || book.deletedAt) throw libraryError('书籍不存在。', 'CORPUS_BOOK_NOT_FOUND');
    if (enabled && !book.indexRequested && !requestIndex) {
      throw libraryError('启用 AI 检索前需要确认正文发送范围。', 'CORPUS_INDEX_CONSENT_REQUIRED', '请确认后建立该书向量索引。');
    }
    book.enabled = Boolean(enabled);
    if (enabled && requestIndex) {
      book.indexRequested = true;
      if (book.indexState === 'local-only') book.indexState = 'pending';
    }
    book.updatedAt = this.now().toISOString();
    this.#writeManifest();
    return this.#publicBook(book);
  }

  updateMetadata(id, values) {
    const book = this.#userBook(id);
    if (!book || book.deletedAt) throw libraryError('书籍不存在。', 'CORPUS_BOOK_NOT_FOUND');
    const title = safeMetadataText(values?.title || book.title, 120);
    if (!title) throw libraryError('书名不能为空。', 'CORPUS_TITLE_REQUIRED');
    const titleChanged = title !== book.title;
    const author = safeMetadataText(values?.author ?? book.author, 80);
    const edition = safeMetadataText(values?.edition ?? book.edition, 120);
    const metadataChanged = titleChanged || author !== book.author || edition !== book.edition;
    book.title = title;
    book.author = author;
    book.edition = edition;
    book.updatedAt = this.now().toISOString();
    if (metadataChanged) {
      const entries = this.#readUserEntries(book).map((entry) => ({ ...entry, source: title, author: book.author, edition: book.edition }));
      atomicWriteJson(path.join(this.#bookDirectory(id), 'chunks.json'), entries);
    }
    if (titleChanged) {
      if (book.indexRequested) {
        book.indexState = 'pending';
        book.indexProgress = 0;
        book.indexError = null;
      }
    }
    this.#writeManifest();
    return { book: this.#publicBook(book), requiresIndex: titleChanged && book.indexRequested };
  }

  markIndexState(id, state, { progress = 0, error = null } = {}) {
    const book = this.#userBook(id);
    if (!book) return null;
    book.indexState = state;
    book.indexProgress = Math.min(100, Math.max(0, Number(progress) || 0));
    book.indexError = error;
    book.updatedAt = this.now().toISOString();
    this.#writeManifest();
    return this.#publicBook(book);
  }

  moveToTrash(id) {
    const book = this.#userBook(id);
    if (!book || book.deletedAt) throw libraryError('书籍不存在。', 'CORPUS_BOOK_NOT_FOUND');
    const deletedAt = this.now();
    book.preDeleteState = { enabled: book.enabled, indexState: book.indexState };
    book.enabled = false;
    book.deletedAt = deletedAt.toISOString();
    book.purgeAt = new Date(deletedAt.getTime() + TRASH_RETENTION_MS).toISOString();
    book.updatedAt = book.deletedAt;
    this.#writeManifest();
    return this.#publicBook(book);
  }

  restore(id) {
    const book = this.#userBook(id);
    if (!book || !book.deletedAt) throw libraryError('最近删除中没有该书。', 'CORPUS_BOOK_NOT_FOUND');
    book.deletedAt = null;
    book.purgeAt = null;
    book.enabled = Boolean(book.preDeleteState?.enabled);
    book.indexState = book.preDeleteState?.indexState || (book.indexRequested ? 'pending' : 'local-only');
    delete book.preDeleteState;
    book.updatedAt = this.now().toISOString();
    this.#writeManifest();
    return this.#publicBook(book);
  }

  purge(id) {
    const book = this.#userBook(id);
    if (!book) throw libraryError('书籍不存在。', 'CORPUS_BOOK_NOT_FOUND');
    if (!book.deletedAt) throw libraryError('请先将书籍移入最近删除。', 'CORPUS_BOOK_NOT_DELETED');
    const directory = this.#bookDirectory(id);
    const relative = path.relative(this.booksRoot, directory);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw libraryError('书籍路径越界。', 'CORPUS_PATH_INVALID');
    fs.rmSync(directory, { recursive: true, force: true });
    this.state.books = this.state.books.filter((item) => item.id !== id);
    this.#writeManifest();
    return true;
  }

  purgeExpired() {
    const current = this.now().getTime();
    const expired = this.state.books.filter((book) => book.deletedAt && Date.parse(book.purgeAt || '') <= current).map((book) => book.id);
    for (const id of expired) this.purge(id);
    this.lastPurgedBookIds = expired;
    return expired.length;
  }

  consumePurgedBookIds() {
    const ids = [...this.lastPurgedBookIds];
    this.lastPurgedBookIds = [];
    return ids;
  }
}

module.exports = {
  CorpusLibrary,
  LIBRARY_SCHEMA_VERSION,
  MAX_BATCH_BYTES,
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  TRASH_RETENTION_MS,
  bookEmbeddingHash,
  libraryError,
};
