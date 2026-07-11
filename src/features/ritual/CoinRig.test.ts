import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCoinTracks, sampleCoinTrack } from './coinTrajectory';
import { createCoinRigHandle } from './CoinRig';

const input = {
  tossId: 'rig-final-frame',
  visualSeed: 'shared-clock',
  faces: ['text', 'reverse', 'text'] as const,
  lineIndex: 4,
};

describe('CoinRig 唯一轨迹时钟', () => {
  it('prepare 前后保持真实对象隐藏，只有显式 release/snap 才显示', () => {
    const objects = [
      new THREE.Object3D(),
      new THREE.Object3D(),
      new THREE.Object3D(),
    ] as const;
    const invalidate = vi.fn();
    const rig = createCoinRigHandle(objects, invalidate);

    expect(objects.every((object) => object.visible === false)).toBe(true);
    rig.prepare(input);
    expect(objects.every((object) => object.visible === false)).toBe(true);

    rig.setVisible(true);
    expect(objects.every((object) => object.visible === true)).toBe(true);
    rig.setVisible(false);
    expect(objects.every((object) => object.visible === false)).toBe(true);

    rig.snapToEnd();
    expect(objects.every((object) => object.visible === true)).toBe(true);

    rig.prepare({ ...input, tossId: 'rig-next-toss', lineIndex: 5 });
    expect(objects.every((object) => object.visible === false)).toBe(true);
    expect(invalidate).toHaveBeenCalled();
  });

  it('setProgress(1) 精确写入 Task 2 的三枚末帧并请求渲染', () => {
    const objects = [
      new THREE.Object3D(),
      new THREE.Object3D(),
      new THREE.Object3D(),
    ] as const;
    const invalidate = vi.fn();
    const rig = createCoinRigHandle(objects, invalidate);
    const tracks = createCoinTracks(input);

    rig.prepare(input);
    invalidate.mockClear();
    rig.setProgress(1);

    objects.forEach((object, index) => {
      const pose = sampleCoinTrack(tracks[index], 1);
      expect(object.position.toArray()).toEqual(pose.position);
      expect(object.quaternion.toArray()).toEqual(pose.quaternion);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('snapToEnd 与 setProgress(1) 一致，显式 invalidate 复用同一渲染入口', () => {
    const objects = [
      new THREE.Object3D(),
      new THREE.Object3D(),
      new THREE.Object3D(),
    ] as const;
    const invalidate = vi.fn();
    const rig = createCoinRigHandle(objects, invalidate);

    rig.prepare(input);
    rig.setProgress(0.42);
    rig.snapToEnd();

    const tracks = createCoinTracks(input);
    objects.forEach((object, index) => {
      const pose = sampleCoinTrack(tracks[index], 1);
      expect(object.position.toArray()).toEqual(pose.position);
      expect(object.quaternion.toArray()).toEqual(pose.quaternion);
    });

    invalidate.mockClear();
    rig.invalidate();
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
