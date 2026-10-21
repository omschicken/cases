/**
 * Safe, explicit import of the 15 original Casecrow collections.
 *
 * pnpm --filter @cs2-cases/api seed:originals:dry
 * pnpm --filter @cs2-cases/api seed:originals
 * pnpm --filter @cs2-cases/api seed:originals -- --activate
 *
 * Uses real, already-valued CS2 skins from active cases, with a deterministic
 * thematic selection and EV-based price. New cases stay INACTIVE by default,
 * and existing slugs or historical item pools are NEVER modified.
 */
import { PrismaClient, ItemRarity } from "@prisma/client";
import { marketCasePrice } from "../src/prices/case-pricing";
import { assessCaseEconomics } from "../src/common/util/case-economics";

const ORIGINALS = [
  {
    "slug": "raven",
    "name": "Raven",
    "keywords": [
      "raven",
      "night",
      "dark",
      "black",
      "slate"
    ],
    "min": 29900
  },
  {
    "slug": "ancient",
    "name": "Ancient",
    "keywords": [
      "ancient",
      "lore",
      "medusa",
      "apep",
      "king"
    ],
    "min": 89900
  },
  {
    "slug": "blackout",
    "name": "Blackout",
    "keywords": [
      "night",
      "black",
      "carbon",
      "graphite",
      "slate"
    ],
    "min": 29900
  },
  {
    "slug": "anubis",
    "name": "Anubis",
    "keywords": [
      "anubis",
      "apep",
      "desert",
      "egypt",
      "temple"
    ],
    "min": 99900
  },
  {
    "slug": "ice-vein",
    "name": "Ice Vein",
    "keywords": [
      "ice",
      "blue",
      "cold",
      "water",
      "frost"
    ],
    "min": 49900
  },
  {
    "slug": "dragon-fire",
    "name": "Dragon Fire",
    "keywords": [
      "dragon",
      "fire",
      "blaze",
      "flame",
      "heat"
    ],
    "min": 129900
  },
  {
    "slug": "eco-round",
    "name": "Eco Round",
    "keywords": [
      "sand",
      "forest",
      "urban",
      "army",
      "groundwater"
    ],
    "min": 9900
  },
  {
    "slug": "headshot",
    "name": "Headshot",
    "keywords": [
      "redline",
      "bullet",
      "kill",
      "blood",
      "head"
    ],
    "min": 39900
  },
  {
    "slug": "fade",
    "name": "Fade",
    "keywords": [
      "fade",
      "gradient",
      "spectrum",
      "marble",
      "neon"
    ],
    "min": 119900
  },
  {
    "slug": "gold-rush",
    "name": "Gold Rush",
    "keywords": [
      "gold",
      "tiger tooth",
      "arabesque",
      "amber",
      "brass"
    ],
    "min": 159900
  },
  {
    "slug": "blood-money",
    "name": "Blood Money",
    "keywords": [
      "blood",
      "red",
      "crimson",
      "slaughter",
      "scarlet"
    ],
    "min": 59900
  },
  {
    "slug": "toxic",
    "name": "Toxic",
    "keywords": [
      "green",
      "radiation",
      "jungle",
      "poison",
      "toxic"
    ],
    "min": 49900
  },
  {
    "slug": "doppler",
    "name": "Doppler",
    "keywords": [
      "doppler",
      "marble",
      "phase",
      "sapphire",
      "ruby"
    ],
    "min": 199900
  },
  {
    "slug": "ruby-crystal",
    "name": "Ruby Crystal",
    "keywords": [
      "ruby",
      "crimson",
      "doppler",
      "red",
      "slaughter"
    ],
    "min": 499900
  },
  {
    "slug": "sapphire-crystal",
    "name": "Sapphire Crystal",
    "keywords": [
      "sapphire",
      "blue",
      "doppler",
      "water",
      "ice"
    ],
    "min": 499900
  }
] as const;
const prisma = new PrismaClient();
type SourceItem = {
  name: string; imageUrl: string; rarity: ItemRarity;
  valueMinor: bigint; currency: string; weight: number;
};
const COUNTS: Partial<Record<ItemRarity, number>> = {
  MIL_SPEC: 4, RESTRICTED: 4, CLASSIFIED: 3, COVERT: 3, GOLD: 2,
};
const SHARES: Partial<Record<ItemRarity, number>> = {
  MIL_SPEC: 60, RESTRICTED: 25, CLASSIFIED: 10, COVERT: 4, GOLD: 1,
};
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
function choose(source: SourceItem[], rarity: ItemRarity, slug: string, keywords: readonly string[], count: number): SourceItem[] {
  return source.filter((item) => item.rarity === rarity).sort((a,b) => {
    const matches = (item: SourceItem) => keywords.reduce((sum,k) => sum + Number(item.name.toLowerCase().includes(k.toLowerCase())),0);
    const diff = matches(b) - matches(a);
    return diff || (hash(slug + a.name) - hash(slug + b.name));
  }).slice(0,count);
}
async function main() {
  const args = new Set(process.argv.slice(2));
  const dry = args.has("--dry-run") || process.env.CATALOG_DRY_RUN === "1";
  const activate = args.has("--activate");
  if (activate && dry) throw new Error("Cannot activate cases in dry-run mode");
  const sourceCases = await prisma.case.findMany({ where: { isActive:true }, select: {
    slug:true, items:{select:{name:true,imageUrl:true,rarity:true,valueMinor:true,currency:true,weight:true}}
  } });
  const source = new Map<string,SourceItem>();
  for (const existing of sourceCases) for (const item of existing.items) {
    if (item.currency !== "RUB" || item.valueMinor <= 0n || item.weight <= 0 || !/^https:\/\//.test(item.imageUrl)) continue;
    const old = source.get(item.name);
    // Keep a conservatively higher value when duplicate item names are priced differently.
    if (!old || item.valueMinor > old.valueMinor) source.set(item.name,item);
  }
  const all = [...source.values()];
  if (!all.length) throw new Error("No valued, illustrated RUB skins in current catalog");
  let imported = 0;
  for (let idx=0;idx<ORIGINALS.length;idx++) {
    const spec = ORIGINALS[idx];
    if (await prisma.case.findUnique({ where:{slug:spec.slug},select:{id:true} })) {
      console.log(`SKIP ${spec.slug}: existing slug, no mutation`);
      continue;
    }
    const pool = (Object.keys(COUNTS) as ItemRarity[]).flatMap((rarity) => {
      const picks = choose(all,rarity,spec.slug,spec.keywords,COUNTS[rarity] ?? 0);
      if (!picks.length) throw new Error(`No real items in rarity ${rarity} for ${spec.slug}`);
      return picks.map((item) => ({...item,weight:(SHARES[rarity] ?? 0)/picks.length}));
    });
    if (pool.length < 12) throw new Error(`Insufficient real item diversity for ${spec.slug}: ${pool.length}`);
    const priceMinor = marketCasePrice(pool.map((i)=>({valueMinor:Number(i.valueMinor),weight:i.weight})),spec.min);
    if (priceMinor > 10_000_000) throw new Error(`Unreasonable price of ${spec.slug}: ${priceMinor}`);
    const economic = assessCaseEconomics(pool,BigInt(priceMinor));
    if (!economic.canOpen || !economic.canBattle) throw new Error(`Case pricing safety rejected ${spec.slug}`);
    console.log(`${dry ? "PLAN" : "IMPORT"} ${spec.slug}: ${pool.length} distinct skins; ${priceMinor/100} RUB; active=${activate}`);
    if (dry) continue;
    await prisma.case.create({data:{
      slug:spec.slug,name:spec.name,priceMinor:BigInt(priceMinor),currency:"RUB",
      imageUrl:`/casecrow-originals/${spec.slug}.webp`,
      isActive:activate,displayOrder:2000+idx,
      items:{create:pool.map((i)=>({
        name:i.name,imageUrl:i.imageUrl,rarity:i.rarity,
        weight:i.weight,valueMinor:i.valueMinor,currency:"RUB",
      }))},
    }});
    imported++;
  }
  console.log(`Imported ${imported}/${ORIGINALS.length} original cases. Existing cases untouched.`);
}
main().catch((error)=>{console.error(error);process.exitCode=1;}).finally(async()=>{await prisma.$disconnect();});
