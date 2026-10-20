import { describe, expect, it } from "vitest";
import { reelProgress } from "./reelMotion";

describe("opening motion", () => {
  it("starts and stops exactly without overshoot", () => {
    expect(reelProgress(-1)).toBe(0);
    expect(reelProgress(0)).toBe(0);
    expect(reelProgress(1)).toBe(1);
    expect(reelProgress(2)).toBe(1);
    let previous = 0;
    for (let i = 1; i <= 1000; i++) {
      const progress = reelProgress(i / 1000);
      expect(progress).toBeGreaterThanOrEqual(previous);
      expect(progress).toBeLessThanOrEqual(1);
      previous = progress;
    }
  });
  it("joins acceleration, cruise and braking without velocity jumps", () => {
    const step = 0.000001;
    const speed = (t: number) => (reelProgress(t + step) - reelProgress(t)) / step;
    for (const join of [0.08, 0.24]) expect(speed(join - step)).toBeCloseTo(speed(join), 3);
    expect(speed(0.1)).toBeCloseTo(speed(0.2), 5);
    expect(speed(0.7)).toBeLessThan(speed(0.3));
    expect(speed(1 - step)).toBeLessThan(0.00001);
  });
});
