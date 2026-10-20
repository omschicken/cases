/**
 * Picks extra drops for a case from the live market catalog, spread over
 * value bands relative to the case price so every case gets cheap fillers,
 * mid-tier skins and a few chase items.
 */
export interface Candidate {
  name: string;
  priceMinor: number;
  imageUrl: string;
  rarity: string | null;
}

type Rarity = "CONSUMER" | "INDUSTRIAL" | "MIL_SPEC" | "RESTRICTED" | "CLASSIFIED" | "COVERT" | "GOLD";

const BANDS: Array<{ lo: number; hi: number; share: number }> = [
  { lo: 0.04, hi: 0.5, share: 0.4 },
  { lo: 0.6, hi: 2.5, share: 0.3 },
  { lo: 3, hi: 12, share: 0.2 },
  { lo: 15, hi: 100, share: 0.1 },
];

const DATASET_RARITY: Record<string, Rarity> = {
  rarity_common_weapon: "CONSUMER",
  rarity_uncommon_weapon: "INDUSTRIAL",
  rarity_rare_weapon: "MIL_SPEC",
  rarity_mythical_weapon: "RESTRICTED",
  rarity_legendary_weapon: "CLASSIFIED",
  rarity_ancient_weapon: "COVERT",
  rarity_ancient: "GOLD",
  rarity_contraband: "GOLD",
};

/** Rarity as the game enum; falls back to the price tier when the dataset has none. */
export function toItemRarity(datasetRarity: string | null, priceMinor: number, casePriceMinor: number): Rarity {
  const mapped = datasetRarity ? DATASET_RARITY[datasetRarity] : undefined;
  if (mapped) return mapped;
  const ratio = priceMinor / casePriceMinor;
  if (ratio < 0.15) return "CONSUMER";
  if (ratio < 0.5) return "INDUSTRIAL";
  if (ratio < 1.5) return "MIL_SPEC";
  if (ratio < 5) return "RESTRICTED";
  if (ratio < 20) return "CLASSIFIED";
  return "COVERT";
}

/** `skin` key: weapon + finish without wear, so one case never holds the same skin twice. */
const skinKey = (name: string) => name.replace(/ \([^)]*\)$/, "");

export function pickCaseItems(
  candidates: Candidate[],
  casePriceMinor: number,
  need: number,
  taken: Set<string>,
  random: () => number,
): Candidate[] {
  if (need <= 0) return [];
  const usedSkins = new Set([...taken].map(skinKey));
  const chosen: Candidate[] = [];

  const shuffled = (list: Candidate[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const take = (pool: Candidate[], n: number) => {
    for (const c of shuffled(pool)) {
      if (n <= 0) break;
      const key = skinKey(c.name);
      if (taken.has(c.name) || usedSkins.has(key)) continue;
      taken.add(c.name);
      usedSkins.add(key);
      chosen.push(c);
      n--;
    }
    return n;
  };

  let missing = 0;
  BANDS.forEach((band, index) => {
    const want = Math.max(index === BANDS.length - 1 && need >= 12 ? 1 : 0, Math.round(need * band.share)) + missing;
    const pool = candidates.filter((c) => c.priceMinor >= band.lo * casePriceMinor && c.priceMinor <= band.hi * casePriceMinor);
    missing = take(pool, Math.min(want, need - chosen.length));
  });

  // Bands that ran dry: take the closest-priced skins instead.
  if (chosen.length < need) {
    const byDistance = [...candidates].sort(
      (a, b) => Math.abs(Math.log(a.priceMinor / casePriceMinor)) - Math.abs(Math.log(b.priceMinor / casePriceMinor)),
    );
    take(byDistance.slice(0, 400), need - chosen.length);
  }
  return chosen;
}
