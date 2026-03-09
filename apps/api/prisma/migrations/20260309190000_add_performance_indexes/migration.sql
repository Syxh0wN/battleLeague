CREATE INDEX "Battle_challengerId_status_updatedAt_idx" ON "Battle"("challengerId", "status", "updatedAt");
CREATE INDEX "Battle_opponentId_status_updatedAt_idx" ON "Battle"("opponentId", "status", "updatedAt");
CREATE INDEX "Battle_winnerUserId_status_createdAt_idx" ON "Battle"("winnerUserId", "status", "createdAt");

CREATE INDEX "BattleTurn_battleId_createdAt_idx" ON "BattleTurn"("battleId", "createdAt");

CREATE INDEX "Friendship_receiverId_status_updatedAt_idx" ON "Friendship"("receiverId", "status", "updatedAt");
CREATE INDEX "Friendship_senderId_status_updatedAt_idx" ON "Friendship"("senderId", "status", "updatedAt");

CREATE INDEX "LootBoxOpen_userId_createdAt_idx" ON "LootBoxOpen"("userId", "createdAt");

CREATE INDEX "AuditLog_actorUserId_action_entityName_createdAt_idx" ON "AuditLog"("actorUserId", "action", "entityName", "createdAt");

CREATE INDEX "UserPokemon_userId_isLegacy_wins_level_idx" ON "UserPokemon"("userId", "isLegacy", "wins", "level");
