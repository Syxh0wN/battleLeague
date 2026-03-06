import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { QuestStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CompleteQuestDto } from "./dto/complete-quest.dto";

@Injectable()
export class ProgressionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getProgress(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    return {
      userId: user.id,
      level: user.level,
      xp: user.xp,
      coins: user.coins
    };
  }

  async completeQuest(userId: string, dto: CompleteQuestDto) {
    const quest = await this.prisma.userQuest.findUnique({
      where: {
        userId_questCode: {
          userId,
          questCode: dto.questCode
        }
      }
    });
    if (!quest) {
      throw new NotFoundException("questNotFound");
    }
    if (quest.status === QuestStatus.claimed) {
      throw new BadRequestException("questAlreadyClaimed");
    }

    const completed = await this.prisma.userQuest.update({
      where: { id: quest.id },
      data: {
        progress: quest.target,
        status: QuestStatus.claimed
      }
    });

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: completed.rewardXp },
        coins: { increment: completed.rewardCoins }
      }
    });

    const leveled = await this.applyLevelUp(userId, user.xp);
    await this.auditService.write({
      actorUserId: userId,
      action: "QuestCompleted",
      entityName: "UserQuest",
      entityId: completed.id,
      payload: { questCode: dto.questCode }
    });
    return {
      quest: completed,
      user: leveled
    };
  }

  async ensureStarterQuests(userId: string) {
    const quests = [
      { questCode: "WinFirstBattle", target: 1, rewardXp: 50, rewardCoins: 20 },
      { questCode: "OpenFirstLootBox", target: 1, rewardXp: 20, rewardCoins: 10 }
    ];

    for (const quest of quests) {
      await this.prisma.userQuest.upsert({
        where: {
          userId_questCode: {
            userId,
            questCode: quest.questCode
          }
        },
        update: {},
        create: {
          userId,
          questCode: quest.questCode,
          target: quest.target,
          rewardXp: quest.rewardXp,
          rewardCoins: quest.rewardCoins
        }
      });
    }

    return this.prisma.userQuest.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" }
    });
  }

  async openLootBox(userId: string) {
    const species = await this.prisma.pokemonSpecies.findMany({ take: 151 });
    if (species.length === 0) {
      throw new BadRequestException("speciesCatalogEmpty");
    }
    const selected = species[Math.floor(Math.random() * species.length)];
    const createdPokemon = await this.prisma.userPokemon.create({
      data: {
        userId,
        speciesId: selected.id,
        currentHp: selected.baseHp,
        atk: selected.baseAtk,
        def: selected.baseDef,
        speed: selected.baseSpeed
      },
      include: { species: true }
    });
    await this.prisma.lootBoxOpen.create({
      data: {
        userId,
        rewardType: "pokemon",
        rewardValue: selected.name
      }
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "LootBoxOpened",
      entityName: "LootBoxOpen",
      payload: { reward: selected.name }
    });
    return createdPokemon;
  }

  private async applyLevelUp(userId: string, currentXp: number) {
    const targetLevel = Math.max(1, Math.floor(currentXp / 100) + 1);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        level: targetLevel
      }
    });
  }
}
