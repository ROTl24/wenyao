import { describe, expect, it } from 'vitest';
import { isClarificationQuestion, reselectEvidence, reselectEvidenceWithDiagnostics, searchEvidence, type EvidenceEntry } from './retrieval';
import retrievalCore from '../../shared/retrieval-core.cjs';

const entries: EvidenceEntry[] = [
  {
    id: 'E1',
    title: '用神规则',
    source: '测试古籍',
    location: '卷一',
    text: '占问事业，以官鬼爻为用神，兼看世爻旺衰。',
    tags: ['事业', '官鬼', '世爻'],
    sourceType: 'original',
  },
  {
    id: 'E2',
    title: '财爻规则',
    source: '测试古籍',
    location: '卷二',
    text: '占问求财，以妻财爻为用神。',
    tags: ['财运', '妻财'],
    sourceType: 'original',
  },
];

describe('本地证据检索', () => {
  it('ranks exact domain terms above unrelated entries', () => {
    const result = searchEvidence(entries, '事业发展要看官鬼还是妻财', ['事业', '官鬼']);
    expect(result[0].id).toBe('E1');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('returns no fabricated evidence when nothing matches', () => {
    expect(searchEvidence(entries, '完全无关的天气问题', [])).toEqual([]);
  });

  it('keeps renderer and Electron BM25 ranking identical', () => {
    const renderer = searchEvidence(entries, '事业发展要看官鬼还是妻财', ['事业', '官鬼']);
    const shared = retrievalCore.bm25Search(entries, '事业发展要看官鬼还是妻财', ['事业', '官鬼'], 40);
    expect(renderer.map((item) => item.id)).toEqual(shared.map((item: { id: string }) => item.id));
    expect(renderer.map((item) => item.score)).toEqual(shared.map((item: { score: number }) => item.score));
  });

  it('distinguishes local clarification from a new follow-up concern', () => {
    expect(isClarificationQuestion('你说的官鬼受制具体是什么意思')).toBe(true);
    expect(isClarificationQuestion('那我明年换到另一家公司会怎样')).toBe(false);
    expect(reselectEvidence(entries, '官鬼具体是什么意思', ['官鬼'])[0].id).toBe('E1');
    const local = reselectEvidenceWithDiagnostics(entries, '官鬼具体是什么意思', ['官鬼']);
    expect(local.diagnostics.rankings?.bm25[0]).toMatchObject({ id: 'E1', rank: 1 });
    expect(local.diagnostics.rankings?.final[0]).toMatchObject({ id: 'E1', rank: 1 });
  });
});
