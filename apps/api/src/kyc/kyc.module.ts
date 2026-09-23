import { Module } from "@nestjs/common";
import { KycService } from "./kyc.service";
import { KycController } from "./kyc.controller";
import { KYC_PROVIDER } from "./kyc-provider.interface";
import { MockKycProvider } from "./providers/mock-kyc.provider";

// Swap this provider binding for a real KYC vendor adapter once contracted;
// nothing else in the module needs to change (see kyc-provider.interface.ts).
@Module({
  providers: [KycService, { provide: KYC_PROVIDER, useClass: MockKycProvider }],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
