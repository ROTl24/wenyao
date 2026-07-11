import { describe, expect, it } from 'vitest';
import { searchEvidence, type EvidenceEntry } from './retrieval';

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
});
