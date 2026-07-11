import { describe, expect, it } from 'vitest';
import { initialRitualState, ritualReducer } from './ritualMachine';
import {
  FIRST_LINE_TIMING,
  REDUCED_MOTION_DURATION,
  REPEAT_LINE_TIMING,
  ritualTimingFor,
} from './ritualTiming';

describe('摇卦动画时序', () => {
  it('锁定首爻、后续爻和减弱动态效果的秒制时序', () => {
    expect(FIRST_LINE_TIMING).toEqual({
      duration: 3.2,
      releaseAt: 0.98,
      airborneAt: 1.22,
      landingAt: 1.78,
      revealAt: 2.82,
      readyAt: 3.2,
    });
    expect(REPEAT_LINE_TIMING).toEqual({
      duration: 2.2,
      releaseAt: 0.46,
      airborneAt: 0.68,
      landingAt: 1.28,
      revealAt: 1.92,
      readyAt: 2.2,
    });
    expect(REDUCED_MOTION_DURATION).toBe(0.2);
    expect(ritualTimingFor(1)).toBe(FIRST_LINE_TIMING);
    expect(ritualTimingFor(2)).toBe(REPEAT_LINE_TIMING);
    expect(ritualTimingFor(6)).toBe(REPEAT_LINE_TIMING);
  });
});

describe('摇卦动画状态机', () => {
  it('场景就绪前忽略同轮次的 PHASE_AT', () => {
    const awaiting = ritualReducer(initialRitualState, { type: 'TOSS_CHANGED', tossId: 'toss-a' });

    for (const phase of ['release', 'ready'] as const) {
      expect(ritualReducer(awaiting, { type: 'PHASE_AT', tossId: 'toss-a', phase })).toBe(awaiting);
    }
  });

  it('丢弃旧轮次回调并锁住重复确认', () => {
    let state = ritualReducer(initialRitualState, { type: 'TOSS_CHANGED', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'SCENE_READY', tossId: 'toss-a' });
    expect(state.phase).toBe('held');
    expect(ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'old' })).toEqual(state);
    state = ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'CONFIRM', tossId: 'toss-a' });
    expect(state.phase).toBe('confirming');
    expect(ritualReducer(state, { type: 'CONFIRM', tossId: 'toss-a' })).toEqual(state);
  });

  it('阶段只单调推进且 confirming 为当前轮次的吸收态', () => {
    let state = ritualReducer(initialRitualState, { type: 'TOSS_CHANGED', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'SCENE_READY', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'PHASE_AT', tossId: 'toss-a', phase: 'airborne' });

    expect(ritualReducer(state, { type: 'SCENE_READY', tossId: 'toss-a' })).toBe(state);
    expect(ritualReducer(state, { type: 'PHASE_AT', tossId: 'toss-a', phase: 'release' })).toBe(state);

    state = ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'toss-a' });
    state = ritualReducer(state, { type: 'CONFIRM', tossId: 'toss-a' });

    expect(ritualReducer(state, { type: 'SCENE_READY', tossId: 'toss-a' })).toBe(state);
    expect(ritualReducer(state, { type: 'PHASE_AT', tossId: 'toss-a', phase: 'landing' })).toBe(state);
    expect(ritualReducer(state, { type: 'TIMELINE_DONE', tossId: 'toss-a' })).toBe(state);
    expect(ritualReducer(state, { type: 'TOSS_CHANGED', tossId: 'toss-a' })).toBe(state);
    expect(ritualReducer(state, { type: 'TOSS_CHANGED', tossId: 'toss-b' })).toEqual({
      tossId: 'toss-b',
      phase: 'awaiting-scene',
    });
  });
});
