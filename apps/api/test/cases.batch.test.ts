import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaService } from "../src/prisma/prisma.service";
import { WalletService } from "../src/wallet/wallet.service";
import { CasesService } from "../src/cases/cases.service";

/** Runs against disposable PostgreSQL in GitHub CI, never production. */
describe("atomic paid multi-open (integration)", () => {
  const prisma = new PrismaService();
  const wallet = new WalletService(prisma);
  const cases = new CasesService(prisma, wallet);

  afterAll(async () => { await prisma.$disconnect(); });

  async function scenario(balanceMinor: bigint) {
    const id = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `batch-${id}@example.test`,
        passwordHash: "integration-only",
        referralCode: id.slice(0, 12).toUpperCase(),
        ageConfirmedAt: new Date(),
        wallet: { create: {} },
      },
    });
    const c = await prisma.case.create({
      data: {
        slug: `batch-${id}`, name: "Multi Open Integration",
        priceMinor: 10_000n, currency: "RUB", imageUrl: "placeholder",
        items: {
          create: [{
            name: "Test Skin", imageUrl: "placeholder",
            valueMinor: 9_000n, weight: 100,
            rarity: "MIL_SPEC", currency: "RUB",
          }],
        },
      },
    });
    await wallet.credit(user.id, balanceMinor, { reason: "DEPOSIT", referenceType: "Test", referenceId: id });
    return { userId: user.id, caseId: c.id };
  }

  it("charges one ledger debit and returns three unique inventory rewards", async () => {
    const { userId, caseId } = await scenario(100_000n);
    const response = await cases.openCaseBatch(userId, caseId, 3);
    expect(response.count).toBe(3);
    expect(response.results).toHaveLength(3);
    expect(response.results.map(x => x.nonce)).toEqual([0, 1, 2]);
    expect(new Set(response.results.map(x => x.inventoryItemId)).size).toBe(3);
    expect(new Set(response.results.map(x => x.openEventId)).size).toBe(3);
    expect(await wallet.getBalance(userId)).toBe(70_000n);

    const debits = (await wallet.getLedger(userId)).filter(x => x.reason === "CASE_OPEN");
    expect(debits).toHaveLength(1);
    expect(debits[0].amountMinor).toBe(-30_000n);
    expect(await prisma.inventoryItem.count({ where: { userId, status: "IN_INVENTORY" } })).toBe(3);

    const next = await cases.openCaseBatch(userId, caseId, 1);
    expect(next.results[0].nonce).toBe(3);
    expect(await wallet.getBalance(userId)).toBe(60_000n);
  });

  it("does not debit or create items when funds are insufficient", async () => {
    const { userId, caseId } = await scenario(10_000n);
    await expect(cases.openCaseBatch(userId, caseId, 3)).rejects.toThrow();
    expect(await wallet.getBalance(userId)).toBe(10_000n);
    expect(await prisma.inventoryItem.count({ where: { userId } })).toBe(0);
    expect(await prisma.caseOpenEvent.count({ where: { userId } })).toBe(0);
  });

  it("never reuses a nonce across concurrent single and batch purchases", async () => {
    const { userId, caseId } = await scenario(150_000n);
    const results = await Promise.all([
      cases.openCase(userId, caseId),
      cases.openCaseBatch(userId, caseId, 3),
    ]);
    const nonces = [results[0].nonce, ...results[1].results.map(item => item.nonce)];
    expect(new Set(nonces).size).toBe(4);
    expect(nonces.sort((a,b) => a-b)).toEqual([0,1,2,3]);
    expect(await wallet.getBalance(userId)).toBe(110_000n);
    expect(await prisma.caseOpenEvent.count({ where: { userId } })).toBe(4);
  });

  it("allocates just one active seed when first use is concurrent", async () => {
    const { userId } = await scenario(10_000n);
    const both = await Promise.all([
      cases.getOrCreateActiveSeed(userId),
      cases.getOrCreateActiveSeed(userId),
    ]);
    expect(both[0].id).toBe(both[1].id);
    expect(await prisma.provablyFairSeed.count({ where: { userId, isActive: true } })).toBe(1);
  });
});
