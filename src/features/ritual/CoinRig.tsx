import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import {
  createCoinTracks,
  sampleCoinTrack,
  type CoinTrajectoryInput,
  type CoinTrack,
} from './coinTrajectory';
import { createQianlongCoinGeometry } from './coinGeometry';
import {
  createQianlongTextureSet,
  DEFAULT_COIN_TEXTURE_QUALITY,
  type CoinTextureQuality,
  type QianlongTextureSet,
} from './coinTextures';
import { createQianlongCoinMeshes, QianlongCoin } from './QianlongCoin';

export type CoinTrackInput = CoinTrajectoryInput;

export interface CoinRigHandle {
  prepare(input: CoinTrackInput): void;
  setProgress(progress: number): void;
  snapToEnd(): void;
  invalidate(): void;
}

type CoinObjects = readonly [THREE.Object3D, THREE.Object3D, THREE.Object3D];
type CoinTracks = readonly [CoinTrack, CoinTrack, CoinTrack];

export function createCoinRigHandle(
  objects: CoinObjects,
  requestRender: () => void,
): CoinRigHandle {
  let tracks: CoinTracks | null = null;

  const setProgress = (progress: number): void => {
    if (!tracks) return;

    objects.forEach((object, index) => {
      const pose = sampleCoinTrack(tracks![index], progress);
      object.position.set(...pose.position);
      object.quaternion.set(...pose.quaternion);
    });
    requestRender();
  };

  return {
    prepare(input) {
      tracks = createCoinTracks(input);
      setProgress(0);
    },
    setProgress,
    snapToEnd() {
      setProgress(1);
    },
    invalidate: requestRender,
  };
}

interface SharedCoinResources {
  readonly geometry: THREE.BufferGeometry;
  readonly textureSet: QianlongTextureSet;
  dispose(): void;
}

function createSharedCoinResources(
  renderer: THREE.WebGLRenderer,
  quality: CoinTextureQuality,
): SharedCoinResources {
  const geometry = createQianlongCoinGeometry();
  let textureSet: QianlongTextureSet;

  try {
    textureSet = createQianlongTextureSet(renderer, quality);
  } catch (error) {
    geometry.dispose();
    throw error;
  }

  let disposed = false;
  return {
    geometry,
    textureSet,
    dispose() {
      if (disposed) return;
      disposed = true;
      geometry.dispose();
      textureSet.dispose();
    },
  };
}

interface CoinRigProps {
  input: CoinTrackInput;
  onReady(rig: CoinRigHandle): void;
  quality?: CoinTextureQuality;
}

export function CoinRig({
  input,
  onReady,
  quality = DEFAULT_COIN_TEXTURE_QUALITY,
}: CoinRigProps) {
  const renderer = useThree((state) => state.gl);
  const requestRender = useThree((state) => state.invalidate);
  const [resources, setResources] = useState<SharedCoinResources | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: SharedCoinResources | null = null;
    setResources(null);

    void Promise.resolve().then(() => {
      if (cancelled) return;
      created = createSharedCoinResources(renderer, quality);
      if (cancelled) created.dispose();
      else setResources(created);
    });

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [quality, renderer]);

  if (!resources) return null;
  return (
    <MountedCoinRig
      input={input}
      onReady={onReady}
      requestRender={requestRender}
      resources={resources}
    />
  );
}

interface MountedCoinRigProps {
  input: CoinTrackInput;
  onReady(rig: CoinRigHandle): void;
  requestRender(): void;
  resources: SharedCoinResources;
}

function MountedCoinRig({
  input,
  onReady,
  requestRender,
  resources,
}: MountedCoinRigProps) {
  const coins = useMemo(
    () => createQianlongCoinMeshes(resources.geometry, resources.textureSet.materials),
    [resources],
  );
  const rig = useMemo(
    () => createCoinRigHandle(coins, requestRender),
    [coins, requestRender],
  );

  useLayoutEffect(() => {
    rig.prepare(input);
  }, [input, rig]);

  useEffect(() => {
    onReady(rig);
  }, [input, onReady, rig]);

  return (
    <Fragment>
      {coins.map((mesh, index) => <QianlongCoin key={index} mesh={mesh} />)}
    </Fragment>
  );
}
