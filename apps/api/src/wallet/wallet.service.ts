import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LedgerReason, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** First-deposit promo: +10% of the deposit, capped at 500 RUB (in kopecks). */
export const FIRST_DEPOSIT_BONUS_PERCENT = 10n;
export const FIRST_DEPOSIT_BONUS_CAP_MINOR = 50_000n;

export function firstDepositBonusMinor(depositAmountMinor: bigint): bigint {
  const bonus = (depositAmountMinor * FIRST_DEPOSIT_BONUS_PERCENT) / 100n;
  return bonus > FIRST_DEPOSIT_BONUS_CAP_MINOR ? FIRST_DEPOSIT_BONUS_CAP_MINOR : bonus;
}

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

  async getPromoStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstDepositBonusUsed: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return { firstDepositBonusAvailable: !user.firstDepositBonusUsed };
  }

  /**
   * Awards the first-deposit bonus inside the caller's transaction (the same
   * one that credits the deposit itself). The flag is claimed with a
   * conditional UPDATE, so two concurrent confirmations can never both win it.
   * Returns the bonus credited, in minor units (0n if not eligible).
   */
  async applyFirstDepositBonusInTx(
    tx: Prisma.TransactionClient,
    userId: string,
    depositAmountMinor: bigint,
    depositId: string,
  ): Promise<bigint> {
    const bonusMinor = firstDepositBonusMinor(depositAmountMinor);
    if (bonusMinor <= 0n) return 0n;

    const claimed = await tx.user.updateMany({
      where: { id: userId, firstDepositBonusUsed: false },
      data: { firstDepositBonusUsed: true },
    });
    if (claimed.count === 0) return 0n;

    await this.creditInTx(tx, userId, bonusMinor, {
      reason: "PROMO_CODE",
      referenceType: "FirstDepositBonus",
      referenceId: depositId,
    });
    return bonusMinor;
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
    const locked = await tx.$queryRaw<{ id: string; balanceMinor: bigint; currency: string }[]>`
      SELECT "id", "balanceMinor", "currency" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
    `;
    const wallet = locked[0];
    if (!wallet) throw new NotFoundException("Wallet not found");
    if (wallet.currency !== "RUB") throw new BadRequestException("Only RUB wallets are supported");

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
