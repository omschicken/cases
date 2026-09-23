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
 * Dev/test stand-in for a card PSP under the operator's gambling licence
 * (e.g. a Curacao/Coljuegos-approved acquirer). Real integration: redirect
 * to the PSP's hosted payment page, confirm via their webhook instead of
 * synchronously here.
 */
@Injectable()
export class MockCardProvider implements PaymentProvider {
  readonly rail: PaymentRail = "CARD";

  async initiateDeposit(_input: DepositInitInput): Promise<DepositInitResult> {
    return { providerRef: `mock_card_${randomUUID()}`, status: "CONFIRMED" };
  }

  async executeWithdrawal(_input: WithdrawalExecuteInput): Promise<WithdrawalExecuteResult> {
    return { providerRef: `mock_card_${randomUUID()}`, status: "PAID" };
  }
}
