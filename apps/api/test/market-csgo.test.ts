import { describe, expect, it } from "vitest";
import { parseMarketCsgoPrices } from "../src/prices/market-csgo";

const body = (items: unknown[], extra: object = {}) => ({ success: true, currency: "RUB", items, ...extra });
const filler = Array.from({ length: 5000 }, (_, i) => ({ market_hash_name: `Skin ${i}`, price: "1.5", volume: "3" }));

describe("parseMarketCsgoPrices", () => {
  it("reads price strings into minor units and keeps volume", () => {
    const m = parseMarketCsgoPrices(body([...filler, { market_hash_name: "AK-47 | Redline (Field-Tested)", price: "1234.567", volume: "12" }]), "RUB");
    expect(m.get("AK-47 | Redline (Field-Tested)")).toEqual({ priceMinor: 123457, volume: 12 });
  });
  it("drops names with no lots or no price", () => {
    const m = parseMarketCsgoPrices(body([...filler, { market_hash_name: "Sold out", price: "5", volume: "0" }, { market_hash_name: "Free", price: "0", volume: "4" }]), "RUB");
    expect(m.has("Sold out")).toBe(false);
    expect(m.has("Free")).toBe(false);
  });
  it("rejects a wrong currency, a failure flag and a partial list", () => {
    expect(() => parseMarketCsgoPrices(body(filler, { currency: "USD" }), "RUB")).toThrow(/unexpected format/);
    expect(() => parseMarketCsgoPrices(body(filler, { success: false }), "RUB")).toThrow(/unexpected format/);
    expect(() => parseMarketCsgoPrices(body(filler.slice(0, 100)), "RUB")).toThrow(/incomplete/);
  });
});
