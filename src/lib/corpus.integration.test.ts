import { describe, expect, it } from 'vitest';
import corpus from '../../resources/corpus.json';
import { searchEvidence, type EvidenceEntry } from './retrieval';

const entries = corpus as EvidenceEntry[];

describe('正式古籍证据包', () => {
  it('包含五本用户古籍且全部标记为原文', () => {
    expect(entries.length).toBeGreaterThan(1_200);
    expect(new Set(entries.map((entry) => entry.source))).toEqual(new Set([
      '易隐', '卜筮正宗', '易冒', '火珠林', '增删卜易',
    ]));
    expect(entries.every((entry) => entry.sourceType === 'original')).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
  });

  it('不含下载站广告、乱码或无法追溯的空位置', () => {
    expect(entries.some((entry) => /https?:|www\.|z-library|1lib|z-lib/i.test(entry.text))).toBe(false);
    expect(entries.some((entry) => entry.text.includes('�'))).toBe(false);
    expect(entries.every((entry) => entry.location.includes('原文第'))).toBe(true);
    expect(Math.min(...entries.map((entry) => entry.text.length))).toBeGreaterThanOrEqual(36);
  });

  it.each([
    ['事业功名', ['官鬼', '世爻', '父母', '功名']],
    ['婚姻感情', ['婚姻', '妻财', '官鬼', '世应']],
    ['求财买卖', ['求财', '妻财', '子孙', '兄弟']],
    ['疾病调养', ['疾病', '官鬼', '子孙', '用神']],
  ])('可以检索“%s”相关原文', (query, terms) => {
    const result = searchEvidence(entries, query, terms, 8);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some((entry) => entry.matchedTerms.length > 0)).toBe(true);
    expect(result.every((entry) => entry.sourceType === 'original')).toBe(true);
  });
});
