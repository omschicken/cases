-- CreateTable
CREATE TABLE "SkinPrice" (
    "name" TEXT NOT NULL,
    "usdValueMinor" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'steam',
    "lastSyncedAt" TIMESTAMP(3),
    "syncFailCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkinPrice_pkey" PRIMARY KEY ("name")
);
