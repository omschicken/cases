import { PrismaService } from "../src/prisma/prisma.service";
import { PricesService } from "../src/prices/prices.service";

async function main() {
  const prisma = new PrismaService();
  try {
    const status = await new PricesService(prisma).syncNow(true);
    console.log(JSON.stringify(status));
    if (status.lastError) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
