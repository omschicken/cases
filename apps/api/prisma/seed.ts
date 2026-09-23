import { PrismaClient, ItemRarity } from "@prisma/client";

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

/**
 * Every image here is an inline SVG data URI — zero dependency on an
 * external image host, so cases render correctly in any environment
 * (including ones with restricted network egress). Swap for real skin
 * renders whenever real art is ready; nothing else needs to change.
 */
function placeholderImage(color: string, label: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>
    <rect width='240' height='240' fill='#14151d'/>
    <rect x='24' y='24' width='192' height='192' rx='20' fill='${color}' fill-opacity='0.18' stroke='${color}' stroke-width='3'/>
    <circle cx='120' cy='96' r='34' fill='${color}' fill-opacity='0.35' stroke='${color}' stroke-width='2'/>
    <text x='120' y='168' font-family='sans-serif' font-weight='700' font-size='15' fill='${color}' text-anchor='middle'>${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

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
}

interface CaseSeed {
  slug: string;
  name: string;
  priceMinor: number;
  items: ItemSeed[];
}

// Weights roughly mirror real CS2 case odds (heavily common-weighted).
const CASES: CaseSeed[] = [
  {
    slug: "starter-case",
    name: "Starter Case",
    priceMinor: 250,
    items: [
      { name: "Steel Blue Scout", rarity: "CONSUMER", weight: 7992, valueMinor: 80 },
      { name: "Urban Grey Rifle", rarity: "INDUSTRIAL", weight: 1598, valueMinor: 220 },
      { name: "Night Ops Carbine", rarity: "MIL_SPEC", weight: 320, valueMinor: 650 },
      { name: "Violet Storm SMG", rarity: "RESTRICTED", weight: 64, valueMinor: 2400 },
      { name: "Neon Fracture Knife", rarity: "CLASSIFIED", weight: 26, valueMinor: 12000 },
    ],
  },
  {
    slug: "operation-case",
    name: "Operation Case",
    priceMinor: 500,
    items: [
      { name: "Desert Tan Pistol", rarity: "CONSUMER", weight: 7992, valueMinor: 150 },
      { name: "Forest Camo Rifle", rarity: "INDUSTRIAL", weight: 1598, valueMinor: 450 },
      { name: "Crimson Edge SMG", rarity: "MIL_SPEC", weight: 320, valueMinor: 1300 },
      { name: "Arctic Ghost Sniper", rarity: "RESTRICTED", weight: 64, valueMinor: 4800 },
      { name: "Phantom Blade Karambit", rarity: "CLASSIFIED", weight: 24, valueMinor: 22000 },
      { name: "Dragon's Breath Gloves", rarity: "COVERT", weight: 2, valueMinor: 55000 },
    ],
  },
  {
    slug: "vanguard-case",
    name: "Vanguard Case",
    priceMinor: 1000,
    items: [
      { name: "Ashwood Pistol", rarity: "CONSUMER", weight: 7500, valueMinor: 300 },
      { name: "Riot Shield Rifle", rarity: "INDUSTRIAL", weight: 1800, valueMinor: 900 },
      { name: "Voidwalker SMG", rarity: "MIL_SPEC", weight: 480, valueMinor: 2600 },
      { name: "Solar Flare AWP", rarity: "RESTRICTED", weight: 160, valueMinor: 9500 },
      { name: "Obsidian Fang Knife", rarity: "CLASSIFIED", weight: 50, valueMinor: 38000 },
      { name: "Crown Reaper Gloves", rarity: "COVERT", weight: 10, valueMinor: 85000 },
    ],
  },
  {
    slug: "budget-case",
    name: "Budget Case",
    priceMinor: 100,
    items: [
      { name: "Concrete Grey Pistol", rarity: "CONSUMER", weight: 8500, valueMinor: 30 },
      { name: "Sandstorm Rifle", rarity: "INDUSTRIAL", weight: 1200, valueMinor: 90 },
      { name: "Copper Line SMG", rarity: "MIL_SPEC", weight: 250, valueMinor: 260 },
      { name: "Emerald Tide Knife", rarity: "RESTRICTED", weight: 45, valueMinor: 900 },
      { name: "Static Pulse Gloves", rarity: "CLASSIFIED", weight: 5, valueMinor: 4200 },
    ],
  },
  {
    slug: "legendary-case",
    name: "Legendary Case",
    priceMinor: 5000,
    items: [
      { name: "Titanium Pistol", rarity: "INDUSTRIAL", weight: 6000, valueMinor: 1800 },
      { name: "Warlord Rifle", rarity: "MIL_SPEC", weight: 2500, valueMinor: 5200 },
      { name: "Eclipse SMG", rarity: "RESTRICTED", weight: 900, valueMinor: 18000 },
      { name: "Bloodmoon Karambit", rarity: "CLASSIFIED", weight: 400, valueMinor: 60000 },
      { name: "Sovereign Gloves", rarity: "COVERT", weight: 150, valueMinor: 140000 },
      { name: "Golden Dragon Knife", rarity: "GOLD", weight: 50, valueMinor: 400000 },
    ],
  },
];

async function main() {
  for (const c of CASES) {
    const existing = await prisma.case.findUnique({ where: { slug: c.slug } });
    if (existing) {
      console.log(`skip (exists): ${c.slug}`);
      continue;
    }

    await prisma.case.create({
      data: {
        slug: c.slug,
        name: c.name,
        priceMinor: c.priceMinor,
        currency: "USD",
        imageUrl: caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
        items: {
          create: c.items.map((item) => ({
            name: item.name,
            rarity: item.rarity,
            weight: item.weight,
            valueMinor: item.valueMinor,
            currency: "USD",
            imageUrl: placeholderImage(RARITY_COLOR[item.rarity], item.name),
          })),
        },
      },
    });
    console.log(`created: ${c.slug} (${c.items.length} items)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
