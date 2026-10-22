import { describe, expect, it } from "vitest";
import { resolveMarketName } from "../src/prices/market-names";

const catalog = new Set([
  "AK-47 | Slate (Factory New)",
  "★ Butterfly Knife | Lore (Minimal Wear)",
  "★ Karambit | Fade (Factory New)",
  "AWP | Asiimov (Field-Tested)",
  "★ Sport Gloves | Vice (Field-Tested)",
]);
const has = (n: string) => catalog.has(n);

describe("resolveMarketName", () => {
  it("expands wear abbreviations", () => {
    expect(resolveMarketName("AK-47 | Slate (FN)", has)).toBe("AK-47 | Slate (Factory New)");
  });
  it("adds the star and full knife name", () => {
    expect(resolveMarketName("Karambit | Fade (FN)", has)).toBe("★ Karambit | Fade (Factory New)");
    expect(resolveMarketName("Butterfly | Lore (MW)", has)).toBe("★ Butterfly Knife | Lore (Minimal Wear)");
    expect(resolveMarketName("Sport Gloves | Vice (FT)", has)).toBe("★ Sport Gloves | Vice (Field-Tested)");
  });
  it("falls back to the closest wear that exists", () => {
    expect(resolveMarketName("AWP | Asiimov (FN)", has)).toBe("AWP | Asiimov (Field-Tested)");
  });
  it("returns null when nothing matches", () => {
    expect(resolveMarketName("Nope | Nothing (FN)", has)).toBeNull();
  });
});
