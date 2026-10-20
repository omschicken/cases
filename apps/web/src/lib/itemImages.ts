import officialItemImages from "../data/item-image-overrides.json";

const EXTERIOR_PATTERN = / \((FN|MW|FT|WW|BS|Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/;

const ITEM_NAME_ALIASES: Record<string, string> = {
  "Butterfly |": "Butterfly Knife |",
};

export type ItemImageStatus = "official" | "remote" | "fallback";

export function normalizeItemImageName(name: string): string {
  let normalized = name.replace(EXTERIOR_PATTERN, "").replace(/^★ /, "").trim();
  for (const [prefix, replacement] of Object.entries(ITEM_NAME_ALIASES)) {
    if (normalized.startsWith(prefix)) normalized = replacement + normalized.slice(prefix.length);
  }
  return normalized;
}

export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return true;
  return url.startsWith("data:") || /placehold(?:er)?\.co/i.test(url);
}

export function resolveItemImage(name: string, currentUrl?: string | null): {
  url: string | null;
  status: ItemImageStatus;
} {
  const official = (officialItemImages as Record<string, string>)[normalizeItemImageName(name)];
  if (official) return { url: official, status: "official" };
  if (!isPlaceholderImageUrl(currentUrl)) return { url: currentUrl ?? null, status: "remote" };
  return { url: null, status: "fallback" };
}

/**
 * Ordered, exact-match image sources. A stale official CDN URL must not hide
 * a valid inventory URL; never substitute a different weapon or finish.
 */
export function resolveItemImageSources(name: string, currentUrl?: string | null): Array<{
  url: string;
  status: Exclude<ItemImageStatus, "fallback">;
}> {
  const preferred = resolveItemImage(name, currentUrl);
  const sources: Array<{ url: string; status: Exclude<ItemImageStatus, "fallback"> }> = [];
  if (preferred.url && preferred.status !== "fallback") {
    sources.push({ url: preferred.url, status: preferred.status });
  }
  if (!isPlaceholderImageUrl(currentUrl) && currentUrl && !sources.some((source) => source.url === currentUrl)) {
    sources.push({ url: currentUrl, status: "remote" });
  }
  return sources;
}
