import { describe, expect, it } from 'vitest';
import { transition } from './machine';
import type { Phase } from './machine';
describe('Raven presentation authority', () => {
  it('waits indefinitely for confirmation; timers and skip cannot invent a result', () => {
    expect(transition('idle', 'OPEN')).toBe('openingPending');
    expect(transition('openingPending', 'NEXT')).toBe('openingPending');
    expect(transition('openingPending', 'SKIP')).toBe('openingPending');
  });
  it('follows the deterministic sequence', () => {
    let state: Phase = 'loading';
    for (const target of ['caseDrop', 'ravenArrive', 'idle']) { state = transition(state, 'NEXT'); expect(state).toBe(target); }
    state = transition(state, 'OPEN'); state = transition(state, 'CONFIRMED');
    expect(state).toBe('ravenDepart');
    for (const target of ['unlock', 'lidOpen', 'resultReveal', 'complete']) { state = transition(state, 'NEXT'); expect(state).toBe(target); }
  });
  it('handles failure and confirmed presentation skip without replaying a request', () => {
    expect(transition('openingPending', 'ERROR')).toBe('idle');
    expect(transition('lidOpen', 'SKIP')).toBe('complete');
    expect(transition('idle', 'CONFIRMED')).toBe('idle');
  });
});
