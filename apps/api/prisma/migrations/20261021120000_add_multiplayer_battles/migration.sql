CREATE TYPE "BattleRoomStatus" AS ENUM ('WAITING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "BattleRoom" (
  "id" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "caseIds" JSONB NOT NULL,
  "maxPlayers" INTEGER NOT NULL,
  "status" "BattleRoomStatus" NOT NULL DEFAULT 'WAITING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "BattleRoom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BattleParticipant" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "paidMinor" BIGINT NOT NULL,
  "scoreMinor" BIGINT NOT NULL DEFAULT 0,
  "isWinner" BOOLEAN NOT NULL DEFAULT false,
  "roundResults" JSONB NOT NULL DEFAULT '[]',
  "awardedItems" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BattleRoom_status_createdAt_idx" ON "BattleRoom"("status", "createdAt");
CREATE UNIQUE INDEX "BattleRoom_requestKey_key" ON "BattleRoom"("requestKey");
CREATE UNIQUE INDEX "BattleParticipant_roomId_userId_key" ON "BattleParticipant"("roomId", "userId");
CREATE INDEX "BattleParticipant_roomId_createdAt_idx" ON "BattleParticipant"("roomId", "createdAt");

ALTER TABLE "BattleRoom" ADD CONSTRAINT "BattleRoom_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "BattleRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
