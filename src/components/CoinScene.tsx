import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Float, Sparkles } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CoinFace } from '../lib/divination';

function coinTexture(face: CoinFace) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(175, 145, 30, 256, 256, 255);
  gradient.addColorStop(0, '#f0d58f');
  gradient.addColorStop(0.35, '#c28b3c');
  gradient.addColorStop(0.72, '#8a5923');
  gradient.addColorStop(1, '#543416');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = 'rgba(46,25,8,.6)';
  context.lineWidth = 15;
  context.beginPath(); context.arc(256, 256, 218, 0, Math.PI * 2); context.stroke();
  context.fillStyle = '#25170d';
  context.fillRect(218, 218, 76, 76);
  context.strokeStyle = '#d5ad61'; context.lineWidth = 5; context.strokeRect(218, 218, 76, 76);
  context.fillStyle = '#38210b';
  context.font = '700 66px KaiTi, STKaiti, serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  if (face === 'text') {
    context.fillText('乾', 256, 132); context.fillText('隆', 382, 256); context.fillText('通', 256, 380); context.fillText('宝', 130, 256);
  } else {
    context.font = '700 40px serif'; context.fillText('ᠪᠣᠣ', 256, 155); context.fillText('ᠴᡳᠣᠸᠠᠨ', 256, 360);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function AnimatedCoin({ face, index }: { face: CoinFace; index: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const start = useRef<number | null>(null);
  const texture = useMemo(() => coinTexture(face), [face]);
  const targets = [[-1.35, -0.32, 0], [0, -0.12, 0.22], [1.35, -0.34, -0.12]] as const;
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((state) => {
    if (!mesh.current) return;
    start.current ??= state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - start.current;
    const p = Math.min(1, elapsed / 2.05);
    const eased = 1 - Math.pow(1 - p, 3);
    const target = targets[index];
    mesh.current.position.x = THREE.MathUtils.lerp((index - 1) * 0.45, target[0], eased);
    mesh.current.position.y = THREE.MathUtils.lerp(3.4 + index * 0.45, target[1], eased) + Math.sin(p * Math.PI) * 1.65;
    mesh.current.position.z = THREE.MathUtils.lerp(-1.2, target[2], eased);
    mesh.current.rotation.x = Math.PI / 2 + (face === 'reverse' ? Math.PI : 0) + (1 - eased) * Math.PI * (9 + index * 2);
    mesh.current.rotation.z = (1 - eased) * Math.PI * (5 + index);
  });
  return (
    <mesh ref={mesh} castShadow>
      <cylinderGeometry args={[0.69, 0.69, 0.11, 72, 1, false]} />
      <meshPhysicalMaterial map={texture} metalness={0.48} roughness={0.58} clearcoat={0.12} color="#d6a55b" emissive="#422109" emissiveIntensity={0.08} />
    </mesh>
  );
}

export default function CoinScene({ faces }: { faces: readonly CoinFace[] }) {
  if (import.meta.env.MODE === 'test') {
    return <div className="coin-test-stage">{faces.map((face, index) => <span key={index}>{face}</span>)}</div>;
  }
  return (
    <Canvas className="coin-canvas" camera={{ position: [0, 1.1, 8], fov: 39 }} dpr={[1, 1.6]} shadows gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.85} color="#fff1ce" />
      <hemisphereLight color="#fff2d0" groundColor="#6e3b16" intensity={1.15} />
      <directionalLight position={[4, 7, 6]} intensity={4.4} color="#ffe3aa" castShadow />
      <pointLight position={[-4, 2, 4]} intensity={8.5} distance={13} color="#c46b38" />
      <Float speed={0.35} rotationIntensity={0.04} floatIntensity={0.05}>
        {faces.map((face, index) => <AnimatedCoin face={face} index={index} key={`${face}-${index}`} />)}
      </Float>
      <Sparkles count={90} size={1.2} speed={0.25} scale={[7, 3.5, 2]} color="#9a7642" opacity={0.45} />
      <ContactShadows position={[0, -1.35, 0]} opacity={0.35} scale={8} blur={3.5} far={5} color="#19140e" />
    </Canvas>
  );
}
