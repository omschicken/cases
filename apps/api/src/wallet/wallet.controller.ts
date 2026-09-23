import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { WalletService } from "./wallet.service";

@UseGuards(JwtAuthGuard)
@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("me")
  async myWallet(@CurrentUser() user: AuthenticatedUser) {
    const balanceMinor = await this.walletService.getBalance(user.id);
    return { balanceMinor };
  }

  @Get("me/ledger")
  myLedger(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getLedger(user.id);
  }
}
