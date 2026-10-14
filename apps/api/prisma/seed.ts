import { PrismaClient, ItemRarity } from "@prisma/client";
import cases from "./cs2-items.json";
import { fetchMarketListings, pricedVariants } from "../src/prices/market-catalog";
import { marketCasePrice } from "../src/prices/case-pricing";

const prisma = new PrismaClient();

// CS2-authentic rarity colors, matching apps/web/src/lib/rarity.ts
const RARITY_COLOR: Record<ItemRarity, string> = {
  CONSUMER: "#B0C3D9",
  INDUSTRIAL: "#5E98D9",
  MIL_SPEC: "#4B69FF",
  RESTRICTED: "#8847FF",
  CLASSIFIED: "#D32CE6",
  COVERT: "#EB4B4B",
  GOLD: "#E4AE39",
};

/** Fallback only — every case in cs2-items.json now carries a real caseImageUrl. */
function caseImage(color: string, name: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='220'>
    <rect width='320' height='220' fill='#14151d'/>
    <rect x='40' y='30' width='240' height='160' rx='14' fill='none' stroke='${color}' stroke-width='4'/>
    <line x1='40' y1='90' x2='280' y2='90' stroke='${color}' stroke-width='2' opacity='0.5'/>
    <text x='160' y='170' font-family='sans-serif' font-weight='800' font-size='20' fill='${color}' text-anchor='middle'>${name}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface ItemSeed {
  name: string;
  rarity: ItemRarity;
  weight: number;
  valueMinor: number;
  imageUrl: string;
  currency?: string;
}

interface CaseSeed {
  slug: string;
  name: string;
  priceMinor: number;
  caseImageUrl?: string;
  /** Lower sorts first on the public list. Omitted = 100 (stock reissues). */
  displayOrder?: number;
  currency?: string;
  items: ItemSeed[];
}

const BASE_CASES = cases as CaseSeed[];

const STARTER_CHASE_DROPS: Record<string, string[]> = {
  "ignition-case": ["★ Ursus Knife | Tiger Tooth", "★ Talon Knife | Case Hardened", "★ Driver Gloves | Crimson Weave", "★ Hand Wraps | Slaughter"],
  "static-case": ["★ Butterfly Knife | Bright Water", "★ Skeleton Knife | Doppler", "★ Sport Gloves | Superconductor", "★ Specialist Gloves | Crimson Kimono"],
  "overdrive-case": ["★ M9 Bayonet | Night", "★ Classic Knife | Fade", "★ Moto Gloves | Spearmint", "★ Bloodhound Gloves | Snakebite"],
};

/** Adds a small, explicit chase tier to the three starter cases. Market names,
 * images and prices still come from the existing catalog and live price feed. */
function withStarterChaseDrops(sourceCases: CaseSeed[]): CaseSeed[] {
  const itemCatalog = new Map(sourceCases.flatMap((entry) => entry.items.map((item) => [item.name, item] as const)));
  return sourceCases.map((entry) => {
    const chaseNames = STARTER_CHASE_DROPS[entry.slug];
    if (!chaseNames) return entry;
    const additions = chaseNames.map((name) => {
      const source = itemCatalog.get(name);
      if (!source) throw new Error(`Missing chase item in catalog: ${name}`);
      return { ...source, rarity: ItemRarity.GOLD, weight: 0.125 };
    });
    const existingNames = new Set(entry.items.map((item) => item.name));
    const newDrops = additions.filter((item) => !existingNames.has(item.name));
    const reservedWeight = newDrops.reduce((sum, item) => sum + item.weight, 0);
    const existingWeight = entry.items.reduce((sum, item) => sum + item.weight, 0);
    const scale = (100 - reservedWeight) / existingWeight;
    return { ...entry, items: [...entry.items.map((item) => ({ ...item, weight: item.weight * scale })), ...newDrops] };
  });
}

function expandPricedCases(prices: ReadonlyMap<string, number>): CaseSeed[] {
  const missing = new Set<string>();
  const expanded = withStarterChaseDrops(BASE_CASES).map((c) => ({
    ...c,
    items: c.items.flatMap((item) => {
      const variants = pricedVariants(item, prices);
      if (variants.length === 0) {
        missing.add(item.name);
        return [];
      }
      return variants;
    }),
  }));
  // A partial market response must never silently remove drops from a case.
  if (missing.size) throw new Error(`No live RUB listing for ${missing.size} skins: ${[...missing].slice(0, 10).join(", ")}`);
  return expanded.map((c) => ({ ...c, priceMinor: marketCasePrice(c.items, c.priceMinor) }));
}

async function main() {
  // Read and validate the whole market snapshot before the first database write.
  const marketPrices = await fetchMarketListings("RUB");
  const CASES = expandPricedCases(marketPrices);
  console.log(`market catalog: ${CASES.length} cases, ${CASES.reduce((count, c) => count + c.items.length, 0)} priced exterior variants`);
  if (process.env.CATALOG_DRY_RUN === "1") return;
  for (const c of CASES) {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.case.findUnique({ where: { slug: c.slug }, include: { items: true } });
      if (existing) {
        const oldPool = new Map(existing.items.map((item) => [item.name, item.weight]));
        const samePool = existing.items.length === c.items.length && c.items.every((item) =>
          Math.abs((oldPool.get(item.name) ?? -1) - item.weight) < 0.000001,
        );
        if (samePool) {
          if (existing.priceMinor !== BigInt(c.priceMinor)) {
            await tx.case.update({ where: { id: existing.id }, data: { priceMinor: c.priceMinor } });
          }
          return false;
        }

        // Preserve the complete old pool for historical provably-fair checks.
        await tx.case.update({
          where: { id: existing.id },
          data: { slug: `${c.slug}--archived-${existing.id}`, isActive: false },
        });
      }

      await tx.case.create({
        data: {
          slug: c.slug,
          name: c.name,
          priceMinor: c.priceMinor,
          currency: c.currency ?? "RUB",
          displayOrder: c.displayOrder ?? 100,
          imageUrl: c.caseImageUrl ?? caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
          items: {
            create: c.items.map((item) => ({
              name: item.name,
              rarity: item.rarity,
              weight: item.weight,
              valueMinor: item.valueMinor,
              currency: item.currency ?? c.currency ?? "RUB",
              imageUrl: item.imageUrl,
            })),
          },
        },
      });
      return true;
    }, { timeout: 60_000 });
    console.log(created ? `created: ${c.slug} (${c.items.length} market-priced variants)` : `already current: ${c.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
