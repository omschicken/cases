import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { BonusesService } from "./bonuses.service";
import { IsString, MinLength, MaxLength } from "class-validator";

class RedeemPromoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  code!: string;
}

@Controller("bonuses")
@UseGuards(JwtAuthGuard)
export class BonusesController {
  constructor(private readonly bonuses: BonusesService) {}

  @Get("daily")
  dailyStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.bonuses.getDailyStatus(user.id);
  }

  @Post("daily/claim")
  claimDaily(@CurrentUser() user: AuthenticatedUser) {
    return this.bonuses.claimDaily(user.id);
  }

  @Post("promo/redeem")
  redeemPromo(@CurrentUser() user: AuthenticatedUser, @Body() dto: RedeemPromoDto) {
    return this.bonuses.redeemPromo(user.id, dto.code);
  }
}
