import { describe, expect, it } from 'vitest';
import {
  createCoinTracks,
  sampleCoinTrack,
  type CoinFace,
  type CoinPose,
} from './coinTrajectory';

const SAMPLE_PROGRESS = [-1, 0, 0.72, 0.9, 1, 2] as const;
const TEXT_QUATERNION = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] as const;
const REVERSE_QUATERNION = [Math.SQRT1_2, 0, 0, Math.SQRT1_2] as const;

function allFaceCombinations(): ReadonlyArray<readonly [CoinFace, CoinFace, CoinFace]> {
  const faces: CoinFace[] = ['text', 'reverse'];
  const combinations: Array<readonly [CoinFace, CoinFace, CoinFace]> = [];

  for (const first of faces) {
    for (const second of faces) {
      for (const third of faces) combinations.push([first, second, third]);
    }
  }

  return combinations;
}

function expectFinitePose(pose: CoinPose): void {
  for (const value of [...pose.position, ...pose.quaternion]) {
    expect(Number.isFinite(value)).toBe(true);
  }
}

function distance(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function localMaxima(values: readonly number[]): number[] {
  return values.filter(
    (value, index) =>
      index > 0
      && index < values.length - 1
      && value > values[index - 1]
      && value > values[index + 1],
  );
}

describe('确定性古钱轨迹', () => {
  it('同种子逐帧一致，新 tossId 会重播但最终面不变', () => {
    const input = {
      tossId: 'a',
      visualSeed: 'seed',
      lineIndex: 1,
      faces: ['text', 'reverse', 'text'] as const,
    };
    const progress = [0, 0.25, 0.5, 0.75, 1] as const;
    const first = createCoinTracks(input);
    const repeated = createCoinTracks(input);

    expect(progress.map((value) => first.map((track) => sampleCoinTrack(track, value)))).toEqual(
      progress.map((value) => repeated.map((track) => sampleCoinTrack(track, value))),
    );

    const replayed = createCoinTracks({ ...input, tossId: 'b' });
    expect(sampleCoinTrack(first[0], 0.5)).not.toEqual(sampleCoinTrack(replayed[0], 0.5));
    expect(replayed.map((track) => sampleCoinTrack(track, 1).face)).toEqual(input.faces);
  });

  it('由 visualSeed 和 lineIndex 驱动每轮中间轨迹', () => {
    const input = {
      tossId: 'toss',
      visualSeed: 'seed-a',
      lineIndex: 1,
      faces: ['text', 'reverse', 'text'] as const,
    };
    const original = sampleCoinTrack(createCoinTracks(input)[1], 0.5);

    expect(sampleCoinTrack(createCoinTracks({ ...input, visualSeed: 'seed-b' })[1], 0.5)).not.toEqual(
      original,
    );
    expect(sampleCoinTrack(createCoinTracks({ ...input, lineIndex: 2 })[1], 0.5)).not.toEqual(
      original,
    );
  });

  it('不同 visualSeed 产生不同且仍受毫秒边界约束的 seeded 接触错峰', () => {
    const impactSeries = ['seed-a', 'seed-b', 'seed-c', 'seed-d'].map((visualSeed) => {
      const tracks = createCoinTracks({
        tossId: 'stagger',
        visualSeed,
        lineIndex: 3,
        faces: ['text', 'text', 'reverse'],
      });
      const impacts = tracks.map((track) => track.impactAtMs);

      expect(tracks[0].impactProgress).toBeCloseTo(0.72, 12);
      for (const gap of [impacts[1] - impacts[0], impacts[2] - impacts[1]]) {
        expect(gap).toBeGreaterThanOrEqual(60);
        expect(gap).toBeLessThanOrEqual(140);
      }

      return impacts;
    });

    expect(
      new Set(impactSeries.map((impacts) => JSON.stringify(impacts))).size,
    ).toBeGreaterThanOrEqual(2);
  });

  it('贝塞尔飞行中点明显高于两端且位置持续变化', () => {
    const tracks = createCoinTracks({
      tossId: 'flight-shape',
      visualSeed: 'phase-coverage',
      lineIndex: 2,
      faces: ['text', 'reverse', 'text'],
    });

    for (const track of tracks) {
      const start = sampleCoinTrack(track, 0);
      const midpoint = sampleCoinTrack(track, track.impactProgress / 2);
      const impact = sampleCoinTrack(track, track.impactProgress);
      expect(midpoint.position[1]).toBeGreaterThan(
        Math.max(start.position[1], impact.position[1]) + 0.15,
      );

      const flightSamples = [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) =>
        sampleCoinTrack(track, track.impactProgress * fraction).position);
      for (let index = 1; index < flightSamples.length; index += 1) {
        expect(distance(flightSamples[index - 1], flightSamples[index])).toBeGreaterThan(0.03);
      }
    }
  });

  it('首次接触后出现至少两次严格衰减的反弹峰', () => {
    const tracks = createCoinTracks({
      tossId: 'bounce-shape',
      visualSeed: 'phase-coverage',
      lineIndex: 2,
      faces: ['text', 'reverse', 'text'],
    });

    for (const track of tracks) {
      const heights = Array.from({ length: 401 }, (_, index) => {
        const progress = track.impactProgress
          + (0.9 - track.impactProgress) * (index / 400);
        return sampleCoinTrack(track, progress).position[1];
      });
      const peaks = localMaxima(heights);

      expect(peaks.length).toBeGreaterThanOrEqual(2);
      for (let index = 1; index < peaks.length; index += 1) {
        expect(peaks[index]).toBeLessThan(peaks[index - 1]);
      }
    }
  });

  it('摇摆阶段偏离落定朝向且末帧精确回归最终四元数', () => {
    const faces = ['text', 'reverse', 'text'] as const;
    const tracks = createCoinTracks({
      tossId: 'wobble-shape',
      visualSeed: 'phase-coverage',
      lineIndex: 2,
      faces,
    });

    tracks.forEach((track, index) => {
      const settled = sampleCoinTrack(track, 1);
      const wobbling = sampleCoinTrack(track, 0.925);

      expect(wobbling.quaternion).not.toEqual(settled.quaternion);
      expect(settled.quaternion).toEqual(
        faces[index] === 'text' ? TEXT_QUATERNION : REVERSE_QUATERNION,
      );
    });
  });

  it('contact 是达到首次接触后的持续状态，且 progress 会钳制到边界', () => {
    const tracks = createCoinTracks({
      tossId: 'contact',
      visualSeed: 'seed',
      lineIndex: 1,
      faces: ['reverse', 'text', 'reverse'],
    });

    for (const track of tracks) {
      expect(sampleCoinTrack(track, track.impactProgress - 1e-6).contact).toBe(false);
      expect(sampleCoinTrack(track, track.impactProgress).contact).toBe(true);
      expect(sampleCoinTrack(track, Math.min(1, track.impactProgress + 1e-6)).contact).toBe(true);
      expect(sampleCoinTrack(track, -1)).toEqual(sampleCoinTrack(track, 0));
      expect(sampleCoinTrack(track, 2)).toEqual(sampleCoinTrack(track, 1));
    }
  });

  it.each(allFaceCombinations())(
    '覆盖币面组合 %s/%s/%s、边界进度、有限数值和分离落点',
    (firstFace, secondFace, thirdFace) => {
      const faces = [firstFace, secondFace, thirdFace] as const;
      const tracks = createCoinTracks({
        tossId: `faces-${faces.join('-')}`,
        visualSeed: 'all-faces',
        lineIndex: 6,
        faces,
      });

      for (const progress of SAMPLE_PROGRESS) {
        tracks.forEach((track) => expectFinitePose(sampleCoinTrack(track, progress)));
      }

      const settled = tracks.map((track) => sampleCoinTrack(track, 1));
      expect(settled.map((pose) => pose.face)).toEqual(faces);
      settled.forEach((pose, index) => {
        expect(pose.contact).toBe(true);
        expect(pose.quaternion).toEqual(
          faces[index] === 'text' ? TEXT_QUATERNION : REVERSE_QUATERNION,
        );
        expect(sampleCoinTrack(tracks[index], 2)).toEqual(pose);
      });

      expect(distance(settled[0].position, settled[1].position)).toBeGreaterThan(0.9);
      expect(distance(settled[0].position, settled[2].position)).toBeGreaterThan(0.9);
      expect(distance(settled[1].position, settled[2].position)).toBeGreaterThan(0.9);
    },
  );
});
