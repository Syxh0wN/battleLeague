# ProductRules

## CoreLoop
- UserLoginComGoogle
- ClaimStarterPokemon
- CompleteQuest
- OpenLootBox
- ChallengeOtherPlayer
- SubmitTurnsUntilBattleFinish

## ProgressionRules
- UserGainsXpFromBattleQuestLoot
- UserLevelFormula `Level = floor(Xp / 100) + 1`
- PokemonGainsXpFromBattle
- PokemonEvolutionRequiresLevelAndCooldown
- PokemonRestCooldownAppliedAfterBattleFinish

## AcquisitionRules
- StarterPokemonOnlyOncePerAccount
- NewPokemonByLevelRewardLootBoxAndQuestReward
- LootBoxRandomPoolUsesLocalCatalog

## SocialRules
- UserCanSendFriendRequest
- ReceiverCanAcceptFriendRequest
- UserCanVisitPublicProfile
- PublicProfileShowsChampionPokemons

## BattleRules
- ServerAuthoritativeDamageCalculation
- AsyncTurnBattleWithExpiration
- IdempotencyKeyRequiredForTurnSubmission
- WinnerAndLoserStatsPersistedAtBattleFinish
