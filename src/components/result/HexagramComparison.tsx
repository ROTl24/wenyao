import type { DerivedFact, HexagramSideV2, LineFacetV2 } from '../../domain/liuyao';
import type { LineFactView } from './selectors';
import { ElementText } from './ElementText';

const EFFECT_LABELS: Readonly<Record<string, string>> = {
  'is-void': '空', 'is-month-break': '月破', 'is-day-break': '日破', 'is-dark-moving': '暗动',
  'returns-generate': '回头生', 'returns-control': '回头克', 'returns-clash': '回头冲',
  'returns-combine': '回头合', advances: '进神', retreats: '退神',
  'changes-to-tomb': '化墓', 'changes-to-absolute': '化绝',
};

function value(fact: DerivedFact | undefined, key: string): string {
  if (!fact) return '';
  const result = fact.values[key];
  return typeof result === 'string' ? result : '';
}

function LineCell({ view }: { view: LineFactView }) {
  const { line, side } = view;
  const facet: LineFacetV2 = line[side];
  const spirit = value(view.sixSpiritFact, 'sixSpirit');
  return (
    <div className="hex-line-detail" data-testid={`${side}-line`}>
      <div className="hex-line-heading">
        <strong>{['初', '二', '三', '四', '五', '上'][line.position - 1]}爻</strong>
        <span className={facet.yang ? 'line-glyph line-glyph--yang' : 'line-glyph line-glyph--yin'} aria-label={facet.yang ? '阳爻' : '阴爻'} />
        <span>{line.moving ? (side === 'base' ? '动爻' : '变爻') : (side === 'base' ? '静爻' : '静爻对应')}</span>
        <b>{facet.role ?? '—'}</b>
      </div>
      <div className="line-facets">
        <span>六神 {spirit || '—'}</span>
        <span>纳甲 <ElementText value={facet.stem} element={facet.stemElement} /><ElementText value={facet.branch} element={facet.branchElement} /></span>
        <span>本宫六亲 {facet.relationToBasePalace}</span>
        <span>自宫六亲 {facet.relationToOwnPalace}</span>
      </div>
      <div className="line-hidden">
        <strong>伏神</strong>
        {side === 'base' && line.hiddenSpiritCandidates.length
          ? line.hiddenSpiritCandidates.map((hidden) => <span key={hidden.id}>{hidden.relation} {hidden.ganZhi}<ElementText value={hidden.branch} element={hidden.element} /></span>)
          : <span>无</span>}
      </div>
      <div className="line-derived"><strong>十二长生</strong>{view.growthFacts.map((fact) => <span key={fact.id}>{value(fact, 'pillarKind') || '动变'}·{value(fact, 'stage')}</span>)}</div>
      <div className="line-derived"><strong>辅助神煞</strong>{view.shenShaFacts.length ? view.shenShaFacts.map((fact) => <span key={fact.id}>{value(fact, 'label') || value(fact, 'shenShaId')}</span>) : <span>无</span>}</div>
      {view.effectFacts.length > 0 && <div className="line-derived line-derived--effects">{view.effectFacts.map((fact) => <span key={fact.id}>{EFFECT_LABELS[fact.relation] ?? fact.relation}</span>)}</div>}
    </div>
  );
}

function HexagramPanel({ title, hexagram, lines }: { title: string; hexagram: HexagramSideV2; lines: readonly LineFactView[] }) {
  return (
    <section className="hexagram-panel">
      <header><span>{title}</span><h3>{hexagram.name}</h3><p>{hexagram.palace}宫 · {hexagram.generation} · 五行{hexagram.palaceElement}</p></header>
      {lines.map((view) => <LineCell key={`${view.line.id}:${view.side}`} view={view} />)}
    </section>
  );
}

export function HexagramComparison({ base, changed, baseLines, changedLines }: {
  base: HexagramSideV2; changed: HexagramSideV2;
  baseLines: readonly LineFactView[]; changedLines: readonly LineFactView[];
}) {
  return (
    <section className="hexagram-comparison-wrap" aria-label="本卦变卦完整对照">
      <div className="hexagram-comparison">
        <HexagramPanel title="本卦" hexagram={base} lines={baseLines} />
        <HexagramPanel title="变卦" hexagram={changed} lines={changedLines} />
      </div>
    </section>
  );
}
