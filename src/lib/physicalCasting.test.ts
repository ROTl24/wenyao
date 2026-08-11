import { describe, expect, it } from 'vitest';
import {
  appendPhysicalCastLine,
  createPhysicalCastDraft,
  finalizePhysicalCast,
  replacePhysicalCastLine,
  updatePhysicalCastTime,
} from './physicalCasting';

describe('线下起卦草稿', () => {
  it('records bottom-to-top lines, supports correction and creates a complete plate without visual seeds', () => {
    let draft = createPhysicalCastDraft(
      '项目能否落地',
      'career',
      '2026-07-12T04:00:00.000Z',
    );
    const values = [6, 7, 8, 9, 7, 8] as const;
    for (const [index, value] of values.entries()) {
      draft = appendPhysicalCastLine(
        draft,
        value,
        `2026-07-30T00:00:0${index}.000Z`,
      );
    }
    draft = replacePhysicalCastLine(draft, 1, 9, '2026-07-30T00:01:00.000Z');
    draft = updatePhysicalCastTime(draft, '2026-07-12T05:00:00.000Z');
    const session = finalizePhysicalCast(draft, '2026-07-30T00:02:00.000Z');

    expect(session).toMatchObject({
      question: '项目能否落地',
      category: 'career',
      castingMethod: 'physical',
      castAt: '2026-07-12T05:00:00.000Z',
      status: 'complete',
      updatedAt: '2026-07-30T00:02:00.000Z',
    });
    expect(session.lines.map((line) => line.value)).toEqual([6, 9, 8, 9, 7, 8]);
    expect(session.lines.map((line) => line.lineIndex)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(session.lines.every((line) => line.coin && !Object.hasOwn(line.coin, 'visualSeed'))).toBe(true);
    expect(session.plate?.lines.map((line) => line.value)).toEqual([6, 9, 8, 9, 7, 8]);
  });

  it('does not finalize an incomplete physical cast', () => {
    const draft = appendPhysicalCastLine(
      createPhysicalCastDraft('线下问题', 'other', '2026-07-12T04:00:00.000Z'),
      7,
      '2026-07-30T00:00:00.000Z',
    );
    expect(() => finalizePhysicalCast(draft)).toThrow('必须确认完整六爻');
  });
});
