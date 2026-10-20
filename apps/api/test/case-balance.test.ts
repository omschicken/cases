import { describe, expect, it } from "vitest";
import { balanceCase } from "../src/prices/case-balance";

const step = 1000;

describe("balanceCase", () => {
  it("hits the target RTP for a wide pool without touching the price", () => {
    const r = balanceCase({ priceMinor: 10_000, valuesMinor: [1000, 5000, 20_000, 100_000, 5_000_000], priceStepMinor: step });
    expect(r.priceMinor).toBe(10_000);
    expect(r.rtp).toBeCloseTo(0.8, 3);
    expect(r.probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(Math.min(...r.probabilities)).toBeGreaterThan(0);
  });

  it("makes pricier drops rarer", () => {
    const r = balanceCase({ priceMinor: 10_000, valuesMinor: [1000, 5000, 20_000, 100_000], priceStepMinor: step });
    for (let i = 1; i < r.probabilities.length; i++) expect(r.probabilities[i]).toBeLessThan(r.probabilities[i - 1]);
  });

  it("raises the price when even the cheapest drop is too valuable", () => {
    const r = balanceCase({ priceMinor: 149_900, valuesMinor: [352_100, 500_000, 12_000_000], priceStepMinor: step });
    expect(r.priceMinor).toBeGreaterThan(149_900);
    expect(r.priceMinor % step).toBe(0);
    expect(r.rtp).toBeCloseTo(0.8, 3);
  });

  it("lowers the price when the pool is too cheap", () => {
    const r = balanceCase({ priceMinor: 100_000, valuesMinor: [1000, 2000, 3000], priceStepMinor: step });
    expect(r.priceMinor).toBeLessThan(100_000);
    expect(r.rtp).toBeCloseTo(0.8, 2);
  });

  it("rejects invalid drops", () => {
    expect(() => balanceCase({ priceMinor: 1000, valuesMinor: [0, 5], priceStepMinor: step })).toThrow();
  });
});
