import type { CalendarSnapshot, PillarKind } from '../../domain/liuyao';
import { ElementText } from './ElementText';

const PILLARS: readonly [PillarKind, string][] = [
  ['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱'],
];

export function PillarGrid({ calendar }: { calendar: CalendarSnapshot }) {
  return (
    <section className="pillar-section" aria-label="年月日时四柱">
      <div className="pillar-grid">
        {PILLARS.map(([kind, label]) => {
          const pillar = calendar.pillars[kind];
          return (
            <article className="pillar-card" key={kind}>
              <h3>{label}</h3>
              <div className="pillar-ganzhi">
                <ElementText value={pillar.stem.value} element={pillar.stem.element} />
                <ElementText value={pillar.branch.value} element={pillar.branch.element} />
              </div>
              <p>{pillar.ganZhi}</p><span>{pillar.xun}</span>
              <span>旬空 {pillar.voidBranches.join('、')}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
