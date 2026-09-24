import { PrismaClient, ItemRarity } from "@prisma/client";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import {
  computeRoll,
  generateClientSeed,
  generateServerSeed,
  hashServerSeed,
  pickWeightedItem,
} from "@cs2-cases/shared";
import { generateReferralCode } from "../src/common/util/code";
import cases from "./cs2-items.json";

const prisma = new PrismaClient();

// Marks accounts created purely to seed a non-empty "live drops" feed on a
// fresh install — never real players. Recreated fresh on every seed run.
const BOT_EMAIL_DOMAIN = "bots.internal";
const BOT_NAMES = [
  "ShadowFrost",
  "VertexPlay",
  "NoScopeKing",
  "LunaDrops",
  "GrimReaper94",
  "PixelHunter",
  "ZenithRoll",
  "BlazeCase",
  "NovaSkins",
  "CoreBreak",
];
const BOT_STARTING_BALANCE_MINOR = 100_000; // $1,000 — enough to open any seeded case

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
}

interface CaseSeed {
  slug: string;
  name: string;
  priceMinor: number;
  caseImageUrl?: string;
  items: ItemSeed[];
}

const CASES = cases as CaseSeed[];

/**
 * Bot-owned open events/inventory are purged and fully recreated on every
 * seed run (never persisted across runs) — that keeps them from being
 * mistaken for real history by the case-item replacement logic below, and
 * keeps their timestamps looking freshly "live" every time this runs.
 */
async function purgeBotDrops() {
  const bots = await prisma.user.findMany({
    where: { email: { endsWith: `@${BOT_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  if (bots.length === 0) return;
  const botIds = bots.map((b) => b.id);

  const wallets = await prisma.wallet.findMany({ where: { userId: { in: botIds } }, select: { id: true } });
  await prisma.caseOpenEvent.deleteMany({ where: { userId: { in: botIds } } });
  await prisma.inventoryItem.deleteMany({ where: { userId: { in: botIds } } });
  await prisma.ledgerEntry.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
  await prisma.provablyFairSeed.deleteMany({ where: { userId: { in: botIds } } });
}

async function seedBotDrops() {
  const items = await prisma.caseItem.findMany({ include: { case: true } });
  if (items.length === 0) return;

  let ts = Date.now();

  for (const name of BOT_NAMES) {
    const email = `bot_${name.toLowerCase()}@${BOT_EMAIL_DOMAIN}`;
    const passwordHash = await argon2.hash(randomUUID());

    const bot = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        displayName: name,
        ageConfirmedAt: new Date(),
        referralCode: generateReferralCode(),
      },
    });

    const wallet = await prisma.wallet.upsert({
      where: { userId: bot.id },
      update: { balanceMinor: BOT_STARTING_BALANCE_MINOR },
      create: { userId: bot.id, balanceMinor: BOT_STARTING_BALANCE_MINOR },
    });

    const serverSeed = generateServerSeed();
    const seed = await prisma.provablyFairSeed.create({
      data: {
        userId: bot.id,
        serverSeed,
        serverSeedHash: hashServerSeed(serverSeed),
        clientSeed: generateClientSeed(),
        nonce: 0,
        isActive: true,
      },
    });

    // 2-4 opens per bot, each real weighted rolls against the item pool of
    // a random seeded case — genuinely provably-fair, just bot-owned.
    const opens = 2 + Math.floor(Math.random() * 3);
    let balance = wallet.balanceMinor;
    let nonce = 0;

    for (let i = 0; i < opens; i++) {
      const theCase = CASES[Math.floor(Math.random() * CASES.length)];
      const caseItems = items.filter((it) => it.case.slug === theCase.slug);
      const price = BigInt(theCase.priceMinor);
      if (balance < price) continue;

      const roll = computeRoll(serverSeed, seed.clientSeed, nonce);
      const won = pickWeightedItem(
        caseItems.map((it) => ({ id: it.id, weight: it.weight })),
        roll,
      );
      const wonItem = caseItems.find((it) => it.id === won.id)!;

      balance -= price;
      // Spread drops out over the last ~90 minutes so the ticker reads as
      // organic activity rather than a single burst.
      ts -= 1000 * (30 + Math.floor(Math.random() * 300));

      await prisma.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          amountMinor: -price,
          balanceAfterMinor: balance,
          reason: "CASE_OPEN",
          referenceType: "Case",
          referenceId: wonItem.caseId,
          createdAt: new Date(ts),
        },
      });

      const inventoryItem = await prisma.inventoryItem.create({
        data: { userId: bot.id, caseItemId: wonItem.id, status: "IN_INVENTORY", acquiredAt: new Date(ts) },
      });
      await prisma.caseOpenEvent.create({
        data: {
          userId: bot.id,
          caseId: wonItem.caseId,
          resultCaseItemId: wonItem.id,
          provablyFairSeedId: seed.id,
          nonce,
          roll,
          inventoryItemId: inventoryItem.id,
          createdAt: new Date(ts),
        },
      });
      nonce += 1;
    }

    await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceMinor: balance } });
    await prisma.provablyFairSeed.update({ where: { id: seed.id }, data: { nonce } });
  }

  console.log(`seeded bot drops: ${BOT_NAMES.length} bots`);
}

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
  await purgeBotDrops();
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
          imageUrl: c.caseImageUrl ?? caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
          items: {
            create: c.items.map((item) => ({
              name: item.name,
              rarity: item.rarity,
              weight: item.weight,
              valueMinor: item.valueMinor,
              currency: "USD",
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
        currency: "USD",
        imageUrl: c.caseImageUrl ?? caseImage(RARITY_COLOR[c.items[c.items.length - 1].rarity], c.name),
        items: {
          create: c.items.map((item) => ({
            name: item.name,
            rarity: item.rarity,
            weight: item.weight,
            valueMinor: item.valueMinor,
            currency: "USD",
            imageUrl: item.imageUrl,
          })),
        },
      },
    });
    console.log(`created: ${c.slug} (${c.items.length} real items)`);
  }

  await seedBotDrops();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
