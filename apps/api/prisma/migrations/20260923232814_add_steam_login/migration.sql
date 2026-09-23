-- AlterTable
ALTER TABLE "User" ADD COLUMN "steamId" TEXT,
ADD COLUMN "steamAvatarUrl" TEXT,
ADD COLUMN "displayName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");
