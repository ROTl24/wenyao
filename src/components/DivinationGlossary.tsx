const terms = [
  ['世爻与应爻', '世爻通常用来观察问卦者自身，应爻通常对应对方或外部环境。具体指代要结合所问之事。'],
  ['用神', '按问题选取的主要观察对象，通常从六亲中确定。不同问题可能取不同用神。'],
  ['旬空', '起卦日所在的十日周期中，有两个地支不在其中，称为旬空。空亡需要结合旺衰、动变与时间条件判断。'],
  ['动爻与变卦', '老阴、老阳是动爻，会变成相反的阴阳；将动爻变化后得到变卦，用来观察变化线索。'],
  ['六亲', '父母、兄弟、子孙、妻财、官鬼，是按五行生克建立的关系名称。它们的具体含义取决于问题，不只指家庭关系。'],
] as const;

export function DivinationGlossary() {
  return <details className="divination-glossary"><summary>看不懂术语？查看入门解释</summary><div>{terms.map(([term, explanation]) => <details key={term}><summary>{term}</summary><p>{explanation}</p></details>)}</div></details>;
}
