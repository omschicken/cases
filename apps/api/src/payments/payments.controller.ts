import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { PaymentsService } from "./payments.service";
import { DepositDto } from "./dto/deposit.dto";
import { WithdrawalDto } from "./dto/withdrawal.dto";

@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("deposit")
  deposit(@CurrentUser() user: AuthenticatedUser, @Body() dto: DepositDto) {
    return this.paymentsService.deposit(user.id, dto);
  }

  @Post("withdraw")
  withdraw(@CurrentUser() user: AuthenticatedUser, @Body() dto: WithdrawalDto) {
    return this.paymentsService.requestWithdrawal(user.id, dto);
  }

  @Get("deposits/me")
  myDeposits(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listMyDeposits(user.id);
  }

  @Get("withdrawals/me")
  myWithdrawals(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listMyWithdrawals(user.id);
  }

  // TODO(real providers): add POST /payments/webhook/:rail here, verify the
  // provider's signature, and call a PaymentsService.confirmDeposit(...)
  // method for rails that confirm asynchronously instead of synchronously.
}
