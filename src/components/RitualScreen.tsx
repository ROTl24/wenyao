import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  InkHands,
  useRitualController,
  type CoinRigHandle,
  type RitualPhase,
} from '../features/ritual';
import type { CoinFace } from '../lib/divination';
import type { DivinationSession, PreparedToss } from '../lib/session';
import { HexagramLines } from './HexagramLines';

const coinSceneModule = import('./CoinScene');
const CoinScene = lazy(() => coinSceneModule);

const lineNames = ['第一爻', '第二爻', '第三爻', '第四爻', '第五爻', '第六爻'];

const stageLabels: Readonly<Record<RitualPhase, string>> = {
  'awaiting-scene': '起卦动画正在准备，点击可在资源就绪后直接查看结果',
  held: '起卦动画已开始，点击可直接查看结果',
  release: '起卦动画正在释钱，点击可直接查看结果',
  airborne: '起卦动画中铜钱正在翻飞，点击可直接查看结果',
  landing: '起卦动画中铜钱正在落定，点击可直接查看结果',
  reveal: '起卦动画正在揭示结果，点击可直接查看结果',
  ready: '起卦动画已落定，可确认此爻',
  confirming: '起卦动画结果正在确认',
};

interface Props {
  session: DivinationSession;
  onConfirm(expectedTossId: string): void;
}

interface SceneBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  resetKey: string;
}

interface SceneBoundaryState {
  failed: boolean;
}

class CoinSceneErrorBoundary extends Component<SceneBoundaryProps, SceneBoundaryState> {
  state: SceneBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('CoinScene failed; using the static ritual fallback.', error, info);
  }

  componentDidUpdate(previous: SceneBoundaryProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface StaticCoinFallbackProps {
  toss: PreparedToss;
  notice: string;
  onRigReady(rig: CoinRigHandle): void;
}

function staticFaceLabel(face: CoinFace): string {
  return face === 'text' ? '字' : '背';
}

function StaticCoinFallback({ toss, notice, onRigReady }: StaticCoinFallbackProps) {
  const coinRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rig = useMemo<CoinRigHandle>(() => {
    const setVisible = (visible: boolean) => {
      coinRefs.current.forEach((coin) => {
        if (coin) coin.style.visibility = visible ? 'visible' : 'hidden';
      });
    };
    const setProgress = (progress: number) => {
      const normalized = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
      coinRefs.current.forEach((coin, index) => {
        if (!coin) return;
        coin.dataset.progress = normalized.toFixed(3);
        coin.style.transform = `rotateY(${(1 - normalized) * 540}deg) scale(${0.88 + normalized * 0.12})`;
        const label = coin.querySelector('b');
        if (label) label.textContent = normalized >= 1 ? staticFaceLabel(toss.faces[index]) : '旋';
      });
    };
    return {
      prepare: () => {
        setVisible(false);
        setProgress(0);
      },
      setProgress,
      setVisible,
      snapToEnd: () => {
        setVisible(true);
        setProgress(1);
      },
      invalidate: () => undefined,
    };
  }, [toss.faces]);

  useEffect(() => {
    rig.prepare({
      tossId: toss.id,
      visualSeed: toss.visualSeed,
      faces: toss.faces,
      lineIndex: toss.lineIndex,
    });
    onRigReady(rig);
  }, [onRigReady, rig, toss]);

  return (
    <div className="coin-static-fallback" data-toss-id={toss.id}>
      <span className="coin-static-fallback__notice" role="status">
        {notice}
      </span>
      <div aria-hidden="true" className="coin-static-fallback__coins">
        {toss.faces.map((_, index) => (
          <span
            data-progress="0.000"
            key={index}
            ref={(node) => { coinRefs.current[index] = node; }}
            style={{ visibility: 'hidden' }}
          >
            <i />
            <b>旋</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function RitualScreen({ session, onConfirm }: Props) {
  const current = session.currentToss!;
  const controller = useRitualController({
    toss: current,
    lineIndex: current.lineIndex,
  });
  const handleRigReady = useCallback((rig: CoinRigHandle) => {
    controller.bindRig(current.id, rig);
  }, [controller.bindRig, current.id]);
  const handleConfirm = useCallback(() => {
    const expectedTossId = controller.tryConfirm();
    if (expectedTossId !== null) onConfirm(expectedTossId);
  }, [controller.tryConfirm, onConfirm]);
  const revealed = controller.phase === 'ready' || controller.phase === 'confirming';
  const confirmedBits = session.tosses.map((toss) => toss.baseYang);
  const displayBits = [...Array(6)].map((_, index) => confirmedBits[index] ?? false).reverse();
  const textFaces = current.faces.filter((face) => face === 'text').length;
  const reverseFaces = current.faces.length - textFaces;

  return (
    <main className="ritual-screen" data-phase={controller.phase}>
      <div className="ritual-heading">
        <h1>{lineNames[current.lineIndex - 1]}</h1>
        <p>{current.lineIndex === 1 ? '凝神片刻，观三钱落定' : `已定 ${session.tosses.length} 爻，继续自下而上成卦`}</p>
      </div>
      <button
        aria-label={stageLabels[controller.phase]}
        className="ritual-stage"
        data-phase={controller.phase}
        onClick={controller.skip}
        type="button"
      >
        <InkHands
          firstLine={current.lineIndex === 1}
          onReady={controller.onHandsReady}
          reducedMotion={controller.reducedMotion}
        />
        <CoinSceneErrorBoundary
          fallback={(
            <StaticCoinFallback
              notice="3D 铜钱不可用，已切换静态铜钱模式"
              onRigReady={handleRigReady}
              toss={current}
            />
          )}
          resetKey={current.id}
        >
          <Suspense
            fallback={(
              <StaticCoinFallback
                notice="正在唤醒 3D 铜钱，暂以静态铜钱起卦"
                onRigReady={handleRigReady}
                toss={current}
              />
            )}
          >
            <CoinScene
              active={controller.active}
              faces={current.faces}
              lineIndex={current.lineIndex}
              onRigReady={handleRigReady}
              tossId={current.id}
              visualSeed={current.visualSeed}
            />
          </Suspense>
        </CoinSceneErrorBoundary>
        <div className="paper-vignette" />
      </button>
      <div aria-label="本爻三枚铜钱结果" className="coin-accessible-results">
        {current.faces.map((face, index) => (
          <span
            aria-label={revealed
              ? `乾隆古币 ${index + 1}：${face === 'text' ? '汉字面' : '背面'}`
              : `乾隆古币 ${index + 1}：尚未落定`}
            key={index}
          >
            {revealed ? staticFaceLabel(face) : '旋'}
          </span>
        ))}
      </div>
      <div aria-live="polite" className="line-result">
        <strong>{revealed ? current.label : controller.phase === 'awaiting-scene' ? '正在准备场景' : '铜钱翻滚中'}</strong>
        <span>{revealed ? `${textFaces} 字 · ${reverseFaces} 背` : '点击画面可略过动画'}</span>
      </div>
      <aside className="casting-progress">
        <span className="progress-title">六爻进度</span>
        <HexagramLines
          compact
          lines={displayBits}
          moving={session.tosses.filter((toss) => toss.moving).map((toss) => toss.lineIndex)}
        />
        <span>{session.tosses.length} / 6</span>
      </aside>
      <div className="ritual-confirm-slot">
        <button
          className="primary-ink-button ritual-confirm"
          disabled={!controller.confirmable}
          onClick={handleConfirm}
          type="button"
        >
          定此爻
        </button>
      </div>
    </main>
  );
}
