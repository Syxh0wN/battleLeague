import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BattleService } from "./battle.service";
import { CreateBattleDto } from "./dto/create-battle.dto";
import { SubmitTurnDto } from "./dto/submit-turn.dto";

@Controller("battles")
@UseGuards(JwtAuthGuard)
export class BattleController {
  constructor(private readonly battleService: BattleService) {}

  @Post()
  async createBattle(@CurrentUser() user: AuthUser, @Body() dto: CreateBattleDto) {
    return this.battleService.createBattle(user.userId, dto);
  }

  @Post(":battleId/turn")
  async submitTurn(
    @CurrentUser() user: AuthUser,
    @Param("battleId") battleId: string,
    @Body() dto: SubmitTurnDto
  ) {
    return this.battleService.submitTurn(user.userId, battleId, dto);
  }

  @Get(":battleId")
  async getBattle(@CurrentUser() user: AuthUser, @Param("battleId") battleId: string) {
    return this.battleService.getBattleState(user.userId, battleId);
  }
}
