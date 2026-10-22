/**
 * Images + rarity for Market.CSGO names, from the open ByMykel/CSGO-API dataset
 * (one entry per exact market_hash_name incl. wear). The file is large (~35 MB),
 * so the sync only reads it while images are missing.
 */
const SOURCE =
  "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins_not_grouped.json";

export interface SkinMeta {
  imageUrl: string;
  rarity: string | null;
}

export function parseSkinMeta(body: unknown): Map<string, SkinMeta> {
  if (!Array.isArray(body)) throw new Error("skin image dataset has an unexpected format");
  const out = new Map<string, SkinMeta>();
  for (const row of body as { market_hash_name?: unknown; image?: unknown; rarity?: { id?: unknown } }[]) {
    if (typeof row.market_hash_name !== "string" || typeof row.image !== "string") continue;
    const rarity = typeof row.rarity?.id === "string" ? row.rarity.id : null;
    out.set(row.market_hash_name, { imageUrl: row.image, rarity });
  }
  return out;
}

export async function fetchSkinMeta(): Promise<Map<string, SkinMeta>> {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`skin image dataset returned HTTP ${res.status}`);
  return parseSkinMeta(await res.json());
}
