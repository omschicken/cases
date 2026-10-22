import { sha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";
import { bytesToHex, randomBytes } from "@noble/hashes/utils";

/**
 * Provably-fair case opening.
 *
 * Flow:
 *  1. Server generates a serverSeed and publishes sha256(serverSeed) (the
 *     "commitment") BEFORE any roll is made against it.
 *  2. Each roll consumes the next nonce for the (user, serverSeed) pair and
 *     combines it with the user's clientSeed via HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}`).
 *  3. The first 8 hex chars of the HMAC become a uint32, normalized to [0, 1),
 *     which is the roll used to pick a weighted item.
 *  4. When the user rotates their seed pair, the server reveals serverSeed.
 *     Anyone can then recompute steps 1-3 for every past nonce and confirm
 *     the committed hash and the resulting item both match — the operator
 *     could not have chosen the outcome after seeing the clientSeed/nonce.
 */

export interface WeightedItem {
  id: string;
  weight: number;
}

export function generateServerSeed(): string {
  return bytesToHex(randomBytes(32));
}

export function generateClientSeed(): string {
  return bytesToHex(randomBytes(16));
}

export function hashServerSeed(serverSeed: string): string {
  return bytesToHex(sha256(serverSeed));
}

/** Returns a float in [0, 1). */
export function computeRoll(serverSeed: string, clientSeed: string, nonce: number): number {
  const message = `${clientSeed}:${nonce}`;
  const digest = hmac(sha256, serverSeed, message);
  const slice = bytesToHex(digest.slice(0, 4)); // first 4 bytes = 32 bits
  const uint32 = parseInt(slice, 16);
  return uint32 / 0x100000000; // 2^32, keeps roll strictly < 1
}

export class ProvablyFairError extends Error {}

/**
 * Weighted pick using cumulative-weight walk. Deterministic given `roll`.
 * Items must have weight > 0; total weight must be > 0.
 */
export function pickWeightedItem<T extends WeightedItem>(items: T[], roll: number): T {
  if (items.length === 0) throw new ProvablyFairError("Cannot pick from an empty item list");
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) throw new ProvablyFairError("Total weight must be positive");

  const target = roll * totalWeight;
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (target < cumulative) return item;
  }
  // Guards against floating point edge case where target === totalWeight.
  return items[items.length - 1];
}

export interface RollResult<T extends WeightedItem> {
  roll: number;
  item: T;
}

export function rollCase<T extends WeightedItem>(
  items: T[],
  serverSeed: string,
  clientSeed: string,
  nonce: number,
): RollResult<T> {
  const roll = computeRoll(serverSeed, clientSeed, nonce);
  const item = pickWeightedItem(items, roll);
  return { roll, item };
}

export interface VerifyInput<T extends WeightedItem> {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  items: T[];
  expectedItemId: string;
}

export interface VerifyResult {
  hashMatches: boolean;
  itemMatches: boolean;
  roll: number;
  valid: boolean;
}

/** Anyone (user, auditor) can call this once serverSeed has been revealed. */
export function verifyRoll<T extends WeightedItem>(input: VerifyInput<T>): VerifyResult {
  const hashMatches = hashServerSeed(input.serverSeed) === input.serverSeedHash;
  const { roll, item } = rollCase(input.items, input.serverSeed, input.clientSeed, input.nonce);
  const itemMatches = item.id === input.expectedItemId;
  return { hashMatches, itemMatches, roll, valid: hashMatches && itemMatches };
}
