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
  snapRitualTargetsToEnd,
  type RitualTimelineController,
  type RitualTimelinePhase,
  type RitualTimelineTargets,
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

interface CommittedRitual {
  readonly tossId: string;
  readonly lineIndex: number;
  readonly onReady: UseRitualControllerOptions['onReady'];
  readonly onPhase: UseRitualControllerOptions['onPhase'];
}

interface TargetIdentity {
  readonly tossId: string;
  readonly hands: InkHandsTargets;
  readonly rig: CoinRigHandle;
}

interface OwnedController extends TargetIdentity {
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

const PHASE_RANK: Readonly<Record<RitualPhase, number>> = {
  'awaiting-scene': 0,
  held: 1,
  release: 2,
  airborne: 3,
  landing: 4,
  reveal: 5,
  ready: 6,
  confirming: 7,
};

function initialReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function sameTargets(owned: TargetIdentity, hands: InkHandsTargets, rig: CoinRigHandle): boolean {
  return owned.hands === hands && owned.rig === rig;
}

export function useRitualController({
  toss,
  lineIndex,
  onReady,
  onPhase,
}: UseRitualControllerOptions): UseRitualControllerResult {
  const tossId = toss.id;
  const [reducedMotion, setReducedMotion] = useState(initialReducedMotion);
  const [handsBinding, setHandsBinding] = useState<HandsBinding | null>(null);
  const [rigBinding, setRigBinding] = useState<RigBinding | null>(null);
  const [phaseSnapshot, setPhaseSnapshot] = useState<PhaseSnapshot>({
    tossId,
    phase: 'awaiting-scene',
  });

  // These refs describe committed UI only. They are never assigned during render.
  const committedRef = useRef<CommittedRitual>({ tossId, lineIndex, onReady, onPhase });
  const phaseRef = useRef<PhaseSnapshot>(phaseSnapshot);
  const controllerRef = useRef<OwnedController | null>(null);
  const finishRequestedRef = useRef<string | null>(null);
  const readyNotifiedRef = useRef<string | null>(null);
  const lastSnappedTargetsRef = useRef<TargetIdentity | null>(null);
  const previousReducedMotionRef = useRef(reducedMotion);

  const commitPhase = useCallback((ownedTossId: string, phase: RitualPhase): void => {
    const committed = committedRef.current;
    if (committed.tossId !== ownedTossId) return;
    const current = phaseRef.current;
    if (
      current.tossId === ownedTossId
      && PHASE_RANK[phase] < PHASE_RANK[current.phase]
    ) return;

    const next = { tossId: ownedTossId, phase };
    phaseRef.current = next;
    setPhaseSnapshot(next);
    committed.onPhase?.(phase, ownedTossId);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    setReducedMotion(media.matches);
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, []);

  // Commit identity and callback ownership before passive child ready notifications run.
  useLayoutEffect(() => {
    const previousTossId = committedRef.current.tossId;
    committedRef.current = { tossId, lineIndex, onReady, onPhase };
    if (previousTossId === tossId) return;

    const awaiting: PhaseSnapshot = { tossId, phase: 'awaiting-scene' };
    phaseRef.current = awaiting;
    setPhaseSnapshot(awaiting);
    lastSnappedTargetsRef.current = null;
  }, [lineIndex, onPhase, onReady, tossId]);

  const onHandsReady = useCallback((targets: InkHandsTargets | null): void => {
    if (targets) {
      if (committedRef.current.tossId !== tossId) return;
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
    if (readyTossId !== committedRef.current.tossId) return;
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
    const committed = committedRef.current;
    if (
      committed.tossId !== tossId
      || handsBinding?.tossId !== tossId
      || rigBinding?.tossId !== tossId
    ) return;

    const hands = handsBinding.targets;
    const rig = rigBinding.rig;
    const currentPhase = phaseRef.current.tossId === tossId
      ? phaseRef.current.phase
      : 'awaiting-scene';
    const existing = controllerRef.current?.tossId === tossId
      ? controllerRef.current
      : null;

    if (currentPhase === 'ready' || currentPhase === 'confirming') {
      const snapped = lastSnappedTargetsRef.current;
      if (!snapped || !sameTargets(snapped, hands, rig)) {
        snapRitualTargetsToEnd({ ...hands, coinRig: rig });
        lastSnappedTargetsRef.current = { tossId, hands, rig };
      }
      return;
    }

    if (existing && sameTargets(existing, hands, rig)) return;

    const resumeProgress = existing?.controller.getProgress() ?? 0;
    if (existing) {
      existing.ownership.active = false;
      existing.controller.kill();
      controllerRef.current = null;
    }

    const ownership = { active: true };
    const targets: RitualTimelineTargets = { ...hands, coinRig: rig };
    const controller = createRitualTimeline(targets, {
      firstLine: committed.lineIndex === 1,
      reducedMotion,
      onPhase: (phase: RitualTimelinePhase) => {
        if (ownership.active) commitPhase(tossId, phase);
      },
      onComplete: () => {
        if (!ownership.active || committedRef.current.tossId !== tossId) return;
        lastSnappedTargetsRef.current = { tossId, hands, rig };
        commitPhase(tossId, 'ready');
      },
    });
    controllerRef.current = { tossId, hands, rig, controller, ownership };

    const migrating = existing !== null;
    if (!migrating && currentPhase === 'awaiting-scene') commitPhase(tossId, 'held');
    if (readyNotifiedRef.current !== tossId) {
      readyNotifiedRef.current = tossId;
      committedRef.current.onReady?.(tossId);
    }

    if (migrating) controller.seekProgress(resumeProgress);
    if (finishRequestedRef.current === tossId) controller.finish();
    else controller.play();
  }, [commitPhase, handsBinding, lineIndex, reducedMotion, rigBinding, tossId]);

  useLayoutEffect(() => {
    const wasReduced = previousReducedMotionRef.current;
    previousReducedMotionRef.current = reducedMotion;
    if (wasReduced || !reducedMotion) return;

    const committedTossId = committedRef.current.tossId;
    const owned = controllerRef.current;
    if (
      owned?.tossId === committedTossId
      && phaseRef.current.phase !== 'ready'
      && phaseRef.current.phase !== 'confirming'
    ) {
      owned.controller.finish();
    }
  }, [reducedMotion]);

  const skip = useCallback((): void => {
    if (committedRef.current.tossId !== tossId) return;
    const owned = controllerRef.current;
    if (owned?.tossId === tossId) owned.controller.finish();
    else finishRequestedRef.current = tossId;
  }, [tossId]);

  const tryConfirm = useCallback((): string | null => {
    if (
      committedRef.current.tossId !== tossId
      || phaseRef.current.tossId !== tossId
      || phaseRef.current.phase !== 'ready'
    ) return null;
    commitPhase(tossId, 'confirming');
    return tossId;
  }, [commitPhase, tossId]);

  const getProgress = useCallback((): number => {
    if (committedRef.current.tossId !== tossId) return 0;
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
