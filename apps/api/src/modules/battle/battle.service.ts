import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BattleStatus } from "@prisma/client";
import { resolveTurn } from "@duelmen/game-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateAiBattleDto } from "./dto/create-ai-battle.dto";
import { CreateBattleDto } from "./dto/create-battle.dto";
import { SubmitTurnDto } from "./dto/submit-turn.dto";

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listAiOpponents() {
    return [
      {
        id: "easy",
        name: "Bot Rookie",
        difficulty: "easy",
        strategy: "Ataque basico e defesa eventual"
      },
      {
        id: "normal",
        name: "Bot Ranger",
        difficulty: "normal",
        strategy: "Comportamento equilibrado"
      },
      {
        id: "hard",
        name: "Bot Elite",
        difficulty: "hard",
        strategy: "Mais agressivo e com skills frequentes"
      }
    ];
  }

  async createBattle(challengerId: string, dto: CreateBattleDto) {
    const [challengerPokemon, opponentPokemon] = await Promise.all([
      this.prisma.userPokemon.findFirst({
        where: { id: dto.challengerPokemonId, userId: challengerId },
        include: { species: true }
      }),
      this.prisma.userPokemon.findFirst({
        where: { id: dto.opponentPokemonId, userId: dto.opponentUserId },
        include: { species: true }
      })
    ]);

    if (!challengerPokemon || !opponentPokemon) {
      throw new NotFoundException("battlePokemonNotFound");
    }
    if (
      (challengerPokemon.restCooldownUntil && challengerPokemon.restCooldownUntil > new Date()) ||
      (opponentPokemon.restCooldownUntil && opponentPokemon.restCooldownUntil > new Date())
    ) {
      throw new BadRequestException("pokemonInRestCooldown");
    }

    const battle = await this.prisma.battle.create({
      data: {
        challengerId,
        opponentId: dto.opponentUserId,
        challengerPokemonId: challengerPokemon.id,
        opponentPokemonId: opponentPokemon.id,
        status: BattleStatus.active,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
      },
      include: {
        challengerPokemon: true,
        opponentPokemon: true
      }
    });
    await this.auditService.write({
      actorUserId: challengerId,
      action: "BattleCreated",
      entityName: "Battle",
      entityId: battle.id,
      payload: { opponentUserId: dto.opponentUserId }
    });
    return battle;
  }

  async createAiBattle(challengerId: string, dto: CreateAiBattleDto) {
    const challengerPokemon = await this.prisma.userPokemon.findFirst({
      where: { id: dto.challengerPokemonId, userId: challengerId }
    });
    if (!challengerPokemon) {
      throw new NotFoundException("challengerPokemonNotFound");
    }
    if (challengerPokemon.restCooldownUntil && challengerPokemon.restCooldownUntil > new Date()) {
      throw new BadRequestException("pokemonInRestCooldown");
    }

    const aiSetup = await this.ensureAiOpponent(dto.difficulty);

    const battle = await this.prisma.battle.create({
      data: {
        challengerId,
        opponentId: aiSetup.aiUser.id,
        challengerPokemonId: challengerPokemon.id,
        opponentPokemonId: aiSetup.aiPokemon.id,
        status: BattleStatus.active,
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
      },
      include: {
        challengerPokemon: true,
        opponentPokemon: true,
        opponent: true
      }
    });

    await this.auditService.write({
      actorUserId: challengerId,
      action: "AiBattleCreated",
      entityName: "Battle",
      entityId: battle.id,
      payload: { difficulty: dto.difficulty }
    });

    return battle;
  }

  async submitTurn(userId: string, battleId: string, dto: SubmitTurnDto) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        opponent: true,
        challengerPokemon: true,
        opponentPokemon: true,
        turns: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!battle) {
      throw new NotFoundException("battleNotFound");
    }
    if (battle.status !== BattleStatus.active) {
      throw new BadRequestException("battleIsNotActive");
    }
    if (battle.expiresAt < new Date()) {
      await this.prisma.battle.update({
        where: { id: battleId },
        data: { status: BattleStatus.expired }
      });
      throw new BadRequestException("battleExpired");
    }
    if (userId !== battle.challengerId && userId !== battle.opponentId) {
      throw new ForbiddenException("battleAccessDenied");
    }

    const duplicatedTurn = await this.prisma.battleTurn.findUnique({
      where: {
        battleId_idempotencyKey: {
          battleId,
          idempotencyKey: dto.idempotencyKey
        }
      }
    });
    if (duplicatedTurn) {
      return {
        battleId: battle.id,
        reused: true,
        turn: duplicatedTurn
      };
    }

    const actor = userId === battle.challengerId ? "challenger" : "opponent";
    const challengerState = {
      currentHp: battle.turns.length > 0 ? battle.turns[battle.turns.length - 1].challengerHp : battle.challengerPokemon.currentHp,
      maxHp: battle.challengerPokemon.currentHp,
      atk: battle.challengerPokemon.atk,
      def: battle.challengerPokemon.def,
      speed: battle.challengerPokemon.speed
    };
    const opponentState = {
      currentHp: battle.turns.length > 0 ? battle.turns[battle.turns.length - 1].opponentHp : battle.opponentPokemon.currentHp,
      maxHp: battle.opponentPokemon.currentHp,
      atk: battle.opponentPokemon.atk,
      def: battle.opponentPokemon.def,
      speed: battle.opponentPokemon.speed
    };

    const result = resolveTurn(challengerState, opponentState, dto.action, actor);

    const userTurn = await this.prisma.battleTurn.create({
      data: {
        battleId: battle.id,
        actorUserId: userId,
        actorPokemonId: actor === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId,
        action: dto.action,
        damage: result.damage,
        challengerHp: result.challengerHp,
        opponentHp: result.opponentHp,
        idempotencyKey: dto.idempotencyKey
      }
    });

    let aiTurn:
      | {
          id: string;
          action: string;
          damage: number;
        }
      | null = null;
    let finalResult = result;

    const isAiBattle = battle.opponent.googleSub.startsWith("ai_");
    const playerIsChallenger = userId === battle.challengerId;
    if (isAiBattle && playerIsChallenger && !result.winner) {
      const aiAction = this.pickAiAction(battle.opponent.googleSub);
      const aiChallengerState = {
        currentHp: result.challengerHp,
        maxHp: battle.challengerPokemon.currentHp,
        atk: battle.challengerPokemon.atk,
        def: battle.challengerPokemon.def,
        speed: battle.challengerPokemon.speed
      };
      const aiOpponentState = {
        currentHp: result.opponentHp,
        maxHp: battle.opponentPokemon.currentHp,
        atk: battle.opponentPokemon.atk,
        def: battle.opponentPokemon.def,
        speed: battle.opponentPokemon.speed
      };
      const aiResult = resolveTurn(aiChallengerState, aiOpponentState, aiAction, "opponent");
      const createdAiTurn = await this.prisma.battleTurn.create({
        data: {
          battleId: battle.id,
          actorUserId: battle.opponentId,
          actorPokemonId: battle.opponentPokemonId,
          action: aiAction,
          damage: aiResult.damage,
          challengerHp: aiResult.challengerHp,
          opponentHp: aiResult.opponentHp,
          idempotencyKey: `${dto.idempotencyKey}:ai`
        }
      });
      aiTurn = {
        id: createdAiTurn.id,
        action: createdAiTurn.action,
        damage: createdAiTurn.damage
      };
      finalResult = aiResult;
    }

    if (finalResult.winner) {
      await this.finishBattle(
        battle.id,
        finalResult.winner,
        battle.challengerId,
        battle.opponentId,
        battle.challengerPokemonId,
        battle.opponentPokemonId,
        userTurn.damage + (aiTurn?.damage ?? 0)
      );
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "BattleTurnSubmitted",
      entityName: "Battle",
      entityId: battle.id,
      payload: { action: dto.action, damage: userTurn.damage, aiAction: aiTurn?.action ?? null }
    });

    return {
      battleId: battle.id,
      turn: userTurn,
      aiTurn,
      result: finalResult
    };
  }

  async getBattleState(userId: string, battleId: string) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        challenger: true,
        opponent: true,
        challengerPokemon: { include: { species: true } },
        opponentPokemon: { include: { species: true } },
        turns: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!battle) {
      throw new NotFoundException("battleNotFound");
    }
    if (battle.challengerId !== userId && battle.opponentId !== userId) {
      throw new ForbiddenException("battleAccessDenied");
    }
    return battle;
  }

  private pickAiAction(googleSub: string): "attack" | "defend" | "skill" {
    const randomValue = Math.random();
    if (googleSub.includes("_hard_")) {
      if (randomValue < 0.55) {
        return "skill";
      }
      if (randomValue < 0.85) {
        return "attack";
      }
      return "defend";
    }
    if (googleSub.includes("_easy_")) {
      if (randomValue < 0.6) {
        return "attack";
      }
      if (randomValue < 0.8) {
        return "defend";
      }
      return "skill";
    }
    if (randomValue < 0.45) {
      return "attack";
    }
    if (randomValue < 0.7) {
      return "skill";
    }
    return "defend";
  }

  private async ensureAiOpponent(difficulty: "easy" | "normal" | "hard") {
    const aiGoogleSub = `ai_${difficulty}_bot`;
    const aiDisplayName = difficulty === "easy" ? "Bot Rookie" : difficulty === "hard" ? "Bot Elite" : "Bot Ranger";
    const aiUser = await this.prisma.user.upsert({
      where: { googleSub: aiGoogleSub },
      update: { displayName: aiDisplayName },
      create: {
        googleSub: aiGoogleSub,
        email: `${aiGoogleSub}@duelmen.local`,
        displayName: aiDisplayName,
        profileHistory: {
          create: {
            battleCount: 0,
            bestStreak: 0,
            totalDamage: 0
          }
        }
      }
    });

    const allSpecies = await this.prisma.pokemonSpecies.findMany({
      orderBy: { baseAtk: "desc" },
      take: 12
    });
    if (allSpecies.length === 0) {
      throw new BadRequestException("speciesCatalogEmpty");
    }
    const baseSpecies =
      difficulty === "easy"
        ? allSpecies[Math.min(allSpecies.length - 1, 8)]
        : difficulty === "hard"
          ? allSpecies[0]
          : allSpecies[Math.min(allSpecies.length - 1, 4)];

    const existingAiPokemon = await this.prisma.userPokemon.findFirst({
      where: { userId: aiUser.id },
      include: { species: true },
      orderBy: { updatedAt: "desc" }
    });

    if (existingAiPokemon) {
      return { aiUser, aiPokemon: existingAiPokemon };
    }

    const levelBonus = difficulty === "easy" ? 1 : difficulty === "hard" ? 8 : 4;
    const aiPokemon = await this.prisma.userPokemon.create({
      data: {
        userId: aiUser.id,
        speciesId: baseSpecies.id,
        level: 8 + levelBonus,
        currentHp: baseSpecies.baseHp + levelBonus * 2,
        atk: baseSpecies.baseAtk + levelBonus,
        def: baseSpecies.baseDef + levelBonus,
        speed: baseSpecies.baseSpeed + Math.floor(levelBonus / 2),
        restCooldownUntil: null
      },
      include: { species: true }
    });

    return { aiUser, aiPokemon };
  }

  private async finishBattle(
    battleId: string,
    winner: "challenger" | "opponent",
    challengerId: string,
    opponentId: string,
    challengerPokemonId: string,
    opponentPokemonId: string,
    totalDamage: number
  ) {
    const winnerUserId = winner === "challenger" ? challengerId : opponentId;
    const loserUserId = winner === "challenger" ? opponentId : challengerId;
    const winnerPokemonId = winner === "challenger" ? challengerPokemonId : opponentPokemonId;
    const loserPokemonId = winner === "challenger" ? opponentPokemonId : challengerPokemonId;
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.battle.update({
        where: { id: battleId },
        data: { status: BattleStatus.finished, winnerUserId }
      }),
      this.prisma.user.update({
        where: { id: winnerUserId },
        data: { totalWins: { increment: 1 }, xp: { increment: 25 }, coins: { increment: 10 } }
      }),
      this.prisma.user.update({
        where: { id: loserUserId },
        data: { totalLosses: { increment: 1 }, xp: { increment: 10 }, coins: { increment: 3 } }
      }),
      this.prisma.userPokemon.update({
        where: { id: winnerPokemonId },
        data: {
          wins: { increment: 1 },
          xp: { increment: 25 },
          restCooldownUntil: cooldownUntil
        }
      }),
      this.prisma.userPokemon.update({
        where: { id: loserPokemonId },
        data: {
          losses: { increment: 1 },
          xp: { increment: 10 },
          restCooldownUntil: cooldownUntil
        }
      }),
      this.prisma.userProfileHistory.updateMany({
        where: { userId: { in: [winnerUserId, loserUserId] } },
        data: {
          battleCount: { increment: 1 },
          totalDamage: { increment: totalDamage }
        }
      })
    ]);
  }
}
