import { entityRefKey, type DerivedFact } from '../../domain/liuyao';

const AUTHORITY_LABELS = {
  structural: '结构事实',
  'profile-dependent': '规则口径事实',
  secondary: '辅助参考事实',
} as const;

const RELATION_LABELS: Readonly<Record<string, string>> = {
  generates: '生', controls: '克', clashes: '冲', combines: '合', punishes: '刑', harms: '害', breaks: '破',
  'returns-generate': '回头生', 'returns-control': '回头克', 'returns-clash': '回头冲', 'returns-combine': '回头合',
  advances: '进神', retreats: '退神', 'is-source-spirit': '元神', 'is-avoid-spirit': '忌神', 'is-enemy-spirit': '仇神',
};

export function FactExplorer({ factsByAuthority }: { factsByAuthority: Readonly<Record<keyof typeof AUTHORITY_LABELS, readonly DerivedFact[]>> }) {
  return (
    <section className="fact-explorer">
      <div className="section-title"><i />事实关系浏览</div>
      {(Object.keys(AUTHORITY_LABELS) as Array<keyof typeof AUTHORITY_LABELS>).map((authority) => (
        <details key={authority}>
          <summary>{AUTHORITY_LABELS[authority]} <span>{factsByAuthority[authority].length}</span></summary>
          <div className="fact-list">{factsByAuthority[authority].map((fact) => (
            <details className="fact-card" key={fact.id}>
              <summary><strong>{RELATION_LABELS[fact.relation] ?? fact.relation}</strong><span>{entityRefKey(fact.source)}{fact.target ? ` → ${entityRefKey(fact.target)}` : ''}</span></summary>
              <p>规则 {fact.ruleId} · Profile {fact.profileId} · {fact.certainty}</p>
              {Object.keys(fact.values).length > 0 && <p>取值：{JSON.stringify(fact.values)}</p>}
              {fact.conditions.length > 0 && <p>条件：{fact.conditions.join('、')}</p>}
              {fact.sourceRefs.length > 0 && <p>来源：{fact.sourceRefs.join('、')}</p>}
            </details>
          ))}</div>
        </details>
      ))}
    </section>
  );
}
