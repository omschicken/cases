import { describe, expect, it } from "vitest";
import { parseCsMoneyMinPrices } from "../src/prices/csmc-csmoney";

const wrap = (items: unknown[]) => ({ data: { aggregatedMinPrices: items } });
const listing = (name: string, price: unknown, offers: unknown, locked: unknown = null) => ({
  market_hash_name: name,
  prices: [{ market_name: "csmoney", price, offers, price_locked: locked }],
});

describe("CSMarketCap / CS.MONEY bulk quote parser", () => {
  it("preserves exact market names and USD-thousandth units", () => {
    const result = parseCsMoneyMinPrices(wrap([
      listing("AK-47 | Redline (Field-Tested)", 12345, 14, 12555),
      listing("★ Karambit | Doppler (Factory New)", 2314567, 1),
    ]));
    expect(result.get("AK-47 | Redline (Field-Tested)")).toEqual({
      marketHashName: "AK-47 | Redline (Field-Tested)",
      priceUsdMilli: 12345, priceLockedUsdMilli: 12555, offers: 14,
    });
    expect(result.get("★ Karambit | Doppler (Factory New)")?.priceUsdMilli).toBe(2314567);
  });

  it("supports REST arrays, preserves legitimate zero-offer snapshots, and ignores other markets", () => {
    const result = parseCsMoneyMinPrices([
      listing("MP9 | Ruby Poison Dart (Factory New)", 2000, 0),
      { market_hash_name: "Other", prices: [{ market_name: "skinport", price: 2222, offers: 3 }] },
    ]);
    expect(result.get("MP9 | Ruby Poison Dart (Factory New)")?.offers).toBe(0);
    expect(result.has("Other")).toBe(false);
  });

  it("rejects malformed prices, negative lots, and unexplained units", () => {
    const result = parseCsMoneyMinPrices([
      listing("Invalid numeric string", "12.20", 2),
      listing("Zero", 0, 2),
      listing("No stock count", 100, null),
      listing("Negative", 250, -1),
      listing("Bad locked", 100, 1, -2),
      listing("Valid", 100, 1),
    ]);
    expect([...result.keys()]).toEqual(["Valid"]);
  });

  it("does not guess phase, StatTrak or wear from the item name", () => {
    const result = parseCsMoneyMinPrices([listing("★ Butterfly Knife | Doppler (Factory New)", 100000, 4)]);
    expect(result.has("★ Butterfly Knife | Doppler (Factory New)")).toBe(true);
    expect(result.has("★ Butterfly Knife | Doppler Ruby (Factory New)")).toBe(false);
  });

  it("refuses an unexpected response shape", () => {
    expect(() => parseCsMoneyMinPrices({ message: "unauthorized" })).toThrow(/unexpected response/);
    expect(() => parseCsMoneyMinPrices(null)).toThrow(/unexpected response/);
  });
});
