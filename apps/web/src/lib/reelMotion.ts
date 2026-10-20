export const REEL_MS = 3400;
export const RESULT_HOLD_MS = 420;

/** Continuous velocity: accelerate, cruise, then ease into an exact stop. */
export function reelProgress(time: number): number {
  const t = Math.min(1, Math.max(0, time));
  const ramp = 0.08;
  const cruiseEnd = 0.24;
  const coast = 1 - cruiseEnd;
  const distance = ramp / 2 + cruiseEnd - ramp + coast / 4;
  const travelled = t < ramp
    ? t * t / (2 * ramp)
    : t < cruiseEnd
      ? ramp / 2 + t - ramp
      : ramp / 2 + cruiseEnd - ramp + coast / 4 * (1 - Math.pow((1 - t) / coast, 4));
  return travelled / distance;
}
