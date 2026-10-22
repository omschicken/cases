import { PrismaClient } from "@prisma/client";
import cases from "./cs2-items.json";
import { marketCasePrice } from "../src/prices/case-pricing";

const prisma = new PrismaClient();

async function main() {
  const floors = new Map(cases.map((itemCase) => [itemCase.slug, itemCase.priceMinor]));
  const activeCases = await prisma.case.findMany({
    where: { isActive: true, slug: { in: [...floors.keys()] } },
    include: { items: { select: { weight: true, valueMinor: true } } },
  });
  for (const itemCase of activeCases) {
    const drops = itemCase.items.map((item) => ({ weight: item.weight, valueMinor: Number(item.valueMinor) }));
    const priceMinor = marketCasePrice(drops, floors.get(itemCase.slug)!);
    if (itemCase.priceMinor !== BigInt(priceMinor)) {
      await prisma.case.update({ where: { id: itemCase.id }, data: { priceMinor } });
    }
  }
  console.log(`market-priced ${activeCases.length} active cases`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
