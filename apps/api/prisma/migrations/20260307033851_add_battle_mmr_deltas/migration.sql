-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Battle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "challengerPokemonId" TEXT NOT NULL,
    "opponentPokemonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "winnerUserId" TEXT,
    "challengerMmrDelta" INTEGER NOT NULL DEFAULT 0,
    "opponentMmrDelta" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Battle_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Battle_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Battle_challengerPokemonId_fkey" FOREIGN KEY ("challengerPokemonId") REFERENCES "UserPokemon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Battle_opponentPokemonId_fkey" FOREIGN KEY ("opponentPokemonId") REFERENCES "UserPokemon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Battle" ("challengerId", "challengerPokemonId", "createdAt", "expiresAt", "id", "opponentId", "opponentPokemonId", "status", "updatedAt", "winnerUserId") SELECT "challengerId", "challengerPokemonId", "createdAt", "expiresAt", "id", "opponentId", "opponentPokemonId", "status", "updatedAt", "winnerUserId" FROM "Battle";
DROP TABLE "Battle";
ALTER TABLE "new_Battle" RENAME TO "Battle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
