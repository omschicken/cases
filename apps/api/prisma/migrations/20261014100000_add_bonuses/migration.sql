-- Add new ledger reasons
ALTER TYPE "LedgerReason" ADD VALUE IF NOT EXISTS 'DAILY_BONUS';
ALTER TYPE "LedgerReason" ADD VALUE IF NOT EXISTS 'PROMO_CODE';

-- DailyBonusClaim
CREATE TABLE "DailyBonusClaim" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "claimedDate" TEXT         NOT NULL,
    "amountMinor" BIGINT       NOT NULL,
    "streakDay"   INTEGER      NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyBonusClaim_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyBonusClaim_userId_claimedDate_key" ON "DailyBonusClaim"("userId", "claimedDate");
CREATE INDEX "DailyBonusClaim_userId_createdAt_idx" ON "DailyBonusClaim"("userId", "createdAt");
ALTER TABLE "DailyBonusClaim"
    ADD CONSTRAINT "DailyBonusClaim_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PromoCode
CREATE TABLE "PromoCode" (
    "id"             TEXT         NOT NULL,
    "code"           TEXT         NOT NULL,
    "amountMinor"    BIGINT       NOT NULL,
    "currency"       TEXT         NOT NULL DEFAULT 'RUB',
    "maxRedemptions" INTEGER      NOT NULL DEFAULT 1,
    "expiresAt"      TIMESTAMP(3),
    "isActive"       BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- PromoCodeRedemption
CREATE TABLE "PromoCodeRedemption" (
    "id"          TEXT         NOT NULL,
    "promoCodeId" TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "amountMinor" BIGINT       NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCodeRedemption_promoCodeId_userId_key" ON "PromoCodeRedemption"("promoCodeId", "userId");
CREATE INDEX "PromoCodeRedemption_userId_createdAt_idx" ON "PromoCodeRedemption"("userId", "createdAt");
ALTER TABLE "PromoCodeRedemption"
    ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey"
    FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoCodeRedemption"
    ADD CONSTRAINT "PromoCodeRedemption_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
