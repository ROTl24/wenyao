import { describe, expect, it } from 'vitest';
import { inkHandMotionKeyframes, sampleInkHandPose } from './inkHandMotion';

describe('骨骼手关键姿势曲线', () => {
  it('保留十二个严格递增的审阅姿势', () => {
    const keyframes = inkHandMotionKeyframes();
    expect(keyframes).toHaveLength(12);
    expect(keyframes[0]).toBe(0);
    expect(keyframes.at(-1)).toBe(1);
    expect(keyframes.every((value, index) => index === 0 || value > keyframes[index - 1])).toBe(true);
  });

  it('左右手位置和转角严格镜像，避免身份交换', () => {
    for (let index = 0; index <= 120; index += 1) {
      const progress = index / 120;
      const left = sampleInkHandPose('left', progress);
      const right = sampleInkHandPose('right', progress);
      expect(left.position[0]).toBeCloseTo(-right.position[0], 8);
      expect(left.position[1]).toBeCloseTo(right.position[1], 8);
      expect(left.position[2]).toBeCloseTo(right.position[2], 8);
      expect(left.rotation[1]).toBeCloseTo(-right.rotation[1], 8);
      expect(left.rotation[2]).toBeCloseTo(-right.rotation[2], 8);
      expect(left.curl).toBeCloseTo(right.curl, 8);
    }
  });

  it('压缩后先反向预备，再沿弧线打开并产生收势回弹', () => {
    const compressed = sampleInkHandPose('right', 0.34);
    const anticipation = sampleInkHandPose('right', 0.42);
    const released = sampleInkHandPose('right', 0.68);
    const overshoot = sampleInkHandPose('right', 0.88);
    const settled = sampleInkHandPose('right', 1);

    expect(compressed.position[0]).toBeLessThan(anticipation.position[0]);
    expect(anticipation.position[1]).toBeLessThan(compressed.position[1]);
    expect(released.position[0]).toBeGreaterThan(anticipation.position[0]);
    expect(released.curl).toBeLessThan(anticipation.curl);
    expect(overshoot.position[0]).toBeGreaterThan(settled.position[0]);
    expect(overshoot.rotation[2]).toBeGreaterThan(settled.rotation[2]);
  });

  it('60 FPS 采样不存在位置、旋转或指节曲线跳变', () => {
    let previous = sampleInkHandPose('left', 0);
    for (let frame = 1; frame <= 192; frame += 1) {
      const current = sampleInkHandPose('left', frame / 192);
      const positionDelta = Math.hypot(
        current.position[0] - previous.position[0],
        current.position[1] - previous.position[1],
        current.position[2] - previous.position[2],
      );
      expect(positionDelta).toBeLessThan(0.09);
      expect(Math.abs(current.rotation[2] - previous.rotation[2])).toBeLessThan(0.035);
      expect(Math.abs(current.curl - previous.curl)).toBeLessThan(0.05);
      previous = current;
    }
  });
});
