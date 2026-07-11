import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CoinRigHandle } from './CoinRig';
import type { InkHandsTargets } from './InkHands';
import {
  createRitualTimeline,
  type RitualTimelineController,
  type RitualTimelinePhase,
} from './createRitualTimeline';
import type { RitualPhase } from './ritualMachine';

export interface RitualControllerToss {
  readonly id: string;
}

export interface UseRitualControllerOptions {
  readonly toss: RitualControllerToss;
  readonly lineIndex: number;
  onReady?(tossId: string): void;
  onPhase?(phase: RitualPhase, tossId: string): void;
}

interface HandsBinding {
  readonly tossId: string;
  readonly targets: InkHandsTargets;
}

interface RigBinding {
  readonly tossId: string;
  readonly rig: CoinRigHandle;
}

interface PhaseSnapshot {
  readonly tossId: string;
  readonly phase: RitualPhase;
}

interface OwnedController {
  readonly tossId: string;
  readonly controller: RitualTimelineController;
  readonly ownership: { active: boolean };
}

export interface UseRitualControllerResult {
  readonly phase: RitualPhase;
  readonly confirmable: boolean;
  readonly active: boolean;
  readonly reducedMotion: boolean;
  onHandsReady(targets: InkHandsTargets | null): void;
  bindRig(tossId: string, rig: CoinRigHandle): void;
  skip(): void;
  tryConfirm(): string | null;
  getProgress(): number;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function initialReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useRitualController({
  toss,
  lineIndex,
  onReady,
  onPhase,
}: UseRitualControllerOptions): UseRitualControllerResult {
  const tossId = toss.id;
  const currentTossIdRef = useRef(tossId);
  currentTossIdRef.current = tossId;
  const onReadyRef = useRef(onReady);
  const onPhaseRef = useRef(onPhase);
  onReadyRef.current = onReady;
  onPhaseRef.current = onPhase;

  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [handsBinding, setHandsBinding] = useState<HandsBinding | null>(null);
  const [rigBinding, setRigBinding] = useState<RigBinding | null>(null);
  const [phaseSnapshot, setPhaseSnapshot] = useState<PhaseSnapshot>({
    tossId,
    phase: 'awaiting-scene',
  });
  const phaseRef = useRef<PhaseSnapshot>(phaseSnapshot);
  if (phaseRef.current.tossId !== tossId) {
    phaseRef.current = { tossId, phase: 'awaiting-scene' };
  }
  const controllerRef = useRef<OwnedController | null>(null);
  const finishRequestedRef = useRef<string | null>(null);
  const readyNotifiedRef = useRef<string | null>(null);
  const previousReducedMotionRef = useRef(reducedMotion);

  const commitPhase = useCallback((ownedTossId: string, phase: RitualPhase): void => {
    if (currentTossIdRef.current !== ownedTossId) return;
    const next = { tossId: ownedTossId, phase };
    phaseRef.current = next;
    setPhaseSnapshot(next);
    onPhaseRef.current?.(phase, ownedTossId);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(media.matches);
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  const onHandsReady = useCallback((targets: InkHandsTargets | null): void => {
    if (targets) {
      setHandsBinding((current) => (
        current?.tossId === tossId && current.targets === targets
          ? current
          : { tossId, targets }
      ));
      return;
    }
    setHandsBinding((current) => current?.tossId === tossId ? null : current);
  }, [tossId]);

  const bindRig = useCallback((readyTossId: string, rig: CoinRigHandle): void => {
    if (readyTossId !== currentTossIdRef.current) return;
    setRigBinding((current) => (
      current?.tossId === readyTossId && current.rig === rig
        ? current
        : { tossId: readyTossId, rig }
    ));
  }, []);

  useLayoutEffect(() => () => {
    const owned = controllerRef.current;
    if (owned?.tossId !== tossId) return;
    owned.ownership.active = false;
    owned.controller.kill();
    controllerRef.current = null;
  }, [tossId]);

  useLayoutEffect(() => {
    if (
      controllerRef.current?.tossId === tossId
      ||
      handsBinding?.tossId !== tossId
      || rigBinding?.tossId !== tossId
      || phaseRef.current.phase === 'ready'
      || phaseRef.current.phase === 'confirming'
    ) return;

    const createdTossId = tossId;
    const ownership = { active: true };
    const controller = createRitualTimeline(
      {
        ...handsBinding.targets,
        coinRig: rigBinding.rig,
      },
      {
        firstLine: lineIndex === 1,
        reducedMotion,
        onPhase: (phase: RitualTimelinePhase) => {
          if (ownership.active && currentTossIdRef.current === createdTossId) {
            commitPhase(createdTossId, phase);
          }
        },
        onComplete: () => {
          if (ownership.active && currentTossIdRef.current === createdTossId) {
            commitPhase(createdTossId, 'ready');
          }
        },
      },
    );
    controllerRef.current = { tossId: createdTossId, controller, ownership };

    if (phaseRef.current.phase === 'awaiting-scene') {
      commitPhase(createdTossId, 'held');
    }
    if (readyNotifiedRef.current !== createdTossId) {
      readyNotifiedRef.current = createdTossId;
      onReadyRef.current?.(createdTossId);
    }

    if (finishRequestedRef.current === createdTossId) controller.finish();
    else controller.play();
  }, [commitPhase, handsBinding, lineIndex, rigBinding, tossId]);

  useLayoutEffect(() => {
    const wasReduced = previousReducedMotionRef.current;
    previousReducedMotionRef.current = reducedMotion;
    if (wasReduced || !reducedMotion) return;

    const owned = controllerRef.current;
    if (
      owned?.tossId === tossId
      && phaseRef.current.phase !== 'ready'
      && phaseRef.current.phase !== 'confirming'
    ) {
      owned.controller.finish();
    }
  }, [reducedMotion, tossId]);

  const skip = useCallback((): void => {
    const owned = controllerRef.current;
    if (owned?.tossId === tossId) owned.controller.finish();
    else finishRequestedRef.current = tossId;
  }, [tossId]);

  const tryConfirm = useCallback((): string | null => {
    if (
      phaseRef.current.tossId !== tossId
      || phaseRef.current.phase !== 'ready'
    ) return null;
    commitPhase(tossId, 'confirming');
    return tossId;
  }, [commitPhase, tossId]);

  const getProgress = useCallback((): number => {
    const owned = controllerRef.current;
    return owned?.tossId === tossId ? owned.controller.getProgress() : 0;
  }, [tossId]);

  const phase = phaseSnapshot.tossId === tossId
    ? phaseSnapshot.phase
    : 'awaiting-scene';

  return {
    phase,
    confirmable: phase === 'ready',
    active: phase !== 'ready' && phase !== 'confirming',
    reducedMotion,
    onHandsReady,
    bindRig,
    skip,
    tryConfirm,
    getProgress,
  };
}
