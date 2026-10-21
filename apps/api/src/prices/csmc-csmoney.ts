/**
 * CSMarketCap minimum listing prices for CS.MONEY (CS2 app 730).
 * https://docs.csmarketcap.com/min-prices
 *
 * // Price units from the provider are USD * 1000, NOT cents.
 * Listings are identified by their exact market_hash_name; never guess phases,
 * exteriors or StatTrak variants.
 */
export interface CsMoneyQuote {
  marketHashName: string;
  priceUsdMilli: number;
  priceLockedUsdMilli: number | null;
  offers: number;
}

const GRAPHQL_ENDPOINT = "https://api.csmarketcap.com/api/v2/graphql";
const PRICES_ENDPOINT = "https://api.csmarketcap.com/api/v2/rest/get-aggregated-min-prices";

type JsonObject = Record<string, unknown>;
function record(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject : null;
}
function nonnegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function positiveInteger(value: unknown): number | null {
  const n = nonnegativeInteger(value);
  return n !== null && n > 0 ? n : null;
}

export function parseCsMoneyMinPrices(payload: unknown): Map<string, CsMoneyQuote> {
  const outer = record(payload);
  // REST returns an array; GraphQL and SDK can wrap the same collection.
  const nested = record(outer?.data);
  const rows = Array.isArray(payload) ? payload
    : Array.isArray(outer?.aggregatedMinPrices) ? outer.aggregatedMinPrices
    : Array.isArray(nested?.aggregatedMinPrices) ? nested.aggregatedMinPrices
    : null;
  if (!rows) throw new Error("CSMC min prices: unexpected response format");

  const quotes = new Map<string, CsMoneyQuote>();
  for (const unknownRow of rows) {
    const row = record(unknownRow);
    const name = row?.market_hash_name;
    if (typeof name !== "string" || !name.trim() || name !== name.trim() || name.length > 512) continue;
    if (!Array.isArray(row?.prices)) continue;
    const market = row.prices.map(record).find((p) => p?.market_name === "csmoney");
    if (!market) continue;
    const priceUsdMilli = positiveInteger(market.price);
    const offers = nonnegativeInteger(market.offers);
    if (priceUsdMilli === null || offers === null) continue;
    const priceLockedUsdMilli = market.price_locked === null || market.price_locked === undefined
      ? null : positiveInteger(market.price_locked);
    if (market.price_locked != null && priceLockedUsdMilli === null) continue;

    quotes.set(name, { marketHashName: name, priceUsdMilli, priceLockedUsdMilli, offers });
  }
  return quotes;
}

async function postJson(url: string, payload: unknown, headers: Record<string, string>): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(20_000, retryAfter * 1000) : (attempt + 1) * 2000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw new Error("CSMC API returned HTTP " + response.status);
      }
      return await response.json() as unknown;
    } catch (err) {
      if (attempt >= 2 || (err instanceof Error && err.message.startsWith("CSMC API returned HTTP"))) throw err;
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 2000));
    }
  }
  throw new Error("CSMC API retries exhausted");
}

/** Generates a fresh two-hour JWT each run. Never log the key or JWT. */
export async function fetchCsMoneyMinPrices(apiKey: string): Promise<Map<string, CsMoneyQuote>> {
  if (!apiKey) throw new Error("Missing CSMARKETCAP_API_KEY");
  // Use JSON quoting so unusual API-key characters cannot alter the GraphQL syntax.
  const authBody = await postJson(GRAPHQL_ENDPOINT, {
    query: "mutation { createSubscriptionToken(api_key: " + JSON.stringify(apiKey) + ") }",
  }, {});
  const auth = record(record(authBody)?.data);
  const jwt = auth?.createSubscriptionToken;
  if (typeof jwt !== "string" || jwt.length < 16) {
    throw new Error("CSMC API did not issue a JWT; check subscription and API key");
  }
  const priceBody = await postJson(PRICES_ENDPOINT, {
    game_id: 730,
    markets: ["csmoney"],
  }, { "api-token": jwt });
  return parseCsMoneyMinPrices(priceBody);
}
