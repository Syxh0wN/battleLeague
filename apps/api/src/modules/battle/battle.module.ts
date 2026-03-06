import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BattleController } from "./battle.controller";
import { BattleService } from "./battle.service";

@Module({
  imports: [AuthModule],
  controllers: [BattleController],
  providers: [BattleService]
})
export class BattleModule {}
