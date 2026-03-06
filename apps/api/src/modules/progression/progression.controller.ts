import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CompleteQuestDto } from "./dto/complete-quest.dto";
import { ProgressionService } from "./progression.service";

@Controller("progression")
@UseGuards(JwtAuthGuard)
export class ProgressionController {
  constructor(private readonly progressionService: ProgressionService) {}

  @Get("me")
  async getMine(@CurrentUser() user: AuthUser) {
    return this.progressionService.getProgress(user.userId);
  }

  @Post("quests/complete")
  async completeQuest(@CurrentUser() user: AuthUser, @Body() dto: CompleteQuestDto) {
    return this.progressionService.completeQuest(user.userId, dto);
  }

  @Post("quests/bootstrap")
  async bootstrapQuests(@CurrentUser() user: AuthUser) {
    return this.progressionService.ensureStarterQuests(user.userId);
  }

  @Post("lootbox/open")
  async openLootBox(@CurrentUser() user: AuthUser) {
    return this.progressionService.openLootBox(user.userId);
  }
}
