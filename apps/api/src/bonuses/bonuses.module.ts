import { Module } from "@nestjs/common";
import { BonusesController } from "./bonuses.controller";
import { BonusesService } from "./bonuses.service";
import { PrismaModule } from "../prisma/prisma.module";
import { WalletModule } from "../wallet/wallet.module";

@Module({
  imports: [PrismaModule, WalletModule],
  controllers: [BonusesController],
  providers: [BonusesService],
})
export class BonusesModule {}
