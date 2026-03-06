import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { AuditModule } from "./modules/audit/audit.module";
import { BattleModule } from "./modules/battle/battle.module";
import { IngestionModule } from "./modules/ingestion/ingestion.module";
import { PokemonModule } from "./modules/pokemon/pokemon.module";
import { ProgressionModule } from "./modules/progression/progression.module";
import { SocialModule } from "./modules/social/social.module";
import { UserModule } from "./modules/user/user.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 30
      }
    ]),
    PrismaModule,
    AuditModule,
    AuthModule,
    IngestionModule,
    UserModule,
    PokemonModule,
    BattleModule,
    ProgressionModule,
    SocialModule
  ],
  providers: []
})
export class AppModule {}
