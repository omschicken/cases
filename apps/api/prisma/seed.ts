import { PrismaClient, ItemRarity } from "@prisma/client";
import cases from "./cs2-items.json";

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

const CASES = cases as CaseSeed[];

/**
 * Removes cases that are no longer in cs2-items.json (e.g. the old 5
 * hand-picked demo cases, now superseded by the full real case catalog) —
 * but only when every one of their items is free of real inventory/open
 * history, same safety rule as the per-case item replacement below.
 */
async function pruneRetiredCases() {
  const keepSlugs = new Set(CASES.map((c) => c.slug));
  const existingCases = await prisma.case.findMany({ include: { items: true } });

  for (const existing of existingCases) {
    if (keepSlugs.has(existing.slug)) continue;

    const untouched = await prisma.caseItem.count({
      where: { caseId: existing.id, inventoryItems: { none: {} }, openEvents: { none: {} } },
    });
    if (untouched !== existing.items.length) {
      console.log(`keep retired case (has real history): ${existing.slug}`);
      continue;
    }

    await prisma.caseItem.deleteMany({ where: { caseId: existing.id } });
    await prisma.case.delete({ where: { id: existing.id } });
    console.log(`removed retired case: ${existing.slug}`);
  }
}

async function main() {
  await pruneRetiredCases();

  for (const c of CASES) {
    const existing = await prisma.case.findUnique({ where: { slug: c.slug }, include: { items: true } });

    if (existing) {
      // Only replace items that have never actually dropped for a real
      // player — anything with inventory/open-event history stays put so
      // we never orphan a real result.
      const untouched = await prisma.caseItem.findMany({
        where: { caseId: existing.id, inventoryItems: { none: {} }, openEvents: { none: {} } },
        select: { id: true },
      });
      if (untouched.length !== existing.items.length) {
        console.log(`skip items (has real history): ${c.slug}`);
        continue;
      }

      await prisma.caseItem.deleteMany({ where: { id: { in: untouched.map((i) => i.id) } } });
      await prisma.case.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          priceMinor: c.priceMinor,
          currency: c.currency ?? "USD",
          displayOrder: c.displayOrder ?? 100,
          imageUrl: c.caseImageUrl ?? caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
          items: {
            create: c.items.map((item) => ({
              name: item.name,
              rarity: item.rarity,
              weight: item.weight,
              valueMinor: item.valueMinor,
              currency: item.currency ?? c.currency ?? "USD",
              imageUrl: item.imageUrl,
            })),
          },
        },
      });
      console.log(`updated: ${c.slug} (${c.items.length} real items)`);
      continue;
    }

    await prisma.case.create({
      data: {
        slug: c.slug,
        name: c.name,
        priceMinor: c.priceMinor,
        currency: c.currency ?? "USD",
        displayOrder: c.displayOrder ?? 100,
        imageUrl: c.caseImageUrl ?? caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
        items: {
          create: c.items.map((item) => ({
            name: item.name,
            rarity: item.rarity,
            weight: item.weight,
            valueMinor: item.valueMinor,
            currency: item.currency ?? c.currency ?? "USD",
            imageUrl: item.imageUrl,
          })),
        },
      },
    });
    console.log(`created: ${c.slug} (${c.items.length} real items)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
