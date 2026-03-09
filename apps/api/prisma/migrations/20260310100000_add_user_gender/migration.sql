-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "accountTag" TEXT,
    "avatarUrl" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "trainingPoints" INTEGER NOT NULL DEFAULT 0,
    "pokemonFragments" INTEGER NOT NULL DEFAULT 0,
    "lootPityCounter" INTEGER NOT NULL DEFAULT 0,
    "dailyShopPurchases" INTEGER NOT NULL DEFAULT 0,
    "dailyShopPurchasedAt" DATETIME,
    "mmr" INTEGER NOT NULL DEFAULT 1200,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "totalLosses" INTEGER NOT NULL DEFAULT 0,
    "refreshToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("accountTag", "avatarUrl", "coins", "createdAt", "dailyShopPurchasedAt", "dailyShopPurchases", "displayName", "email", "googleSub", "id", "level", "lootPityCounter", "mmr", "pokemonFragments", "refreshToken", "totalLosses", "totalWins", "trainingPoints", "updatedAt", "xp")
SELECT "accountTag", "avatarUrl", "coins", "createdAt", "dailyShopPurchasedAt", "dailyShopPurchases", "displayName", "email", "googleSub", "id", "level", "lootPityCounter", "mmr", "pokemonFragments", "refreshToken", "totalLosses", "totalWins", "trainingPoints", "updatedAt", "xp" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_accountTag_key" ON "User"("accountTag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
