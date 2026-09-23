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
 * Dev/test stand-in for CS2 skin deposits/withdrawals over the Steam Trade
 * API. Real integration needs bot accounts holding trade-confirmable
 * inventory, Steam Guard/mobile confirmation automation, and live pricing —
 * and is the rail most likely to draw a Valve cease-and-desist if run
 * without extremely careful ToS compliance. Confirm with legal counsel
 * before enabling this rail in production.
 */
@Injectable()
export class MockSteamProvider implements PaymentProvider {
  readonly rail: PaymentRail = "STEAM_SKIN";

  async initiateDeposit(_input: DepositInitInput): Promise<DepositInitResult> {
    return { providerRef: `mock_steam_${randomUUID()}`, status: "CONFIRMED" };
  }

  async executeWithdrawal(_input: WithdrawalExecuteInput): Promise<WithdrawalExecuteResult> {
    return { providerRef: `mock_steam_${randomUUID()}`, status: "PAID" };
  }
}
