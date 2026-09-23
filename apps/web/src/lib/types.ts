export type UserRole = "USER" | "ADMIN";
export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type PaymentRail = "CARD" | "CRYPTO" | "STEAM_SKIN";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface CaseItem {
  id: string;
  name: string;
  imageUrl: string;
  weight: number;
  valueMinor: string; // BigInt serialized as string by the API
  currency: string;
}

export interface CaseDto {
  id: string;
  slug: string;
  name: string;
  priceMinor: string;
  currency: string;
  imageUrl: string;
  isActive: boolean;
  items: CaseItem[];
}

export interface OpenCaseResult {
  inventoryItemId: string;
  openEventId: string;
  item: CaseItem;
  roll: number;
  nonce: number;
  serverSeedHash: string;
  clientSeed: string;
}

export interface InventoryItemDto {
  id: string;
  status: "IN_INVENTORY" | "SOLD" | "WITHDRAWN";
  acquiredAt: string;
  caseItem: CaseItem;
}

export interface WalletDto {
  balanceMinor: string;
}

export interface LedgerEntryDto {
  id: string;
  amountMinor: string;
  balanceAfterMinor: string;
  reason: string;
  referenceType: string;
  referenceId: string;
  createdAt: string;
}
