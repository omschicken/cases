import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";

// Streak rewards in RUB minor (kopecks). Day 7 resets the streak.
const STREAK_AMOUNTS = [5_00n, 10_00n, 15_00n, 20_00n, 25_00n, 30_00n, 100_00n];

function utcDateString(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BonusesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async getDailyStatus(userId: string) {
    const today = utcDateString();
    const claim = await this.prisma.dailyBonusClaim.findUnique({
      where: { userId_claimedDate: { userId, claimedDate: today } },
    });
    if (claim) {
      return { claimedToday: true, streakDay: claim.streakDay, amountMinor: claim.amountMinor.toString() };
    }
    const yesterday = utcDateString(new Date(Date.now() - 86_400_000));
    const prevClaim = await this.prisma.dailyBonusClaim.findUnique({
      where: { userId_claimedDate: { userId, claimedDate: yesterday } },
    });
    const streakDay = prevClaim ? Math.min(prevClaim.streakDay + 1, 7) : 1;
    const amountMinor = STREAK_AMOUNTS[streakDay - 1];
    return { claimedToday: false, streakDay, amountMinor: amountMinor.toString() };
  }

  async claimDaily(userId: string) {
    const today = utcDateString();
    const existing = await this.prisma.dailyBonusClaim.findUnique({
      where: { userId_claimedDate: { userId, claimedDate: today } },
    });
    if (existing) throw new BadRequestException("Бонус за сегодня уже получен");

    const yesterday = utcDateString(new Date(Date.now() - 86_400_000));
    const prevClaim = await this.prisma.dailyBonusClaim.findUnique({
      where: { userId_claimedDate: { userId, claimedDate: yesterday } },
    });
    const streakDay = prevClaim ? Math.min(prevClaim.streakDay + 1, 7) : 1;
    const amountMinor = STREAK_AMOUNTS[streakDay - 1];

    const claim = await this.prisma.dailyBonusClaim.create({
      data: { userId, claimedDate: today, amountMinor, streakDay },
    });

    await this.wallet.credit(userId, amountMinor, {
      reason: "DAILY_BONUS",
      referenceType: "DailyBonusClaim",
      referenceId: claim.id,
    });

    return { streakDay, amountMinor: amountMinor.toString(), nextStreakDay: streakDay < 7 ? streakDay + 1 : 1 };
  }

  async redeemPromo(userId: string, code: string) {
    const promo = await this.prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!promo || !promo.isActive) throw new BadRequestException("Промокод не найден или недействителен");
    if (promo.expiresAt && promo.expiresAt < new Date()) throw new BadRequestException("Срок действия промокода истёк");
    if (promo._count.redemptions >= promo.maxRedemptions) throw new BadRequestException("Промокод уже исчерпан");

    const alreadyUsed = await this.prisma.promoCodeRedemption.findUnique({
      where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
    });
    if (alreadyUsed) throw new BadRequestException("Ты уже активировал этот промокод");

    const redemption = await this.prisma.promoCodeRedemption.create({
      data: { promoCodeId: promo.id, userId, amountMinor: promo.amountMinor },
    });

    await this.wallet.credit(userId, promo.amountMinor, {
      reason: "PROMO_CODE",
      referenceType: "PromoCodeRedemption",
      referenceId: redemption.id,
    });

    return { amountMinor: promo.amountMinor.toString(), currency: promo.currency };
  }
}
