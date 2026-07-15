import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { DivinationSession } from '../lib/session';

const CoinScene = lazy(() => import('./CoinScene'));

const lineNames = ['第一爻', '第二爻', '第三爻', '第四爻', '第五爻', '第六爻'];
const linePositions = ['上', '五', '四', '三', '二', '初'];

type RitualPhase = 'gathering' | 'casting' | 'settling' | 'revealed';

interface RitualSequence {
  tossId: string;
  phase: RitualPhase;
}

interface Props { session: DivinationSession; onConfirm(): void }

export function RitualScreen({ session, onConfirm }: Props) {
  const current = session.currentToss!;
  const [sequence, setSequence] = useState<RitualSequence>(() => ({
    tossId: current.id,
    phase: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'revealed' : 'gathering',
  }));
  const phase = sequence.tossId === current.id ? sequence.phase : 'gathering';

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setSequence({ tossId: current.id, phase: reducedMotion ? 'revealed' : 'gathering' });
    if (reducedMotion) return;

    const isFirstLine = session.tosses.length === 0;
    const castingTimer = window.setTimeout(() => {
      setSequence((value) => value.tossId === current.id && value.phase === 'gathering'
        ? { ...value, phase: 'casting' }
        : value);
    }, isFirstLine ? 560 : 320);
    return () => {
      window.clearTimeout(castingTimer);
    };
  }, [current.id, session.tosses.length]);

  const handleSettling = useCallback(() => {
    setSequence((value) => value.tossId === current.id && value.phase === 'casting'
      ? { ...value, phase: 'settling' }
      : value);
  }, [current.id]);

  const handleSettled = useCallback(() => {
    setSequence((value) => value.tossId === current.id && (value.phase === 'casting' || value.phase === 'settling')
      ? { ...value, phase: 'revealed' }
      : value);
  }, [current.id]);
  const textCount = current.faces.filter((face) => face === 'text').length;
  const reverseCount = current.faces.length - textCount;
  const phaseCopy = phase === 'gathering'
    ? { name: '敛息', title: '掌心蓄势', detail: '三枚铜钱正向盘心聚拢' }
    : phase === 'casting'
      ? { name: '抛钱', title: '三钱翻飞入盘', detail: '铜钱正以各自的轨迹旋转下落' }
      : phase === 'settling'
        ? { name: '听钱', title: '静候铜声止息', detail: '三钱正在瓷盘中碰撞、翻滚并落稳' }
        : { name: '成爻', title: current.label, detail: `${textCount} 字 ${reverseCount} 背 · 钱象已定` };

  return (
    <main className={`ritual-screen ritual-screen--${phase}`} data-phase={phase}>
      <section className="ritual-intro">
        <div className="ritual-order" aria-label={`当前为${lineNames[current.lineIndex - 1]}`}>
          <span>{String(current.lineIndex).padStart(2, '0')}</span>
          <i aria-hidden="true" />
        </div>
        <h1 id="ritual-line-title">{lineNames[current.lineIndex - 1]}</h1>
        <p>{current.lineIndex === 1 ? '由初爻起，自下而上观六次钱象。' : `已有 ${session.tosses.length} 爻归位，继续向上成卦。`}</p>
      </section>

      <section className="ritual-stage" aria-labelledby="ritual-line-title" aria-describedby="ritual-status">
        <div className="ritual-stage-vignette" aria-hidden="true">
          <span className="ritual-halo ritual-halo--ink" />
          <span className="ritual-halo ritual-halo--cinnabar" />
          <span className="ritual-stage-ring" />
        </div>
        <Suspense fallback={<div className="coin-scene-loading">三钱入盘</div>}>
          <CoinScene
            key={current.id}
            faces={current.faces}
            phase={phase}
            visualSeed={current.visualSeed}
            onSettling={handleSettling}
            onSettled={handleSettled}
          />
        </Suspense>
        <span className="ritual-stage-caption">
          {phase === 'gathering' ? '蓄势' : phase === 'casting' ? '翻飞' : phase === 'settling' ? '落定中' : '近观钱象'}
        </span>
      </section>

      <aside className="casting-progress">
        <header>
          <span>六爻成象</span>
          <strong>{session.tosses.length}<small>/6</small></strong>
        </header>
        <div className="casting-lines" aria-label={`已完成 ${session.tosses.length} 爻，共 6 爻`}>
          {linePositions.map((position, visualIndex) => {
            const lineIndex = 6 - visualIndex;
            const confirmed = session.tosses[lineIndex - 1];
            const isCurrent = lineIndex === current.lineIndex;
            const visibleLine = confirmed ?? (isCurrent && phase === 'revealed' ? current : undefined);
            const state = visibleLine ? (visibleLine.baseYang ? 'yang' : 'yin') : 'empty';
            return (
              <div className={`casting-line casting-line--${state}${isCurrent ? ' casting-line--current' : ''}${visibleLine?.moving ? ' casting-line--moving' : ''}`} key={lineIndex} aria-label={`${position}爻：${visibleLine?.label ?? (isCurrent ? '正在起卦' : '未成')}`}>
                <span className="casting-line-index">{position}</span>
                <span className="casting-line-symbol" aria-hidden="true"><i /><i /></span>
                <span className="casting-line-state">{visibleLine?.label ?? (isCurrent ? phaseCopy.name : '')}</span>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="ritual-outcome" id="ritual-status" aria-live="polite">
        <span className="ritual-phase-name">{phaseCopy.name}</span>
        <div className={`ritual-line-mark ritual-line-mark--${current.baseYang ? 'yang' : 'yin'}`} aria-hidden="true"><i /><i /></div>
        <div className="ritual-outcome-copy">
          <strong>{phaseCopy.title}</strong>
          <span>{phaseCopy.detail}</span>
        </div>
        <div className="coin-accessible-results">
          {current.faces.map((face, index) => (
            <span key={index} aria-label={`乾隆古币 ${index + 1}：${face === 'text' ? '汉字面' : '背面'}`}>
              {phase === 'revealed' ? (face === 'text' ? '字' : '背') : '旋'}
            </span>
          ))}
        </div>
        <button className="ritual-confirm" type="button" disabled={phase !== 'revealed'} onClick={onConfirm}>
          {phase === 'revealed' ? '定此爻' : '待钱象落定'}
        </button>
      </section>
    </main>
  );
}
