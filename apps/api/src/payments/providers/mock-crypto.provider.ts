import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PaymentRail } from "@prisma/client";
import {
  DepositInitInput,
  DepositInitResult,
  PaymentProvider,
  WithdrawalExecuteInput,
  WithdrawalExecuteResult,
} from "../payment-provider.interface";

/**
 * Dev/test stand-in for a crypto payment processor (e.g. USDT/BTC invoicing
 * + on-chain payout). Real integration: generate a deposit address/invoice,
 * confirm via the processor's webhook after N confirmations.
 */
@Injectable()
export class MockCryptoProvider implements PaymentProvider {
  readonly rail: PaymentRail = "CRYPTO";

  async initiateDeposit(_input: DepositInitInput): Promise<DepositInitResult> {
    return { providerRef: `mock_crypto_${randomUUID()}`, status: "CONFIRMED" };
  }

  async executeWithdrawal(_input: WithdrawalExecuteInput): Promise<WithdrawalExecuteResult> {
    return { providerRef: `mock_crypto_${randomUUID()}`, status: "PAID" };
  }
}
