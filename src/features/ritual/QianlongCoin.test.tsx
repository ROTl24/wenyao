import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { createQianlongCoinMeshes } from './QianlongCoin';

const disposable: Array<{ dispose(): void }> = [];

afterEach(() => {
  for (const resource of disposable.splice(0)) resource.dispose();
});

describe('乾隆通宝共享渲染资源', () => {
  it('三枚 Mesh 共享同一 geometry 与 material 数组，孔壁复用边缘材质', () => {
    const geometry = new THREE.BufferGeometry();
    const text = new THREE.MeshPhysicalMaterial();
    const reverse = new THREE.MeshPhysicalMaterial();
    const edge = new THREE.MeshPhysicalMaterial();
    const materials: [
      THREE.MeshPhysicalMaterial,
      THREE.MeshPhysicalMaterial,
      THREE.MeshPhysicalMaterial,
      THREE.MeshPhysicalMaterial,
    ] = [text, reverse, edge, edge];
    disposable.push(geometry, text, reverse, edge);

    const coins = createQianlongCoinMeshes(geometry, materials);

    expect(coins.every((coin) => coin.geometry === geometry)).toBe(true);
    expect(coins.every((coin) => coin.material === materials)).toBe(true);
    expect(materials[3]).toBe(materials[2]);
  });
});
