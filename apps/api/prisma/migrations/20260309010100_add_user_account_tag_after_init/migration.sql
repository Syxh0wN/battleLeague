ALTER TABLE "User" ADD COLUMN "accountTag" TEXT;

UPDATE "User"
SET "accountTag" = ('user' || "id")
WHERE "accountTag" IS NULL;

CREATE UNIQUE INDEX "User_accountTag_key" ON "User"("accountTag");
