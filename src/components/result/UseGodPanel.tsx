import type { DivinationCaseV2, UseGodCandidate, UseGodClarificationPatch, UseGodEntityRef } from '../../domain/liuyao';

function entityLabel(caseSnapshot: DivinationCaseV2, entity: UseGodEntityRef): string {
  if (entity.type === 'line') {
    const line = caseSnapshot.plate.lines.find((candidate) => candidate.id === entity.id);
    return line ? `${['初', '二', '三', '四', '五', '上'][line.position - 1]}爻·${entity.side === 'base' ? '本卦' : '变卦'}` : entity.id;
  }
  for (const line of caseSnapshot.plate.lines) {
    const hidden = line.hiddenSpiritCandidates.find((candidate) => candidate.id === entity.id);
    if (hidden) return `伏神·${['初', '二', '三', '四', '五', '上'][line.position - 1]}爻宿主`;
  }
  return entity.id;
}

function Candidate({ candidate, caseSnapshot }: { candidate: UseGodCandidate; caseSnapshot: DivinationCaseV2 }) {
  return <li><strong>{candidate.relation}</strong><span>{entityLabel(caseSnapshot, candidate.entity)}</span><small>{candidate.candidateSource} · {candidate.certainty}</small></li>;
}

export function UseGodPanel({ caseSnapshot, onSelectIntent }: {
  caseSnapshot: DivinationCaseV2;
  onSelectIntent(patch: UseGodClarificationPatch): void;
}) {
  const selection = caseSnapshot.useGod;
  if (selection.status === 'needs-user-input') {
    return (
      <section className="use-god-panel use-god-panel--needs">
        <div className="section-title"><i />用神取用</div>
        <strong>需要补充具体占问事项</strong><p>{selection.clarification.prompt}</p>
        <div className="intent-options">{selection.clarification.options.map((option) => <button type="button" key={option.id} onClick={() => onSelectIntent(option.patch)}>{option.label}</button>)}</div>
        <small>未完成澄清前，不将“学业、功名”等事项标签误当作父母、官鬼等用神。</small>
      </section>
    );
  }
  return (
    <section className="use-god-panel">
      <div className="section-title"><i />用神取用</div>
      <p>事项：{selection.intent.label}</p><p>状态：{selection.status} · 模式：{selection.selectionMode}</p>
      {selection.status === 'resolved' && selection.selectionMode === 'single' && <strong>已定用神：{selection.primary.relation} · {entityLabel(caseSnapshot, selection.primary.entity)}</strong>}
      {selection.status === 'resolved' && selection.selectionMode === 'shi-ying-pair' && <strong>采用世应双端观察，不设单一用神</strong>}
      {selection.status === 'unresolved' && <strong>当前未找到符合规则的用神候选</strong>}
      {selection.status === 'ambiguous' && <strong>保留全部同层候选，不自动选择</strong>}
      {'candidates' in selection && selection.candidates.length > 0 && <ul>{selection.candidates.map((candidate) => <Candidate key={`${candidate.entity.type}:${candidate.entity.id}`} candidate={candidate} caseSnapshot={caseSnapshot} />)}</ul>}
    </section>
  );
}
