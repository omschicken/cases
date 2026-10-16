/**
 * Creates the six flagship cases through the admin API.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @cs2-cases/api seed:cases
 *   pnpm --filter @cs2-cases/api seed:cases -- --dry-run     (no network, prints the plan)
 *
 * Skin names, Steam CDN image URLs and prices are NOT typed in here: every item
 * is looked up by exact name in prisma/cs2-items.json (the catalog the main seed
 * uses) and then expanded into its listed exterior variants with LIVE Skinport
 * RUB prices, exactly like prisma/seed.ts. A name with no catalog entry or no
 * live listing stops the run with the full list of misses — nothing is guessed.
 * --dry-run skips the network and prints the plan with catalog prices instead.
 *
 * POST /admin/cases stores the price it is given as-is, so the script computes
 * it with marketCasePrice() (the same helper the reprice job uses).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketCasePrice } from "../src/prices/case-pricing";
import { fetchMarketListings, pricedVariants } from "../src/prices/market-catalog";

type Rarity = "MIL_SPEC" | "RESTRICTED" | "CLASSIFIED" | "COVERT" | "GOLD";

interface CatalogItem { name: string; rarity: string; valueMinor: number; imageUrl: string; }
interface CaseSpec { slug: string; name: string; theme: string; drops: Record<Rarity, string[]>; }

/**
 * Real CS2 case odds (79.92 / 15.98 / 3.2 / 0.64 / 0.26 %), as weights out of 1000.
 * CS2 cases contain nothing below Mil-Spec, and the catalog has no Consumer or
 * Industrial skins (and no images for them), so those tiers are not used.
 * Each tier's weight is split evenly across the items listed for it.
 */
const TIER_WEIGHT: Record<Rarity, number> = { MIL_SPEC: 799, RESTRICTED: 160, CLASSIFIED: 32, COVERT: 6, GOLD: 3 };
const TIERS = Object.keys(TIER_WEIGHT) as Rarity[];
const CURRENCY = "RUB";
const MIN_PRICE_MINOR = 5_000; // never list a case under 50 RUB

const CASES: CaseSpec[] = [
  {
    slug: "ignition-case", name: "Ignition Case", theme: "fire / red",
    drops: {
      MIL_SPEC: ["Five-SeveN | Flame Test", "MAG-7 | Firestarter", "Glock-18 | Bunsen Burner", "Desert Eagle | Oxide Blaze", "Glock-18 | Oxide Blaze", "XM1014 | Oxide Blaze", "P2000 | Red FragCam", "MAC-10 | Carnivore"],
      RESTRICTED: ["Desert Eagle | Crimson Web", "MAC-10 | Heat", "MAG-7 | Heat", "P250 | Inferno", "Galil AR | Crimson Tsunami"],
      CLASSIFIED: ["AK-47 | Redline", "M4A4 | Hellfire", "AWP | Redline"],
      COVERT: ["AK-47 | Bloodsport", "P2000 | Fire Elemental"],
      GOLD: ["★ Karambit | Doppler", "★ M9 Bayonet | Fade"],
    },
  },
  {
    slug: "static-case", name: "Static Case", theme: "electric / blue",
    drops: {
      MIL_SPEC: ["Galil AR | Blue Titanium", "Tec-9 | Blue Titanium", "Glock-18 | Blue Fissure", "Desert Eagle | Blue Ply", "MAG-7 | Cobalt Core", "PP-Bizon | Cobalt Halftone", "P2000 | Oceanic", "SCAR-20 | Blueprint"],
      RESTRICTED: ["AK-47 | Blue Laminate", "M4A1-S | Bright Water", "AWP | Phobos", "Dual Berettas | Hydro Strike", "USP-S | Dark Water"],
      CLASSIFIED: ["AWP | Electric Hive", "M4A1-S | Atomic Alloy", "Desert Eagle | Cobalt Disruption"],
      COVERT: ["AWP | Lightning Strike", "Desert Eagle | Ocean Drive"],
      GOLD: ["★ Butterfly Knife | Blue Steel", "★ Talon Knife | Blue Steel"],
    },
  },
  {
    slug: "overdrive-case", name: "Overdrive Case", theme: "speed / violet",
    drops: {
      MIL_SPEC: ["MAC-10 | Ultraviolet", "SG 553 | Ultraviolet", "Five-SeveN | Violent Daimyo", "Tec-9 | Flash Out", "Galil AR | Rocket Pop", "FAMAS | Crypsis", "MP9 | Dart", "P250 | Cassette"],
      RESTRICTED: ["AK-47 | Orbit Mk01", "M4A4 | Spider Lily", "P90 | Neoqueen", "MP9 | Mount Fuji", "Sawed-Off | Limelight"],
      CLASSIFIED: ["P90 | Trigon", "AUG | Syd Mead", "AWP | Fever Dream"],
      COVERT: ["M4A1-S | Player Two", "AK-47 | Neon Rider"],
      GOLD: ["★ Karambit | Ultraviolet", "★ Skeleton Knife | Ultraviolet"],
    },
  },
  {
    slug: "meltdown-case", name: "Meltdown Case", theme: "nuclear / green",
    drops: {
      MIL_SPEC: ["MP9 | Bioleak", "MP9 | Deadly Poison", "SCAR-20 | Green Marine", "USP-S | PC-GRN", "G3SG1 | Demeter", "MAG-7 | Resupply", "M249 | Magma", "SCAR-20 | Outbreak"],
      RESTRICTED: ["M249 | Emerald Poison Dart", "P90 | Virus", "AWP | Atheris", "G3SG1 | Dream Glade", "Nova | Gila"],
      CLASSIFIED: ["P90 | Emerald Dragon", "M4A4 | Desolate Space", "Galil AR | Eco"],
      COVERT: ["AK-47 | Fuel Injector", "M4A1-S | Chantico's Fire"],
      GOLD: ["★ Bayonet | Boreal Forest", "★ Falchion Knife | Boreal Forest"],
    },
  },
  {
    slug: "blacklight-case", name: "Blacklight Case", theme: "neon / pink",
    drops: {
      MIL_SPEC: ["Five-SeveN | Capillary", "FAMAS | Meow 36", "FAMAS | Doomkitty", "MAC-10 | Rangeen", "Galil AR | Rocket Pop", "AUG | Tom Cat", "MP9 | Capillary", "P250 | Re.built"],
      RESTRICTED: ["MP7 | Neon Ply", "MAC-10 | Allure", "P90 | Neoqueen", "Glock-18 | Umbral Rabbit", "CZ75-Auto | Pole Position"],
      CLASSIFIED: ["Sawed-Off | Kiss♥Love", "Five-SeveN | Fairy Tale", "AUG | Death by Puppy"],
      COVERT: ["P90 | Death by Kitty", "MAC-10 | Neon Rider"],
      GOLD: ["★ Butterfly Knife | Marble Fade", "★ Karambit | Marble Fade"],
    },
  },
  {
    slug: "sovereign-case", name: "Sovereign Case", theme: "gold / premium",
    drops: {
      MIL_SPEC: ["Desert Eagle | Bronze Deco", "Desert Eagle | Corinthian", "P2000 | Imperial", "AUG | Luxe Trim", "AK-47 | Elite Build", "P90 | Elite Build", "Dual Berettas | Panther", "M4A4 | Poly Mag"],
      RESTRICTED: ["UMP-45 | Gold Bismuth", "Glock-18 | Royal Legion", "Dual Berettas | Royal Consorts", "AUG | Aristocrat", "M4A4 | Evil Daimyo"],
      CLASSIFIED: ["P2000 | Imperial Dragon", "M4A4 | 龍王 (Dragon King)", "M4A1-S | Decimator"],
      COVERT: ["M4A1-S | Golden Coil", "Desert Eagle | Golden Koi"],
      GOLD: ["★ Butterfly Knife | Fade", "★ Talon Knife | Fade"],
    },
  },
];

const catalog = new Map<string, CatalogItem>();
for (const c of JSON.parse(readFileSync(join(__dirname, "../prisma/cs2-items.json"), "utf8")) as { items: CatalogItem[] }[]) {
  for (const item of c.items) if (!catalog.has(item.name)) catalog.set(item.name, item);
}

function buildPayload(spec: CaseSpec, prices?: ReadonlyMap<string, number>) {
  const items = TIERS.flatMap((tier) => {
    const names = spec.drops[tier];
    return names.flatMap((name) => {
      const found = catalog.get(name);
      if (!found) throw new Error(`${spec.slug}: "${name}" is not in prisma/cs2-items.json`);
      if (found.rarity !== tier) throw new Error(`${spec.slug}: "${name}" is ${found.rarity} in the catalog, listed as ${tier}`);
      const base = { name, imageUrl: found.imageUrl, weight: TIER_WEIGHT[tier] / names.length, valueMinor: found.valueMinor, currency: CURRENCY, rarity: tier };
      if (!prices) return [base];
      const variants = pricedVariants(base, prices);
      if (variants.length === 0) throw new Error(`${spec.slug}: no live RUB listing for "${name}"`);
      return variants;
    });
  });
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (Math.abs(total - 1000) > 1e-6) throw new Error(`${spec.slug}: weights sum to ${total}, expected 1000`);
  const chase = items.find((i) => i.rarity === "GOLD") ?? items[items.length - 1];
  return {
    slug: spec.slug,
    name: spec.name,
    priceMinor: marketCasePrice(items, MIN_PRICE_MINOR),
    currency: CURRENCY,
    imageUrl: chase.imageUrl,
    items,
  };
}

/** Validates every case before touching the network, so a typo can't leave half the set created. */
function buildAll(prices?: ReadonlyMap<string, number>) {
  const missing: string[] = [];
  const payloads = [];
  for (const spec of CASES) {
    try { payloads.push(buildPayload(spec, prices)); } catch (e) { missing.push((e as Error).message); }
  }
  if (missing.length) {
    console.error(`\n${missing.length} problem(s):\n  - ${missing.join("\n  - ")}\n`);
    process.exit(1);
  }
  return payloads;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const payloads = buildAll(dryRun ? undefined : await fetchMarketListings(CURRENCY));
  const rub = (m: number) => `${(m / 100).toFixed(2)} RUB`;

  if (dryRun) {
    for (const p of payloads) {
      const ev = p.items.reduce((s, i) => s + i.weight * i.valueMinor, 0) / 1000;
      console.log(`${p.slug.padEnd(16)} ${String(p.items.length).padStart(2)} items  EV ${rub(ev).padStart(12)}  price ${rub(p.priceMinor).padStart(12)}`);
    }
    return;
  }

  const base = (process.env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD");

  const login = await fetch(`${base}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error(`Login failed: HTTP ${login.status}`);
  const { accessToken } = (await login.json()) as { accessToken: string };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };

  const existing = await fetch(`${base}/admin/cases`, { headers });
  if (!existing.ok) throw new Error(`GET /admin/cases failed: HTTP ${existing.status}`);
  const have = new Set(((await existing.json()) as { slug: string }[]).map((c) => c.slug));

  let failed = 0;
  for (const p of payloads) {
    if (have.has(p.slug)) { console.log(`skip     ${p.slug} (already exists)`); continue; }
    const res = await fetch(`${base}/admin/cases`, { method: "POST", headers, body: JSON.stringify(p) });
    if (res.ok) console.log(`created  ${p.slug}  ${p.items.length} items  ${rub(p.priceMinor)}`);
    else { failed++; console.error(`FAILED   ${p.slug}  HTTP ${res.status}  ${await res.text()}`); }
  }
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
