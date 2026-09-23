export type UserRole = "USER" | "ADMIN";

export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export type LedgerReason =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "CASE_OPEN"
  | "ITEM_SELL"
  | "REFERRAL_COMMISSION"
  | "ADMIN_ADJUSTMENT";

export type PaymentRail = "CARD" | "CRYPTO" | "STEAM_SKIN";

export type DepositStatus = "PENDING" | "CONFIRMED" | "FAILED";

export type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID" | "FAILED";

export interface CaseItemDto {
  id: string;
  name: string;
  imageUrl: string;
  weight: number;
  valueMinor: number;
  currency: string;
}

export interface CaseDto {
  id: string;
  slug: string;
  name: string;
  priceMinor: number;
  currency: string;
  imageUrl: string;
  items: CaseItemDto[];
}

export interface OpenCaseResultDto {
  inventoryItemId: string;
  openEventId: string;
  item: CaseItemDto;
  roll: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
}

export interface RevealedSeedDto {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  rollsUsed: number;
}
