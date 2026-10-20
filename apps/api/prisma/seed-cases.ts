/**
 * Seeds the ten DROPZONE cases straight into the database with Prisma.
 *
 *   pnpm --filter @cs2-cases/api seed:cases:db -- --dry-run     # plan + RTP table, writes nothing
 *   pnpm --filter @cs2-cases/api seed:cases:db                  # write (uses DATABASE_URL / DIRECT_URL)
 *
 * Flags: --dry-run (touch nothing), --retire-others (hide every case that is not one of these ten).
 *
 * Money is kopecks. Three player profiles (entry / mid / premium) fix the odds
 * per tier and the *relative* value of each drop. Each case then scales those
 * values so it returns TARGET_RTP of its own price; the script refuses to write
 * unless every case lands in [MIN_RTP, MAX_RTP]. The Static Case uses the brief's
 * explicit per-tier value ranges instead of a scale factor.
 *
 * Images come from prisma/cs2-items.json and prisma/cs2-images-extra.json (real
 * Steam hashes; the open ByMykel/CSGO-API dataset supplies the rare ones). A skin with no real image stops the run instead of borrowing
 * someone else's picture.
 */
import { ItemRarity, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_RTP = 0.8;
const MIN_RTP = 0.72;
const MAX_RTP = 0.88;

type TierKey = "CONSUMER" | "INDUSTRIAL" | "MIL_SPEC" | "RESTRICTED" | "CLASSIFIED" | "COVERT" | "KNIFE";
const RARITY: Record<TierKey, ItemRarity> = {
  CONSUMER: "CONSUMER", INDUSTRIAL: "INDUSTRIAL", MIL_SPEC: "MIL_SPEC",
  RESTRICTED: "RESTRICTED", CLASSIFIED: "CLASSIFIED", COVERT: "COVERT", KNIFE: "GOLD",
};

type Pool = [name: string, baseValueMinor: number][];
interface Profile {
  /** Share of all rolls per tier; consumer takes whatever is left. */
  rates: Record<Exclude<TierKey, "CONSUMER">, number>;
  tiers: Record<Exclude<TierKey, "CONSUMER" | "INDUSTRIAL">, Pool>;
  /** "Various" tiers: each case takes `count` items from the pool, starting at its own offset. */
  industrial: { pool: Pool; count: number };
  consumer: { pool: Pool; count: number };
  /** Stated value range of the knives; scaling can leave it (reported, not an error). */
  knifeRange: [number, number];
}

// ENTRY — brief: "MP7 | Fade" does not exist in CS2, MP7 | Skulls stands in for it.
const ENTRY: Profile = {
  rates: { KNIFE: 0.005, COVERT: 0.0008, CLASSIFIED: 0.0032, RESTRICTED: 0.02, MIL_SPEC: 0.1, INDUSTRIAL: 0.25 },
  tiers: {
    KNIFE: [["★ Gut Knife | Fade", 1_200_000], ["★ Flip Knife | Marble Fade", 2_500_000]],
    COVERT: [["AK-47 | Asiimov", 550_000], ["M4A1-S | Printstream", 480_000]],
    CLASSIFIED: [["AWP | Electric Hive", 180_000], ["AK-47 | Slate", 120_000]],
    RESTRICTED: [["M4A4 | Neo-Noir", 90_000], ["MP9 | Wild Lily", 60_000]],
    MIL_SPEC: [["P250 | Asiimov", 18_000], ["FAMAS | Mecha Industries", 12_000]],
  },
  industrial: { pool: [["UMP-45 | Labyrinth", 6_000], ["P90 | Storm", 4_500]], count: 2 },
  consumer: { pool: [["MP7 | Skulls", 2_000], ["Glock-18 | Sand Dune", 1_500]], count: 2 },
  knifeRange: [1_000_000, 3_000_000],
};

const MID: Profile = {
  rates: { KNIFE: 0.015, COVERT: 0.001, CLASSIFIED: 0.005, RESTRICTED: 0.03, MIL_SPEC: 0.12, INDUSTRIAL: 0.28 },
  tiers: {
    KNIFE: [["★ M9 Bayonet | Doppler", 4_000_000], ["★ Karambit | Vanilla", 7_500_000]],
    COVERT: [["AWP | Asiimov", 1_200_000], ["AK-47 | Fire Serpent", 3_500_000]],
    CLASSIFIED: [["M4A4 | Asiimov", 800_000]], // brief: "M4A4 | Howl clone" -> M4A4 | Asiimov
    RESTRICTED: [["AK-47 | Neon Rider", 250_000], ["AWP | Hyper Beast", 200_000]],
    MIL_SPEC: [["M4A1-S | Basilisk", 45_000], ["SG 553 | Aerial", 35_000]],
  },
  industrial: { pool: [["MP5-SD | Phosphor", 12_000], ["UMP-45 | Crime Scene", 9_000]], count: 2 },
  consumer: {
    pool: [["P250 | Sand Dune", 3_000], ["Five-SeveN | Forest Night", 3_200], ["MP9 | Sand Dashed", 3_500], ["SG 553 | Army Sheen", 4_000], ["Nova | Predator", 4_500], ["Galil AR | Sage Spray", 5_000]],
    count: 4,
  },
  knifeRange: [4_000_000, 8_000_000],
};

const PREMIUM: Profile = {
  rates: { KNIFE: 0.035, COVERT: 0.0015, CLASSIFIED: 0.008, RESTRICTED: 0.04, MIL_SPEC: 0.15, INDUSTRIAL: 0.3 },
  tiers: {
    KNIFE: [["★ Karambit | Fade", 15_000_000], ["★ Butterfly Knife | Marble Fade", 35_000_000]],
    COVERT: [["AWP | Dragon Lore", 25_000_000], ["AK-47 | Wild Lotus", 18_000_000]],
    CLASSIFIED: [["AK-47 | Case Hardened", 8_000_000]],
    RESTRICTED: [["AWP | Medusa", 2_000_000], ["M4A4 | Poseidon", 1_500_000]],
    MIL_SPEC: [["AK-47 | Vulcan", 250_000], ["AWP | Asiimov", 400_000]],
  },
  industrial: {
    pool: [["MP9 | Hypnotic", 40_000], ["CZ75-Auto | Tigris", 50_000], ["Glock-18 | Water Elemental", 60_000], ["AUG | Torque", 70_000], ["UMP-45 | Labyrinth", 80_000]],
    count: 3,
  },
  consumer: {
    pool: [["MAC-10 | Silver", 10_000], ["MP9 | Storm", 16_000], ["P90 | Storm", 14_000], ["UMP-45 | Carbon Fiber", 18_000], ["Tec-9 | Urban DDPAT", 21_000], ["P2000 | Granite Marbleized", 25_000]],
    count: 4,
  },
  knifeRange: [15_000_000, 40_000_000],
};

/** The Static Case's own value ranges (kopecks), used instead of scaling the entry profile. */
const STATIC_RANGES: Record<TierKey, [number, number]> = {
  CONSUMER: [800, 1_500], INDUSTRIAL: [2_000, 4_000], MIL_SPEC: [5_000, 12_000], RESTRICTED: [25_000, 60_000],
  CLASSIFIED: [80_000, 200_000], COVERT: [300_000, 600_000], KNIFE: [500_000, 1_500_000],
};

interface CaseSpec { name: string; slug: string; priceMinor: number; color: string; profile: Profile; offset: number; staticRanges?: boolean }

const CASES: CaseSpec[] = [
  { name: "Static Case", slug: "static-case", priceMinor: 10_000, color: "#4a6fa5", profile: ENTRY, offset: 0, staticRanges: true },
  { name: "Neon Rush Case", slug: "neon-rush-case", priceMinor: 19_900, color: "#00ff88", profile: ENTRY, offset: 0 },
  { name: "Phantom Case", slug: "phantom-case", priceMinor: 39_900, color: "#8888aa", profile: ENTRY, offset: 0 },
  { name: "Ignition Case", slug: "ignition-case", priceMinor: 59_900, color: "#ff6b35", profile: MID, offset: 0 },
  { name: "Tidal Case", slug: "tidal-case", priceMinor: 79_900, color: "#00bfff", profile: MID, offset: 1 },
  { name: "Overdrive Case", slug: "overdrive-case", priceMinor: 99_900, color: "#ff8c00", profile: MID, offset: 2 },
  { name: "Sovereign Case", slug: "sovereign-case", priceMinor: 149_900, color: "#9b59b6", profile: MID, offset: 3 },
  { name: "Dragon Case", slug: "dragon-case", priceMinor: 199_000, color: "#dc143c", profile: PREMIUM, offset: 0 },
  { name: "Blacklight Case", slug: "blacklight-case", priceMinor: 299_900, color: "#7b2fff", profile: PREMIUM, offset: 1 },
  { name: "Aurora Case", slug: "aurora-case", priceMinor: 449_900, color: "#00ffcc", profile: PREMIUM, offset: 2 },
];

// ── images ──────────────────────────────────────────────────────────────
/** Display name -> the catalog name whose picture it shares. */
const IMAGE_ALIAS: Record<string, string> = { "★ Karambit | Vanilla": "★ Karambit" };

function loadImages(): Map<string, string> {
  const images = new Map<string, string>();
  const catalog = JSON.parse(readFileSync(join(__dirname, "cs2-items.json"), "utf8")) as { items: { name: string; imageUrl: string }[] }[];
  for (const c of catalog) for (const i of c.items) if (!images.has(i.name)) images.set(i.name, i.imageUrl);
  const extra = JSON.parse(readFileSync(join(__dirname, "cs2-images-extra.json"), "utf8")) as Record<string, string>;
  for (const [name, url] of Object.entries(extra)) images.set(name, url);
  return images;
}

function caseImage(color: string, name: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='220'>
    <rect width='320' height='220' fill='#0a0e1a'/>
    <path d='M60 70 L100 40 H220 L260 70 V170 H60Z' fill='#1a2035' stroke='${color}' stroke-width='4'/>
    <line x1='60' y1='95' x2='260' y2='95' stroke='${color}' stroke-width='2' opacity='0.6'/>
    <text x='160' y='150' font-family='sans-serif' font-weight='800' font-size='20' fill='${color}' text-anchor='middle'>${name.replace(/ Case$/, "").toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// ── drops ───────────────────────────────────────────────────────────────
interface Drop { name: string; tier: TierKey; weight: number; base: number }

function rotate<T>(pool: T[], count: number, offset: number): T[] {
  return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(offset + i) % pool.length]);
}

function dropsFor(spec: CaseSpec): Drop[] {
  const { profile, offset } = spec;
  const out: Drop[] = [];
  const add = (tier: TierKey, pool: Pool, share: number) => {
    for (const [name, base] of pool) out.push({ name, tier, weight: share / pool.length, base });
  };
  const used = Object.values(profile.rates).reduce((a, b) => a + b, 0);
  add("CONSUMER", rotate(profile.consumer.pool, profile.consumer.count, offset), 1 - used);
  add("INDUSTRIAL", rotate(profile.industrial.pool, profile.industrial.count, offset), profile.rates.INDUSTRIAL);
  for (const tier of ["MIL_SPEC", "RESTRICTED", "CLASSIFIED", "COVERT", "KNIFE"] as const) add(tier, profile.tiers[tier], profile.rates[tier]);
  return out;
}

/** Deterministic 0..1 spread so items of one tier don't sit at the same point of a range. */
function spread(name: string): number {
  let h = 7;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.25 + (h % 750) / 1000;
}

const evOf = (drops: Drop[], valueOf: (d: Drop) => number) => {
  const total = drops.reduce((a, d) => a + d.weight, 0);
  return drops.reduce((a, d) => a + d.weight * valueOf(d), 0) / total;
};

function bisect(fn: (x: number) => number, target: number, lo: number, hi: number): number {
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) > target) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

interface Planned {
  spec: CaseSpec;
  items: { name: string; imageUrl: string; rarity: ItemRarity; weight: number; valueMinor: number }[];
  rtp: number;
  /** Scale applied to the profile's stated values (1 = as stated); null for the range-based Static Case. */
  scale: number | null;
  notes: string[];
}

function plan(images: Map<string, string>): { planned: Planned[]; noImage: string[] } {
  const noImage = new Set<string>();
  const planned = CASES.map((spec): Planned => {
    const drops = dropsFor(spec);
    const target = spec.priceMinor * TARGET_RTP;
    let valueOf: (d: Drop) => number;
    let scale: number | null = null;
    if (spec.staticRanges) {
      const at = (s: number) => (d: Drop) => { const [lo, hi] = STATIC_RANGES[d.tier]; return Math.round(lo + (hi - lo) * Math.min(1, spread(d.name) * s)); };
      const s = bisect((x) => evOf(drops, at(x)), target, 0, 1 / 0.25);
      valueOf = at(s);
    } else {
      scale = bisect((k) => evOf(drops, (d) => d.base * k), target, 0, 1_000);
      valueOf = (d) => Math.max(1, Math.round(d.base * scale!));
    }
    const items = drops.map((d) => {
      const imageUrl = images.get(IMAGE_ALIAS[d.name] ?? d.name);
      if (!imageUrl) noImage.add(d.name);
      return { name: d.name, imageUrl: imageUrl ?? "", rarity: RARITY[d.tier], weight: Number(d.weight.toFixed(6)), valueMinor: valueOf(d) };
    });
    const total = items.reduce((a, i) => a + i.weight, 0);
    const rtp = items.reduce((a, i) => a + i.weight * i.valueMinor, 0) / total / spec.priceMinor;
    const notes: string[] = [];
    if (!spec.staticRanges) {
      const [klo, khi] = spec.profile.knifeRange;
      const knives = items.filter((i) => i.rarity === "GOLD").map((i) => i.valueMinor);
      if (Math.min(...knives) < klo || Math.max(...knives) > khi) notes.push(`knives ${Math.min(...knives) / 100}–${Math.max(...knives) / 100} ₽, stated range ${klo / 100}–${khi / 100} ₽`);
    }
    return { spec, items, rtp, scale, notes };
  });
  return { planned, noImage: [...noImage] };
}

function group(priceMinor: number): string {
  return priceMinor < 50_000 ? "СТАРТ" : priceMinor <= 150_000 ? "ИМПУЛЬС" : "ПРЕДЕЛ";
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dry = args.has("--dry-run");
  const { planned, noImage } = plan(loadImages());

  console.log("case             group     price ₽  items  value scale  payout ₽   RTP");
  for (const p of planned) {
    const payout = p.rtp * p.spec.priceMinor;
    console.log(
      `${p.spec.slug.padEnd(16)} ${group(p.spec.priceMinor).padEnd(8)} ${(p.spec.priceMinor / 100).toFixed(0).padStart(8)} ${String(p.items.length).padStart(6)} ` +
      `${(p.scale === null ? "ranges" : `×${p.scale.toFixed(3)}`).padStart(11)} ${(payout / 100).toFixed(1).padStart(9)} ${(p.rtp * 100).toFixed(1).padStart(6)}%`,
    );
  }
  for (const p of planned) if (p.notes.length) console.log(`  note ${p.spec.slug}: ${p.notes.join("; ")}`);

  const bad = planned.filter((p) => p.rtp < MIN_RTP || p.rtp > MAX_RTP);
  if (bad.length) {
    throw new Error(`RTP outside ${MIN_RTP}–${MAX_RTP}: ${bad.map((p) => `${p.spec.slug}=${(p.rtp * 100).toFixed(1)}%`).join(", ")}`);
  }
  if (noImage.length) {
    console.error(`\nNo real image for: ${noImage.join(", ")}\nAdd the Steam URL to prisma/cs2-images-extra.json or change the skin.`);
    process.exit(1);
  }
  if (dry) { console.log("\n--dry-run: nothing written."); return; }

  const prisma = new PrismaClient();
  try {
    for (const [index, { spec, items }] of planned.entries()) {
      const existing = await prisma.case.findUnique({ where: { slug: spec.slug } });
      const data = { name: spec.name, priceMinor: BigInt(spec.priceMinor), currency: "RUB", imageUrl: caseImage(spec.color, spec.name), isActive: true, displayOrder: (index + 1) * 10 };
      if (!existing) {
        await prisma.case.create({ data: { slug: spec.slug, ...data, items: { create: items.map((i) => ({ ...i, valueMinor: BigInt(i.valueMinor), currency: "RUB" })) } } });
        console.log(`created ${spec.slug}`);
        continue;
      }
      const used = (await prisma.inventoryItem.count({ where: { caseItem: { caseId: existing.id } } })) + (await prisma.caseOpenEvent.count({ where: { caseId: existing.id } }));
      if (used > 0) {
        await prisma.case.update({ where: { id: existing.id }, data });
        console.warn(`updated ${spec.slug} price/image only — ${used} openings/inventory items reference its drops, so its items were kept`);
        continue;
      }
      await prisma.$transaction([
        prisma.caseItem.deleteMany({ where: { caseId: existing.id } }),
        prisma.case.update({ where: { id: existing.id }, data: { ...data, items: { create: items.map((i) => ({ ...i, valueMinor: BigInt(i.valueMinor), currency: "RUB" })) } } }),
      ]);
      console.log(`replaced ${spec.slug}`);
    }
    if (args.has("--retire-others")) {
      const r = await prisma.case.updateMany({ where: { slug: { notIn: CASES.map((c) => c.slug) }, isActive: true }, data: { isActive: false } });
      console.log(`hid ${r.count} other case(s)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
