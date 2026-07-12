import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { sampleInkHandPose } from './inkHandMotion';

function createInkHandMaterial(): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#45483f',
    roughness: 0.94,
    metalness: 0,
    clearcoat: 0.01,
    clearcoatRoughness: 1,
    opacity: 1,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  material.name = 'WenYao.InkHandMaterial';
  return material;
}

export interface InkHandRigHandle {
  setProgress(progress: number): void;
  snapToEnd(): void;
  invalidate(): void;
}

interface InkHandSceneProps {
  readonly model: string;
  readonly animationClip: string;
  onReady(handle: InkHandRigHandle | null): void;
}

interface RigObjects {
  readonly leftRoot: THREE.Group;
  readonly rightRoot: THREE.Group;
  readonly tracks: readonly HandTrackBinding[];
  readonly clipDuration: number;
  requestRender(): void;
}

interface HandTrackBinding {
  readonly left: THREE.Object3D;
  readonly right: THREE.Object3D;
  readonly interpolant: THREE.Interpolant;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function createHandTrackBindings(
  clip: THREE.AnimationClip,
  leftScene: THREE.Group,
  rightScene: THREE.Group,
): HandTrackBinding[] {
  return clip.tracks.flatMap((track) => {
    const separator = track.name.lastIndexOf('.');
    const nodeName = separator < 0 ? track.name : track.name.slice(0, separator);
    const property = separator < 0 ? '' : track.name.slice(separator + 1);
    if (property !== 'quaternion') return [];
    const left = leftScene.getObjectByName(nodeName);
    const right = rightScene.getObjectByName(nodeName);
    if (!left || !right) return [];
    return [{ left, right, interpolant: track.InterpolantFactoryMethodLinear() }];
  });
}

function applyHandTracks(tracks: readonly HandTrackBinding[], time: number): void {
  for (const track of tracks) {
    const quaternion = track.interpolant.evaluate(time) as ArrayLike<number>;
    track.left.quaternion.fromArray(quaternion);
    track.right.quaternion.fromArray(quaternion);
  }
}

export function createInkHandRigHandle(objects: RigObjects): InkHandRigHandle {
  const apply = (progress: number): void => {
    const normalized = clamp01(progress);
    const left = sampleInkHandPose('left', normalized);
    const right = sampleInkHandPose('right', normalized);

    objects.leftRoot.position.set(...left.position);
    objects.leftRoot.rotation.set(...left.rotation);
    objects.leftRoot.scale.setScalar(left.scale);
    objects.rightRoot.position.set(...right.position);
    objects.rightRoot.rotation.set(...right.rotation);
    objects.rightRoot.scale.setScalar(right.scale);

    applyHandTracks(objects.tracks, objects.clipDuration * left.curl);
    objects.requestRender();
  };

  return {
    setProgress: apply,
    snapToEnd: () => apply(1),
    invalidate: objects.requestRender,
  };
}

function prepareClone(source: THREE.Group): THREE.Group {
  const clone = cloneSkeleton(source) as THREE.Group;
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.geometry.computeVertexNormals();
    mesh.geometry.normalizeNormals();
    mesh.material = createInkHandMaterial();
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
  });
  return clone;
}

function RiggedHands({ model, animationClip, onReady }: InkHandSceneProps) {
  const gltf = useLoader(GLTFLoader, model) as GLTF;
  const invalidate = useThree((state) => state.invalidate);
  const leftRootRef = useRef<THREE.Group>(null);
  const rightRootRef = useRef<THREE.Group>(null);
  const leftScene = useMemo(
    () => prepareClone(gltf.scene),
    [gltf.scene],
  );
  const rightScene = useMemo(
    () => prepareClone(gltf.scene),
    [gltf.scene],
  );
  const clip = useMemo(
    () => THREE.AnimationClip.findByName(gltf.animations, animationClip) ?? gltf.animations[0],
    [animationClip, gltf.animations],
  );
  const tracks = useMemo(
    () => clip ? createHandTrackBindings(clip, leftScene, rightScene) : [],
    [clip, leftScene, rightScene],
  );

  useLayoutEffect(() => {
    const leftRoot = leftRootRef.current;
    const rightRoot = rightRootRef.current;
    if (!leftRoot || !rightRoot || !clip) return;

    const handle = createInkHandRigHandle({
      leftRoot,
      rightRoot,
      tracks,
      clipDuration: clip.duration,
      requestRender: invalidate,
    });
    handle.setProgress(0);
    onReady(handle);

    return () => {
      onReady(null);
    };
  }, [clip, invalidate, onReady, tracks]);

  return (
    <>
      <ambientLight color="#d7cab5" intensity={1.05} />
      <directionalLight color="#fff0cf" intensity={1.8} position={[1.4, 3.8, 5]} />
      <directionalLight color="#738079" intensity={0.72} position={[-4, 1.5, 2]} />
      <group ref={leftRootRef}>
        <group rotation={[Math.PI / 2, 0, -Math.PI / 2]} scale={[1.18, -1.18, 1.18]}>
          <primitive object={leftScene} />
        </group>
      </group>
      <group ref={rightRootRef}>
        <group rotation={[Math.PI / 2, 0, -Math.PI / 2]} scale={[1.18, 1.18, 1.18]}>
          <primitive object={rightScene} />
        </group>
      </group>
    </>
  );
}

function TestInkHandScene({ model, animationClip, onReady }: InkHandSceneProps) {
  const progressRef = useRef(0);
  useEffect(() => {
    const handle: InkHandRigHandle = {
      setProgress(value) {
        progressRef.current = clamp01(value);
      },
      snapToEnd() {
        progressRef.current = 1;
      },
      invalidate() {},
    };
    onReady(handle);
    return () => onReady(null);
  }, [onReady]);

  return (
    <div
      className="ink-hand-scene-test"
      data-animation-clip={animationClip}
      data-model={model}
    />
  );
}

export default function InkHandScene(props: InkHandSceneProps) {
  if (import.meta.env.MODE === 'test') return <TestInkHandScene {...props} />;

  return (
    <Canvas
      camera={{ far: 40, near: 0.1, position: [0, 0, 10], zoom: 118 }}
      className="ink-hand-canvas"
      dpr={[1, 2]}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      orthographic
    >
      <RiggedHands {...props} />
    </Canvas>
  );
}

useLoader.preload(GLTFLoader, '/models/rigged-hand.glb');
