import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_RITUAL_HANDS_MANIFEST,
  loadRitualHandsManifest,
  parseRitualHandsManifest,
  type RitualHandsManifest,
} from './ritualAssets';

export interface InkHandsTargets {
  readonly root: HTMLElement;
  readonly closedHands: HTMLElement;
  readonly openHands: HTMLElement;
  readonly inkCover: HTMLElement;
  setMediaProgress(progress: number): void;
}

export interface InkHandsProps {
  readonly firstLine: boolean;
  readonly manifest?: RitualHandsManifest;
  readonly reducedMotion?: boolean;
  readonly className?: string;
  onReady?(targets: InkHandsTargets | null): void;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
}

export function InkHands({
  firstLine,
  manifest,
  reducedMotion = false,
  className = '',
  onReady,
}: InkHandsProps) {
  const explicitManifest = useMemo(
    () => manifest === undefined ? null : parseRitualHandsManifest(manifest),
    [manifest],
  );
  const [runtimeManifest, setRuntimeManifest] = useState<RitualHandsManifest | null>(null);

  useEffect(() => {
    if (explicitManifest) return;
    let cancelled = false;
    setRuntimeManifest(null);
    void loadRitualHandsManifest().then((loaded) => {
      if (!cancelled) setRuntimeManifest(loaded);
    });
    return () => { cancelled = true; };
  }, [explicitManifest]);

  const resolvedManifest = explicitManifest ?? runtimeManifest;
  if (!resolvedManifest) {
    return (
      <div
        aria-hidden="true"
        className={`ink-hands-runtime ${className}`.trim()}
        data-mode="loading-manifest"
      />
    );
  }

  return (
    <LoadedInkHands
      className={className}
      firstLine={firstLine}
      manifest={resolvedManifest}
      onReady={onReady}
      reducedMotion={reducedMotion}
    />
  );
}

interface LoadedInkHandsProps extends Omit<InkHandsProps, 'manifest'> {
  readonly manifest: RitualHandsManifest;
}

function LoadedInkHands({
  manifest: parsed = DEFAULT_RITUAL_HANDS_MANIFEST,
  reducedMotion = false,
  className = '',
  onReady,
}: LoadedInkHandsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef<HTMLImageElement>(null);
  const openRef = useRef<HTMLElement | null>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const showClosed = !reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    const closedHands = closedRef.current;
    const openHands = openRef.current;
    const inkCover = inkRef.current;
    if (!root || !closedHands || !openHands || !inkCover) return;

    let desiredProgress = 0;
    const syncVideo = () => {
      if (
        reducedMotion
        || (parsed.mode !== 'opaque-video' && parsed.mode !== 'alpha-video')
        || !(openHands instanceof HTMLVideoElement)
        || openHands.readyState < HTMLMediaElement.HAVE_METADATA
      ) return;
      openHands.currentTime = parsed.duration * desiredProgress;
    };
    const setMediaProgress = (progress: number) => {
      desiredProgress = clampProgress(progress);
      if (reducedMotion || parsed.mode === 'still-occlusion-cut') return;
      if (parsed.mode === 'image-sequence') {
        const frameIndex = Math.round(desiredProgress * (parsed.frames.length - 1));
        openHands.setAttribute('src', parsed.frames[frameIndex]);
        return;
      }
      try {
        syncVideo();
      } catch {
        // Metadata can be invalidated while a new asset version replaces the old one.
      }
    };

    if (openHands instanceof HTMLVideoElement) {
      openHands.addEventListener('loadedmetadata', syncVideo);
    }
    onReady?.({ root, closedHands, openHands, inkCover, setMediaProgress });

    return () => {
      if (openHands instanceof HTMLVideoElement) {
        openHands.removeEventListener('loadedmetadata', syncVideo);
      }
      onReady?.(null);
    };
  }, [onReady, parsed, reducedMotion]);

  const openLayer = (() => {
    if (reducedMotion || parsed.mode === 'still-occlusion-cut') {
      return (
        <img
          alt=""
          data-testid="ritual-hands-open"
          draggable={false}
          ref={(node) => { openRef.current = node; }}
          src={parsed.openPoster}
          style={{ opacity: showClosed ? 0 : 1 }}
        />
      );
    }
    if (parsed.mode === 'image-sequence') {
      return (
        <img
          alt=""
          data-testid="ritual-hands-open"
          draggable={false}
          ref={(node) => { openRef.current = node; }}
          src={parsed.frames[0] ?? parsed.openPoster}
          style={{ opacity: showClosed ? 0 : 1 }}
        />
      );
    }
    return (
      <video
        aria-hidden="true"
        data-testid="ritual-hands-open"
        muted
        playsInline
        poster={parsed.openPoster}
        preload="auto"
        ref={(node) => { openRef.current = node; }}
        src={parsed.source}
        style={{ opacity: showClosed ? 0 : 1 }}
      />
    );
  })();

  return (
    <div
      aria-hidden="true"
      className={`ink-hands-runtime ${className}`.trim()}
      data-asset-id={parsed.id}
      data-mode={parsed.mode}
      ref={rootRef}
    >
      <img
        alt=""
        data-testid="ritual-hands-closed"
        draggable={false}
        ref={closedRef}
        src={parsed.closedPoster}
        style={{ opacity: showClosed ? 1 : 0 }}
      />
      {openLayer}
      <div
        className="ink-hands-runtime__cover"
        data-testid="ritual-ink-cover"
        ref={inkRef}
        style={{ opacity: 0 }}
      />
    </div>
  );
}
