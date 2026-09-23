import { Module } from "@nestjs/common";
import { PaymentRail } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PAYMENT_PROVIDERS, PaymentProvider } from "./payment-provider.interface";
import { MockCardProvider } from "./providers/mock-card.provider";
import { MockCryptoProvider } from "./providers/mock-crypto.provider";
import { MockSteamProvider } from "./providers/mock-steam.provider";
import { KycModule } from "../kyc/kyc.module";
import { ReferralModule } from "../referral/referral.module";
import { WalletModule } from "../wallet/wallet.module";

// Registers one adapter per PaymentRail. Swap individual providers here for
// real, licensed integrations without touching PaymentsService.
@Module({
  imports: [KycModule, ReferralModule, WalletModule],
  providers: [
    PaymentsService,
    MockCardProvider,
    MockCryptoProvider,
    MockSteamProvider,
    {
      provide: PAYMENT_PROVIDERS,
      useFactory: (
        card: MockCardProvider,
        crypto: MockCryptoProvider,
        steam: MockSteamProvider,
      ): Map<PaymentRail, PaymentProvider> =>
        new Map<PaymentRail, PaymentProvider>([
          ["CARD", card],
          ["CRYPTO", crypto],
          ["STEAM_SKIN", steam],
        ]),
      inject: [MockCardProvider, MockCryptoProvider, MockSteamProvider],
    },
  ],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
