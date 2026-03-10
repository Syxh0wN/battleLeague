import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BuyLootBoxDto } from "./dto/buy-lootbox.dto";
import { ClaimEventRewardDto } from "./dto/claim-event-reward.dto";
import { CompleteQuestDto } from "./dto/complete-quest.dto";
import { CraftPokemonDto } from "./dto/craft-pokemon.dto";
import { OpenLootBoxDto } from "./dto/open-lootbox.dto";
import { UpgradePokemonDto } from "./dto/upgrade-pokemon.dto";
import { ProgressionService } from "./progression.service";

@Controller("progression")
@UseGuards(JwtAuthGuard)
export class ProgressionController {
  constructor(private readonly progressionService: ProgressionService) {}

  @Get("me")
  async getMine(@CurrentUser() user: AuthUser) {
    return this.progressionService.getProgress(user.userId);
  }

  @Get("loot/economy")
  async getLootEconomy(@CurrentUser() user: AuthUser) {
    return this.progressionService.getLootEconomy(user.userId);
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async openLootBox(@CurrentUser() user: AuthUser, @Body() dto: OpenLootBoxDto) {
    return this.progressionService.openLootBox(user.userId, dto);
  }

  @Post("lootbox/shop/buy")
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  async buyLootBoxes(@CurrentUser() user: AuthUser, @Body() dto: BuyLootBoxDto) {
    return this.progressionService.buyLootBoxes(user.userId, dto);
  }

  @Post("events/claim")
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async claimEventReward(@CurrentUser() user: AuthUser, @Body() dto: ClaimEventRewardDto) {
    return this.progressionService.claimEventReward(user.userId, dto);
  }

  @Post("craft")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async craftPokemon(@CurrentUser() user: AuthUser, @Body() dto: CraftPokemonDto) {
    return this.progressionService.craftPokemon(user.userId, dto);
  }

  @Post("upgrade")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async upgradePokemon(@CurrentUser() user: AuthUser, @Body() dto: UpgradePokemonDto) {
    return this.progressionService.upgradePokemon(user.userId, dto);
  }
}
