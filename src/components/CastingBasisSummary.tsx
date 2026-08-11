import { CASTING_METHOD_LABELS, type CastingBasis } from '../lib/casting';
import { formatShanghaiDateTime } from '../lib/shanghaiTime';

interface Props {
  basis: CastingBasis;
}

export function CastingBasisSummary({ basis }: Props) {
  if (basis.kind !== 'time') {
    return (
      <div className="casting-basis-summary casting-basis-summary--compact">
        <span>成卦来源</span>
        <strong>{CASTING_METHOD_LABELS[basis.kind]}</strong>
      </div>
    );
  }

  const { calendar } = basis;
  return (
    <section className="casting-basis-summary" aria-label="时间起卦依据">
      <header>
        <span>时间起卦依据</span>
        <strong>梅花年月日时法</strong>
      </header>
      <dl>
        <div>
          <dt>起念时刻</dt>
          <dd>{formatShanghaiDateTime(new Date(basis.castAt))}</dd>
        </div>
        <div>
          <dt>传统历日</dt>
          <dd>{calendar.traditionalDate} · {calendar.lunarLabel}{calendar.leapMonth ? '（闰月）' : ''}</dd>
        </div>
        <div>
          <dt>年月日时数</dt>
          <dd>{calendar.numbers.year} + {calendar.numbers.month} + {calendar.numbers.day} + {calendar.numbers.hour}</dd>
        </div>
        <div>
          <dt>成卦</dt>
          <dd>上卦数 {basis.upperTrigramNumber} · 下卦数 {basis.lowerTrigramNumber} · 第 {basis.movingLine} 爻动</dd>
        </div>
      </dl>
      <p>规则：北京时间，子初 23:00 换日，闰月沿用本月数字，同一时辰内卦象相同。</p>
    </section>
  );
}
