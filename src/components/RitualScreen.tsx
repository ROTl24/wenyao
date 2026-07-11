import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { CoinRigHandle } from '../features/ritual/CoinRig';
import type { DivinationSession } from '../lib/session';
import { HexagramLines } from './HexagramLines';

const CoinScene = lazy(() => import('./CoinScene'));

const lineNames = ['第一爻', '第二爻', '第三爻', '第四爻', '第五爻', '第六爻'];

interface Props { session: DivinationSession; onConfirm(): void }

export function RitualScreen({ session, onConfirm }: Props) {
  const current = session.currentToss!;
  const [settledTossId, setSettledTossId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const rigRef = useRef<CoinRigHandle | null>(null);
  const settled = settledTossId === current.id;
  const settledRef = useRef(settled);
  settledRef.current = settled;
  const handleRigReady = useCallback((rig: CoinRigHandle) => {
    rigRef.current = rig;
    if (settledRef.current) rig.snapToEnd();
  }, []);
  useEffect(() => {
    setSettledTossId(null);
    setOpened(false);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const openTimer = window.setTimeout(() => setOpened(true), reduced ? 20 : session.tosses.length === 0 ? 680 : 380);
    const settleTimer = window.setTimeout(() => setSettledTossId(current.id), reduced ? 180 : session.tosses.length === 0 ? 2550 : 1750);
    return () => { window.clearTimeout(openTimer); window.clearTimeout(settleTimer); };
  }, [current.id, session.tosses.length]);
  useEffect(() => {
    if (settled) rigRef.current?.snapToEnd();
  }, [settled]);
  const confirmedBits = session.tosses.map((toss) => toss.baseYang);
  const displayBits = [...Array(6)].map((_, index) => confirmedBits[index] ?? false).reverse();
  return (
    <main className="ritual-screen">
      <div className="ritual-heading">
        <h1>{lineNames[current.lineIndex - 1]}</h1>
        <p>{current.lineIndex === 1 ? '凝神片刻，观三钱落定' : `已定 ${session.tosses.length} 爻，继续自下而上成卦`}</p>
      </div>
      <button className="ritual-stage" type="button" onClick={() => { setOpened(true); setSettledTossId(current.id); }} aria-label="起卦动画，点击可直接查看结果">
        <div className={opened ? 'ink-hands ink-hands--open' : 'ink-hands ink-hands--closed'} aria-hidden="true" />
        <Suspense fallback={<div className="coin-scene-loading">正在唤醒铜钱…</div>}>
          <CoinScene
            active={!settled}
            faces={current.faces}
            lineIndex={current.lineIndex}
            onRigReady={handleRigReady}
            tossId={current.id}
            visualSeed={current.visualSeed}
          />
        </Suspense>
        <div className="paper-vignette" />
      </button>
      <div className="coin-accessible-results">
        {current.faces.map((face, index) => (
          <span key={index} aria-label={`乾隆古币 ${index + 1}：${face === 'text' ? '汉字面' : '背面'}`}>
            {settled ? (face === 'text' ? '字' : '背') : '旋'}
          </span>
        ))}
      </div>
      <div className="line-result" aria-live="polite">
        {settled ? <><strong>{current.label}</strong><span>{current.faces.filter((face) => face === 'text').length} 字 · {current.faces.filter((face) => face === 'reverse').length} 背</span></> : <><strong>铜钱翻滚中</strong><span>点击画面可略过动画</span></>}
      </div>
      <aside className="casting-progress">
        <span className="progress-title">六爻进度</span>
        <HexagramLines lines={displayBits} moving={session.tosses.filter((toss) => toss.moving).map((toss) => toss.lineIndex)} compact />
        <span>{session.tosses.length} / 6</span>
      </aside>
      <button className="primary-ink-button ritual-confirm" type="button" disabled={!settled} onClick={onConfirm}>定此爻</button>
    </main>
  );
}
