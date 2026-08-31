import { describe, expect, it } from 'vitest';
import { createCompletedSession, normalizeSession } from './session';
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
    expect(parsed).toMatchObject({ schema: 'wenyao.plate-export', schemaVersion: 2 });
    expect(parsed.casting.originalLines[0].coins).toEqual(['字（2）', '字（2）', '字（2）']);
  });

  it('distinguishes base-to-changed progression from changed-line return actions', () => {
    const session = completed([6, 7, 8, 8, 9, 7]);
    const text = formatPlateExport(session, 'text');
    const markdown = formatPlateExport(session, 'markdown');
    const parsed = JSON.parse(formatPlateExport(session, 'json'));

    expect(session.plate!.baseHexagram.name).toBe('风水涣');
    expect(session.plate!.changedHexagram.name).toBe('山泽损');
    expect(session.plate!.lines[0]).toMatchObject({ ganZhi: '戊寅', changedGanZhi: '丁巳' });
    expect(session.plate!.lines[4]).toMatchObject({ ganZhi: '辛巳', changedGanZhi: '丙子' });
    expect(parsed.plate.relations).not.toHaveProperty('transformations');
    expect(parsed.plate.relations.transformationReturnScope).toEqual({
      appliesTo: 'transformationReturns',
      direction: 'changed-line-returns-to-base-line',
      directionLabel: '变爻回头作用于本爻',
      elementRelationSubject: 'changed-line',
      returnEffectSubject: 'changed-line',
      branchRelations: ['六合', '六冲'],
    });
    expect(parsed.plate.relations.transformationReturns).toEqual([
      {
        line: '初爻',
        direction: 'changed-line-returns-to-base-line',
        directionLabel: '变爻回头作用于本爻',
        changedLine: '丁巳',
        baseLine: '戊寅',
        elementRelation: '被生',
        elementRelationLabel: '本爻生变爻',
        branchRelation: 'none',
        branchRelationLabel: '无',
        returnEffects: [],
        returnEffectLabels: [],
      },
      {
        line: '五爻',
        direction: 'changed-line-returns-to-base-line',
        directionLabel: '变爻回头作用于本爻',
        changedLine: '丙子',
        baseLine: '辛巳',
        elementRelation: '克',
        elementRelationLabel: '变爻克本爻',
        branchRelation: 'none',
        branchRelationLabel: '无',
        returnEffects: ['克'],
        returnEffectLabels: ['回头克'],
      },
    ]);
    expect(parsed.plate.lines.find((line: { position: string }) => line.position === '初爻')).toMatchObject({
      base: { stemBranch: '戊寅' },
      changed: { stemBranch: '丁巳' },
    });
    expect(parsed.plate.lines.find((line: { position: string }) => line.position === '五爻')).toMatchObject({
      base: { stemBranch: '辛巳' },
      changed: { stemBranch: '丙子' },
    });
    expect(text).toContain('  本卦：父母 戊寅木');
    expect(text).toContain('  变卦：兄弟 丁巳火');
    expect(markdown).toMatch(/\| 初爻 \|.*父母 戊寅木.*兄弟 丁巳火.*\|/);
    expect(markdown).toMatch(/\| 五爻 \|.*兄弟 辛巳火.*官鬼 丙子水.*\|/);
    for (const output of [text, markdown]) {
      expect(output).toContain('本卦与变卦的排列表示成卦变化，回头关系固定表示变爻对同位本爻的作用');
      expect(output).toContain('初爻回头关系（变爻回头作用于本爻）：变爻 丁巳；本爻 戊寅；五行：本爻生变爻；回头作用（仅标注生、克、比和、合、冲）：未命中已建模作用；地支（仅判断六合与六冲）：无');
      expect(output).toContain('五爻回头关系（变爻回头作用于本爻）：变爻 丙子；本爻 辛巳；五行：变爻克本爻；回头作用（仅标注生、克、比和、合、冲）：回头克；地支（仅判断六合与六冲）：无');
      expect(output).not.toContain('初爻 丁巳 → 戊寅');
      expect(output).not.toContain('五爻 丙子 → 辛巳');
    }
  });

  it('exports raw and labelled multi-effect return facts within the declared branch scope', () => {
    const session = completed([9, 7, 7, 7, 7, 7]);
    const text = formatPlateExport(session, 'text');
    const markdown = formatPlateExport(session, 'markdown');
    const parsed = JSON.parse(formatPlateExport(session, 'json'));
    const firstReturn = parsed.plate.relations.transformationReturns[0];

    expect(firstReturn).toMatchObject({
      line: '初爻',
      changedLine: '辛丑',
      baseLine: '甲子',
      elementRelation: '克',
      elementRelationLabel: '变爻克本爻',
      branchRelation: '六合',
      branchRelationLabel: '六合',
      returnEffects: ['克', '合'],
      returnEffectLabels: ['回头克', '回头合'],
    });
    for (const output of [text, markdown]) {
      expect(output).toContain('初爻回头关系（变爻回头作用于本爻）：变爻 辛丑；本爻 甲子；五行：变爻克本爻；回头作用（仅标注生、克、比和、合、冲）：回头克、回头合；地支（仅判断六合与六冲）：六合');
    }
  });

  it('formats a persisted old-shape return relation after the plate upgrader rebuilds it', () => {
    const session = completed([6, 7, 8, 8, 9, 7]);
    const stalePlate = structuredClone(session.plate!) as unknown as Record<string, unknown>;
    const currentFacts = session.plate!.relationFacts;
    stalePlate.relationFacts = {
      ...currentFacts,
      transformationReturns: [{
        id: 'return:1',
        lineIndex: 1,
        fromGanZhi: '旧变爻',
        toGanZhi: '旧本爻',
        elementRelation: '被克',
        branchRelation: 'none',
        effects: ['克'],
      }],
    };
    const normalized = normalizeSession({ ...session, plate: stalePlate });

    expect(() => formatPlateExport(normalized, 'json')).not.toThrow();
    const parsed = JSON.parse(formatPlateExport(normalized, 'json'));
    expect(parsed.plate.relations.transformationReturns[0]).toMatchObject({
      changedLine: '丁巳',
      baseLine: '戊寅',
    });
  });

  it('copies only the base judgment for a static hexagram', () => {
    const document = buildPlateExportDocument(completed([7, 8, 7, 8, 7, 8]));
    expect(document.plate.movingLines).toEqual([]);
    expect(document.plate).not.toHaveProperty('changedHexagram');
    expect(document.plate.relations).not.toHaveProperty('transformationReturnScope');
    expect(document.instructions.join('')).not.toContain('回头关系');
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
