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

// Vercel Functions are request-driven and may create multiple instances.
// Do not start a process-local cron timer there; its execution would be
// unreliable and could run more than once. Price sync needs a durable job.
const scheduleImports = process.env.VERCEL ? [] : [ScheduleModule.forRoot()];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...scheduleImports,
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
