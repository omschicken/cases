import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { PricesService } from "../src/prices/prices.service";

async function main() {
  const prisma = new PrismaService();
  try {
    const summary = await new PricesService(prisma, new ConfigService()).syncNow();
    console.log(JSON.stringify(summary));
    if (summary.failed || summary.skipped) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
