import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { WalletService } from "../src/wallet/wallet.service";

/**
 * Integration tests against a real Postgres database (see .env / docker-compose.yml).
 * These exercise the actual row-level locking in WalletService, not a mock —
 * that's the only way to trust the "no lost updates" guarantee under real concurrency.
 */
describe("WalletService (integration)", () => {
  const prisma = new PrismaService();
  const wallet = new WalletService(prisma);

  async function createTestUser() {
    const suffix = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `wallet-test-${suffix}@example.com`,
        passwordHash: "not-a-real-hash",
        ageConfirmedAt: new Date(),
        referralCode: `TST${suffix.slice(0, 8).toUpperCase()}`,
      },
    });
    await prisma.wallet.create({ data: { userId: user.id } });
    return user.id;
  }

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("credits and debits adjust the balance and write matching ledger entries", async () => {
    const userId = await createTestUser();

    await wallet.credit(userId, 1000n, {
      reason: "DEPOSIT",
      referenceType: "Test",
      referenceId: "seed",
    });
    await wallet.debit(userId, 400n, {
      reason: "CASE_OPEN",
      referenceType: "Test",
      referenceId: "spend",
    });

    const balance = await wallet.getBalance(userId);
    expect(balance).toBe(600n);

    const ledger = await wallet.getLedger(userId);
    expect(ledger).toHaveLength(2);
    const sum = ledger.reduce((acc, e) => acc + e.amountMinor, 0n);
    expect(sum).toBe(600n);
  });

  it("rejects a debit that would overdraw the balance, leaving it unchanged", async () => {
    const userId = await createTestUser();
    await wallet.credit(userId, 100n, { reason: "DEPOSIT", referenceType: "Test", referenceId: "seed" });

    await expect(
      wallet.debit(userId, 101n, { reason: "CASE_OPEN", referenceType: "Test", referenceId: "spend" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(await wallet.getBalance(userId)).toBe(100n);
  });

  it("serializes concurrent debits so the balance never goes negative", async () => {
    const userId = await createTestUser();
    const startingBalance = 1000n;
    await wallet.credit(userId, startingBalance, {
      reason: "DEPOSIT",
      referenceType: "Test",
      referenceId: "seed",
    });

    // 20 concurrent debits of 100 against a balance of 1000: at most 10 can
    // succeed. If the row lock in WalletService didn't serialize these,
    // interleaved reads could let more than 10 through and drive the
    // balance negative.
    const attempts = 20;
    const debitAmount = 100n;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        wallet.debit(userId, debitAmount, {
          reason: "CASE_OPEN",
          referenceType: "Test",
          referenceId: `concurrent-${i}`,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    expect(succeeded).toBe(10);
    expect(failed).toBe(10);

    const finalBalance = await wallet.getBalance(userId);
    expect(finalBalance).toBe(startingBalance - BigInt(succeeded) * debitAmount);
    expect(finalBalance).toBeGreaterThanOrEqual(0n);

    // The ledger is the source of truth: replaying it must reconstruct the same balance.
    const ledger = await wallet.getLedger(userId, 100);
    const replayedBalance = ledger.reduce((acc, e) => acc + e.amountMinor, 0n);
    expect(replayedBalance).toBe(finalBalance);
  });
});
