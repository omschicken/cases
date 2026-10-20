import { describe, expect, it } from "vitest";
import { isPlaceholderImageUrl, normalizeItemImageName, resolveItemImage, resolveItemImageSources } from "./itemImages";

describe("item image policy", () => {
  it("normalizes short and full wear suffixes", () => {
    expect(normalizeItemImageName("AK-47 | Slate (FT)")).toBe("AK-47 | Slate");
    expect(normalizeItemImageName("AK-47 | Slate (Field-Tested)")).toBe("AK-47 | Slate");
  });

  it("normalizes the catalog's Butterfly alias", () => {
    expect(normalizeItemImageName("Butterfly | Autotronic (BS)")).toBe("Butterfly Knife | Autotronic");
  });

  it("replaces a placeholder only with an exact official match", () => {
    const result = resolveItemImage("AK-47 | Slate (FT)", "https://placehold.co/300x300?text=Slate");
    expect(result.status).toBe("official");
    expect(result.url).toMatch(/^https:\/\/(community\.akamai\.steamstatic\.com|raw\.githubusercontent\.com)\//);
    expect(isPlaceholderImageUrl(result.url)).toBe(false);
  });

  it("keeps a non-placeholder remote URL when no exact match exists", () => {
    expect(resolveItemImage("Unknown | Exact Item", "https://example.test/item.png")).toEqual({
      url: "https://example.test/item.png",
      status: "remote",
    });
  });


  it("tries the exact original URL if an official CDN image fails", () => {
    const remote = "https://images.example.test/exact-item.png";
    const sources = resolveItemImageSources("AK-47 | Slate (FT)", remote);
    expect(sources[0]?.status).toBe("official");
    expect(sources[1]).toEqual({ url: remote, status: "remote" });
    expect(sources[0]?.url).not.toBe(remote);
  });

  it("never invents an image for Karambit Emerald", () => {
    expect(resolveItemImageSources("Karambit | Emerald (FN)", "https://placehold.co/320")).toEqual([]);
  });

  it("deduplicates the same approved image URL", () => {
    const official = resolveItemImage("AK-47 | Slate (FN)").url;
    const sources = resolveItemImageSources("AK-47 | Slate (FN)", official);
    expect(sources).toHaveLength(1);
  });

  it("uses the neutral fallback for missing or placeholder-only images", () => {
    expect(isPlaceholderImageUrl("https://placehold.co/300x300")).toBe(true);
    expect(resolveItemImage("SG 553 | Phantasm (FN)", "https://placehold.co/300x300")).toEqual({
      url: null,
      status: "fallback",
    });
  });
});
