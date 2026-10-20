/**
 * Read-only: prints the real Market.CSGO price of each wear of the given skins,
 * so numbers can be checked by eye before anything is priced from them.
 * Touches no database.
 *
 *   pnpm --filter @cs2-cases/api exec tsx prisma/price-report.ts "AK-47 | Redline" "★ Karambit | Fade"
 */
import { fetchMarketCsgoPrices } from "../src/prices/market-csgo";
import { EXTERIORS } from "../src/prices/market-catalog";

async function main() {
  const names = process.argv.slice(2);
  if (names.length === 0) {
    console.error('usage: price-report.ts "AK-47 | Redline" ["★ Karambit" ...]');
    process.exit(1);
  }
  const [rub, usd] = await Promise.all([fetchMarketCsgoPrices("RUB"), fetchMarketCsgoPrices("USD")]);
  console.log(`snapshot: ${rub.size} names (RUB), ${usd.size} (USD)\n`);
  for (const base of names) {
    console.log(base);
    const variants = [base, ...EXTERIORS.map((e) => `${base} (${e})`)].filter((n) => rub.has(n));
    if (variants.length === 0) console.log("   not listed\n");
    for (const n of variants) {
      const r = rub.get(n)!;
      const u = usd.get(n);
      const wear = n === base ? "(no wear)" : n.slice(base.length + 2, -1);
      console.log(
        `   ${wear.padEnd(16)} ${(r.priceMinor / 100).toLocaleString("ru-RU").padStart(12)} ₽  ${u ? `$${(u.priceMinor / 100).toLocaleString("en-US")}`.padStart(11) : "".padStart(11)}  ${String(r.volume).padStart(4)} lots${r.volume <= 2 ? "  ⚠ thin" : ""}`,
      );
    }
    console.log();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
