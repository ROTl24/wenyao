import corpusJson from '../../resources/corpus.json';
import corpusManifestJson from '../../resources/corpus-manifest.json';
import knowledgeIndexJson from '../../resources/knowledge-index.json';
import type { CanonicalEvidenceV2 } from '../domain/liuyao/analysis-report';
import { hashCanonicalPayload } from '../domain/liuyao/canonical';
import { browserSha256 } from './browserCrypto';
import type { CorpusRefV2 } from './types';

const HASH = /^[a-f0-9]{64}$/;
const KINDS = new Set(['rule', 'case', 'doctrine']);
const SOURCE_TYPES = new Set(['original', 'summary']);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} 必须是对象`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) throw new TypeError(`${label} 无效`);
  return value;
}

function strings(value: unknown, label: string, sorted = false): string[] {
  if (!Array.isArray(value) || value.some((_, index) => !Object.hasOwn(value, index))) throw new TypeError(`${label} 必须是稠密数组`);
  const result = value.map((item, index) => string(item, `${label}[${index}]`));
  if (new Set(result).size !== result.length) throw new TypeError(`${label} 存在重复项`);
  if (sorted && result.some((item, index) => index > 0 && result[index - 1].localeCompare(item) > 0)) {
    throw new TypeError(`${label} 必须稳定排序`);
  }
  return result;
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new TypeError(`${label} 无效`);
  return Number(value);
}

function deepFreeze<T>(value: T, seen = new Set<object>()): T {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || seen.has(value as object)) return value;
  seen.add(value as object);
  Reflect.ownKeys(value as object).forEach((key) => deepFreeze((value as Record<PropertyKey, unknown>)[key], seen));
  return Object.freeze(value);
}

interface BrowserCatalogInput {
  corpus: unknown;
  corpusManifest: unknown;
  knowledgeIndex: unknown;
}

export interface BrowserEvidenceCandidateRef {
  readonly id: string;
  readonly rank: number;
}

export interface BrowserEvidenceCatalog {
  readonly entries: readonly CanonicalEvidenceV2[];
  readonly corpusRef: CorpusRefV2;
  hydrate(candidates: readonly unknown[], limit?: number): {
    readonly evidence: readonly CanonicalEvidenceV2[];
    readonly corpusRef: CorpusRefV2;
  };
}

export function createBrowserEvidenceCatalog(input: BrowserCatalogInput): BrowserEvidenceCatalog {
  const manifest = record(input.corpusManifest, 'corpus manifest');
  if (manifest.schemaVersion !== 1) throw new TypeError('corpus manifest 版本无效');
  const corpusVersion = string(manifest.corpusVersion, 'corpus manifest.corpusVersion');
  const sourcesRaw = Array.isArray(manifest.sources) ? manifest.sources : null;
  if (!sourcesRaw) throw new TypeError('corpus manifest.sources 无效');
  const sources = sourcesRaw.map((value, index) => {
    const source = record(value, `manifest source ${index}`);
    return {
      id: string(source.id, 'source.id'), title: string(source.title, 'source.title'),
      filename: string(source.filename, 'source.filename'), sha256: string(source.sha256, 'source.sha256'),
      encoding: string(source.encoding, 'source.encoding'), bytes: integer(source.bytes, 'source.bytes'),
      rawLineCount: integer(source.rawLineCount, 'source.rawLineCount'),
      acceptedLineCount: integer(source.acceptedLineCount, 'source.acceptedLineCount'),
      entryCount: integer(source.entryCount, 'source.entryCount'),
    };
  });
  const normalizedManifest = {
    schemaVersion: 1,
    corpusVersion,
    sourceType: string(manifest.sourceType, 'manifest.sourceType'),
    bookCount: integer(manifest.bookCount, 'manifest.bookCount'),
    entryCount: integer(manifest.entryCount, 'manifest.entryCount'),
    sources,
  };
  if (normalizedManifest.bookCount !== sources.length) throw new TypeError('manifest bookCount 不一致');
  const sourceCounts = new Map(sources.map((source) => [source.title, 0]));
  if (!Array.isArray(input.corpus)) throw new TypeError('corpus 必须是数组');
  const corpusIds = new Set<string>();
  const normalizedCorpus = input.corpus.map((value, index) => {
    const entry = record(value, `corpus[${index}]`);
    const id = string(entry.id, `corpus[${index}].id`);
    if (corpusIds.has(id)) throw new TypeError(`corpus ID 重复：${id}`);
    corpusIds.add(id);
    const source = string(entry.source, `corpus[${index}].source`);
    if (!sourceCounts.has(source)) throw new TypeError(`corpus 来源无效：${source}`);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    const sourceType = string(entry.sourceType, `corpus[${index}].sourceType`);
    if (!SOURCE_TYPES.has(sourceType)) throw new TypeError('corpus sourceType 无效');
    return {
      id, title: string(entry.title, 'entry.title'), source,
      location: string(entry.location, 'entry.location'), text: string(entry.text, 'entry.text'),
      tags: strings(entry.tags, 'entry.tags'), sourceType: sourceType as 'original' | 'summary',
      ...(typeof entry.pageImage === 'string' && entry.pageImage ? { pageImage: entry.pageImage } : {}),
    };
  });
  if (normalizedManifest.entryCount !== normalizedCorpus.length) throw new TypeError('manifest entryCount 不一致');
  for (const source of sources) {
    if (sourceCounts.get(source.title) !== source.entryCount) throw new TypeError(`来源计数不一致：${source.id}`);
  }

  const index = record(input.knowledgeIndex, 'knowledge index');
  if (index.version !== 2 || index.corpusVersion !== corpusVersion || typeof index.corpusHash !== 'string' || !HASH.test(index.corpusHash)) {
    throw new TypeError('knowledge index 版本或 corpusVersion/corpusHash 无效');
  }
  if (!Array.isArray(index.units)) throw new TypeError('knowledge index units 无效');
  const unitById = new Map<string, { kind: 'rule' | 'case' | 'doctrine'; topics: string[]; source: string; location: string; supportsRuleIds: string[] }>();
  index.units.forEach((value, unitIndex) => {
    const unit = record(value, `knowledge unit ${unitIndex}`);
    const id = string(unit.id, 'unit.id');
    if (unitById.has(id)) throw new TypeError(`knowledge unit ID 重复：${id}`);
    const kind = string(unit.kind, 'unit.kind');
    if (!KINDS.has(kind)) throw new TypeError(`knowledge kind 无效：${kind}`);
    unitById.set(id, {
      kind: kind as 'rule' | 'case' | 'doctrine', topics: strings(unit.topics, 'unit.topics'),
      source: string(unit.source, 'unit.source'), location: string(unit.location, 'unit.location'),
      supportsRuleIds: strings(unit.supportsRuleIds, 'unit.supportsRuleIds', true),
    });
  });
  if (unitById.size !== normalizedCorpus.length) throw new TypeError('语料与知识索引必须一一对应');
  const entries = normalizedCorpus.sort((left, right) => left.id.localeCompare(right.id)).map((entry): CanonicalEvidenceV2 => {
    const unit = unitById.get(entry.id);
    if (!unit) throw new TypeError(`知识索引缺失语料：${entry.id}`);
    if (unit.source !== entry.source || unit.location !== entry.location) throw new TypeError(`来源或位置不一致：${entry.id}`);
    return {
      ...entry,
      contentHash: browserSha256(entry.text),
      knowledgeKind: unit.kind,
      topics: [...unit.topics],
      supportsRuleIds: [...unit.supportsRuleIds],
    };
  });
  const hash = hashCanonicalPayload({
    schemaVersion: 'canonical-evidence/v2', corpusManifest: normalizedManifest, entries,
  }, { sha256: browserSha256 });
  if (hash !== index.corpusHash) throw new Error('knowledge index corpusHash 陈旧或语料哈希损坏');
  const frozenEntries = deepFreeze(entries.map((entry) => deepFreeze(entry)));
  const byId = new Map(frozenEntries.map((entry) => [entry.id, entry]));
  const corpusRef = deepFreeze({ version: 2, hash });
  const catalog: BrowserEvidenceCatalog = {
    entries: frozenEntries,
    corpusRef,
    hydrate(candidates, limit = 8) {
      if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100) throw new TypeError('hydrate limit 无效');
      const ranked: BrowserEvidenceCandidateRef[] = [];
      const seen = new Set<string>();
      for (let index = 0; index < (Array.isArray(candidates) ? candidates.length : 0); index += 1) {
        if (!Object.hasOwn(candidates, index)) continue;
        const candidate = candidates[index];
        const source = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : null;
        const id = typeof candidate === 'string' ? candidate : typeof source?.id === 'string' ? source.id : '';
        const rank = typeof candidate === 'string' ? index + 1 : Number.isSafeInteger(source?.rank) && Number(source?.rank) >= 0 ? Number(source?.rank) : null;
        if (!byId.has(id) || seen.has(id) || rank === null) continue;
        seen.add(id);
        ranked.push({ id, rank });
      }
      ranked.sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
      return deepFreeze({
        evidence: deepFreeze(ranked.slice(0, limit).map(({ id }) => byId.get(id)!)),
        corpusRef,
      });
    },
  };
  return deepFreeze(catalog);
}

export const browserEvidenceCatalog = createBrowserEvidenceCatalog({
  corpus: corpusJson,
  corpusManifest: corpusManifestJson,
  knowledgeIndex: knowledgeIndexJson,
});
