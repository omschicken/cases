import { Body, Controller, Get, Headers, HttpCode, Logger, Param, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { NowpaymentsService } from "./nowpayments.service";
import { CreateCryptoPaymentDto } from "./dto/create-crypto-payment.dto";

@Controller("payments/crypto")
export class CryptoPaymentsController {
  private readonly logger = new Logger(CryptoPaymentsController.name);

  constructor(private readonly nowpayments: NowpaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("create")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCryptoPaymentDto) {
    return this.nowpayments.createPayment(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("status/:paymentId")
  status(@CurrentUser() user: AuthenticatedUser, @Param("paymentId") paymentId: string) {
    return this.nowpayments.getStatus(user.id, paymentId);
  }

  // No auth: called by NOWPayments, authenticated by the HMAC signature.
  // Forged requests are rejected (401). A transient failure while crediting
  // returns 500 so NOWPayments retries — safe, processing is idempotent — a
  // swallowed error here would mean a paid deposit that is never credited.
  @Post("webhook")
  @HttpCode(200)
  async webhook(@Body() body: Record<string, unknown>, @Headers("x-nowpayments-sig") signature?: string) {
    if (!this.nowpayments.verifySignature(body, signature)) {
      this.logger.warn("Rejected NOWPayments webhook with an invalid signature");
      throw new UnauthorizedException("Invalid signature");
    }
    await this.nowpayments.handleWebhook(body);
    return { ok: true };
  }
}
