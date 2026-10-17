/**
 * Seeds the ten DROPZONE cases straight into the database with Prisma.
 *
 *   pnpm --filter @cs2-cases/api seed:cases:db -- --dry-run     # plan + RTP table, writes nothing
 *   pnpm --filter @cs2-cases/api seed:cases:db                  # write (uses DATABASE_URL / DIRECT_URL)
 *
 * Flags
 *   --dry-run          print the plan and RTP per case, touch nothing
 *   --accept-low-rtp   write even if a case would return under MIN_RTP of its price
 *   --retire-others    hide (isActive=false) every case that is not one of these ten
 *
 * Money is kopecks. A drop's weight is its tier's share of the roll divided by
 * the number of items in the tier (0.7992 / 4 = 0.1998 for consumer); the weights
 * only matter relative to each other. Item values sit inside the ranges of the
 * brief, scaled per case so the case returns about TARGET_RTP of its price —
 * where the brief's ranges allow it (see the RTP table printed on every run).
 *
 * Images: the real Steam hashes in prisma/cs2-items.json, plus
 * prisma/cs2-images-extra.json for skins that file lacks. A skin with no real
 * image stops the run instead of getting someone else's picture.
 */
import { ItemRarity, PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Tier = "CONSUMER" | "INDUSTRIAL" | "MIL_SPEC" | "RESTRICTED" | "CLASSIFIED" | "COVERT" | "KNIFE";

/** Share of all rolls, and the value range (kopecks), per tier. */
const TIER: Record<"CONSUMER" | "INDUSTRIAL" | "MILSPEC_RESTRICTED" | "CLASSIFIED" | "COVERT" | "KNIFE", { share: number; lo: number; hi: number }> = {
  CONSUMER: { share: 0.7992, lo: 3_000, hi: 15_000 },
  INDUSTRIAL: { share: 0.16, lo: 8_000, hi: 40_000 },
  MILSPEC_RESTRICTED: { share: 0.032, lo: 30_000, hi: 150_000 },
  CLASSIFIED: { share: 0.0064, lo: 100_000, hi: 500_000 },
  COVERT: { share: 0.0013, lo: 300_000, hi: 3_000_000 },
  KNIFE: { share: 0.0026, lo: 2_000_000, hi: 15_000_000 },
};

const TARGET_RTP = 0.88;
const MIN_RTP = 0.6;

interface CaseSpec {
  name: string;
  slug: string;
  priceMinor: number;
  color: string;
  tier: "entry" | "mid" | "premium";
  consumer: string[]; // 4
  industrial: string[]; // 3
  milspec: [string, string]; // 2 MIL_SPEC
  restricted: string; // 1 RESTRICTED
  classified: string[]; // 2
  covert: string[]; // 1-2
  knives: string[]; // 2
}

const STARTER_KNIVES = ["★ Gut Knife | Fade", "★ Flip Knife | Slaughter"];
const MID_KNIVES = ["★ M9 Bayonet | Doppler", "★ Karambit | Vanilla"];
const PREMIUM_KNIVES = ["★ Karambit | Fade", "★ Butterfly Knife | Marble Fade"];
const STARTER_COVERT = ["AK-47 | Asiimov", "M4A1-S | Player Two"];

const CASES: CaseSpec[] = [
  { name: "Static Case", slug: "static-case", priceMinor: 27_900, color: "#4a6fa5", tier: "entry",
    consumer: ["MP9 | Setting Sun", "P250 | Sand Dune", "Glock-18 | Sand Dune", "FAMAS | Valence"],
    industrial: ["UMP-45 | Labyrinth", "MP7 | Skulls", "Galil AR | Eco"],
    milspec: ["AK-47 | Slate", "M4A1-S | Basilisk"], restricted: "AWP | Electric Hive",
    classified: ["AK-47 | Neon Rider", "M4A4 | Neo-Noir"], covert: STARTER_COVERT, knives: STARTER_KNIVES },
  { name: "Neon Rush Case", slug: "neon-rush-case", priceMinor: 39_900, color: "#00ff88", tier: "entry",
    consumer: ["MAC-10 | Silver", "Nova | Predator", "SG 553 | Army Sheen", "MP9 | Sand Dashed"],
    industrial: ["MAC-10 | Heat", "Five-SeveN | Monkey Business", "AUG | Torque"],
    milspec: ["AK-47 | Redline", "M4A4 | Radiation Hazard"], restricted: "M4A1-S | Cyrex",
    classified: ["AK-47 | Neon Rider", "AWP | Asiimov"], covert: STARTER_COVERT, knives: STARTER_KNIVES },
  { name: "Phantom Case", slug: "phantom-case", priceMinor: 54_900, color: "#8888aa", tier: "entry",
    consumer: ["P90 | Storm", "Five-SeveN | Forest Night", "Galil AR | Sage Spray", "Tec-9 | Urban DDPAT"],
    industrial: ["P250 | Muertos", "Tec-9 | Isaac", "SSG 08 | Slashed"],
    milspec: ["AK-47 | Elite Build", "USP-S | Guardian"], restricted: "AWP | Atheris",
    classified: ["M4A1-S | Hyper Beast", "USP-S | Neo-Noir"], covert: STARTER_COVERT, knives: STARTER_KNIVES },
  { name: "Ignition Case", slug: "ignition-case", priceMinor: 65_600, color: "#ff6b35", tier: "mid",
    consumer: ["MP9 | Storm", "P2000 | Granite Marbleized", "UMP-45 | Carbon Fiber", "Glock-18 | Sand Dune"],
    industrial: ["Glock-18 | Water Elemental", "MP9 | Hypnotic", "CZ75-Auto | Tigris"],
    milspec: ["AK-47 | Slate", "Desert Eagle | Blaze"], restricted: "M4A1-S | Cyrex",
    classified: ["AK-47 | Fuel Injector", "AK-47 | Vulcan"], covert: ["AK-47 | Neon Revolution"], knives: MID_KNIVES },
  { name: "Tidal Case", slug: "tidal-case", priceMinor: 89_900, color: "#00bfff", tier: "mid",
    consumer: ["P250 | Sand Dune", "MP9 | Setting Sun", "SG 553 | Army Sheen", "Galil AR | Sage Spray"],
    industrial: ["MP7 | Urban Hazard", "UMP-45 | Labyrinth", "Five-SeveN | Monkey Business"],
    milspec: ["M4A1-S | Basilisk", "AWP | Atheris"], restricted: "AWP | Electric Hive",
    classified: ["AWP | Asiimov", "M4A1-S | Hyper Beast"], covert: ["AWP | Man-o'-war"], knives: MID_KNIVES },
  { name: "Overdrive Case", slug: "overdrive-case", priceMinor: 37_100, color: "#ff8c00", tier: "mid",
    consumer: ["MAC-10 | Silver", "P90 | Storm", "FAMAS | Valence", "Nova | Predator"],
    industrial: ["MAC-10 | Heat", "AUG | Torque", "Galil AR | Eco"],
    milspec: ["AK-47 | Redline", "AK-47 | Elite Build"], restricted: "P90 | Asiimov",
    classified: ["M4A4 | The Emperor", "AK-47 | Fuel Injector"], covert: ["M4A4 | Buzz Kill"], knives: MID_KNIVES },
  { name: "Sovereign Case", slug: "sovereign-case", priceMinor: 129_700, color: "#9b59b6", tier: "mid",
    consumer: ["Glock-18 | Sand Dune", "P250 | Sand Dune", "MP9 | Sand Dashed", "Tec-9 | Urban DDPAT"],
    industrial: ["P250 | Muertos", "USP-S | Guardian", "SSG 08 | Slashed"],
    milspec: ["M4A4 | Radiation Hazard", "M4A1-S | Basilisk"], restricted: "Desert Eagle | Blaze",
    classified: ["M4A4 | Neo-Noir", "USP-S | Neo-Noir"], covert: ["AK-47 | The Empress"], knives: MID_KNIVES },
  { name: "Dragon Case", slug: "dragon-case", priceMinor: 199_000, color: "#dc143c", tier: "premium",
    consumer: ["MP9 | Setting Sun", "Five-SeveN | Forest Night", "P2000 | Granite Marbleized", "MAC-10 | Silver"],
    industrial: ["UMP-45 | Labyrinth", "CZ75-Auto | Tigris", "Glock-18 | Water Elemental"],
    milspec: ["AK-47 | Redline", "M4A1-S | Cyrex"], restricted: "AWP | Atheris",
    classified: ["AK-47 | Vulcan", "AWP | Asiimov"], covert: ["AWP | Lightning Strike", "AK-47 | Fire Serpent"], knives: PREMIUM_KNIVES },
  { name: "Blacklight Case", slug: "blacklight-case", priceMinor: 329_700, color: "#7b2fff", tier: "premium",
    consumer: ["P90 | Storm", "MP9 | Storm", "UMP-45 | Carbon Fiber", "Nova | Predator"],
    industrial: ["MP9 | Hypnotic", "AUG | Torque", "Tec-9 | Isaac"],
    milspec: ["AK-47 | Slate", "AK-47 | Elite Build"], restricted: "AWP | Electric Hive",
    classified: ["M4A1-S | Hyper Beast", "M4A4 | Neo-Noir"], covert: ["AWP | Neo-Noir", "M4A4 | Poseidon"], knives: PREMIUM_KNIVES },
  { name: "Aurora Case", slug: "aurora-case", priceMinor: 599_900, color: "#00ffcc", tier: "premium",
    consumer: ["P250 | Sand Dune", "Glock-18 | Sand Dune", "SG 553 | Army Sheen", "MP9 | Sand Dashed"],
    industrial: ["MP7 | Skulls", "Galil AR | Eco", "MAC-10 | Heat"],
    milspec: ["M4A1-S | Basilisk", "M4A4 | Radiation Hazard"], restricted: "Desert Eagle | Blaze",
    classified: ["AK-47 | Neon Rider", "M4A1-S | Hyper Beast"], covert: ["AWP | Containment Breach", "AK-47 | Bloodsport"], knives: PREMIUM_KNIVES },
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
interface Drop { name: string; rarity: ItemRarity; weight: number; lo: number; hi: number; u: number }

/** Deterministic 0..1 spread so items in a tier don't all sit at the same point of the range. */
function spread(name: string): number {
  let h = 7;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 0.25 + (h % 750) / 1000;
}

function dropsFor(spec: CaseSpec): Drop[] {
  const out: Drop[] = [];
  const add = (names: string[], rarity: ItemRarity, t: keyof typeof TIER, shareOfTier = 1, n = names.length) => {
    for (const name of names) {
      out.push({ name, rarity, weight: (TIER[t].share * shareOfTier) / n, lo: TIER[t].lo, hi: TIER[t].hi, u: spread(name) });
    }
  };
  add(spec.consumer, "CONSUMER", "CONSUMER");
  add(spec.industrial, "INDUSTRIAL", "INDUSTRIAL");
  // the 3.2% mil-spec/restricted share is split evenly over the three items
  add(spec.milspec, "MIL_SPEC", "MILSPEC_RESTRICTED", 1, 3);
  add([spec.restricted], "RESTRICTED", "MILSPEC_RESTRICTED", 1, 3);
  add(spec.classified, "CLASSIFIED", "CLASSIFIED");
  add(spec.covert, "COVERT", "COVERT");
  add(spec.knives, "GOLD", "KNIFE");
  return out;
}

const expected = (drops: Drop[], s: number) => {
  const total = drops.reduce((a, d) => a + d.weight, 0);
  return drops.reduce((a, d) => a + d.weight * Math.round(d.lo + (d.hi - d.lo) * Math.min(1, d.u * s)), 0) / total;
};

/** Pick the range position (0..1) that makes the case return TARGET_RTP, or the nearest the ranges allow. */
function solveScale(drops: Drop[], priceMinor: number): number {
  const target = priceMinor * TARGET_RTP;
  if (expected(drops, 0) >= target) return 0;
  if (expected(drops, 1 / Math.min(...drops.map((d) => d.u))) <= target) return 1 / Math.min(...drops.map((d) => d.u));
  let lo = 0, hi = 1 / Math.min(...drops.map((d) => d.u));
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (expected(drops, mid) > target) hi = mid; else lo = mid;
  }
  return lo;
}

interface Planned { spec: CaseSpec; items: { name: string; imageUrl: string; rarity: ItemRarity; weight: number; valueMinor: number }[]; rtp: number }

function plan(images: Map<string, string>): { planned: Planned[]; noImage: string[] } {
  const noImage = new Set<string>();
  const planned = CASES.map((spec) => {
    const drops = dropsFor(spec);
    const s = solveScale(drops, spec.priceMinor);
    const items = drops.map((d) => {
      const imageUrl = images.get(IMAGE_ALIAS[d.name] ?? d.name);
      if (!imageUrl) noImage.add(d.name);
      return {
        name: d.name, imageUrl: imageUrl ?? "", rarity: d.rarity, weight: Number(d.weight.toFixed(6)),
        valueMinor: Math.round(d.lo + (d.hi - d.lo) * Math.min(1, d.u * s)),
      };
    });
    const total = items.reduce((a, i) => a + i.weight, 0);
    const ev = items.reduce((a, i) => a + i.weight * i.valueMinor, 0) / total;
    return { spec, items, rtp: ev / spec.priceMinor };
  });
  return { planned, noImage: [...noImage] };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dry = args.has("--dry-run");
  const { planned, noImage } = plan(loadImages());

  console.log("case              price ₽   items  expected payout  RTP");
  for (const p of planned) {
    const ev = p.rtp * p.spec.priceMinor;
    console.log(`${p.spec.slug.padEnd(16)} ${(p.spec.priceMinor / 100).toFixed(0).padStart(8)} ${String(p.items.length).padStart(6)} ${(ev / 100).toFixed(0).padStart(14)} ₽  ${(p.rtp * 100).toFixed(1).padStart(5)}%`);
  }
  if (noImage.length) {
    console.error(`\nNo real image for: ${noImage.join(", ")}\nAdd the Steam URL to prisma/cs2-images-extra.json or change the skin.`);
    process.exit(1);
  }
  const low = planned.filter((p) => p.rtp < MIN_RTP);
  if (low.length) {
    console.warn(`\n⚠ ${low.length} case(s) would return under ${MIN_RTP * 100}% of their price: ${low.map((p) => p.spec.slug).join(", ")}.`);
    console.warn("  Players pay the price but the brief's item values cap the payout. Raise the knife/covert odds or lower the price.");
    if (!dry && !args.has("--accept-low-rtp")) {
      console.error("  Refusing to write. Re-run with --accept-low-rtp if that is really what you want.");
      process.exit(1);
    }
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
