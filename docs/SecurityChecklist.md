# SecurityChecklist

## AuthSecurity
- GoogleIdTokenValidationWithIssuerAudienceExpiration
- EmailVerifiedRequired
- AccessTokenShortLived
- RefreshTokenStoredAsHash
- RefreshTokenRotationEnabled

## ApiSecurity
- GlobalValidationPipeWhitelistEnabled
- ForbiddenExtraPayloadFields
- JwtGuardRequiredOnProtectedRoutes
- GlobalRateLimitEnabled

## BattleSecurity
- ServerSideDamageComputation
- TurnIdempotencyKeyUniquePerBattle
- BattleOwnershipValidationBeforeReadWrite
- BattleExpirationValidation

## DataSecurity
- AuditLogForSensitiveActions
- CatalogSyncRunTracking
- DoNotExposeRefreshHash

## GitSecurity
- IgnoreCursorFilesAndPlans
- IgnoreEnvFiles
