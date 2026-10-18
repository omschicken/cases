/**
 * One-shot image fixer: finds every CaseItem whose imageUrl is empty, a
 * placehold.co stub, or missing, and patches it with the real Steam CDN URL
 * from prisma/cs2-items.json and prisma/cs2-images-extra.json.
 *
 *   DATABASE_URL=...  tsx prisma/fix-item-images.ts
 *
 * Safe to run repeatedly — only rows that still have placeholder / empty URLs
 * are touched (items with a real Steam URL are skipped).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ── image alias map — same as seed-cases.ts ─────────────────────────────────
const IMAGE_ALIAS: Record<string, string> = {
  "★ Karambit | Vanilla": "★ Karambit",
};

function loadImages(): Map<string, string> {
  const images = new Map<string, string>();
  const catalog = JSON.parse(
    readFileSync(join(__dirname, "cs2-items.json"), "utf8"),
  ) as { items: { name: string; imageUrl: string }[] }[];
  for (const c of catalog)
    for (const i of c.items)
      if (!images.has(i.name) && i.imageUrl) images.set(i.name, i.imageUrl);

  const extra = JSON.parse(
    readFileSync(join(__dirname, "cs2-images-extra.json"), "utf8"),
  ) as Record<string, string>;
  for (const [name, url] of Object.entries(extra))
    if (url) images.set(name, url);

  return images;
}

/** The hallucinated Steam CDN hash used in every fake/AI-generated imageUrl. */
const FAKE_HASH_PREFIX = "i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhW";

function needsFix(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  if (/placehold(er)?\.co/i.test(url)) return true;
  if (url.startsWith("data:")) return true;
  if (url.includes(FAKE_HASH_PREFIX)) return true;
  return false;
}

async function main() {
  const images = loadImages();
  console.log(`Loaded ${images.size} image URLs from catalog`);

  const prisma = new PrismaClient();
  try {
    // Fetch ALL case items — typically only a few hundred rows
    const items = await prisma.caseItem.findMany({
      select: { id: true, name: true, imageUrl: true },
    });
    console.log(`Found ${items.length} case items in DB`);

    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const item of items) {
      // Skip items that already have a real URL
      if (!needsFix(item.imageUrl)) {
        skipped++;
        continue;
      }

      const resolvedName = IMAGE_ALIAS[item.name] ?? item.name;
      const imageUrl = images.get(resolvedName);
      if (!imageUrl) {
        console.warn(`  no image for: ${item.name}`);
        notFound++;
        continue;
      }

      await prisma.caseItem.update({
        where: { id: item.id },
        data: { imageUrl },
      });
      updated++;
    }

    console.log(`\nDone: updated=${updated}  skipped(already ok)=${skipped}  notFound=${notFound}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("fix-item-images failed:", err);
  process.exit(1);
});
