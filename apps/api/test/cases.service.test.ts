import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { WalletService } from "../src/wallet/wallet.service";
import { CasesService } from "../src/cases/cases.service";

describe("CasesService.sellItem", () => {
  it("credits only once when two requests sell the same item concurrently", async () => {
    const userId = "user-1";
    let status = "IN_INVENTORY";
    const item = {
      id: "inventory-1",
      userId,
      status,
      caseItem: { currency: "RUB", valueMinor: 2500n },
    };
    let transactionTail = Promise.resolve();
    const tx = {
      inventoryItem: {
        updateMany: vi.fn(async ({ where }: { where: { id: string; userId: string; status: string } }) => {
          if (where.id !== item.id || where.userId !== userId || where.status !== status || status !== "IN_INVENTORY") {
            return { count: 0 };
          }
          status = "SOLD";
          return { count: 1 };
        }),
        findUniqueOrThrow: vi.fn(async () => ({ ...item, status })),
      },
    };
    const prisma = {
      inventoryItem: {
        // Both calls read the same available snapshot before either tx claims it.
        findUnique: vi.fn(async () => ({ ...item, status: "IN_INVENTORY" })),
      },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        const previous = transactionTail;
        let release = () => {};
        transactionTail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        try {
          return await callback(tx);
        } finally {
          release();
        }
      }),
    };
    const creditInTx = vi.fn(async () => undefined);
    const service = new CasesService(
      prisma as unknown as PrismaService,
      { creditInTx } as unknown as WalletService,
    );

    const results = await Promise.allSettled([
      service.sellItem(userId, item.id),
      service.sellItem(userId, item.id),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(BadRequestException);
    expect(creditInTx).toHaveBeenCalledTimes(1);
    expect(status).toBe("SOLD");
  });
});

describe("CasesService.listMyOpenEvents", () => {
  it("limits history to the authenticated user and returns newest entries first", async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { caseOpenEvent: { findMany } };
    const service = new CasesService(
      prisma as unknown as PrismaService,
      {} as WalletService,
    );

    await service.listMyOpenEvents("user-42");

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-42" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        nonce: true,
        roll: true,
        case: { select: { name: true, slug: true } },
        resultCaseItem: {
          select: { name: true, imageUrl: true, valueMinor: true, currency: true, rarity: true },
        },
        provablyFairSeed: { select: { serverSeedHash: true } },
      },
    });
  });
});
