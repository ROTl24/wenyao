import type { Toss } from '../lib/divination';

const linePositions = ['上', '五', '四', '三', '二', '初'];

interface Props {
  confirmed: readonly Toss[];
  currentLineIndex?: number;
  preview?: Toss;
  currentStateLabel?: string;
}

export function CastingProgress({
  confirmed,
  currentLineIndex,
  preview,
  currentStateLabel = '',
}: Props) {
  return (
    <aside className="casting-progress">
      <header>
        <span>六爻成象</span>
        <strong>{confirmed.length}<small>/6</small></strong>
      </header>
      <div className="casting-lines" aria-label={`已完成 ${confirmed.length} 爻，共 6 爻`}>
        {linePositions.map((position, visualIndex) => {
          const lineIndex = 6 - visualIndex;
          const recorded = confirmed[lineIndex - 1];
          const isCurrent = lineIndex === currentLineIndex;
          const visibleLine = recorded ?? (isCurrent ? preview : undefined);
          const state = visibleLine ? (visibleLine.baseYang ? 'yang' : 'yin') : 'empty';
          return (
            <div
              className={`casting-line casting-line--${state}${isCurrent ? ' casting-line--current' : ''}${visibleLine?.moving ? ' casting-line--moving' : ''}`}
              key={lineIndex}
              aria-label={`${position}爻：${visibleLine?.label ?? (isCurrent ? '正在起卦' : '未成')}`}
            >
              <span className="casting-line-index">{position}</span>
              <span className="casting-line-symbol" aria-hidden="true"><i /><i /></span>
              <span className="casting-line-state">{visibleLine?.label ?? (isCurrent ? currentStateLabel : '')}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
