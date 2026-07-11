import type { ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';

export function createQianlongCoinMesh(
  geometry: THREE.BufferGeometry,
  materials: readonly THREE.Material[],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, materials as THREE.Material[]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'QianlongTongbaoCoin';
  return mesh;
}

export function createQianlongCoinMeshes(
  geometry: THREE.BufferGeometry,
  materials: readonly THREE.Material[],
): readonly [THREE.Mesh, THREE.Mesh, THREE.Mesh] {
  return [
    createQianlongCoinMesh(geometry, materials),
    createQianlongCoinMesh(geometry, materials),
    createQianlongCoinMesh(geometry, materials),
  ];
}

interface QianlongCoinProps {
  mesh: THREE.Mesh;
}

export function QianlongCoin({ mesh }: QianlongCoinProps) {
  const primitiveProps: ThreeElements['primitive'] = { object: mesh };
  return <primitive {...primitiveProps} />;
}
