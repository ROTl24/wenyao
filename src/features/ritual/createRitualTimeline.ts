import { gsap } from 'gsap';
import type { CoinRigHandle } from './CoinRig';
import type { RitualPhase } from './ritualMachine';
import {
  REDUCED_MOTION_DURATION,
  ritualTimingFor,
} from './ritualTiming';

export type RitualTimelineLabel =
  | 'start'
  | 'inkCover'
  | 'release'
  | 'coinsAirborne'
  | 'firstImpact'
  | 'lastImpact'
  | 'settled'
  | 'reveal'
  | 'confirmable';

export type RitualTimelineLabels = Readonly<Record<RitualTimelineLabel, number>>;

export type RitualTimelinePhase = Extract<
  RitualPhase,
  'release' | 'airborne' | 'landing' | 'reveal'
>;

export interface RitualTimelineTargets {
  readonly root: HTMLElement;
  readonly closedHands: HTMLElement;
  readonly openHands: HTMLElement;
  readonly inkCover: HTMLElement;
  readonly coinRig: CoinRigHandle;
  setMediaProgress(progress: number): void;
}

export interface RitualTimelineOptions {
  readonly firstLine: boolean;
  readonly reducedMotion: boolean;
  onPhase?(phase: RitualTimelinePhase): void;
  onComplete?(): void;
}

export interface RitualTimelineController {
  play(): void;
  finish(): void;
  restart(): void;
  seek(position: RitualTimelineLabel | number): void;
  kill(): void;
  dispose(): void;
  getProgress(): number;
  getPlaybackDuration(): number;
  getLabels(): RitualTimelineLabels;
  isKilled(): boolean;
}

const INK_COVER_HOLD_SECONDS = 0.02;
const MAX_IMPACT_STAGGER_SECONDS = 0.28;
const FIRST_LINE_SETTLE_LEAD_SECONDS = 0.32;
const FIRST_IMPACT_PROGRESS = 0.72;
const ALL_IMPACTS_COMPLETE_PROGRESS = 0.88;

function seconds(value: number): number {
  return Number(value.toFixed(2));
}

export function ritualTimelineLabels(firstLine: boolean): RitualTimelineLabels {
  const timing = ritualTimingFor(firstLine ? 1 : 2);
  const lastImpact = seconds(timing.landingAt + MAX_IMPACT_STAGGER_SECONDS);
  const settled = firstLine
    ? seconds(timing.revealAt - FIRST_LINE_SETTLE_LEAD_SECONDS)
    : timing.revealAt;

  return {
    start: 0,
    inkCover: firstLine
      ? seconds(timing.releaseAt - INK_COVER_HOLD_SECONDS)
      : 0,
    release: timing.releaseAt,
    coinsAirborne: timing.airborneAt,
    firstImpact: timing.landingAt,
    lastImpact,
    settled,
    reveal: timing.revealAt,
    confirmable: timing.readyAt,
  };
}

function snapshotStyle(element: HTMLElement): string | null {
  return element.hasAttribute('style') ? element.getAttribute('style') : null;
}

function restoreStyle(element: HTMLElement, style: string | null): void {
  if (style === null) element.removeAttribute('style');
  else element.setAttribute('style', style);
}

export function createRitualTimeline(
  targets: RitualTimelineTargets,
  options: RitualTimelineOptions,
): RitualTimelineController {
  const labels = ritualTimelineLabels(options.firstLine);
  const originalStyles = new Map<HTMLElement, string | null>([
    [targets.closedHands, snapshotStyle(targets.closedHands)],
    [targets.openHands, snapshotStyle(targets.openHands)],
    [targets.inkCover, snapshotStyle(targets.inkCover)],
  ]);
  const coinProgress = { value: 0 };
  const mediaProgress = { value: 0 };
  const endMarker = { value: 0 };
  let killed = false;
  let completed = false;
  let timeline!: gsap.core.Timeline;

  targets.closedHands.style.opacity = options.firstLine ? '1' : '0';
  targets.openHands.style.opacity = options.firstLine ? '0' : '1';
  targets.inkCover.style.opacity = '0';

  const emitPhase = (phase: RitualTimelinePhase): void => {
    if (!killed) options.onPhase?.(phase);
  };
  const applyFinalState = (): void => {
    if (killed) return;
    targets.closedHands.style.opacity = '0';
    targets.openHands.style.opacity = '1';
    targets.inkCover.style.opacity = '0';
    targets.setMediaProgress(1);
    targets.coinRig.setProgress(1);
    targets.coinRig.invalidate();
  };
  const emitComplete = (): void => {
    if (killed || completed) return;
    completed = true;
    options.onComplete?.();
  };

  const context = gsap.context(() => {
    timeline = gsap.timeline({
      paused: true,
      onComplete: () => {
        applyFinalState();
        emitComplete();
      },
    });

    for (const [label, at] of Object.entries(labels)) {
      timeline.addLabel(label, at);
    }

    timeline.set(targets.closedHands, { opacity: options.firstLine ? 1 : 0 }, labels.start);
    timeline.set(targets.openHands, { opacity: options.firstLine ? 0 : 1 }, labels.start);
    timeline.set(targets.inkCover, { opacity: 0 }, labels.start);

    if (options.firstLine && !options.reducedMotion) {
      const coverDuration = 0.16;
      timeline.to(targets.inkCover, {
        duration: coverDuration,
        ease: 'power2.inOut',
        opacity: 1,
      }, labels.inkCover - coverDuration);
      // The two opaque stills are swapped only after the ink layer is fully opaque.
      timeline.set(targets.closedHands, { opacity: 0 }, labels.inkCover);
      timeline.set(targets.openHands, { opacity: 1 }, labels.inkCover);
      timeline.to(targets.inkCover, {
        duration: labels.coinsAirborne - labels.inkCover,
        ease: 'power2.out',
        opacity: 0,
      }, labels.inkCover);
    }

    timeline.call(() => emitPhase('release'), [], labels.release);
    timeline.call(() => emitPhase('airborne'), [], labels.coinsAirborne);
    timeline.call(() => emitPhase('landing'), [], labels.firstImpact);
    timeline.call(() => emitPhase('reveal'), [], labels.reveal);

    if (options.reducedMotion) {
      timeline.to(endMarker, {
        duration: labels.confirmable,
        ease: 'none',
        value: 1,
      }, labels.start);
    } else {
      timeline.set(coinProgress, { value: 0 }, labels.release);
      timeline.to(coinProgress, {
        duration: labels.firstImpact - labels.release,
        ease: 'power2.in',
        onUpdate: () => targets.coinRig.setProgress(coinProgress.value),
        value: FIRST_IMPACT_PROGRESS,
      }, labels.release);
      timeline.to(coinProgress, {
        duration: labels.lastImpact - labels.firstImpact,
        ease: 'none',
        onUpdate: () => targets.coinRig.setProgress(coinProgress.value),
        value: ALL_IMPACTS_COMPLETE_PROGRESS,
      }, labels.firstImpact);
      timeline.to(coinProgress, {
        duration: labels.settled - labels.lastImpact,
        ease: 'power3.out',
        onUpdate: () => targets.coinRig.setProgress(coinProgress.value),
        value: 1,
      }, labels.lastImpact);
      timeline.to(mediaProgress, {
        duration: labels.settled,
        ease: 'none',
        onUpdate: () => targets.setMediaProgress(mediaProgress.value),
        value: 1,
      }, labels.start);
      timeline.set(endMarker, { value: 1 }, labels.confirmable);
    }
  }, targets.root);

  targets.setMediaProgress(0);
  targets.coinRig.setProgress(0);
  timeline.seek(0, true).pause();
  if (options.reducedMotion) {
    timeline.timeScale(labels.confirmable / REDUCED_MOTION_DURATION);
  }

  const finishTimeline = (): void => {
    if (killed || completed) return;
    applyFinalState();
    timeline.pause().progress(1, false);
    emitComplete();
  };

  const kill = (): void => {
    if (killed) return;
    killed = true;
    timeline.kill();
    context.revert();
    for (const [element, style] of originalStyles) restoreStyle(element, style);
  };

  return {
    play() {
      if (killed) return;
      if (options.reducedMotion) finishTimeline();
      else timeline.play();
    },
    finish: finishTimeline,
    restart() {
      if (killed) return;
      timeline.restart();
      if (options.reducedMotion) applyFinalState();
    },
    seek(position) {
      if (killed) return;
      timeline.seek(position, false);
    },
    kill,
    dispose: kill,
    getProgress() {
      return timeline.progress();
    },
    getPlaybackDuration() {
      return options.reducedMotion ? REDUCED_MOTION_DURATION : labels.confirmable;
    },
    getLabels() {
      return { ...labels };
    },
    isKilled() {
      return killed;
    },
  };
}
