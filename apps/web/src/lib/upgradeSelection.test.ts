import { describe, expect, it } from "vitest";
import { nearestUpgradeTarget } from "./upgradeSelection";
import type { CaseItem } from "./types";
const make = (id: string, price: string): CaseItem => ({ id, name:id,imageUrl:"",currency:"RUB",rarity:"COVERT",weight:1,valueMinor:price });
describe("nearest-price upgrade target selection", () => {
  const items = [make("near-low","19000"),make("near-high","21000"),make("expensive","1000000"),make("invalid","8000")];
  it("autoselects the nearest eligible item to the multiplier", () => {
    expect(nearestUpgradeTarget(items,"10000",2)?.id).toBe("near-low");
    expect(nearestUpgradeTarget(items,"10000",1.5)?.id).toBe("near-low");
  });
  it("excludes cheaper or above 90x rewards", () => {
    expect(nearestUpgradeTarget([make("cheap","10000"),make("too-much","900001")],"10000",5)).toBeUndefined();
  });
  it("works with large BigInt values", () => {
    expect(nearestUpgradeTarget([make("large","200000000000000000000")],"100000000000000000000",2)?.id).toBe("large");
  });
});
