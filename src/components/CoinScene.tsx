import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import type { CoinFace } from '../lib/divination';
import {
  CoinRig,
  createCoinRigHandle,
  type CoinRigHandle,
  type CoinTrackInput,
} from '../features/ritual/CoinRig';
import { restoreOwnedCoinEnvironment } from '../features/ritual/coinEnvironment';
import { DEFAULT_COIN_TEXTURE_QUALITY } from '../features/ritual/coinTextures';

export const COIN_SCENE_TEXTURE_QUALITY = DEFAULT_COIN_TEXTURE_QUALITY;
export const COIN_SCENE_SHADOW_MODE = 'basic' as const;

export function coinSceneFrameloop(active: boolean): 'always' | 'demand' {
  return active ? 'always' : 'demand';
}

export interface CoinSceneProps {
  tossId: string;
  visualSeed: string;
  faces: readonly [CoinFace, CoinFace, CoinFace];
  lineIndex: number;
  active: boolean;
  onRigReady(rig: CoinRigHandle): void;
}

function coinTrackInput(props: CoinSceneProps): CoinTrackInput {
  return {
    tossId: props.tossId,
    visualSeed: props.visualSeed,
    faces: props.faces,
    lineIndex: props.lineIndex,
  };
}

function OfflineCoinEnvironment() {
  const renderer = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(renderer);
    const target = generator.fromScene(room, 0.04);

    scene.environment = target.texture;
    scene.environmentIntensity = 0.78;
    invalidate();

    return () => {
      restoreOwnedCoinEnvironment(
        scene,
        target.texture,
        previousEnvironment,
        previousIntensity,
      );
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [invalidate, renderer, scene]);

  return null;
}

function CoinSceneContents(props: CoinSceneProps) {
  const input = useMemo(
    () => coinTrackInput(props),
    [props.faces, props.lineIndex, props.tossId, props.visualSeed],
  );

  return (
    <>
      <OfflineCoinEnvironment />
      <ambientLight intensity={0.72} color="#f5e4c1" />
      <hemisphereLight color="#f5dfb4" groundColor="#3a2414" intensity={0.64} />
      <directionalLight
        castShadow
        color="#ffe1a3"
        intensity={3.2}
        position={[4.5, 7, 5.5]}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <pointLight color="#b96a35" distance={13} intensity={6.4} position={[-4, 2.5, 3]} />
      <CoinRig
        input={input}
        onReady={props.onRigReady}
        quality={COIN_SCENE_TEXTURE_QUALITY}
      />
      <mesh position={[0, -0.12, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 5]} />
        <shadowMaterial color="#18120c" opacity={0.24} transparent />
      </mesh>
    </>
  );
}

function TestCoinScene(props: CoinSceneProps) {
  const objects = useMemo(() => [
    new THREE.Object3D(),
    new THREE.Object3D(),
    new THREE.Object3D(),
  ] as const, []);
  const rig = useMemo(() => createCoinRigHandle(objects, () => undefined), [objects]);
  const input = useMemo(
    () => coinTrackInput(props),
    [props.faces, props.lineIndex, props.tossId, props.visualSeed],
  );

  useEffect(() => {
    rig.prepare(input);
    props.onRigReady(rig);
  }, [input, props.onRigReady, rig]);

  return (
    <div className="coin-test-stage" data-toss-id={props.tossId}>
      {props.faces.map((face, index) => (
        <span
          aria-hidden="true"
          data-coin-index={index}
          data-face={face}
          key={index}
        >
          {props.active ? '旋' : face}
        </span>
      ))}
    </div>
  );
}

export default function CoinScene(props: CoinSceneProps) {
  if (import.meta.env.MODE === 'test') return <TestCoinScene {...props} />;

  return (
    <Canvas
      camera={{ fov: 36, position: [0, 4.2, 7.2] }}
      className="coin-canvas"
      dpr={[1, 1.6]}
      frameloop={coinSceneFrameloop(props.active)}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, 0, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
      shadows={COIN_SCENE_SHADOW_MODE}
    >
      <CoinSceneContents {...props} />
    </Canvas>
  );
}
