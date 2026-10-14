import { describe, expect, it } from "vitest";
import { listedVariants, pricedVariants } from "../src/prices/market-catalog";

describe("market case variants", () => {
  const prices = new Map([
    ["AK-47 | Redline (Field-Tested)", 2494],
    ["AK-47 | Redline (Well-Worn)", 2313],
    ["StatTrak™ AK-47 | Redline (Field-Tested)", 6500],
  ]);

  it("uses only exact listed exterior names and prices", () => {
    expect(listedVariants("AK-47 | Redline", prices)).toEqual([
      { name: "AK-47 | Redline (Field-Tested)", valueMinor: 2494 },
      { name: "AK-47 | Redline (Well-Worn)", valueMinor: 2313 },
    ]);
  });

  it("preserves the original skin's total drop weight", () => {
    const variants = pricedVariants({ name: "AK-47 | Redline", weight: 3, valueMinor: 1 }, prices);
    expect(variants.map((item) => item.weight)).toEqual([1.5, 1.5]);
    expect(variants.reduce((sum, item) => sum + item.weight, 0)).toBe(3);
  });

  it("does not invent an unlisted price", () => {
    expect(pricedVariants({ name: "Unknown", weight: 3, valueMinor: 1 }, prices)).toEqual([]);
  });
});
