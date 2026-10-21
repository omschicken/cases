export const durations = { loading: 80, caseDrop: 1500, ravenArrive: 1800, ravenDepart: 1100, unlock: 550, lidOpen: 1100, resultReveal: 1000 } as const;
export type Phase = keyof typeof durations | 'idle' | 'openingPending' | 'complete';
export type Event = 'NEXT' | 'OPEN' | 'CONFIRMED' | 'ERROR' | 'SKIP' | 'RESET';
const next: Partial<Record<Phase, Phase>> = { loading: 'caseDrop', caseDrop: 'ravenArrive', ravenArrive: 'idle', ravenDepart: 'unlock', unlock: 'lidOpen', lidOpen: 'resultReveal', resultReveal: 'complete' };
/** Presentation only. CONFIRMED must come from the existing server response. */
export function transition(phase: Phase, event: Event): Phase {
  if (event === 'RESET') return 'loading';
  if (event === 'ERROR') return 'idle';
  if (event === 'OPEN') return 'openingPending';
  if (event === 'CONFIRMED' && phase === 'openingPending') return 'ravenDepart';
  if (event === 'SKIP') return phase === 'openingPending' ? phase : ['ravenDepart', 'unlock', 'lidOpen', 'resultReveal'].includes(phase) ? 'complete' : 'idle';
  return event === 'NEXT' ? next[phase] ?? phase : phase;
}
