import { Module } from "@nestjs/common";
import { PricesService } from "./prices.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
