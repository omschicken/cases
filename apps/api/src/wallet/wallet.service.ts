import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerReason, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface LedgerRef {
  reason: LedgerReason;
  referenceType: string;
  referenceId: string;
}

/**
 * All balance mutations go through this service so every change is backed by
 * an append-only LedgerEntry and a row-level lock (`FOR UPDATE`) on the
 * wallet row, preventing lost updates when two requests hit the same wallet
 * concurrently (e.g. two case-opens firing at once).
 */
@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string): Promise<bigint> {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    return wallet.balanceMinor;
  }

  async getLedger(userId: string, take = 50) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException("Wallet not found");
    return this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  /** Credits (adds to) the wallet balance, opening its own transaction. */
  async credit(userId: string, amountMinor: bigint, ref: LedgerRef) {
    return this.prisma.$transaction((tx) => this.creditInTx(tx, userId, amountMinor, ref));
  }

  /** Debits (subtracts from) the wallet balance; throws if funds are insufficient. */
  async debit(userId: string, amountMinor: bigint, ref: LedgerRef) {
    return this.prisma.$transaction((tx) => this.debitInTx(tx, userId, amountMinor, ref));
  }

  async creditInTx(tx: Prisma.TransactionClient, userId: string, amountMinor: bigint, ref: LedgerRef) {
    if (amountMinor <= 0n) throw new BadRequestException("Credit amount must be positive");
    return this.applyInTx(tx, userId, amountMinor, ref);
  }

  async debitInTx(tx: Prisma.TransactionClient, userId: string, amountMinor: bigint, ref: LedgerRef) {
    if (amountMinor <= 0n) throw new BadRequestException("Debit amount must be positive");
    return this.applyInTx(tx, userId, -amountMinor, ref);
  }

  private async applyInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    signedAmountMinor: bigint,
    ref: LedgerRef,
  ) {
    const locked = await tx.$queryRaw<{ id: string; balanceMinor: bigint }[]>`
      SELECT "id", "balanceMinor" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
    `;
    const wallet = locked[0];
    if (!wallet) throw new NotFoundException("Wallet not found");

    const newBalance = wallet.balanceMinor + signedAmountMinor;
    if (newBalance < 0n) throw new BadRequestException("Insufficient funds");

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: newBalance, version: { increment: 1 } },
    });

    return tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        amountMinor: signedAmountMinor,
        balanceAfterMinor: newBalance,
        reason: ref.reason,
        referenceType: ref.referenceType,
        referenceId: ref.referenceId,
      },
    });
  }
}
