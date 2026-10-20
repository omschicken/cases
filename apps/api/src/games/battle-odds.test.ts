import { describe, expect, it } from "vitest";
import { battleWinChance } from "./battle-odds";

describe("case battle win odds", () => {
  it("counts ties as player wins", () => {
    expect(battleWinChance([{ valueMinor: 100n, weight: 100 }])).toBe(1);
  });
  it("counts both drops and ties with equal weights", () => {
    expect(battleWinChance([{ valueMinor: 100n, weight: 1 }, { valueMinor: 200n, weight: 1 }])).toBeCloseTo(0.75);
  });
  it("handles weighted unequal drops", () => {
    expect(battleWinChance([{ valueMinor: 100n, weight: 3 }, { valueMinor: 200n, weight: 1 }])).toBeCloseTo(0.8125);
  });
  it("rejects invalid or empty pools", () => {
    expect(battleWinChance([])).toBe(0);
    expect(battleWinChance([{ valueMinor: 100n, weight: 0 }])).toBe(0);
  });
});
