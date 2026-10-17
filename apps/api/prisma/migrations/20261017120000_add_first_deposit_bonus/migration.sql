-- AlterTable
ALTER TABLE "User" ADD COLUMN "firstDepositBonusUsed" BOOLEAN NOT NULL DEFAULT false;

-- Users who already deposited before this promo existed are not "first deposit" users.
UPDATE "User" SET "firstDepositBonusUsed" = true
WHERE "id" IN (SELECT DISTINCT "userId" FROM "Deposit" WHERE "status" = 'CONFIRMED');
