export type UserRole = "USER" | "ADMIN";
export type KycStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
export type PaymentRail = "CARD" | "CRYPTO" | "STEAM_SKIN";
export type ItemRarity =
  | "CONSUMER"
  | "INDUSTRIAL"
  | "MIL_SPEC"
  | "RESTRICTED"
  | "CLASSIFIED"
  | "COVERT"
  | "GOLD";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
  steamAvatarUrl?: string | null;
}

export interface CaseItem {
  id: string;
  name: string;
  imageUrl: string;
  weight: number;
  valueMinor: string; // BigInt serialized as string by the API
  currency: string;
  rarity: ItemRarity;
}

export interface CaseDto {
  id: string;
  slug: string;
  name: string;
  priceMinor: string;
  currency: string;
  imageUrl: string;
  isActive: boolean;
  itemCount?: number; // Full exterior count; list responses contain representative items.
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

export interface CaseOpenHistoryDto {
  id: string;
  createdAt: string;
  nonce: number;
  roll: number;
  case: { name: string; slug: string };
  resultCaseItem: Pick<CaseItem, "name" | "imageUrl" | "valueMinor" | "currency" | "rarity">;
  provablyFairSeed: { serverSeedHash: string };
}

export interface InventoryItemDto {
  id: string;
  status: "IN_INVENTORY" | "SOLD" | "WITHDRAWN" | "CONSUMED";
  acquiredAt: string;
  caseItem: CaseItem;
}

export interface WalletDto {
  balanceMinor: string;
}

export interface GameOperationDto {
  id: string;
  type: "CONTRACT" | "UPGRADE" | "BATTLE";
  status: "WON" | "LOST";
  roll: number;
  chance: number;
  nonce: number;
  serverSeedHash: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
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

export interface RecentDropDto {
  id: string;
  createdAt: string;
  userLabel: string;
  caseName: string;
  item: {
    name: string;
    imageUrl: string;
    valueMinor: string;
    currency: string;
    rarity: ItemRarity;
  };
}

export interface PublicStatsDto {
  totalOpens: string;
  totalValueMinor: string;
  playerCount: number;
}

export interface PriceSyncStatusDto {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  durationMs: number | null;
  itemsSynced: number | null;
  casesUpdated: number | null;
  lastError: string | null;
  skinsListed: number;
  itemsTotal: number;
  withImages: number;
}

export interface CaseBalanceRowDto {
  slug: string;
  currency: string;
  oldPriceMinor: string;
  priceMinor: string;
  rtp: number;
  itemCount: number;
}
