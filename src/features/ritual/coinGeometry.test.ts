import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createQianlongCoinGeometry } from './coinGeometry';
import { createCoinTracks, sampleCoinTrack } from './coinTrajectory';

const geometries: THREE.BufferGeometry[] = [];

function createGeometry(): THREE.BufferGeometry {
  const geometry = createQianlongCoinGeometry();
  geometries.push(geometry);
  return geometry;
}

afterEach(() => {
  for (const geometry of geometries.splice(0)) geometry.dispose();
});

describe('乾隆通宝方孔几何', () => {
  it('中心射线不会命中币面且方孔真实贯穿', () => {
    const geometry = createGeometry();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);

    const centerRay = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 2),
      new THREE.Vector3(0, 0, -1),
    );
    const offCenterRay = new THREE.Raycaster(
      new THREE.Vector3(0.45, 0, 2),
      new THREE.Vector3(0, 0, -1),
    );

    expect(centerRay.intersectObject(mesh)).toHaveLength(0);
    expect(offCenterRay.intersectObject(mesh).length).toBeGreaterThan(0);
    material.dispose();
  });

  it('以四个连续材质组完整覆盖正面、背面、外圆和方孔内壁', () => {
    const geometry = createGeometry();
    const elementCount = geometry.index?.count ?? geometry.getAttribute('position').count;

    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1, 2, 3]);
    expect(geometry.groups[0]?.start).toBe(0);

    geometry.groups.forEach((group, index) => {
      expect(group.count).toBeGreaterThan(0);
      expect(group.count % 3).toBe(0);
      if (index > 0) {
        const previous = geometry.groups[index - 1];
        expect(group.start).toBe(previous.start + previous.count);
      }
    });

    expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(elementCount);
  });

  it('正背币面的平均法线方向明确且几何包围盒居中', () => {
    const geometry = createGeometry();
    const normals = geometry.getAttribute('normal');

    const averageNormalZ = (group: (typeof geometry.groups)[number]): number => {
      const count = group.count ?? 0;
      let total = 0;
      for (let index = group.start; index < group.start + count; index += 1) {
        total += normals.getZ(geometry.index?.getX(index) ?? index);
      }
      return total / count;
    };

    expect(averageNormalZ(geometry.groups[0])).toBeGreaterThan(0.99);
    expect(averageNormalZ(geometry.groups[1])).toBeLessThan(-0.99);

    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    expect(bounds.min.x).toBeCloseTo(-bounds.max.x, 5);
    expect(bounds.min.y).toBeCloseTo(-bounds.max.y, 5);
    expect(bounds.min.z).toBeCloseTo(-bounds.max.z, 5);
  });

  it('应用 Task 2 末帧后正背可见面的 U 向右、V 向上世界方向一致', () => {
    const geometry = createGeometry();
    const positions = geometry.getAttribute('position');
    const uvs = geometry.getAttribute('uv');
    const tracks = createCoinTracks({
      tossId: 'final-visible-uv-orientation',
      visualSeed: 'front-and-reverse',
      faces: ['text', 'reverse', 'text'],
      lineIndex: 1,
    });

    const directionalCovariance = (
      group: (typeof geometry.groups)[number],
      quaternion: THREE.Quaternion,
      worldAxis: 'x' | 'z',
      uvAxis: 'u' | 'v',
    ): number => {
      const count = group.count ?? 0;
      let covariance = 0;
      for (let index = group.start; index < group.start + count; index += 1) {
        const worldPosition = new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index),
        ).applyQuaternion(quaternion);
        const uv = uvAxis === 'u' ? uvs.getX(index) : uvs.getY(index);
        covariance += worldPosition[worldAxis] * (uv - 0.5);
      }
      return covariance;
    };

    const front = geometry.groups[0];
    const reverse = geometry.groups[1];
    const frontPose = sampleCoinTrack(tracks[0], 1);
    const reversePose = sampleCoinTrack(tracks[1], 1);
    const frontQuaternion = new THREE.Quaternion(...frontPose.quaternion);
    const reverseQuaternion = new THREE.Quaternion(...reversePose.quaternion);

    expect(directionalCovariance(front, frontQuaternion, 'x', 'u')).toBeGreaterThan(0);
    expect(directionalCovariance(front, frontQuaternion, 'z', 'v')).toBeLessThan(0);
    expect(directionalCovariance(reverse, reverseQuaternion, 'x', 'u')).toBeGreaterThan(0);
    expect(directionalCovariance(reverse, reverseQuaternion, 'z', 'v')).toBeLessThan(0);
  });

  it('外缘与孔壁每个三角的 U 接缝跨度不超过半圈', () => {
    const geometry = createGeometry();
    const uvs = geometry.getAttribute('uv');

    for (const group of geometry.groups.slice(2)) {
      const count = group.count ?? 0;
      for (let start = group.start; start < group.start + count; start += 3) {
        const triangleU = [uvs.getX(start), uvs.getX(start + 1), uvs.getX(start + 2)];
        expect(Math.max(...triangleU) - Math.min(...triangleU)).toBeLessThanOrEqual(0.5);
      }
    }
  });
});
