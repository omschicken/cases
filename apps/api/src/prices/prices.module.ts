import { Module } from "@nestjs/common";
import { PricesService } from "./prices.service";
import { MarketController } from "./market.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [MarketController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
