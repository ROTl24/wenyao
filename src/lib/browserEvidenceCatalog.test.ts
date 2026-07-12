import { describe, expect, it } from 'vitest';
import corpus from '../../resources/corpus.json';
import corpusManifest from '../../resources/corpus-manifest.json';
import knowledgeIndex from '../../resources/knowledge-index.json';
import { browserSha256 } from './browserCrypto';
import {
  browserEvidenceCatalog,
  createBrowserEvidenceCatalog,
} from './browserEvidenceCatalog';

describe('浏览器 canonical evidence catalog', () => {
  it('从 bundled 三件套构造与桌面端相同的 corpusRef 和逐条正文哈希', () => {
    expect(browserEvidenceCatalog.corpusRef).toEqual({
      version: 2,
      hash: 'c1c7777ceecffdddcc586df371263868fa61cad2a161b4d58af3568b27018ba3',
    });
    expect(browserEvidenceCatalog.entries).toHaveLength(1263);
    const first = browserEvidenceCatalog.entries[0];
    expect(first.contentHash).toBe(browserSha256(first.text));
    expect(Object.isFrozen(browserEvidenceCatalog)).toBe(true);
    expect(Object.isFrozen(browserEvidenceCatalog.entries)).toBe(true);
    expect(Object.isFrozen(first.supportsRuleIds)).toBe(true);
  });

  it('hydrate 只信首个合法 ID/rank，忽略伪正文和 metadata，并稳定排序冻结', () => {
    const [first, second] = browserEvidenceCatalog.entries;
    const hydrated = browserEvidenceCatalog.hydrate([
      { id: first.id, rank: 9, text: '伪正文', supportsRuleIds: ['forged'] },
      { id: second.id, rank: 2, title: '伪标题' },
      { id: first.id, rank: 1 },
      { id: 'unknown', rank: 0 },
    ], 2);

    expect(hydrated.corpusRef).toBe(browserEvidenceCatalog.corpusRef);
    expect(hydrated.evidence.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(hydrated.evidence[1]).toBe(first);
    expect(hydrated.evidence[1].text).not.toBe('伪正文');
    expect(Object.isFrozen(hydrated)).toBe(true);
    expect(Object.isFrozen(hydrated.evidence)).toBe(true);
  });

  it('拒绝被篡改的正文、陈旧 corpusHash 及来源位置错配', () => {
    const forgedCorpus = structuredClone(corpus) as Array<Record<string, unknown>>;
    forgedCorpus[0].text = `${String(forgedCorpus[0].text)}伪造`;
    expect(() => createBrowserEvidenceCatalog({
      corpus: forgedCorpus,
      corpusManifest,
      knowledgeIndex,
    })).toThrow(/corpusHash|哈希/);

    const staleIndex = structuredClone(knowledgeIndex);
    staleIndex.corpusHash = '0'.repeat(64);
    expect(() => createBrowserEvidenceCatalog({
      corpus,
      corpusManifest,
      knowledgeIndex: staleIndex,
    })).toThrow(/corpusHash|哈希/);

    const mismatchedIndex = structuredClone(knowledgeIndex);
    mismatchedIndex.units[0].source = '伪来源';
    expect(() => createBrowserEvidenceCatalog({
      corpus,
      corpusManifest,
      knowledgeIndex: mismatchedIndex,
    })).toThrow(/来源|位置/);
  });
});
