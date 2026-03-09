-- AlterTable
ALTER TABLE "BattleTurn" ADD COLUMN "moveCategory" TEXT;
ALTER TABLE "BattleTurn" ADD COLUMN "moveControlChance" REAL;
ALTER TABLE "BattleTurn" ADD COLUMN "moveDamageMultiplier" REAL;
ALTER TABLE "BattleTurn" ADD COLUMN "movePriority" INTEGER;
