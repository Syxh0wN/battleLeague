CREATE TABLE "UserLootBoxState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "boxType" TEXT NOT NULL,
  "pityCounter" INTEGER NOT NULL DEFAULT 0,
  "dailyShopPurchases" INTEGER NOT NULL DEFAULT 0,
  "dailyShopPurchasedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserLootBoxState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserLootBoxState_userId_boxType_key" ON "UserLootBoxState"("userId", "boxType");
CREATE INDEX "UserLootBoxState_userId_idx" ON "UserLootBoxState"("userId");
