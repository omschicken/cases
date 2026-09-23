import { Module } from "@nestjs/common";
import { CasesService } from "./cases.service";
import { CasesController } from "./cases.controller";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [WalletModule],
  providers: [CasesService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}
