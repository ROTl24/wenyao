import { describe, expect, it } from 'vitest';
import { createCompletedSession } from './session';
import { buildPlateExportDocument, formatPlateExport } from './plateExport';
import { defaultCastingBasis, lineRecordFromToss } from './casting';
import { createToss } from './divination';

const castAt = new Date('2026-07-11T12:00:00+08:00');

function completed(values: readonly (6 | 7 | 8 | 9)[]) {
  const lines = values.map((value, index) => {
    const faces = value === 6 ? ['text', 'text', 'text'] as const
      : value === 7 ? ['text', 'text', 'reverse'] as const
        : value === 8 ? ['text', 'reverse', 'reverse'] as const
          : ['reverse', 'reverse', 'reverse'] as const;
    return lineRecordFromToss(createToss(faces), index + 1, castAt.toISOString());
  });
  return createCompletedSession('这项事业合作是否适合继续？', 'career', castAt, {
    method: 'random',
    basis: defaultCastingBasis('random'),
    lines,
  }, castAt);
}

describe('排盘复制格式', () => {
  it('builds one privacy-bounded document shared by all formats', () => {
    const session = completed([6, 7, 8, 9, 7, 8]);
    session.analysis = { mode: 'cloud', markdown: '不得导出', generatedAt: castAt.toISOString() };
    session.messages = [{ id: 'message-secret', role: 'user', content: '不得导出的追问', createdAt: castAt.toISOString() }];
    const document = buildPlateExportDocument(session);
    const serialized = JSON.stringify(document);

    expect(document.plate.lines.map((line) => line.position)).toEqual(['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']);
    expect(document.plate.movingLines).toEqual(['初爻', '四爻']);
    expect(document.classics.movingLines.map((line) => line.position)).toEqual(['初爻', '四爻']);
    expect(serialized).not.toContain('不得导出');
    expect(serialized).not.toContain('message-secret');
    expect(serialized).not.toMatch(/visualSeed|analysis|messages|"id"/);
  });

  it('renders equivalent model-ready facts as text, Markdown and JSON', () => {
    const session = completed([6, 7, 8, 9, 7, 8]);
    const text = formatPlateExport(session, 'text');
    const markdown = formatPlateExport(session, 'markdown');
    const json = formatPlateExport(session, 'json');
    const parsed = JSON.parse(json);

    for (const output of [text, markdown, json]) {
      expect(output).toContain(session.question);
      expect(output).toContain(session.plate!.baseHexagram.name);
      expect(output).toContain(session.plate!.changedHexagram.name);
      expect(output).toContain('初爻');
      expect(output).toContain('四爻');
      expect(output).toContain('CC BY-SA 4.0');
    }
    expect(text).toContain('【六爻排盘（上爻至初爻）】');
    expect(markdown).toContain('| 爻位 | 六神 | 爻类 | 本卦 | 变卦 |');
    expect(parsed.instructions).toHaveLength(4);
    expect(parsed.casting.originalLines[0].coins).toEqual(['字（2）', '字（2）', '字（2）']);
  });

  it('copies only the base judgment for a static hexagram', () => {
    const document = buildPlateExportDocument(completed([7, 8, 7, 8, 7, 8]));
    expect(document.plate.movingLines).toEqual([]);
    expect(document.plate).not.toHaveProperty('changedHexagram');
    expect(document.classics).not.toHaveProperty('changed');
    expect(document.classics.movingLines).toEqual([]);
  });

  it('includes 用九 and 用六 only for six moving lines', () => {
    const qian = buildPlateExportDocument(completed([9, 9, 9, 9, 9, 9]));
    const kun = buildPlateExportDocument(completed([6, 6, 6, 6, 6, 6]));
    expect(qian.classics.special?.label).toBe('用九');
    expect(kun.classics.special?.label).toBe('用六');
    expect(buildPlateExportDocument(completed([9, 7, 7, 7, 7, 7])).classics.special).toBeUndefined();
  });
});
