import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BattleStatus } from "@prisma/client";
import { resolveTurn } from "@duelmen/game-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateBattleDto } from "./dto/create-battle.dto";
import { SubmitTurnDto } from "./dto/submit-turn.dto";

@Injectable()
export class BattleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

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

  async submitTurn(userId: string, battleId: string, dto: SubmitTurnDto) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
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

    const turn = await this.prisma.battleTurn.create({
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

    if (result.winner) {
      const winnerUserId = result.winner === "challenger" ? battle.challengerId : battle.opponentId;
      const loserUserId = result.winner === "challenger" ? battle.opponentId : battle.challengerId;
      const winnerPokemonId = result.winner === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId;
      const loserPokemonId = result.winner === "challenger" ? battle.opponentPokemonId : battle.challengerPokemonId;
      const now = new Date();
      const cooldownUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await this.prisma.$transaction([
        this.prisma.battle.update({
          where: { id: battle.id },
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
            totalDamage: { increment: turn.damage }
          }
        })
      ]);
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "BattleTurnSubmitted",
      entityName: "Battle",
      entityId: battle.id,
      payload: { action: dto.action, damage: turn.damage }
    });

    return {
      battleId: battle.id,
      turn,
      result
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
}
