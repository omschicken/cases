import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { KycService } from "./kyc.service";
import { KycSubmitDto } from "./dto/kyc-submit.dto";

@UseGuards(JwtAuthGuard)
@Controller("kyc")
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post("submit")
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: KycSubmitDto) {
    return this.kycService.submit(user.id, dto);
  }

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    const [status, latest] = await Promise.all([
      this.kycService.getStatus(user.id),
      this.kycService.getLatestRecord(user.id),
    ]);
    return { status, latest };
  }
}
