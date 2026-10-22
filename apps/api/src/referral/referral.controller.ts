import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { ReferralService } from "./referral.service";

@UseGuards(JwtAuthGuard)
@Controller("referral")
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get("me")
  myStats(@CurrentUser() user: AuthenticatedUser) {
    return this.referralService.myStats(user.id);
  }

  @Get("me/earnings")
  myEarnings(@CurrentUser() user: AuthenticatedUser) {
    return this.referralService.myEarnings(user.id);
  }
}
