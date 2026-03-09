ALTER TABLE "User" ADD COLUMN "pokemonFragments" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lootPityCounter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "dailyShopPurchases" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "dailyShopPurchasedAt" DATETIME;

ALTER TABLE "PokemonSpecies" ADD COLUMN "dropRarity" TEXT NOT NULL DEFAULT 'common';

ALTER TABLE "LootBoxOpen" ADD COLUMN "boxType" TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE "LootBoxOpen" ADD COLUMN "requestId" TEXT;
ALTER TABLE "LootBoxOpen" ADD COLUMN "rewardRarity" TEXT;
ALTER TABLE "LootBoxOpen" ADD COLUMN "fragmentGain" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LootBoxOpen" ADD COLUMN "wasDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LootBoxOpen" ADD COLUMN "pityBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LootBoxOpen" ADD COLUMN "pityAfter" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "LootBoxOpen_userId_requestId_key" ON "LootBoxOpen"("userId", "requestId");

CREATE TABLE "ProgressionEventClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "eventCode" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressionEventClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProgressionEventClaim_userId_eventCode_dayKey_key" ON "ProgressionEventClaim"("userId", "eventCode", "dayKey");
