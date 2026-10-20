/**
 * Market.CSGO public price lists — the same market the winners' skins will be
 * bought from, so a price here is a real purchase price, not a reference quote.
 *
 *   GET https://market.csgo.com/api/v2/prices/{RUB|USD}.json   (no key needed)
 *   -> { success, currency, items: [{ market_hash_name, price: "12.345", volume: "32" }] }
 *
 * `price` is the lowest asking price for that exact market_hash_name and
 * `volume` the number of lots at the moment of the snapshot.
 */
export interface MarketCsgoQuote {
  /** Lowest asking price, in minor units (kopecks / cents). */
  priceMinor: number;
  /** Lots on sale. Few lots (1–2) means the price is a single seller's opinion. */
  volume: number;
}

/** A healthy snapshot has ~27 000 names; far fewer means a partial outage, not a market. */
const MIN_EXPECTED_NAMES = 5_000;

export async function fetchMarketCsgoPrices(currency: "RUB" | "USD"): Promise<Map<string, MarketCsgoQuote>> {
  const response = await fetch(`https://market.csgo.com/api/v2/prices/${currency}.json`, {
    headers: { "User-Agent": "DROPZONE price sync" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Market.CSGO ${currency} prices returned HTTP ${response.status}`);
  return parseMarketCsgoPrices(await response.json(), currency);
}

export function parseMarketCsgoPrices(body: unknown, currency: string): Map<string, MarketCsgoQuote> {
  const data = body as { success?: boolean; currency?: string; items?: unknown };
  if (!data || data.success !== true || data.currency !== currency || !Array.isArray(data.items)) {
    throw new Error(`Market.CSGO ${currency} prices have an unexpected format`);
  }
  const quotes = new Map<string, MarketCsgoQuote>();
  for (const row of data.items as { market_hash_name?: unknown; price?: unknown; volume?: unknown }[]) {
    if (typeof row.market_hash_name !== "string") continue;
    const price = Number(row.price);
    const volume = Number(row.volume);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(volume) || volume < 1) continue;
    const priceMinor = Math.round(price * 100);
    if (Number.isSafeInteger(priceMinor) && priceMinor > 0) quotes.set(row.market_hash_name, { priceMinor, volume });
  }
  if (quotes.size < MIN_EXPECTED_NAMES) {
    throw new Error(`Market.CSGO ${currency} prices look incomplete (${quotes.size} names)`);
  }
  return quotes;
}
