export type RitualPhase =
  | 'awaiting-scene'
  | 'held'
  | 'release'
  | 'airborne'
  | 'landing'
  | 'reveal'
  | 'ready'
  | 'confirming';

export interface RitualState {
  tossId: string | null;
  phase: RitualPhase;
}

export type RitualEvent =
  | { type: 'TOSS_CHANGED'; tossId: string }
  | { type: 'SCENE_READY'; tossId: string }
  | {
    type: 'PHASE_AT';
    tossId: string;
    phase: Exclude<RitualPhase, 'awaiting-scene' | 'confirming'>;
  }
  | { type: 'TIMELINE_DONE'; tossId: string }
  | { type: 'CONFIRM'; tossId: string };

export const initialRitualState: RitualState = {
  tossId: null,
  phase: 'awaiting-scene',
};

const ritualPhaseRank: Record<RitualPhase, number> = {
  'awaiting-scene': 0,
  held: 1,
  release: 2,
  airborne: 3,
  landing: 4,
  reveal: 5,
  ready: 6,
  confirming: 7,
};

function advancePhase(state: RitualState, phase: RitualPhase): RitualState {
  return ritualPhaseRank[phase] > ritualPhaseRank[state.phase] ? { ...state, phase } : state;
}

export function ritualReducer(state: RitualState, event: RitualEvent): RitualState {
  if (event.tossId !== state.tossId) {
    return event.type === 'TOSS_CHANGED'
      ? { tossId: event.tossId, phase: 'awaiting-scene' }
      : state;
  }

  if (event.type === 'TOSS_CHANGED' || state.phase === 'confirming') return state;

  switch (event.type) {
    case 'SCENE_READY':
      return state.phase === 'awaiting-scene' ? { ...state, phase: 'held' } : state;
    case 'PHASE_AT':
      return state.phase === 'awaiting-scene' ? state : advancePhase(state, event.phase);
    case 'TIMELINE_DONE':
      return advancePhase(state, 'ready');
    case 'CONFIRM':
      return state.phase === 'ready' ? { ...state, phase: 'confirming' } : state;
  }
}
