import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { KycModule } from "../kyc/kyc.module";
import { PaymentsModule } from "../payments/payments.module";
import { CasesModule } from "../cases/cases.module";

@Module({
  imports: [KycModule, PaymentsModule, CasesModule],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
