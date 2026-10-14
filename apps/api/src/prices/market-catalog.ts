export const EXTERIORS = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
] as const;

export interface MarketListing {
  market_hash_name: string;
  currency: string;
  min_price: number | null;
}

export async function fetchMarketListings(currency: "RUB" | "USD"): Promise<Map<string, number>> {
  const url = `https://api.skinport.com/v1/items?app_id=730&currency=${currency}`;
  const response = await fetch(url, {
    headers: { "Accept-Encoding": "br", "User-Agent": "DROPZONE CS2 catalog" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Skinport ${currency} catalog returned HTTP ${response.status}`);

  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error(`Skinport ${currency} catalog has an unexpected format`);

  const prices = new Map<string, number>();
  for (const row of body as MarketListing[]) {
    if (row.currency !== currency || typeof row.market_hash_name !== "string") continue;
    if (typeof row.min_price !== "number" || !Number.isFinite(row.min_price) || row.min_price <= 0) continue;
    const minor = Math.round(row.min_price * 100);
    if (Number.isSafeInteger(minor) && minor > 0) prices.set(row.market_hash_name, minor);
  }
  if (prices.size === 0) throw new Error(`Skinport ${currency} catalog contains no priced items`);
  return prices;
}

/** Only use exact, listed market names. Never guess the price of an exterior. */
export function listedVariants(baseName: string, prices: ReadonlyMap<string, number>) {
  return [baseName, ...EXTERIORS.map((exterior) => `${baseName} (${exterior})`)]
    .filter((name) => prices.has(name))
    .map((name) => ({ name, valueMinor: prices.get(name)! }));
}

export function pricedVariants<T extends { name: string; valueMinor: number; weight: number }>(
  item: T,
  prices: ReadonlyMap<string, number>,
): T[] {
  const variants = listedVariants(item.name, prices);
  return variants.map((variant) => ({
    ...item,
    name: variant.name,
    valueMinor: variant.valueMinor,
    weight: item.weight / variants.length,
  }));
}
