import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { WalletService } from "../wallet/wallet.service";
import { ReferralService } from "../referral/referral.service";
import { CreateCryptoPaymentDto } from "./dto/create-crypto-payment.dto";

const PAID_STATUSES = new Set(["finished", "confirmed"]);
const DEAD_STATUSES = new Set(["failed", "expired", "refunded"]);

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeysDeep((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

/** NOWPayments signs HMAC-SHA512 over the JSON body with keys sorted alphabetically. */
export function computeIpnSignature(body: unknown, secret: string): string {
  return createHmac("sha512", secret).update(JSON.stringify(sortKeysDeep(body))).digest("hex");
}

interface NpPayment {
  payment_id?: string | number;
  payment_status?: string;
  pay_address?: string;
  pay_amount?: number | string;
  pay_currency?: string;
  price_amount?: number | string;
  price_currency?: string;
  expiration_estimate_date?: string;
}

@Injectable()
export class NowpaymentsService {
  private readonly logger = new Logger(NowpaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly referral: ReferralService,
  ) {}

  private get baseUrl() {
    return process.env.NOWPAYMENTS_SANDBOX === "true"
      ? "https://api-sandbox.nowpayments.io/v1"
      : "https://api.nowpayments.io/v1";
  }

  private apiKey() {
    const key = process.env.NOWPAYMENTS_API_KEY;
    if (!key) throw new ServiceUnavailableException("Crypto deposits are not configured");
    return key;
  }

  private async np<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "x-api-key": this.apiKey(), "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!res.ok) {
      const message = (json as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`NOWPayments ${path} failed: ${message}`);
      // 4xx from NOWPayments is almost always "amount below the minimum for this coin".
      if (res.status >= 400 && res.status < 500) throw new BadRequestException(message);
      throw new BadGatewayException("Payment provider is unavailable, try again later");
    }
    return json as T;
  }

  async createPayment(userId: string, dto: CreateCryptoPaymentDto) {
    const amountKopecks = Math.round(dto.amountRub * 100);
    const callbackBase = (process.env.API_URL ?? "").replace(/\/+$/, "");

    // price_currency "rub": NOWPayments converts at its own rate, so we never
    // hold or guess an exchange rate ourselves.
    const np = await this.np<NpPayment>("/payment", {
      method: "POST",
      body: JSON.stringify({
        price_amount: amountKopecks / 100,
        price_currency: "rub",
        pay_currency: dto.currency,
        order_id: `dz_${userId}_${Date.now()}`,
        order_description: "DROPZONE deposit",
        ...(callbackBase ? { ipn_callback_url: `${callbackBase}/payments/crypto/webhook` } : {}),
      }),
    });

    if (!np.payment_id || !np.pay_address) throw new BadGatewayException("Payment provider returned an invalid response");

    const expiresAt = np.expiration_estimate_date
      ? new Date(np.expiration_estimate_date)
      : new Date(Date.now() + 60 * 60 * 1000);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        nowpaymentsId: String(np.payment_id),
        amountRub: amountKopecks,
        currency: dto.currency,
        payAddress: np.pay_address,
        payAmount: String(np.pay_amount ?? ""),
        expiresAt,
      },
    });

    return {
      paymentId: payment.id,
      payAddress: payment.payAddress,
      payAmount: payment.payAmount,
      payCurrency: payment.currency,
      expirationEstimate: payment.expiresAt,
    };
  }

  async getStatus(userId: string, paymentId: string) {
    let payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException("Payment not found");

    // Fallback if the webhook never reached us (wrong API_URL, provider hiccup):
    // ask NOWPayments directly. Same idempotent code path as the webhook.
    if (payment.status === "pending" && process.env.NOWPAYMENTS_API_KEY) {
      try {
        const np = await this.np<NpPayment>(`/payment/${payment.nowpaymentsId}`);
        await this.applyStatus(payment.nowpaymentsId, np);
        payment = (await this.prisma.payment.findFirst({ where: { id: paymentId, userId } })) ?? payment;
      } catch (err) {
        this.logger.warn(`Status sync failed for ${payment.id}: ${(err as Error).message}`);
      }
    }
    return payment;
  }

  verifySignature(body: unknown, signature: string | undefined): boolean {
    const secret = process.env.NOWPAYMENTS_IPN_SECRET;
    if (!secret || !signature || typeof body !== "object" || body === null) return false;
    const expected = Buffer.from(computeIpnSignature(body, secret), "hex");
    const given = Buffer.from(signature.trim().toLowerCase(), "hex");
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  /** Throws only on transient failures, so the provider retries those. */
  async handleWebhook(body: NpPayment) {
    if (body.payment_id === undefined) return;
    await this.applyStatus(String(body.payment_id), body);
  }

  private async applyStatus(nowpaymentsId: string, np: NpPayment) {
    const status = (np.payment_status ?? "").toLowerCase();
    const payment = await this.prisma.payment.findUnique({ where: { nowpaymentsId } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment ${nowpaymentsId}`);
      return;
    }

    if (DEAD_STATUSES.has(status)) {
      await this.prisma.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "failed" } });
      return;
    }
    if (!PAID_STATUSES.has(status) || payment.status === "confirmed") return;

    // Defence in depth: the paid order must be the order we created.
    const priceOk =
      np.price_amount === undefined ||
      (String(np.price_currency ?? "").toLowerCase() === "rub" &&
        Math.round(Number(np.price_amount) * 100) === payment.amountRub);
    if (!priceOk) {
      this.logger.error(`Payment ${payment.id}: price mismatch (${np.price_amount} ${np.price_currency}), not crediting`);
      return;
    }

    const amountMinor = BigInt(payment.amountRub);
    const credited = await this.prisma.$transaction(async (tx) => {
      // Conditional claim: of two concurrent confirmations only one gets count 1.
      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: "confirmed" } },
        data: { status: "confirmed" },
      });
      if (claimed.count === 0) return false;
      await this.wallet.creditInTx(tx, payment.userId, amountMinor, {
        reason: "DEPOSIT",
        referenceType: "CryptoPayment",
        referenceId: payment.id,
      });
      await this.wallet.applyFirstDepositBonusInTx(tx, payment.userId, amountMinor, payment.id);
      return true;
    });

    if (credited) {
      await this.referral
        .awardDepositCommission(payment.userId, amountMinor, "RUB", payment.id)
        .catch((err) => this.logger.error(`Referral commission failed for ${payment.id}: ${err.message}`));
    }
  }
}
