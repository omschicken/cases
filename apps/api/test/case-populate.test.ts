import { describe, expect, it } from "vitest";
import { pickCaseItems, toItemRarity, type Candidate } from "../src/prices/case-populate";

function catalog(): Candidate[] {
  const list: Candidate[] = [];
  for (let i = 0; i < 600; i++) {
    list.push({ name: `Gun${i % 40} | Skin${i} (Field-Tested)`, priceMinor: Math.round(3000 * Math.pow(1.012, i)), imageUrl: "x", rarity: null });
  }
  return list;
}
const seeded = () => {
  let s = 7;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};

describe("pickCaseItems", () => {
  it("fills the requested count with distinct skins across price bands", () => {
    const price = 50_000;
    const picked = pickCaseItems(catalog(), price, 18, new Set(), seeded());
    expect(picked).toHaveLength(18);
    expect(new Set(picked.map((p) => p.name)).size).toBe(18);
    expect(picked.some((p) => p.priceMinor < 0.5 * price)).toBe(true);
    expect(picked.some((p) => p.priceMinor > 3 * price)).toBe(true);
  });

  it("never repeats an item that is already taken", () => {
    const all = catalog();
    const taken = new Set(all.slice(0, 300).map((c) => c.name));
    const picked = pickCaseItems(all, 50_000, 15, taken, seeded());
    expect(picked.every((p) => !all.slice(0, 300).some((t) => t.name === p.name))).toBe(true);
  });
});

describe("toItemRarity", () => {
  it("maps dataset rarities and falls back to price tiers", () => {
    expect(toItemRarity("rarity_legendary_weapon", 1, 1)).toBe("CLASSIFIED");
    expect(toItemRarity("rarity_ancient", 1, 1)).toBe("GOLD");
    expect(toItemRarity(null, 100, 1000)).toBe("CONSUMER");
    expect(toItemRarity(null, 50_000, 1000)).toBe("COVERT");
  });
});
