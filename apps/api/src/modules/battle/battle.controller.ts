import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BattleService } from "./battle.service";
import { CreateAiBattleDto } from "./dto/create-ai-battle.dto";
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

  @Get("suggestions")
  async listBattleSuggestions(@CurrentUser() user: AuthUser) {
    return this.battleService.listBattleSuggestions(user.userId);
  }

  @Get("friends/suggestions")
  async listFriendBattleSuggestions(@CurrentUser() user: AuthUser) {
    return this.battleService.listFriendBattleSuggestions(user.userId);
  }

  @Post("presence")
  async registerPresence(@CurrentUser() user: AuthUser) {
    return this.battleService.registerPresence(user.userId);
  }

  @Get("ongoing")
  async listOngoingBattles(@CurrentUser() user: AuthUser) {
    return this.battleService.listOngoingBattles(user.userId);
  }

  @Get("summary")
  async getBattleSummary(@CurrentUser() user: AuthUser) {
    return this.battleService.getBattleSummary(user.userId);
  }

  @Get("ai/opponents")
  async listAiOpponents() {
    return this.battleService.listAiOpponents();
  }

  @Post("ai")
  async createAiBattle(@CurrentUser() user: AuthUser, @Body() dto: CreateAiBattleDto) {
    return this.battleService.createAiBattle(user.userId, dto);
  }

  @Post("friends")
  async createFriendBattle(@CurrentUser() user: AuthUser, @Body() dto: CreateBattleDto) {
    return this.battleService.createFriendBattle(user.userId, dto);
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
