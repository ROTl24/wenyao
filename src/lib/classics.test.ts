import { describe, expect, it } from 'vitest';
import { zhouyiClassics } from './classics';
import { getHexagram } from './divination';

describe('《周易》经文数据', () => {
  it('contains one traceable judgment and six line texts for every hexagram', () => {
    expect(zhouyiClassics.entries).toHaveLength(64);
    expect(new Set(zhouyiClassics.entries.map((entry) => entry.appName)).size).toBe(64);
    expect(zhouyiClassics.entries.reduce((sum, entry) => sum + entry.lines.length, 0)).toBe(384);

    for (const entry of zhouyiClassics.entries) {
      expect(entry.sourceRevision).toBeGreaterThan(0);
      expect(entry.judgment.trim()).not.toBe('');
      expect(entry.lines.map((line) => line.position)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(JSON.stringify(entry)).not.toMatch(/\{\{|\[\[|<span|-\{/);
    }
  });

  it('maps all 64 computed hexagrams and matches every yin-yang line label', () => {
    for (let code = 0; code < 64; code += 1) {
      const bits = Array.from({ length: 6 }, (_, index) => Boolean(code & (1 << index)));
      const hexagram = getHexagram(bits);
      const classic = zhouyiClassics.forHexagram(hexagram.name);
      for (const line of classic.lines) {
        const expectedPolarity = bits[line.position - 1] ? '九' : '六';
        expect(line.label).toContain(expectedPolarity);
      }
    }
  });

  it('keeps special texts exclusive to Qian and Kun', () => {
    const specials = zhouyiClassics.entries.filter((entry) => entry.special);
    expect(specials.map((entry) => [entry.appName, entry.special?.label])).toEqual([
      ['乾为天', '用九'],
      ['坤为地', '用六'],
    ]);
    expect(zhouyiClassics.forHexagram('乾为天').lines[0].text).toContain('潛龍勿用');
  });
});
