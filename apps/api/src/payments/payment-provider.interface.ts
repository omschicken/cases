import { PaymentRail } from "@prisma/client";

export const PAYMENT_PROVIDERS = Symbol("PAYMENT_PROVIDERS");

export interface DepositInitInput {
  userId: string;
  amountMinor: bigint;
  currency: string;
}

export interface DepositInitResult {
  providerRef: string;
  status: "PENDING" | "CONFIRMED" | "FAILED";
  /** Where to send the user to complete payment (card 3DS page, crypto invoice, Steam trade offer, ...). */
  redirectUrl?: string;
}

export interface WithdrawalExecuteInput {
  userId: string;
  amountMinor: bigint;
  currency: string;
  destination: string;
}

export interface WithdrawalExecuteResult {
  providerRef: string;
  status: "PAID" | "FAILED";
  failureReason?: string;
}

/**
 * One adapter per payment rail (card/PSP, crypto, Steam skin trade). Swap
 * the mock binding in PaymentsModule for a real, licensed provider once
 * contracted — PaymentsService only ever talks to this interface.
 */
export interface PaymentProvider {
  readonly rail: PaymentRail;
  initiateDeposit(input: DepositInitInput): Promise<DepositInitResult>;
  executeWithdrawal(input: WithdrawalExecuteInput): Promise<WithdrawalExecuteResult>;
}
