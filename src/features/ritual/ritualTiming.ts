export interface RitualTiming {
  duration: number;
  releaseAt: number;
  airborneAt: number;
  landingAt: number;
  revealAt: number;
  readyAt: number;
}

export const FIRST_LINE_TIMING: RitualTiming = {
  duration: 3.2,
  releaseAt: 0.98,
  airborneAt: 1.22,
  landingAt: 1.78,
  revealAt: 2.82,
  readyAt: 3.2,
};

export const REPEAT_LINE_TIMING: RitualTiming = {
  duration: 2.2,
  releaseAt: 0.46,
  airborneAt: 0.68,
  landingAt: 1.28,
  revealAt: 1.92,
  readyAt: 2.2,
};

export const REDUCED_MOTION_DURATION = 0.2;

export function ritualTimingFor(lineIndex: number): RitualTiming {
  return lineIndex === 1 ? FIRST_LINE_TIMING : REPEAT_LINE_TIMING;
}
