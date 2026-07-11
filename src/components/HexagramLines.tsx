import type { PlateLine } from '../lib/divination';

interface Props {
  lines: readonly boolean[];
  moving?: readonly number[];
  compact?: boolean;
}

export function HexagramLines({ lines, moving = [], compact = false }: Props) {
  return (
    <div className={`hexagram-lines ${compact ? 'hexagram-lines--compact' : ''}`} aria-label="六爻卦象">
      {[...lines].map((yang, visualIndex) => {
        const lineNumber = lines.length - visualIndex;
        return (
          <div className={`hex-line ${moving.includes(lineNumber) ? 'hex-line--moving' : ''}`} key={lineNumber}>
            {yang ? <span className="yang-line" /> : <><span className="yin-line" /><span className="yin-line" /></>}
          </div>
        );
      })}
    </div>
  );
}
