import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";

@Injectable()
export class ReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService,
  ) {}

  private get commissionBps(): number {
    return this.config.get<number>("REFERRAL_COMMISSION_BPS", 500); // 5% default
  }

  /** Credits the referrer a cut of a referred user's confirmed deposit. No-op if the user has no referrer. */
  async awardDepositCommission(
    referredUserId: string,
    depositAmountMinor: bigint,
    currency: string,
    depositId: string,
  ) {
    const referred = await this.prisma.user.findUnique({
      where: { id: referredUserId },
      select: { referredById: true },
    });
    if (!referred?.referredById) return null;

    const commissionMinor = (depositAmountMinor * BigInt(this.commissionBps)) / 10_000n;
    if (commissionMinor <= 0n) return null;

    const referrerUserId = referred.referredById;
    return this.prisma.$transaction(async (tx) => {
      await this.wallet.creditInTx(tx, referrerUserId, commissionMinor, {
        reason: "REFERRAL_COMMISSION",
        referenceType: "Deposit",
        referenceId: depositId,
      });
      return tx.referralEarning.create({
        data: {
          referrerUserId,
          referredUserId,
          amountMinor: commissionMinor,
          currency,
          sourceType: "DEPOSIT_COMMISSION",
          sourceReferenceId: depositId,
        },
      });
    });
  }

  async myStats(userId: string) {
    const [user, referralsCount, earnings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }),
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.referralEarning.aggregate({
        where: { referrerUserId: userId },
        _sum: { amountMinor: true },
      }),
    ]);

    return {
      referralCode: user?.referralCode,
      referralsCount,
      totalEarnedMinor: earnings._sum.amountMinor ?? 0n,
    };
  }

  myEarnings(userId: string) {
    return this.prisma.referralEarning.findMany({
      where: { referrerUserId: userId },
      orderBy: { createdAt: "desc" },
    });
  }
}
