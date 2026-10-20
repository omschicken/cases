import type { OpenCaseResult } from "./types";

export interface OpeningReceipt {
  startedAt: number;
  result?: OpenCaseResult;
}
const key = (userId: string, caseId: string) => `casecrow.opening.v1:${userId}:${caseId}`;

/** Presentation recovery only. Receipts never authorize or repeat a transaction. */
export function saveOpening(userId: string, caseId: string, receipt: OpeningReceipt) {
  try { sessionStorage.setItem(key(userId, caseId), JSON.stringify(receipt)); }
  catch { /* Opening still works when session storage is unavailable. */ }
}

export function loadOpening(userId: string, caseId: string): OpeningReceipt | null {
  try {
    const receipt = JSON.parse(sessionStorage.getItem(key(userId, caseId)) ?? "null");
    if (!receipt || typeof receipt.startedAt !== "number" || Date.now() - receipt.startedAt > 86_400_000) return null;
    if (receipt.result) {
      const r = receipt.result;
      if (typeof r.openEventId !== "string" || typeof r.inventoryItemId !== "string" ||
          typeof r.roll !== "number" || typeof r.nonce !== "number" ||
          typeof r.serverSeedHash !== "string" || typeof r.clientSeed !== "string" ||
          typeof r.item?.id !== "string" || typeof r.item.name !== "string" ||
          typeof r.item.valueMinor !== "string" || !/^\d+$/.test(r.item.valueMinor) ||
          typeof r.item.currency !== "string" || typeof r.item.rarity !== "string") return null;
    }
    return receipt;
  } catch { return null; }
}

export function clearOpening(userId: string, caseId: string) {
  try { sessionStorage.removeItem(key(userId, caseId)); } catch { /* Optional storage. */ }
}
