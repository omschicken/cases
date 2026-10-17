/**
 * Creates six flagship cases through the admin API.
 *
 *   ADMIN_JWT=eyJ... pnpm --filter @cs2-cases/api seed:cases
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm --filter @cs2-cases/api seed:cases   (logs in for you)
 *   pnpm --filter @cs2-cases/api seed:cases -- --dry-run                          (no network)
 *
 * Env: API_URL (default https://cases-x18t.vercel.app/api), ADMIN_JWT or --jwt=<token>,
 *      SLUG_SUFFIX (e.g. "-v2": create alongside existing slugs instead of skipping),
 *      ONLY (comma-separated base slugs, e.g. "static-case,overdrive-case"; default: all six).
 *
 * Notes on the data:
 * - Drops, exteriors, rarities and RUB prices below are the design brief, verbatim.
 * - POST /admin/cases stores priceMinor as given — the server does NOT reprice. So the
 *   script prices each case with marketCasePrice() (EV / 0.9), using the brief's
 *   "~price" only as a floor. Quoting the brief's price alone would sell cases below EV.
 * - Image URLs come from prisma/cs2-items.json (real Steam CDN links). Skins missing from
 *   that catalog use a clearly marked placeholder (see PLACEHOLDER_IMAGE) and are listed
 *   in the output — paste the real URL into IMAGE_OVERRIDES to fix them.
 * - Rarity enum values are CONSUMER / INDUSTRIAL (the API rejects *_GRADE).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marketCasePrice } from "../src/prices/case-pricing";

type Rarity = "CONSUMER" | "INDUSTRIAL" | "MIL_SPEC" | "RESTRICTED" | "CLASSIFIED" | "COVERT" | "GOLD";
type Exterior = "FN" | "MW" | "FT" | "WW" | "BS";
/** [skin name, exterior, price in RUB] */
type Drop = [string, Exterior, number];
interface CaseSpec { slug: string; name: string; floorRub: number; drops: Record<Rarity, Drop[]>; }

const EXTERIOR: Record<Exterior, string> = {
  FN: "Factory New", MW: "Minimal Wear", FT: "Field-Tested", WW: "Well-Worn", BS: "Battle-Scarred",
};

/** Relative tier weights; each tier's weight is split evenly across its drops. */
const TIER_WEIGHT: Record<Rarity, number> = {
  CONSUMER: 4000, INDUSTRIAL: 3200, MIL_SPEC: 1600, RESTRICTED: 700, CLASSIFIED: 350, COVERT: 130, GOLD: 20,
};
const TIERS = Object.keys(TIER_WEIGHT) as Rarity[];
const CURRENCY = "RUB";

/** Real Steam CDN URLs for skins the bundled catalog doesn't have, keyed by base name (no exterior). */
const IMAGE_OVERRIDES: Record<string, string> = {
  "FAMAS | Valence": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL3n5vh7h1a_s2oaalsM8-QAWmEzvtkj-xsSyCmmFN25TmEyo7_eHLFbQF2XpMlROVct0PtwIG1M-7k51bcjYMWzS7_hitM8G81tAmdCZI8/360fx270f",
  "Glock-18 | Synth Leaf": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1T9s2ibaVrH_KfG2KvzOtyufRkAXDikUt_tzzQyYqtcyqUag8jAsFzF7QD5Bntl4W1ZOPg5QSNjYpBnHrgznQeiI6gWCw/360fx270f",
  "P90 | Vent Rush": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhx8bf-jFk_6v-V7BsLvefC2OvzOtyufRkAS2wzRkit2-EyIqvcHKRawR2DpImTeYDs0W6k9eyN-Pr4ATY3d5HzS3gznQedIwTnmE/360fx270f",
  "AWP | Acheron": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf9Ttk4eetZKFsMs-ABXKczf1JouRtTSWmkCIqtjmMj4K3eH-QPw4gW5shRu5csxS_moGxMr7h4w3f390Unn7823xLu3o-4rlQV71lpPPqq3txRw/360fx270f",
  "MP9 | Bulldozer": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8js_f7i1k9veiZKt6H_2WCm6FzKBz5OU4TS-ykU1_tmWEn9r6dXOUawQkApp5FOcL4RnqmtTuYu-2tQeIlcsbmjeGmfSA/360fx270f",
  "Glock-18 | Reactor": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL2kpnj9h1a4s2gfadhJfGBMXeR1fpzou84cC6_mh4sjDCAnobsLGWRblJ1A8dyRbRYtES4xNbhNLjqtVeIi45CzSqv2i9B7S1v4u5UUPYh5OSJ2Ogs2lKT/360fx270f",
  "AWP | Fade": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwiYbf_CNk7uW-V6JsJPWsAm6Xyfo45-c5GXDnwB534DuEwtuoIHOfaAYiAsYjF-QItUaxmoC0MO_h5ALcjJUFk3sEzfdk4w/360fx270f",
  "PP-Bizon | Forest Leaves": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLzl4zv8x1I_82ibaV7JeOsAm6Xyfo45bU-Hi_gkRl-t2mAw937Iy3FPQF2DJpxQOADsBawloC0Yr_m41GIiJUFk3v_uUXI3A/360fx270f",
  "P250 | Apep's Curse": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLhzMOwwiVI0OL8PfRSIeCWHlicyOl-pK87HCjkxR9ztj-Dzdv8di2TPFchDptyTbEIthTsl9znY77r5Qzc2YwR02yg2XoGglyv/360fx270f",
  "M4A1-S | Welcome to the Jungle": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8ypexwjFS4_ega6F_H_OGMWrEwL9Jo-9oRCyMnRgmpSTLy9igc3PDbVcnDZd3R-de5hHpl4CxZO6z4gLWjt5Dzyv8iCJA6C5j5vFCD_ThScH7Ig/360fx270f",
  "AK-47 | Gold Arabesque": "https://community.cloudflare.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyLwlcK3wiVI0POlPPNSJ_-fCliR0-90tfJ4WiyMmBgjuiiI1Nn4cXjEbwMlDsR4RrVfsRK4wdPgPrjh4wKNg49Cyn__2iNI6ihi5O8cEf1yNgAZ7yU/360fx270f",
};
const PLACEHOLDER_IMAGE = "https://placehold.co/256x192/0F1120/6B7089?text=CS2";

const CASES: CaseSpec[] = [
  {
    slug: "static-case", name: "Static Case", floorRub: 150,
    drops: {
      CONSUMER: [["USP-S | Cortex", "FT", 80], ["Glock-18 | Steel Disruption", "FT", 30], ["M4A4 | 龍王 (Dragon King)", "BS", 50]],
      INDUSTRIAL: [["AWP | Acheron", "FT", 120], ["MAC-10 | Oceanic", "MW", 60]],
      MIL_SPEC: [["AK-47 | Slate", "FT", 200], ["FAMAS | Mecha Industries", "FT", 150]],
      RESTRICTED: [["M4A1-S | Decimator", "FT", 500], ["Desert Eagle | Cobalt Disruption", "FT", 400]],
      CLASSIFIED: [["AK-47 | Neon Revolution", "FT", 1200]],
      COVERT: [["AWP | Asiimov", "FT", 4500]],
      GOLD: [["★ Gut Knife | Fade", "FN", 18000]],
    },
  },
  {
    slug: "overdrive-case", name: "Overdrive Case", floorRub: 200,
    drops: {
      CONSUMER: [["P250 | Verdigris", "FT", 50], ["Nova | Gila", "FT", 40], ["Tec-9 | Isaac", "FT", 60]],
      INDUSTRIAL: [["MP9 | Bulldozer", "FT", 80], ["XM1014 | Tranquility", "FT", 70]],
      MIL_SPEC: [["AUG | Stymphalian", "FT", 300], ["M4A4 | Neo-Noir", "FT", 400]],
      RESTRICTED: [["M4A1-S | Player Two", "FT", 800], ["USP-S | Monster Mashup", "FT", 600]],
      CLASSIFIED: [["AK-47 | Bloodsport", "FT", 2000]],
      COVERT: [["M4A1-S | Hyper Beast", "FT", 5000]],
      GOLD: [["★ Bayonet | Doppler", "FN", 25000]],
    },
  },
  {
    slug: "ignition-case", name: "Ignition Case", floorRub: 500,
    drops: {
      CONSUMER: [["FAMAS | Valence", "FT", 100], ["MAC-10 | Tatter", "FT", 80]],
      INDUSTRIAL: [["MP7 | Abyssal Apparition", "FT", 200], ["PP-Bizon | Forest Leaves", "FT", 150]],
      MIL_SPEC: [["SG 553 | Colony IV", "FT", 600], ["CZ75-Auto | Tigris", "FT", 500]],
      RESTRICTED: [["AWP | Mortis", "FT", 1500], ["M4A1-S | Nightmare", "FT", 1200]],
      CLASSIFIED: [["AK-47 | Nightwish", "FT", 3500]],
      COVERT: [["AWP | Neo-Noir", "FT", 8000]],
      GOLD: [["★ Karambit | Tiger Tooth", "FN", 45000]],
    },
  },
  {
    slug: "blacklight-case", name: "Blacklight Case", floorRub: 1000,
    drops: {
      CONSUMER: [["Glock-18 | Synth Leaf", "FT", 200], ["P90 | Vent Rush", "FT", 150]],
      INDUSTRIAL: [["MP5-SD | Phosphor", "FT", 400], ["MAG-7 | Heat", "FT", 300]],
      MIL_SPEC: [["M4A4 | Cyber Security", "FT", 1200], ["AK-47 | Uncharted", "FT", 1000]],
      RESTRICTED: [["USP-S | Printstream", "FT", 3000], ["AWP | Exoskeleton", "FT", 2000]],
      CLASSIFIED: [["M4A1-S | Printstream", "FT", 8000]],
      COVERT: [["AK-47 | Phantom Disruptor", "FT", 15000]],
      GOLD: [["★ M9 Bayonet | Lore", "FN", 80000]],
    },
  },
  {
    slug: "sovereign-case", name: "Sovereign Case", floorRub: 3000,
    drops: {
      CONSUMER: [["Glock-18 | Reactor", "FT", 500], ["P250 | Apep's Curse", "FT", 400]],
      INDUSTRIAL: [["AWP | Capillary", "FT", 800], ["M4A4 | Spider Lily", "FT", 700]],
      MIL_SPEC: [["AK-47 | Vulcan", "FT", 3000], ["Desert Eagle | Printstream", "FT", 2500]],
      RESTRICTED: [["AWP | Wildfire", "FT", 6000], ["M4A1-S | Welcome to the Jungle", "FT", 5000]],
      CLASSIFIED: [["AWP | Fade", "FN", 20000]],
      COVERT: [["AK-47 | Gold Arabesque", "FN", 50000]],
      GOLD: [["★ Butterfly Knife | Fade", "FN", 150000]],
    },
  },
  {
    slug: "apex-case", name: "Apex Case", floorRub: 8000,
    drops: {
      CONSUMER: [["AWP | Mortis", "FT", 1500], ["M4A1-S | Decimator", "FT", 1200]],
      INDUSTRIAL: [["★ Karambit | Safari Mesh", "FT", 4000], ["★ M9 Bayonet | Night", "FT", 5000]],
      MIL_SPEC: [["AK-47 | Fire Serpent", "FT", 25000], ["AWP | Dragon Lore", "FT", 80000]],
      RESTRICTED: [["★ Karambit | Slaughter", "FT", 35000], ["★ M9 Bayonet | Marble Fade", "FT", 40000]],
      CLASSIFIED: [["★ Karambit | Tiger Tooth", "FN", 60000]],
      COVERT: [["★ Karambit | Fade", "FN", 120000]],
      GOLD: [["AWP | Dragon Lore", "FN", 250000]],
    },
  },
];

const catalogImages = new Map<string, string>();
for (const c of JSON.parse(readFileSync(join(__dirname, "../prisma/cs2-items.json"), "utf8")) as { items: { name: string; imageUrl: string }[] }[]) {
  for (const item of c.items) if (!catalogImages.has(item.name)) catalogImages.set(item.name, item.imageUrl);
}

const placeholders = new Set<string>();
function imageFor(base: string): string {
  const url = IMAGE_OVERRIDES[base] ?? catalogImages.get(base);
  if (url) return url;
  placeholders.add(base);
  return PLACEHOLDER_IMAGE;
}

function buildPayload(spec: CaseSpec, suffix: string) {
  const items = TIERS.flatMap((tier) => {
    const drops = spec.drops[tier];
    return drops.map(([base, ext, rub]) => ({
      name: `${base} (${EXTERIOR[ext]})`,
      imageUrl: imageFor(base),
      weight: TIER_WEIGHT[tier] / drops.length,
      valueMinor: rub * 100,
      currency: CURRENCY,
      rarity: tier,
    }));
  });
  const chase = items[items.length - 1];
  return {
    slug: `${spec.slug}${suffix}`,
    name: spec.name,
    priceMinor: marketCasePrice(items, spec.floorRub * 100),
    currency: CURRENCY,
    imageUrl: chase.imageUrl,
    items,
    floorRub: spec.floorRub,
  };
}

const rub = (minor: number) => `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} RUB`;

async function main() {
  const suffix = process.env.SLUG_SUFFIX ?? "";
  const only = process.env.ONLY?.split(",").map((x) => x.trim()).filter(Boolean);
  const selected = only ? CASES.filter((c) => only.includes(c.slug)) : CASES;
  if (selected.length === 0) throw new Error(`ONLY matched no case: ${process.env.ONLY}`);
  const payloads = selected.map((c) => buildPayload(c, suffix));

  if (placeholders.size) {
    console.warn(`\n${placeholders.size} skin(s) have no image in the catalog — placeholder used (add real URLs to IMAGE_OVERRIDES):`);
    for (const p of placeholders) console.warn(`  - ${p}`);
    console.warn("");
  }

  console.log("slug".padEnd(18) + "brief".padStart(12) + "  priced at (EV/0.9, floored at brief)");
  for (const p of payloads) console.log(p.slug.padEnd(18) + rub(p.floorRub * 100).padStart(12) + "  " + rub(p.priceMinor));

  if (process.argv.includes("--dry-run")) return;

  const base = (process.env.API_URL ?? "https://cases-x18t.vercel.app/api").replace(/\/$/, "");
  let jwt = process.env.ADMIN_JWT ?? process.argv.find((a) => a.startsWith("--jwt="))?.slice(6);
  if (!jwt && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const login = await fetch(`${base}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
    });
    if (!login.ok) throw new Error(`Login failed: HTTP ${login.status}`);
    jwt = ((await login.json()) as { accessToken: string }).accessToken;
  }
  // With no token here, the request goes out bare: a network-level secret (e.g. a sandbox that
  // injects "Authorization: Bearer ..." for this host) may be adding it. A 401 means it is missing/expired.
  if (!jwt) console.warn("No ADMIN_JWT set — sending requests without an Authorization header (relying on an injected one).");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) };

  // A duplicate slug surfaces as a 500 on this API (unhandled unique violation), so look first.
  const listed = await fetch(`${base}/admin/cases`, { headers });
  if (!listed.ok) throw new Error(`GET /admin/cases failed: HTTP ${listed.status}`);
  const have = new Set(((await listed.json()) as { slug: string }[]).map((c) => c.slug));

  let created = 0, skipped = 0, failed = 0;
  for (const { floorRub: _floor, ...body } of payloads) {
    if (have.has(body.slug)) { skipped++; console.log(`skip     ${body.slug} (exists)`); continue; }
    const res = await fetch(`${base}/admin/cases`, { method: "POST", headers, body: JSON.stringify(body) });
    if (res.ok) { created++; console.log(`created  ${body.slug}  ${body.items.length} items  ${rub(body.priceMinor)}`); }
    else if (res.status === 409) { skipped++; console.log(`skip     ${body.slug} (409 already exists)`); }
    else { failed++; console.error(`FAILED   ${body.slug}  HTTP ${res.status}  ${await res.text()}`); }
  }
  console.log(`\ncreated ${created}, skipped ${skipped}, failed ${failed}`);
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
