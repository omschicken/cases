import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentRail } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { KycService } from "../kyc/kyc.service";
import { ReferralService } from "../referral/referral.service";
import { PAYMENT_PROVIDERS, PaymentProvider } from "./payment-provider.interface";
import { DepositDto } from "./dto/deposit.dto";
import { WithdrawalDto } from "./dto/withdrawal.dto";
import { ReviewWithdrawalDto } from "./dto/review-withdrawal.dto";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly kyc: KycService,
    private readonly referral: ReferralService,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<PaymentRail, PaymentProvider>,
  ) {}

  private providerFor(rail: PaymentRail): PaymentProvider {
    const provider = this.providers.get(rail);
    if (!provider) throw new BadRequestException(`No payment provider configured for rail ${rail}`);
    return provider;
  }

  async deposit(userId: string, dto: DepositDto) {
    const amountMinor = BigInt(dto.amountMinor);
    const provider = this.providerFor(dto.rail);

    const deposit = await this.prisma.deposit.create({
      data: { userId, rail: dto.rail, amountMinor, currency: dto.currency, status: "PENDING" },
    });

    const result = await provider.initiateDeposit({ userId, amountMinor, currency: dto.currency });

    if (result.status === "CONFIRMED") {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.creditInTx(tx, userId, amountMinor, {
          reason: "DEPOSIT",
          referenceType: "Deposit",
          referenceId: deposit.id,
        });
        await tx.deposit.update({
          where: { id: deposit.id },
          data: { status: "CONFIRMED", providerRef: result.providerRef, confirmedAt: new Date() },
        });
      });
      await this.referral.awardDepositCommission(userId, amountMinor, dto.currency, deposit.id);
      return { ...deposit, status: "CONFIRMED" as const, providerRef: result.providerRef };
    }

    if (result.status === "FAILED") {
      await this.prisma.deposit.update({ where: { id: deposit.id }, data: { status: "FAILED" } });
      throw new BadRequestException("Deposit failed at the payment provider");
    }

    // PENDING: real providers confirm asynchronously via webhook (not wired
    // up here — see PaymentsController TODO and README for the real flow).
    await this.prisma.deposit.update({
      where: { id: deposit.id },
      data: { providerRef: result.providerRef },
    });
    return { ...deposit, providerRef: result.providerRef, redirectUrl: result.redirectUrl };
  }

  async requestWithdrawal(userId: string, dto: WithdrawalDto) {
    await this.kyc.requireVerified(userId);
    const amountMinor = BigInt(dto.amountMinor);

    return this.prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          rail: dto.rail,
          amountMinor,
          currency: dto.currency,
          destination: dto.destination,
          status: "PENDING",
        },
      });

      // Hold the funds immediately so the balance can't be double-spent
      // while the withdrawal sits in the admin review queue.
      await this.wallet.debitInTx(tx, userId, amountMinor, {
        reason: "WITHDRAWAL",
        referenceType: "Withdrawal",
        referenceId: withdrawal.id,
      });

      return withdrawal;
    });
  }

  async listPendingWithdrawals() {
    return this.prisma.withdrawal.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  async reviewWithdrawal(withdrawalId: string, adminUserId: string, dto: ReviewWithdrawalDto) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new NotFoundException("Withdrawal not found");
    if (withdrawal.status !== "PENDING") {
      throw new BadRequestException(`Withdrawal is already ${withdrawal.status}`);
    }

    if (!dto.approve) {
      return this.prisma.$transaction(async (tx) => {
        await this.wallet.creditInTx(tx, withdrawal.userId, withdrawal.amountMinor, {
          reason: "WITHDRAWAL",
          referenceType: "Withdrawal",
          referenceId: withdrawal.id,
        });
        return tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "REJECTED",
            reviewedByAdminId: adminUserId,
            reviewedAt: new Date(),
            rejectionReason: dto.rejectionReason ?? "Rejected by admin",
          },
        });
      });
    }

    const provider = this.providerFor(withdrawal.rail);
    const result = await provider.executeWithdrawal({
      userId: withdrawal.userId,
      amountMinor: withdrawal.amountMinor,
      currency: withdrawal.currency,
      destination: withdrawal.destination,
    });

    if (result.status === "PAID") {
      return this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "PAID",
          providerRef: result.providerRef,
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
          paidAt: new Date(),
        },
      });
    }

    // Provider-side failure: refund the held balance.
    return this.prisma.$transaction(async (tx) => {
      await this.wallet.creditInTx(tx, withdrawal.userId, withdrawal.amountMinor, {
        reason: "WITHDRAWAL",
        referenceType: "Withdrawal",
        referenceId: withdrawal.id,
      });
      return tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: "FAILED",
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
          rejectionReason: result.failureReason ?? "Payment provider failed to pay out",
        },
      });
    });
  }

  listMyDeposits(userId: string) {
    return this.prisma.deposit.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  listMyWithdrawals(userId: string) {
    return this.prisma.withdrawal.findMany({ where: { userId }, orderBy: { requestedAt: "desc" } });
  }
}
