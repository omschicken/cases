ALTER TYPE "InventoryItemStatus" ADD VALUE IF NOT EXISTS 'CONSUMED';

CREATE TYPE "GameOperationType" AS ENUM ('CONTRACT', 'UPGRADE');
CREATE TYPE "GameOperationStatus" AS ENUM ('WON', 'LOST');

CREATE TABLE "GameOperation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "GameOperationType" NOT NULL,
  "status" "GameOperationStatus" NOT NULL,
  "inputInventoryItemIds" JSONB NOT NULL,
  "targetCaseItemId" TEXT,
  "outputCaseItemId" TEXT,
  "outputInventoryItemId" TEXT,
  "roll" DOUBLE PRECISION NOT NULL,
  "chance" DOUBLE PRECISION NOT NULL,
  "serverSeedHash" TEXT NOT NULL,
  "clientSeed" TEXT NOT NULL,
  "nonce" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GameOperation_userId_createdAt_idx" ON "GameOperation"("userId", "createdAt");
ALTER TABLE "GameOperation" ADD CONSTRAINT "GameOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
