/**
 * Import CS.MONEY quotes into independent reference tables.
 * Does not reprice cases or mutate wallets, inventory, or historical drops.
 */
import { PrismaClient } from "@prisma/client";
import { fetchCsMoneyMinPrices } from "../src/prices/csmc-csmoney";

const CHUNK = 1500;
const MIN_QUOTES = 1000;
const prisma = new PrismaClient();

async function main() {
  const key = process.env.CSMARKETCAP_API_KEY;
  if (!key) throw new Error("Missing CSMARKETCAP_API_KEY GitHub Actions secret");
  const tables = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('market_csmoney_quote', 'market_csmoney_sync_state')");
  if (tables.length !== 2) throw new Error("CS.MONEY tables are absent; apply migration first");

  // Prevent concurrent and unexpectedly expensive third-party calls.
  const claimed = await prisma.$queryRawUnsafe<{ id: number }[]>(
    "UPDATE market_csmoney_sync_state SET last_started=now(), last_error=NULL WHERE id=1 " +
    "AND (last_started IS NULL OR last_started < now()-interval '10 minutes') " +
    "AND (last_success IS NULL OR last_success < now()-interval '10 minutes') RETURNING id");
  if (!claimed.length) {
    console.log("CS.MONEY sync skipped: run in progress or snapshot still recent");
    return;
  }

  const t0 = Date.now();
  try {
    const quotes = await fetchCsMoneyMinPrices(key);
    if (quotes.size < MIN_QUOTES) {
      throw new Error("Incomplete CS.MONEY snapshot (" + quotes.size + " quotes; minimum " + MIN_QUOTES + ")");
    }
    const entries = [...quotes.values()];
    for (let start = 0; start < entries.length; start += CHUNK) {
      const batch = entries.slice(start, start + CHUNK).map((q) => ({
        name: q.marketHashName, price: q.priceUsdMilli,
        locked: q.priceLockedUsdMilli, offers: q.offers,
      }));
      const payload = JSON.stringify(batch);
      await prisma.$executeRawUnsafe(
        "INSERT INTO market_csmoney_quote " +
        "(market_hash_name, price_usd_milli, price_locked_usd_milli, offers, observed_at) " +
        "SELECT x.name, x.price, x.locked, x.offers, now() " +
        "FROM jsonb_to_recordset($1::jsonb) AS x(name text, price bigint, locked bigint, offers integer) " +
        "ON CONFLICT (market_hash_name) DO UPDATE SET " +
        "price_usd_milli=EXCLUDED.price_usd_milli, " +
        "price_locked_usd_milli=EXCLUDED.price_locked_usd_milli, " +
        "offers=EXCLUDED.offers, observed_at=EXCLUDED.observed_at",
        payload,
      );
    }
    // Never delete absent items, reset prices to zero, or infer zero stock.
    await prisma.$executeRawUnsafe(
      "UPDATE market_csmoney_sync_state SET last_success=now(), last_error=NULL, " +
      "rows_received=$1, rows_saved=$2, duration_ms=$3 WHERE id=1",
      quotes.size, quotes.size, Date.now()-t0,
    );
    console.log(JSON.stringify({ provider: "CSMarketCap", market: "csmoney",
      quotes: quotes.size, durationMs: Date.now()-t0 }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync failure";
    await prisma.$executeRawUnsafe(
      "UPDATE market_csmoney_sync_state SET last_error=$1, duration_ms=$2 WHERE id=1",
      message.slice(0,400), Date.now()-t0,
    );
    throw err;
  }
}

main().catch((err) => {
  console.error("CS.MONEY sync failed:", err instanceof Error ? err.message : "unknown failure");
  process.exitCode=1;
}).finally(async () => prisma.$disconnect());
