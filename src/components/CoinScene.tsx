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

export const COIN_SCENE_TEXTURE_QUALITY = 'high' as const;
export const COIN_SCENE_SHADOW_MODE = 'percentage' as const;
export const COIN_SCENE_DPR: [number, number] = [1, 2];
export const COIN_SCENE_CAMERA = {
  fov: 33,
  position: [0, 6.8, 4.55] as [number, number, number],
  target: [0, 0.18, 0] as [number, number, number],
} as const;

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
    scene.environmentIntensity = 0.38;
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
      <ambientLight intensity={0.16} color="#f2dfbd" />
      <hemisphereLight color="#f1dbb1" groundColor="#241b15" intensity={0.28} />
      <directionalLight
        castShadow
        color="#f5d7a1"
        intensity={1.6}
        position={[4.8, 8.4, 3.6]}
        shadow-bias={-0.00025}
        shadow-camera-bottom={-3}
        shadow-camera-far={18}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={3}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
        shadow-normalBias={0.018}
        shadow-radius={5}
      />
      <pointLight
        color="#a85f35"
        decay={2}
        distance={12}
        intensity={1.4}
        position={[-4.2, 3.2, 2.4]}
      />
      <CoinRig
        input={input}
        onReady={props.onRigReady}
        quality={COIN_SCENE_TEXTURE_QUALITY}
      />
      <mesh position={[0, -0.07, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.6, 5.2]} />
        <shadowMaterial color="#17110d" opacity={0.2} transparent />
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
      camera={{ fov: COIN_SCENE_CAMERA.fov, position: COIN_SCENE_CAMERA.position }}
      className="coin-canvas"
      dpr={COIN_SCENE_DPR}
      frameloop={coinSceneFrameloop(props.active)}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(...COIN_SCENE_CAMERA.target);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.88;
      }}
      shadows={COIN_SCENE_SHADOW_MODE}
    >
      <CoinSceneContents {...props} />
    </Canvas>
  );
}
