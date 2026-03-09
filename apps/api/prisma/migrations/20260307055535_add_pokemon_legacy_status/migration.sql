-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserPokemon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentHp" INTEGER NOT NULL,
    "atk" INTEGER NOT NULL,
    "def" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "lifeUtil" INTEGER NOT NULL DEFAULT 100,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "legacyAt" DATETIME,
    "fatigue" INTEGER NOT NULL DEFAULT 0,
    "fatigueUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainingCooldownUntil" DATETIME,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "restCooldownUntil" DATETIME,
    "evolveCooldownUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPokemon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPokemon_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "PokemonSpecies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserPokemon" ("atk", "createdAt", "currentHp", "def", "evolveCooldownUntil", "fatigue", "fatigueUpdatedAt", "id", "level", "losses", "nickname", "restCooldownUntil", "speciesId", "speed", "trainingCooldownUntil", "updatedAt", "userId", "wins", "xp") SELECT "atk", "createdAt", "currentHp", "def", "evolveCooldownUntil", "fatigue", "fatigueUpdatedAt", "id", "level", "losses", "nickname", "restCooldownUntil", "speciesId", "speed", "trainingCooldownUntil", "updatedAt", "userId", "wins", "xp" FROM "UserPokemon";
DROP TABLE "UserPokemon";
ALTER TABLE "new_UserPokemon" RENAME TO "UserPokemon";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
