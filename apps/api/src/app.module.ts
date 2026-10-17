import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { WalletModule } from "./wallet/wallet.module";
import { KycModule } from "./kyc/kyc.module";
import { PaymentsModule } from "./payments/payments.module";
import { CasesModule } from "./cases/cases.module";
import { ReferralModule } from "./referral/referral.module";
import { AdminModule } from "./admin/admin.module";
import { PricesModule } from "./prices/prices.module";
import { HealthController } from "./health/health.controller";
import { GamesModule } from "./games/games.module";
import { BonusesModule } from "./bonuses/bonuses.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 100 }] }),
    PrismaModule,
    AuthModule,
    WalletModule,
    KycModule,
    PaymentsModule,
    CasesModule,
    ReferralModule,
    AdminModule,
    PricesModule,
    GamesModule,
    BonusesModule,
    LeaderboardModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
