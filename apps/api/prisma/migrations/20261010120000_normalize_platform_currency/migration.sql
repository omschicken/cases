-- Platform currency migration. Seed data and test wallets historically used USD minor units.
-- The current platform FX policy is 95 RUB per USD (USD_TO_RUB_RATE fallback).
-- This migration is intentionally idempotent for currency fields: only USD rows are converted.

UPDATE "Wallet"
SET "balanceMinor" = "balanceMinor" * 95,
    "currency" = 'RUB'
WHERE "currency" = 'USD';

UPDATE "Case"
SET "priceMinor" = "priceMinor" * 95,
    "currency" = 'RUB'
WHERE "currency" = 'USD';

UPDATE "CaseItem"
SET "valueMinor" = "valueMinor" * 95,
    "currency" = 'RUB'
WHERE "currency" = 'USD';

ALTER TABLE "Wallet" ALTER COLUMN "currency" SET DEFAULT 'RUB';
ALTER TABLE "Case" ALTER COLUMN "currency" SET DEFAULT 'RUB';
ALTER TABLE "CaseItem" ALTER COLUMN "currency" SET DEFAULT 'RUB';
