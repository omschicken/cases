import { describe, expect, it } from "vitest";
import { balanceCase } from "../src/prices/case-balance";

const step = 1000;
const ladder = (price: number) => [0.1, 0.3, 0.45, 0.6, 0.9, 1.2, 2, 3.5, 9, 30, 90].map((r) => Math.round(r * price));

describe("balanceCase", () => {
  it("hits the target RTP without touching the price", () => {
    const r = balanceCase({ priceMinor: 50_000, valuesMinor: ladder(50_000), priceStepMinor: step }, 0.9);
    expect(r.priceMinor).toBe(50_000);
    expect(r.rtp).toBeCloseTo(0.9, 3);
    expect(r.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Math.min(...r.probabilities)).toBeGreaterThan(0);
  });

  it("keeps the ride smooth: the median open returns a real share and many opens win", () => {
    const r = balanceCase({ priceMinor: 50_000, valuesMinor: ladder(50_000), priceStepMinor: step }, 0.9);
    expect(r.medianReturn).toBeGreaterThanOrEqual(0.3);
    expect(r.winShare).toBeGreaterThan(0.2);
  });

  it("works for other targets", () => {
    for (const rtp of [0.8, 0.85, 0.95]) {
      const r = balanceCase({ priceMinor: 50_000, valuesMinor: ladder(50_000), priceStepMinor: step }, rtp);
      expect(r.rtp).toBeCloseTo(rtp, 2);
    }
  });

  it("moves the price when the drops are far too valuable for it", () => {
    const r = balanceCase({ priceMinor: 10_000, valuesMinor: [352_100, 500_000, 12_000_000], priceStepMinor: step }, 0.9);
    expect(r.priceMinor).toBeGreaterThan(10_000);
    expect(r.priceMinor % step).toBe(0);
    expect(r.rtp).toBeCloseTo(0.9, 2);
  });

  it("moves the price down when the drops are too cheap", () => {
    const r = balanceCase({ priceMinor: 100_000, valuesMinor: [1000, 2000, 3000], priceStepMinor: step }, 0.9);
    expect(r.priceMinor).toBeLessThan(100_000);
  });

  it("rejects invalid drops", () => {
    expect(() => balanceCase({ priceMinor: 1000, valuesMinor: [0, 5], priceStepMinor: step })).toThrow();
  });
});
