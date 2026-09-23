import { Module } from "@nestjs/common";
import { ReferralService } from "./referral.service";
import { ReferralController } from "./referral.controller";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [WalletModule],
  providers: [ReferralService],
  controllers: [ReferralController],
  exports: [ReferralService],
})
export class ReferralModule {}
