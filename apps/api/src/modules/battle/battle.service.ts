import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BattleStatus, FriendshipStatus } from "@prisma/client";
import { resolveTurn } from "@battleleague/game-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateAiBattleDto } from "./dto/create-ai-battle.dto";
import { CreateBattleDto } from "./dto/create-battle.dto";
import { SubmitTurnDto } from "./dto/submit-turn.dto";

@Injectable()
export class BattleService {
  private readonly newUserInitialCoins = 1000;
  private readonly userPresence = new Map<string, number>();
  private readonly pvpScheduleMs = 60_000;
  private readonly battleDurationMs = 300_000;
  private readonly turnDecisionWindowMs = 20_000;
  private readonly presenceWindowMs = 90_000;
  private readonly maxPokemonLevel = 100;
  private readonly rankedTiers = [
    "Ferro 3",
    "Ferro 2",
    "Ferro 1",
    "Bronze 3",
    "Bronze 2",
    "Bronze 1",
    "Prata 3",
    "Prata 2",
    "Prata 1",
    "Ouro 3",
    "Ouro 2",
    "Ouro 1",
    "Platina 3",
    "Platina 2",
    "Platina 1",
    "Diamante 3",
    "Diamante 2",
    "Diamante 1",
    "Ruby 3",
    "Ruby 2",
    "Ruby 1"
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async registerPresence(userId: string) {
    this.userPresence.set(userId, Date.now());
    return { ok: true };
  }

  async listBattleSuggestions(challengerId: string) {
    await this.ensureDemoOpponents(challengerId);
    return this.listSuggestionsFromOpponentIds(challengerId, null, true);
  }

  async listFriendBattleSuggestions(challengerId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ senderId: challengerId }, { receiverId: challengerId }]
      },
      select: {
        senderId: true,
        receiverId: true
      }
    });
    const friendIds = friendships
      .map((item) => (item.senderId === challengerId ? item.receiverId : item.senderId))
      .filter((id) => id !== challengerId);
    return this.listSuggestionsFromOpponentIds(challengerId, friendIds, false);
  }

  private async listSuggestionsFromOpponentIds(challengerId: string, opponentIds: string[] | null, enforceRankRange: boolean) {
    const now = new Date();
    const challengerUser = await this.prisma.user.findUnique({
      where: { id: challengerId },
      select: { mmr: true }
    });
    if (!challengerUser) {
      throw new NotFoundException("userNotFound");
    }
    const opponents = await this.prisma.user.findMany({
      where: {
        id: opponentIds ? { in: opponentIds } : { not: challengerId },
        NOT: {
          googleSub: { startsWith: "ai_" }
        }
      },
      orderBy: [{ level: "desc" }, { totalWins: "desc" }],
      take: 25,
      include: {
        pokemons: {
          where: {
            isLegacy: false,
            AND: [
              {
                OR: [{ evolveCooldownUntil: null }, { evolveCooldownUntil: { lte: now } }]
              },
              {
                OR: [{ trainingCooldownUntil: null }, { trainingCooldownUntil: { lte: now } }]
              }
            ]
          },
          include: { species: true },
          orderBy: [{ wins: "desc" }, { level: "desc" }],
          take: 3
        }
      }
    });
    const filteredOpponents = enforceRankRange
      ? opponents.filter((opponent) => this.canDuelByRank(challengerUser.mmr, opponent.mmr))
      : opponents;
    return filteredOpponents
      .map((opponent) => ({
      id: opponent.id,
      displayName: opponent.displayName,
      avatarUrl: opponent.avatarUrl,
      level: opponent.level,
      totalWins: opponent.totalWins,
      totalLosses: opponent.totalLosses,
      champions: opponent.pokemons
      }));
  }

  async listOngoingBattles(userId: string) {
    const now = new Date();
    const nowMs = now.getTime();
    const battles = await this.prisma.battle.findMany({
      where: {
        status: { in: [BattleStatus.pending, BattleStatus.active] },
        OR: [{ challengerId: userId }, { opponentId: userId }]
      },
      orderBy: { updatedAt: "desc" },
      include: {
        challenger: true,
        opponent: true,
        challengerPokemon: { include: { species: true } },
        opponentPokemon: { include: { species: true } },
        turns: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const visibleBattles: Array<{
      id: string;
      status: BattleStatus;
      scheduledStartAt: Date;
      currentTurnUserId: string;
      isAiBattle: boolean;
      challenger: { id: string; displayName: string };
      opponent: { id: string; displayName: string };
      challengerPokemon: { id: string; level: number; species: { name: string; imageUrl: string | null } };
      opponentPokemon: { id: string; level: number; species: { name: string; imageUrl: string | null } };
      lastTurn: { action: string; damage: number; actorUserId: string } | null;
    }> = [];

    for (const battle of battles) {
      const isAiBattle = battle.opponent.googleSub.startsWith("ai_");
      const effectiveExpiresAt = this.getEffectiveExpiresAt(battle.createdAt, battle.expiresAt);
      const scheduledStartAt = this.getBattleStartAt(battle.createdAt);
      const lastTurn = battle.turns[0] ?? null;
      if (effectiveExpiresAt.getTime() <= nowMs) {
        continue;
      }
      const derivedStatus = battle.status === BattleStatus.pending && nowMs >= scheduledStartAt.getTime() ? BattleStatus.active : battle.status;
      const currentTurnUserId = this.getCurrentTurnUserId(
        battle.challengerId,
        battle.opponentId,
        battle.challengerPokemon.speed,
        battle.opponentPokemon.speed,
        lastTurn ? [lastTurn] : []
      );
      visibleBattles.push({
        id: battle.id,
        status: derivedStatus,
        scheduledStartAt,
        currentTurnUserId,
        isAiBattle,
        challenger: {
          id: battle.challenger.id,
          displayName: battle.challenger.displayName
        },
        opponent: {
          id: battle.opponent.id,
          displayName: battle.opponent.displayName
        },
        challengerPokemon: {
          id: battle.challengerPokemon.id,
          level: battle.challengerPokemon.level,
          species: {
            name: battle.challengerPokemon.species.name,
            imageUrl: battle.challengerPokemon.species.imageUrl
          }
        },
        opponentPokemon: {
          id: battle.opponentPokemon.id,
          level: battle.opponentPokemon.level,
          species: {
            name: battle.opponentPokemon.species.name,
            imageUrl: battle.opponentPokemon.species.imageUrl
          }
        },
        lastTurn: lastTurn
          ? {
              action: lastTurn.action,
              damage: lastTurn.damage,
              actorUserId: lastTurn.actorUserId
            }
          : null
      });
    }

    return visibleBattles;
  }

  async getBattleSummary(userId: string) {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        mmr: true,
        level: true,
        totalWins: true,
        totalLosses: true
      }
    });
    if (!me) {
      throw new NotFoundException("userNotFound");
    }

    const [higherRankedCount, totalRankPlayers] = await Promise.all([
      this.prisma.user.count({
        where: {
          NOT: {
            googleSub: { startsWith: "ai_" }
          },
          OR: [{ mmr: { gt: me.mmr } }, { mmr: me.mmr, id: { lt: me.id } }]
        }
      }),
      this.prisma.user.count({
        where: {
          NOT: {
            googleSub: { startsWith: "ai_" }
          }
        }
      })
    ]);

    const myElo = me.mmr;
    const myRankPosition = higherRankedCount + 1;

    const recentBattles = await this.prisma.battle.findMany({
      where: {
        OR: [{ challengerId: userId }, { opponentId: userId }],
        status: { in: [BattleStatus.finished, BattleStatus.expired] }
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        challenger: { select: { id: true, displayName: true, mmr: true } },
        opponent: { select: { id: true, displayName: true, mmr: true } },
        challengerPokemon: { select: { id: true, level: true, species: { select: { name: true, imageUrl: true } } } },
        opponentPokemon: { select: { id: true, level: true, species: { select: { name: true, imageUrl: true } } } },
      }
    });
    const recentBattleIds = recentBattles.map((battle) => battle.id);
    const [turnCountRows, turnDamageRows, lastTurns] = await Promise.all([
      recentBattleIds.length > 0
        ? this.prisma.battleTurn.groupBy({
            by: ["battleId"],
            where: { battleId: { in: recentBattleIds } },
            _count: { _all: true }
          })
        : Promise.resolve([]),
      recentBattleIds.length > 0
        ? this.prisma.battleTurn.groupBy({
            by: ["battleId", "actorPokemonId"],
            where: { battleId: { in: recentBattleIds } },
            _sum: { damage: true }
          })
        : Promise.resolve([]),
      recentBattleIds.length > 0
        ? this.prisma.battleTurn.findMany({
            where: { battleId: { in: recentBattleIds } },
            distinct: ["battleId"],
            orderBy: [{ battleId: "asc" }, { createdAt: "desc" }],
            select: {
              battleId: true,
              challengerHp: true,
              opponentHp: true
            }
          })
        : Promise.resolve([])
    ]);
    const turnCountByBattleId = new Map(turnCountRows.map((row) => [row.battleId, row._count._all]));
    const damageByBattleAndActor = new Map(turnDamageRows.map((row) => [`${row.battleId}:${row.actorPokemonId}`, row._sum.damage ?? 0]));
    const lastTurnByBattleId = new Map(lastTurns.map((turn) => [turn.battleId, turn]));

    return {
      me: {
        id: me.id,
        displayName: me.displayName,
        avatarUrl: me.avatarUrl,
        level: me.level,
        totalWins: me.totalWins,
        totalLosses: me.totalLosses,
        winRate: me.totalWins + me.totalLosses === 0 ? 0 : Math.round((me.totalWins / (me.totalWins + me.totalLosses)) * 100)
      },
      rank: {
        elo: myElo,
        league: this.getLeagueByMmr(myElo),
        position: myRankPosition,
        totalPlayers: totalRankPlayers
      },
      recentBattles: recentBattles.map((battle) => {
        const rival = battle.challengerId === userId ? battle.opponent : battle.challenger;
        const myPokemonName = battle.challengerId === userId ? battle.challengerPokemon.species.name : battle.opponentPokemon.species.name;
        const rivalPokemonName = battle.challengerId === userId ? battle.opponentPokemon.species.name : battle.challengerPokemon.species.name;
        let result: "Vitoria" | "Derrota" | "Expirada" | "Sem resultado";
        if (battle.winnerUserId) {
          result = battle.winnerUserId === userId ? "Vitoria" : "Derrota";
        } else if (battle.status === BattleStatus.expired) {
          const lastTurn = lastTurnByBattleId.get(battle.id) ?? null;
          if (!lastTurn) {
            result = "Expirada";
          } else {
            const myHp = battle.challengerId === userId ? lastTurn.challengerHp : lastTurn.opponentHp;
            const rivalHp = battle.challengerId === userId ? lastTurn.opponentHp : lastTurn.challengerHp;
            result = myHp === rivalHp ? "Expirada" : myHp > rivalHp ? "Vitoria" : "Derrota";
          }
        } else {
          result = "Sem resultado";
        }
        const challengerDamageDealt = Math.max(0, damageByBattleAndActor.get(`${battle.id}:${battle.challengerPokemon.id}`) ?? 0);
        const opponentDamageDealt = Math.max(0, damageByBattleAndActor.get(`${battle.id}:${battle.opponentPokemon.id}`) ?? 0);
        const turnCount = turnCountByBattleId.get(battle.id) ?? 0;
        const challengerWon = battle.winnerUserId === battle.challengerId;
        const opponentWon = battle.winnerUserId === battle.opponentId;
        const challengerXpGain = battle.winnerUserId
          ? this.calculatePokemonXpGain({
              didWin: challengerWon,
              myLevel: battle.challengerPokemon.level,
              opponentLevel: battle.opponentPokemon.level,
              myDamageDealt: challengerDamageDealt,
              opponentDamageDealt,
              turnCount
            })
          : 0;
        const opponentXpGain = battle.winnerUserId
          ? this.calculatePokemonXpGain({
              didWin: opponentWon,
              myLevel: battle.opponentPokemon.level,
              opponentLevel: battle.challengerPokemon.level,
              myDamageDealt: opponentDamageDealt,
              opponentDamageDealt: challengerDamageDealt,
              turnCount
            })
          : 0;
        const challengerAccountXpGain = battle.winnerUserId
          ? this.calculateUserAccountXpGain({
              didWin: challengerWon,
              myMmr: battle.challenger.mmr,
              opponentMmr: battle.opponent.mmr,
              myPokemonLevel: battle.challengerPokemon.level,
              opponentPokemonLevel: battle.opponentPokemon.level,
              myDamageDealt: challengerDamageDealt,
              opponentDamageDealt,
              turnCount
            })
          : 0;
        const opponentAccountXpGain = battle.winnerUserId
          ? this.calculateUserAccountXpGain({
              didWin: opponentWon,
              myMmr: battle.opponent.mmr,
              opponentMmr: battle.challenger.mmr,
              myPokemonLevel: battle.opponentPokemon.level,
              opponentPokemonLevel: battle.challengerPokemon.level,
              myDamageDealt: opponentDamageDealt,
              opponentDamageDealt: challengerDamageDealt,
              turnCount
            })
          : 0;
        return {
          id: battle.id,
          result,
          iWasChallenged: battle.opponentId === userId,
          rivalName: rival.displayName,
          myPokemonName,
          rivalPokemonName,
          myMmrDelta: battle.challengerId === userId ? battle.challengerMmrDelta : battle.opponentMmrDelta,
          rivalMmrDelta: battle.challengerId === userId ? battle.opponentMmrDelta : battle.challengerMmrDelta,
          myPokemonXpGain: battle.challengerId === userId ? challengerXpGain : opponentXpGain,
          rivalPokemonXpGain: battle.challengerId === userId ? opponentXpGain : challengerXpGain,
          myAccountXpGain: battle.challengerId === userId ? challengerAccountXpGain : opponentAccountXpGain,
          rivalAccountXpGain: battle.challengerId === userId ? opponentAccountXpGain : challengerAccountXpGain,
          myPokemonImageUrl: battle.challengerId === userId ? battle.challengerPokemon.species.imageUrl : battle.opponentPokemon.species.imageUrl,
          rivalPokemonImageUrl: battle.challengerId === userId ? battle.opponentPokemon.species.imageUrl : battle.challengerPokemon.species.imageUrl,
          updatedAt: battle.updatedAt
        };
      })
    };
  }

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
    return this.createBattleInternal(challengerId, dto, true, false);
  }

  async createFriendBattle(challengerId: string, dto: CreateBattleDto) {
    return this.createBattleInternal(challengerId, dto, false, true);
  }

  private async createBattleInternal(challengerId: string, dto: CreateBattleDto, enforceRankRange: boolean, requireFriendship: boolean) {
    const now = new Date();
    const [challengerUser, challengerPokemon, opponentUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: challengerId },
        select: { id: true, mmr: true }
      }),
      this.prisma.userPokemon.findFirst({
        where: { id: dto.challengerPokemonId, userId: challengerId, isLegacy: false },
        include: { species: true }
      }),
      this.prisma.user.findUnique({
        where: { id: dto.opponentUserId },
        include: {
          pokemons: {
            where: {
              isLegacy: false,
              AND: [
                {
                  OR: [{ evolveCooldownUntil: null }, { evolveCooldownUntil: { lte: now } }]
                },
                {
                  OR: [{ trainingCooldownUntil: null }, { trainingCooldownUntil: { lte: now } }]
                }
              ]
            },
            include: { species: true },
            orderBy: [{ wins: "desc" }, { level: "desc" }],
            take: 3
          }
        }
      })
    ]);

    if (!challengerUser || !challengerPokemon || !opponentUser) {
      throw new NotFoundException("battlePokemonNotFound");
    }
    if (requireFriendship) {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          status: FriendshipStatus.accepted,
          OR: [
            { senderId: challengerId, receiverId: dto.opponentUserId },
            { senderId: dto.opponentUserId, receiverId: challengerId }
          ]
        },
        select: { id: true }
      });
      if (!friendship) {
        throw new ForbiddenException("friendshipRequiredForFriendBattle");
      }
    }
    if (enforceRankRange && !this.canDuelByRank(challengerUser.mmr, opponentUser.mmr)) {
      throw new BadRequestException("opponentRankOutOfRange");
    }
    if (opponentUser.pokemons.length === 0) {
      throw new BadRequestException("opponentHasNoAvailablePokemon");
    }
    const randomIndex = Math.floor(Math.random() * opponentUser.pokemons.length);
    const opponentPokemon = opponentUser.pokemons[randomIndex];

    const scheduledStartAt = new Date(Date.now() + this.pvpScheduleMs);
    const expiresAt = new Date(scheduledStartAt.getTime() + this.battleDurationMs);

    const battle = await this.prisma.battle.create({
      data: {
        challengerId,
        opponentId: dto.opponentUserId,
        challengerPokemonId: challengerPokemon.id,
        opponentPokemonId: opponentPokemon.id,
        status: BattleStatus.pending,
        expiresAt
      },
      include: {
        challengerPokemon: { include: { species: true } },
        opponentPokemon: { include: { species: true } }
      }
    });
    await this.auditService.write({
      actorUserId: challengerId,
      action: "BattleCreated",
      entityName: "Battle",
      entityId: battle.id,
      payload: {
        opponentUserId: dto.opponentUserId,
        scheduledStartAt: scheduledStartAt.toISOString(),
        roulettePokemonId: opponentPokemon.id
      }
    });
    return {
      ...battle,
      scheduledStartAt,
      roulettePokemonName: opponentPokemon.species.name
    };
  }

  async createAiBattle(challengerId: string, dto: CreateAiBattleDto) {
    const challengerPokemon = await this.prisma.userPokemon.findFirst({
      where: { id: dto.challengerPokemonId, userId: challengerId, isLegacy: false }
    });
    if (!challengerPokemon) {
      throw new NotFoundException("challengerPokemonNotFound");
    }

    const aiSetup = await this.ensureAiOpponent(dto.difficulty);

    const battle = await this.prisma.battle.create({
      data: {
        challengerId,
        opponentId: aiSetup.aiUser.id,
        challengerPokemonId: challengerPokemon.id,
        opponentPokemonId: aiSetup.aiPokemon.id,
        status: BattleStatus.pending,
        expiresAt: new Date(Date.now() + this.pvpScheduleMs + this.battleDurationMs)
      },
      include: {
        challengerPokemon: { include: { species: true } },
        opponentPokemon: { include: { species: true } },
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

    return {
      ...battle,
      scheduledStartAt: new Date(Date.now() + this.pvpScheduleMs)
    };
  }

  async submitTurn(userId: string, battleId: string, dto: SubmitTurnDto) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: {
        opponent: true,
        challengerPokemon: { include: { species: true } },
        opponentPokemon: { include: { species: true } },
        turns: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!battle) {
      throw new NotFoundException("battleNotFound");
    }
    const scheduledStartAt = this.getBattleStartAt(battle.createdAt);
    if (battle.status === BattleStatus.pending) {
      if (Date.now() < scheduledStartAt.getTime()) {
        throw new BadRequestException("battleNotStartedYet");
      }
      await this.prisma.battle.update({
        where: { id: battle.id },
        data: { status: BattleStatus.active }
      });
      battle.status = BattleStatus.active;
    }
    if (battle.status !== BattleStatus.active) {
      throw new BadRequestException("battleIsNotActive");
    }
    const isAiBattle = battle.opponent.googleSub.startsWith("ai_");
    const effectiveExpiresAt = this.getEffectiveExpiresAt(battle.createdAt, battle.expiresAt);
    if (battle.expiresAt.getTime() !== effectiveExpiresAt.getTime()) {
      await this.prisma.battle.update({
        where: { id: battleId },
        data: { expiresAt: effectiveExpiresAt }
      });
      battle.expiresAt = effectiveExpiresAt;
    }
    if (effectiveExpiresAt < new Date()) {
      const timeoutResult = await this.settleBattleByHpOnTimeout({
        ...battle,
        isRanked: !isAiBattle
      });
      battle.status = timeoutResult.status;
      battle.winnerUserId = timeoutResult.winnerUserId;
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

    await this.processTurnTimeoutAutoActions(battle, isAiBattle);
    if (battle.status !== BattleStatus.active) {
      if (battle.status === BattleStatus.finished || battle.status === BattleStatus.expired) {
        throw new BadRequestException("battleExpired");
      }
      throw new BadRequestException("battleIsNotActive");
    }

    const expectedTurnUserId = this.getCurrentTurnUserId(
      battle.challengerId,
      battle.opponentId,
      battle.challengerPokemon.speed,
      battle.opponentPokemon.speed,
      battle.turns
    );
    if (expectedTurnUserId !== userId) {
      throw new BadRequestException("notYourTurn");
    }

    const actor = userId === battle.challengerId ? "challenger" : "opponent";
    const actorPokemon = actor === "challenger" ? battle.challengerPokemon : battle.opponentPokemon;
    const actorAvailableMoves = this.getPokemonMoveSet({
      speciesName: actorPokemon.species.name,
      level: actorPokemon.level,
      typePrimary: actorPokemon.species.typePrimary,
      typeSecondary: actorPokemon.species.typeSecondary
    });
    const selectedMove =
      dto.moveId && dto.moveId.length > 0
        ? actorAvailableMoves.find((move) => move.id === dto.moveId) ?? null
        : actorAvailableMoves.find((move) => move.action === dto.action) ?? actorAvailableMoves[0] ?? null;
    if (!selectedMove) {
      throw new BadRequestException("noAvailableMoveForPokemon");
    }
    const selectedMoveTelemetry = this.getMoveTelemetry(selectedMove);
    const nowForFatigue = new Date();
    const challengerEffectiveFatigue = this.getEffectiveFatigue(
      battle.challengerPokemon.fatigue,
      battle.challengerPokemon.fatigueUpdatedAt,
      nowForFatigue
    );
    const opponentEffectiveFatigue = this.getEffectiveFatigue(
      battle.opponentPokemon.fatigue,
      battle.opponentPokemon.fatigueUpdatedAt,
      nowForFatigue
    );
    const challengerFatiguePenalty = this.getFatiguePenaltyMultiplier(challengerEffectiveFatigue);
    const opponentFatiguePenalty = this.getFatiguePenaltyMultiplier(opponentEffectiveFatigue);
    const challengerAgePenalty = this.getAgePenaltyMultiplier(battle.challengerPokemon.createdAt, nowForFatigue);
    const opponentAgePenalty = this.getAgePenaltyMultiplier(battle.opponentPokemon.createdAt, nowForFatigue);
    const challengerTotalPenalty = challengerFatiguePenalty * challengerAgePenalty;
    const opponentTotalPenalty = opponentFatiguePenalty * opponentAgePenalty;
    const challengerState = {
      currentHp: battle.turns.length > 0 ? battle.turns[battle.turns.length - 1].challengerHp : battle.challengerPokemon.currentHp,
      maxHp: battle.challengerPokemon.currentHp,
      atk: this.applyFatiguePenalty(battle.challengerPokemon.atk, challengerTotalPenalty),
      def: this.applyFatiguePenalty(battle.challengerPokemon.def, challengerTotalPenalty),
      speed: this.applyFatiguePenalty(battle.challengerPokemon.speed, challengerTotalPenalty),
      level: battle.challengerPokemon.level,
      typePrimary: battle.challengerPokemon.species.typePrimary,
      typeSecondary: battle.challengerPokemon.species.typeSecondary
    };
    const opponentState = {
      currentHp: battle.turns.length > 0 ? battle.turns[battle.turns.length - 1].opponentHp : battle.opponentPokemon.currentHp,
      maxHp: battle.opponentPokemon.currentHp,
      atk: this.applyFatiguePenalty(battle.opponentPokemon.atk, opponentTotalPenalty),
      def: this.applyFatiguePenalty(battle.opponentPokemon.def, opponentTotalPenalty),
      speed: this.applyFatiguePenalty(battle.opponentPokemon.speed, opponentTotalPenalty),
      level: battle.opponentPokemon.level,
      typePrimary: battle.opponentPokemon.species.typePrimary,
      typeSecondary: battle.opponentPokemon.species.typeSecondary
    };

    const result = resolveTurn(challengerState, opponentState, selectedMove.action, actor, {
      action: selectedMove.action,
      type: selectedMove.type,
      power: selectedMove.power,
      priority: selectedMove.priority,
      category: selectedMove.category
    });
    let challengerFatigueAfterTurn =
      actor === "challenger" ? this.applyFatigueGain(challengerEffectiveFatigue, selectedMove.action, selectedMove.type) : challengerEffectiveFatigue;
    let opponentFatigueAfterTurn =
      actor === "opponent" ? this.applyFatigueGain(opponentEffectiveFatigue, selectedMove.action, selectedMove.type) : opponentEffectiveFatigue;

    const userTurnNextActorUserId = result.nextAttacker === "challenger" ? battle.challengerId : battle.opponentId;
    const userTurn = await this.prisma.battleTurn.create({
      data: {
        battleId: battle.id,
        actorUserId: userId,
        actorPokemonId: actor === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId,
        action: selectedMove.action,
        moveName: selectedMove.name,
        moveType: selectedMove.type,
        moveCategory: selectedMoveTelemetry.category,
        movePriority: selectedMoveTelemetry.effectivePriority,
        moveDamageMultiplier: selectedMoveTelemetry.damageMultiplier,
        moveControlChance: selectedMoveTelemetry.controlChance,
        nextActorUserId: userTurnNextActorUserId,
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

    const shouldAutoRetaliate = !result.winner;
    if (shouldAutoRetaliate) {
      const autoActor = actor === "challenger" ? "opponent" : "challenger";
      const autoActorPokemon = autoActor === "challenger" ? battle.challengerPokemon : battle.opponentPokemon;
      const autoActorGoogleSub = autoActor === "opponent" ? battle.opponent.googleSub : "offline_proxy";
      const autoAvailableMoves = this.getPokemonMoveSet({
        speciesName: autoActorPokemon.species.name,
        level: autoActorPokemon.level,
        typePrimary: autoActorPokemon.species.typePrimary,
        typeSecondary: autoActorPokemon.species.typeSecondary
      });
      const autoMove = this.pickAiMove(autoAvailableMoves, isAiBattle ? autoActorGoogleSub : "offline_proxy");
      const autoMoveTelemetry = this.getMoveTelemetry(autoMove);
      const challengerFatiguePenaltyAfterUserAction = this.getFatiguePenaltyMultiplier(challengerFatigueAfterTurn);
      const opponentFatiguePenaltyAfterUserAction = this.getFatiguePenaltyMultiplier(opponentFatigueAfterTurn);
      const challengerTotalPenaltyAfterUserAction = challengerFatiguePenaltyAfterUserAction * challengerAgePenalty;
      const opponentTotalPenaltyAfterUserAction = opponentFatiguePenaltyAfterUserAction * opponentAgePenalty;
      const autoChallengerState = {
        currentHp: result.challengerHp,
        maxHp: battle.challengerPokemon.currentHp,
        atk: this.applyFatiguePenalty(battle.challengerPokemon.atk, challengerTotalPenaltyAfterUserAction),
        def: this.applyFatiguePenalty(battle.challengerPokemon.def, challengerTotalPenaltyAfterUserAction),
        speed: this.applyFatiguePenalty(battle.challengerPokemon.speed, challengerTotalPenaltyAfterUserAction),
        level: battle.challengerPokemon.level,
        typePrimary: battle.challengerPokemon.species.typePrimary,
        typeSecondary: battle.challengerPokemon.species.typeSecondary
      };
      const autoOpponentState = {
        currentHp: result.opponentHp,
        maxHp: battle.opponentPokemon.currentHp,
        atk: this.applyFatiguePenalty(battle.opponentPokemon.atk, opponentTotalPenaltyAfterUserAction),
        def: this.applyFatiguePenalty(battle.opponentPokemon.def, opponentTotalPenaltyAfterUserAction),
        speed: this.applyFatiguePenalty(battle.opponentPokemon.speed, opponentTotalPenaltyAfterUserAction),
        level: battle.opponentPokemon.level,
        typePrimary: battle.opponentPokemon.species.typePrimary,
        typeSecondary: battle.opponentPokemon.species.typeSecondary
      };
      const autoResult = resolveTurn(autoChallengerState, autoOpponentState, autoMove.action, autoActor, {
        action: autoMove.action,
        type: autoMove.type,
        power: autoMove.power,
        priority: autoMove.priority,
        category: autoMove.category
      });
      const autoTurnNextActorUserId = userId;
      const createdAutoTurn = await this.prisma.battleTurn.create({
        data: {
          battleId: battle.id,
          actorUserId: autoActor === "challenger" ? battle.challengerId : battle.opponentId,
          actorPokemonId: autoActor === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId,
          action: autoMove.action,
          moveName: autoMove.name,
          moveType: autoMove.type,
          moveCategory: autoMoveTelemetry.category,
          movePriority: autoMoveTelemetry.effectivePriority,
          moveDamageMultiplier: autoMoveTelemetry.damageMultiplier,
          moveControlChance: autoMoveTelemetry.controlChance,
          nextActorUserId: autoTurnNextActorUserId,
          damage: autoResult.damage,
          challengerHp: autoResult.challengerHp,
          opponentHp: autoResult.opponentHp,
          idempotencyKey: `${dto.idempotencyKey}:auto`
        }
      });
      aiTurn = {
        id: createdAutoTurn.id,
        action: createdAutoTurn.action,
        damage: createdAutoTurn.damage
      };
      if (autoActor === "challenger") {
        challengerFatigueAfterTurn = this.applyFatigueGain(challengerFatigueAfterTurn, autoMove.action, autoMove.type);
      } else {
        opponentFatigueAfterTurn = this.applyFatigueGain(opponentFatigueAfterTurn, autoMove.action, autoMove.type);
      }
      finalResult = autoResult;
    }

    await this.prisma.$transaction([
      this.prisma.userPokemon.update({
        where: { id: battle.challengerPokemonId },
        data: {
          fatigue: challengerFatigueAfterTurn,
          fatigueUpdatedAt: nowForFatigue
        }
      }),
      this.prisma.userPokemon.update({
        where: { id: battle.opponentPokemonId },
        data: {
          fatigue: opponentFatigueAfterTurn,
          fatigueUpdatedAt: nowForFatigue
        }
      })
    ]);

    if (finalResult.winner) {
      await this.finishBattle(
        battle.id,
        finalResult.winner,
        battle.challengerId,
        battle.opponentId,
        battle.challengerPokemonId,
        battle.opponentPokemonId,
        userTurn.damage + (aiTurn?.damage ?? 0),
        !isAiBattle
      );
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "BattleTurnSubmitted",
      entityName: "Battle",
      entityId: battle.id,
      payload: { action: selectedMove.action, moveName: selectedMove.name, damage: userTurn.damage, aiAction: aiTurn?.action ?? null }
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
    const isAiBattle = battle.opponent.googleSub.startsWith("ai_");
    const effectiveExpiresAt = this.getEffectiveExpiresAt(battle.createdAt, battle.expiresAt);
    const scheduledStartAt = this.getBattleStartAt(battle.createdAt);
    const nowMs = Date.now();
    let derivedStatus = battle.status;
    if (battle.status !== BattleStatus.finished && battle.status !== BattleStatus.expired && effectiveExpiresAt.getTime() < nowMs) {
      derivedStatus = BattleStatus.expired;
    } else if (battle.status === BattleStatus.pending && nowMs >= scheduledStartAt.getTime()) {
      derivedStatus = BattleStatus.active;
    }
    const challengerMoves = this.getPokemonMoveSet({
      speciesName: battle.challengerPokemon.species.name,
      level: battle.challengerPokemon.level,
      typePrimary: battle.challengerPokemon.species.typePrimary,
      typeSecondary: battle.challengerPokemon.species.typeSecondary
    });
    const opponentMoves = this.getPokemonMoveSet({
      speciesName: battle.opponentPokemon.species.name,
      level: battle.opponentPokemon.level,
      typePrimary: battle.opponentPokemon.species.typePrimary,
      typeSecondary: battle.opponentPokemon.species.typeSecondary
    });
    const currentTurnUserId = this.getCurrentTurnUserId(
      battle.challengerId,
      battle.opponentId,
      battle.challengerPokemon.speed,
      battle.opponentPokemon.speed,
      battle.turns
    );
    const currentTurnMoves = currentTurnUserId === battle.challengerId ? challengerMoves : opponentMoves;
    return {
      ...battle,
      status: derivedStatus,
      currentTurnUserId,
      scheduledStartAt,
      expiresAt: effectiveExpiresAt,
      fallbackAiForOfflineOpponent: !battle.opponent.googleSub.startsWith("ai_"),
      challengerMoves,
      opponentMoves,
      currentTurnMoves
    };
  }

  private async processTurnTimeoutAutoActions(
    battle: {
      id: string;
      status: BattleStatus;
      winnerUserId: string | null;
      createdAt: Date;
      challengerId: string;
      opponentId: string;
      challengerPokemonId: string;
      opponentPokemonId: string;
      opponent: { googleSub: string };
      challengerPokemon: {
        id: string;
        currentHp: number;
        atk: number;
        def: number;
        speed: number;
        level: number;
        fatigue: number;
        fatigueUpdatedAt: Date;
        createdAt: Date;
        species: { name: string; typePrimary: string; typeSecondary: string | null };
      };
      opponentPokemon: {
        id: string;
        currentHp: number;
        atk: number;
        def: number;
        speed: number;
        level: number;
        fatigue: number;
        fatigueUpdatedAt: Date;
        createdAt: Date;
        species: { name: string; typePrimary: string; typeSecondary: string | null };
      };
      turns: Array<{
        id: string;
        actorUserId: string;
        action: string;
        damage: number;
        challengerHp: number;
        opponentHp: number;
        createdAt: Date;
        moveName: string | null;
        moveType: string | null;
        moveCategory: string | null;
        movePriority: number | null;
        moveDamageMultiplier: number | null;
        moveControlChance: number | null;
        nextActorUserId: string | null;
      }>;
    },
    isAiBattle: boolean
  ) {
    if (battle.status !== BattleStatus.active || battle.winnerUserId) {
      return;
    }
    let safety = 0;
    while (safety < 8 && battle.status === BattleStatus.active && !battle.winnerUserId) {
      const nowMs = Date.now();
      const lastTurn = battle.turns.length > 0 ? battle.turns[battle.turns.length - 1] : null;
      const referenceTimeMs = lastTurn ? new Date(lastTurn.createdAt).getTime() : this.getBattleStartAt(battle.createdAt).getTime();
      if (nowMs - referenceTimeMs < this.turnDecisionWindowMs) {
        break;
      }
      const currentTurnUserId = this.getCurrentTurnUserId(
        battle.challengerId,
        battle.opponentId,
        battle.challengerPokemon.speed,
        battle.opponentPokemon.speed,
        battle.turns
      );
      const actor = currentTurnUserId === battle.challengerId ? "challenger" : "opponent";
      const actorPokemon = actor === "challenger" ? battle.challengerPokemon : battle.opponentPokemon;
      const availableMoves = this.getPokemonMoveSet({
        speciesName: actorPokemon.species.name,
        level: actorPokemon.level,
        typePrimary: actorPokemon.species.typePrimary,
        typeSecondary: actorPokemon.species.typeSecondary
      });
      const autoMove = this.pickAiMove(availableMoves, actor === "opponent" && isAiBattle ? battle.opponent.googleSub : "offline_proxy");
      const moveTelemetry = this.getMoveTelemetry(autoMove);
      const nowForFatigue = new Date();
      const challengerEffectiveFatigue = this.getEffectiveFatigue(
        battle.challengerPokemon.fatigue,
        battle.challengerPokemon.fatigueUpdatedAt,
        nowForFatigue
      );
      const opponentEffectiveFatigue = this.getEffectiveFatigue(
        battle.opponentPokemon.fatigue,
        battle.opponentPokemon.fatigueUpdatedAt,
        nowForFatigue
      );
      const challengerFatiguePenalty = this.getFatiguePenaltyMultiplier(challengerEffectiveFatigue);
      const opponentFatiguePenalty = this.getFatiguePenaltyMultiplier(opponentEffectiveFatigue);
      const challengerAgePenalty = this.getAgePenaltyMultiplier(battle.challengerPokemon.createdAt, nowForFatigue);
      const opponentAgePenalty = this.getAgePenaltyMultiplier(battle.opponentPokemon.createdAt, nowForFatigue);
      const challengerTotalPenalty = challengerFatiguePenalty * challengerAgePenalty;
      const opponentTotalPenalty = opponentFatiguePenalty * opponentAgePenalty;
      const challengerState = {
        currentHp: lastTurn ? lastTurn.challengerHp : battle.challengerPokemon.currentHp,
        maxHp: battle.challengerPokemon.currentHp,
        atk: this.applyFatiguePenalty(battle.challengerPokemon.atk, challengerTotalPenalty),
        def: this.applyFatiguePenalty(battle.challengerPokemon.def, challengerTotalPenalty),
        speed: this.applyFatiguePenalty(battle.challengerPokemon.speed, challengerTotalPenalty),
        level: battle.challengerPokemon.level,
        typePrimary: battle.challengerPokemon.species.typePrimary,
        typeSecondary: battle.challengerPokemon.species.typeSecondary
      };
      const opponentState = {
        currentHp: lastTurn ? lastTurn.opponentHp : battle.opponentPokemon.currentHp,
        maxHp: battle.opponentPokemon.currentHp,
        atk: this.applyFatiguePenalty(battle.opponentPokemon.atk, opponentTotalPenalty),
        def: this.applyFatiguePenalty(battle.opponentPokemon.def, opponentTotalPenalty),
        speed: this.applyFatiguePenalty(battle.opponentPokemon.speed, opponentTotalPenalty),
        level: battle.opponentPokemon.level,
        typePrimary: battle.opponentPokemon.species.typePrimary,
        typeSecondary: battle.opponentPokemon.species.typeSecondary
      };
      const timeoutResult = resolveTurn(challengerState, opponentState, autoMove.action, actor, {
        action: autoMove.action,
        type: autoMove.type,
        power: autoMove.power,
        priority: autoMove.priority,
        category: autoMove.category
      });
      const timeoutTurnNextActorUserId = timeoutResult.nextAttacker === "challenger" ? battle.challengerId : battle.opponentId;
      const createdTurn = await this.prisma.battleTurn.create({
        data: {
          battleId: battle.id,
          actorUserId: actor === "challenger" ? battle.challengerId : battle.opponentId,
          actorPokemonId: actor === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId,
          action: autoMove.action,
          moveName: autoMove.name,
          moveType: autoMove.type,
          moveCategory: moveTelemetry.category,
          movePriority: moveTelemetry.effectivePriority,
          moveDamageMultiplier: moveTelemetry.damageMultiplier,
          moveControlChance: moveTelemetry.controlChance,
          nextActorUserId: timeoutTurnNextActorUserId,
          damage: timeoutResult.damage,
          challengerHp: timeoutResult.challengerHp,
          opponentHp: timeoutResult.opponentHp,
          idempotencyKey: `timeout_${battle.id}_${referenceTimeMs}_${safety}_${actor}`
        }
      });
      const actorFatigueAfterTurn = this.applyFatigueGain(
        actor === "challenger" ? challengerEffectiveFatigue : opponentEffectiveFatigue,
        autoMove.action,
        autoMove.type
      );
      await this.prisma.userPokemon.update({
        where: { id: actor === "challenger" ? battle.challengerPokemonId : battle.opponentPokemonId },
        data: {
          fatigue: actorFatigueAfterTurn,
          fatigueUpdatedAt: nowForFatigue
        }
      });
      if (actor === "challenger") {
        battle.challengerPokemon.fatigue = actorFatigueAfterTurn;
        battle.challengerPokemon.fatigueUpdatedAt = nowForFatigue;
      } else {
        battle.opponentPokemon.fatigue = actorFatigueAfterTurn;
        battle.opponentPokemon.fatigueUpdatedAt = nowForFatigue;
      }
      battle.turns.push({
        id: createdTurn.id,
        actorUserId: createdTurn.actorUserId,
        action: createdTurn.action,
        damage: createdTurn.damage,
        challengerHp: createdTurn.challengerHp,
        opponentHp: createdTurn.opponentHp,
        createdAt: createdTurn.createdAt,
        moveName: createdTurn.moveName,
        moveType: createdTurn.moveType,
        moveCategory: createdTurn.moveCategory,
        movePriority: createdTurn.movePriority,
        moveDamageMultiplier: createdTurn.moveDamageMultiplier,
        moveControlChance: createdTurn.moveControlChance,
        nextActorUserId: createdTurn.nextActorUserId
      });
      if (timeoutResult.winner) {
        await this.finishBattle(
          battle.id,
          timeoutResult.winner,
          battle.challengerId,
          battle.opponentId,
          battle.challengerPokemonId,
          battle.opponentPokemonId,
          createdTurn.damage,
          !isAiBattle
        );
        battle.status = BattleStatus.finished;
        battle.winnerUserId = timeoutResult.winner === "challenger" ? battle.challengerId : battle.opponentId;
        break;
      }
      safety += 1;
    }
  }

  private pickAiMove(
    availableMoves: Array<{
      id: string;
      name: string;
      action: "attack" | "defend" | "skill";
      type: string;
      power: number;
      category: "physical" | "special" | "status";
      priority: number;
      minLevel: number;
    }>,
    googleSub: string
  ) {
    if (availableMoves.length === 0) {
      return {
        id: "fallback_attack",
        name: "Ataque Basico",
        action: "attack" as const,
        type: "normal",
        power: 55,
        category: "physical" as const,
        priority: 0,
        minLevel: 1
      };
    }
    const attackMoves = availableMoves.filter((move) => move.action === "attack");
    const defendMoves = availableMoves.filter((move) => move.action === "defend");
    const skillMoves = availableMoves.filter((move) => move.action === "skill");
    const randomValue = Math.random();
    if (googleSub.includes("_hard_")) {
      if (randomValue < 0.55) {
        return (skillMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
      }
      if (randomValue < 0.85) {
        return (attackMoves[0] ?? skillMoves[0] ?? availableMoves[0])!;
      }
      return (defendMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
    }
    if (googleSub.includes("_easy_")) {
      if (randomValue < 0.6) {
        return (attackMoves[0] ?? skillMoves[0] ?? availableMoves[0])!;
      }
      if (randomValue < 0.8) {
        return (defendMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
      }
      return (skillMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
    }
    if (googleSub.includes("offline_proxy")) {
      if (randomValue < 0.5) {
        return (attackMoves[0] ?? availableMoves[0])!;
      }
      if (randomValue < 0.8) {
        return (defendMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
      }
      return (skillMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
    }
    if (randomValue < 0.45) {
      return (attackMoves[0] ?? availableMoves[0])!;
    }
    if (randomValue < 0.7) {
      return (skillMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
    }
    return (defendMoves[0] ?? attackMoves[0] ?? availableMoves[0])!;
  }

  private async ensureAiOpponent(difficulty: "easy" | "normal" | "hard") {
    const aiGoogleSub = `ai_${difficulty}_bot`;
    const aiDisplayName = difficulty === "easy" ? "Bot Rookie" : difficulty === "hard" ? "Bot Elite" : "Bot Ranger";
    const aiUser = await this.prisma.user.upsert({
      where: { googleSub: aiGoogleSub },
      update: { displayName: aiDisplayName },
      create: {
        googleSub: aiGoogleSub,
        email: `${aiGoogleSub}@battleleague.local`,
        displayName: aiDisplayName,
        coins: this.newUserInitialCoins,
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
    const aiLevel = 8 + levelBonus;
    const aiStats = this.getStatsForLevel(
      {
        baseHp: baseSpecies.baseHp,
        baseAtk: baseSpecies.baseAtk,
        baseDef: baseSpecies.baseDef,
        baseSpeed: baseSpecies.baseSpeed
      },
      aiLevel
    );
    const aiPokemon = await this.prisma.userPokemon.create({
      data: {
        userId: aiUser.id,
        speciesId: baseSpecies.id,
        level: aiLevel,
        currentHp: aiStats.currentHp,
        atk: aiStats.atk,
        def: aiStats.def,
        speed: aiStats.speed,
        restCooldownUntil: null
      },
      include: { species: true }
    });

    return { aiUser, aiPokemon };
  }

  private async ensureDemoOpponents(challengerId: string) {
    const availableOpponentsCount = await this.prisma.user.count({
      where: {
        id: { not: challengerId },
        NOT: {
          googleSub: { startsWith: "ai_" }
        }
      }
    });
    if (availableOpponentsCount >= 30) {
      return;
    }

    const speciesCatalog = await this.prisma.pokemonSpecies.findMany({
      orderBy: { pokeApiId: "asc" },
      take: 20
    });
    if (speciesCatalog.length === 0) {
      return;
    }

    const demoNamePool = [
      "Rival Blaze",
      "Rival Sky",
      "Rival Frost",
      "Rival Vine",
      "Rival Nova",
      "Rival Echo",
      "Rival Pulse",
      "Rival Storm",
      "Rival Ember",
      "Rival Tide",
      "Rival Terra",
      "Rival Volt",
      "Rival Comet",
      "Rival Flare",
      "Rival Mist",
      "Rival Shade",
      "Rival Bolt",
      "Rival Orbit",
      "Rival Frostbite",
      "Rival Bloom",
      "Rival Kaze",
      "Rival Magma",
      "Rival Glint",
      "Rival Quartz",
      "Rival Iron",
      "Rival Wind",
      "Rival Surge",
      "Rival Drift",
      "Rival Spark",
      "Rival Aurora"
    ] as const;
    const demoPlayers = demoNamePool.map((displayName, index) => {
      const slug = displayName.toLowerCase().replace(/\s+/g, "_");
      const level = 5 + (index % 6);
      const wins = 4 + ((index * 3) % 11);
      const losses = 2 + ((index * 5) % 8);
      return {
        googleSub: `demo_${slug}`,
        email: `${slug}@battleleague.local`,
        displayName,
        avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(displayName)}`,
        level,
        wins,
        losses
      };
    });

    for (let index = 0; index < demoPlayers.length; index += 1) {
      const demo = demoPlayers[index];
      const user = await this.prisma.user.upsert({
        where: { googleSub: demo.googleSub },
        update: {
          displayName: demo.displayName,
          avatarUrl: demo.avatarUrl,
          level: demo.level,
          totalWins: demo.wins,
          totalLosses: demo.losses
        },
        create: {
          googleSub: demo.googleSub,
          email: demo.email,
          displayName: demo.displayName,
          avatarUrl: demo.avatarUrl,
          coins: this.newUserInitialCoins,
          level: demo.level,
          totalWins: demo.wins,
          totalLosses: demo.losses,
          profileHistory: {
            create: {
              battleCount: demo.wins + demo.losses,
              bestStreak: Math.max(2, Math.floor(demo.wins / 2)),
              totalDamage: 200 + demo.wins * 15
            }
          }
        }
      });

      const existingPokemons = await this.prisma.userPokemon.findMany({
        where: { userId: user.id },
        select: { speciesId: true }
      });
      const existingSpeciesIds = new Set(existingPokemons.map((pokemon) => pokemon.speciesId));
      const desiredPokemonCount = 2 + (index % 4);
      const missingPokemonCount = Math.max(0, desiredPokemonCount - existingPokemons.length);
      if (missingPokemonCount === 0) {
        continue;
      }

      const chosenSpecies: typeof speciesCatalog = [];
      let speciesCursor = 0;
      while (chosenSpecies.length < missingPokemonCount && speciesCursor < speciesCatalog.length * 2) {
        const species = speciesCatalog[(index * 3 + speciesCursor) % speciesCatalog.length];
        if (!existingSpeciesIds.has(species.id) && !chosenSpecies.some((item) => item.id === species.id)) {
          chosenSpecies.push(species);
        }
        speciesCursor += 1;
      }

      for (let speciesIndex = 0; speciesIndex < chosenSpecies.length; speciesIndex += 1) {
        const species = chosenSpecies[speciesIndex];
        const pokemonLevel = demo.level + speciesIndex;
        const pokemonStats = this.getStatsForLevel(
          {
            baseHp: species.baseHp,
            baseAtk: species.baseAtk,
            baseDef: species.baseDef,
            baseSpeed: species.baseSpeed
          },
          pokemonLevel
        );
        await this.prisma.userPokemon.create({
          data: {
            userId: user.id,
            speciesId: species.id,
            level: pokemonLevel,
            xp: pokemonLevel * 15,
            currentHp: pokemonStats.currentHp,
            atk: pokemonStats.atk,
            def: pokemonStats.def,
            speed: pokemonStats.speed,
            wins: Math.max(0, demo.wins - speciesIndex),
            losses: Math.max(0, demo.losses - speciesIndex),
            restCooldownUntil: null,
            evolveCooldownUntil: null
          }
        });
      }
    }
  }

  private async finishBattle(
    battleId: string,
    winner: "challenger" | "opponent",
    challengerId: string,
    opponentId: string,
    challengerPokemonId: string,
    opponentPokemonId: string,
    totalDamage: number,
    isRanked: boolean
  ) {
    const [challengerUser, opponentUser, challengerPokemonState, opponentPokemonState, battleTurns] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: challengerId }, select: { mmr: true, xp: true } }),
      this.prisma.user.findUnique({ where: { id: opponentId }, select: { mmr: true, xp: true } }),
      this.prisma.userPokemon.findUnique({
        where: { id: challengerPokemonId },
        select: { level: true, xp: true, lifeUtil: true, isLegacy: true }
      }),
      this.prisma.userPokemon.findUnique({
        where: { id: opponentPokemonId },
        select: { level: true, xp: true, lifeUtil: true, isLegacy: true }
      }),
      this.prisma.battleTurn.findMany({
        where: { battleId },
        select: {
          actorPokemonId: true,
          damage: true
        }
      })
    ]);
    const challengerMmr = challengerUser?.mmr ?? 1200;
    const opponentMmr = opponentUser?.mmr ?? 1200;
    const challengerCurrentXp = challengerUser?.xp ?? 0;
    const opponentCurrentXp = opponentUser?.xp ?? 0;
    const mmrChange = isRanked
      ? this.calculateMmrChange(
          winner,
          challengerMmr,
          opponentMmr,
          challengerPokemonState?.level ?? 1,
          opponentPokemonState?.level ?? 1
        )
      : { challengerDelta: 0, opponentDelta: 0 };
    const challengerNextMmr = Math.max(0, challengerMmr + mmrChange.challengerDelta);
    const opponentNextMmr = Math.max(0, opponentMmr + mmrChange.opponentDelta);
    const winnerUserId = winner === "challenger" ? challengerId : opponentId;
    const loserUserId = winner === "challenger" ? opponentId : challengerId;
    const winnerPokemonId = winner === "challenger" ? challengerPokemonId : opponentPokemonId;
    const loserPokemonId = winner === "challenger" ? opponentPokemonId : challengerPokemonId;
    const challengerDamageDealt = battleTurns
      .filter((turn) => turn.actorPokemonId === challengerPokemonId)
      .reduce((total, turn) => total + Math.max(0, turn.damage), 0);
    const opponentDamageDealt = battleTurns
      .filter((turn) => turn.actorPokemonId === opponentPokemonId)
      .reduce((total, turn) => total + Math.max(0, turn.damage), 0);
    const battleTurnCount = battleTurns.length;
    const winnerPower =
      winner === "challenger"
        ? challengerMmr + Math.max(1, challengerPokemonState?.level ?? 1) * 12
        : opponentMmr + Math.max(1, opponentPokemonState?.level ?? 1) * 12;
    const loserPower =
      winner === "challenger"
        ? opponentMmr + Math.max(1, opponentPokemonState?.level ?? 1) * 12
        : challengerMmr + Math.max(1, challengerPokemonState?.level ?? 1) * 12;
    const underdogWin = loserPower - winnerPower >= 120;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayWins = await this.prisma.battle.count({
      where: {
        winnerUserId,
        status: BattleStatus.finished,
        createdAt: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    });
    const isFirstWinToday = todayWins === 0;
    const winnerBonusCoins = (underdogWin ? 8 : 0) + (isFirstWinToday ? 5 : 0);
    const winnerBonusFragments = (underdogWin ? 12 : 0) + (isFirstWinToday ? 6 : 0);
    let challengerXpGainForUser = this.calculateUserAccountXpGain({
      didWin: winner === "challenger",
      myMmr: challengerMmr,
      opponentMmr,
      myPokemonLevel: challengerPokemonState?.level ?? 1,
      opponentPokemonLevel: opponentPokemonState?.level ?? 1,
      myDamageDealt: challengerDamageDealt,
      opponentDamageDealt,
      turnCount: battleTurnCount
    });
    let opponentXpGainForUser = this.calculateUserAccountXpGain({
      didWin: winner === "opponent",
      myMmr: opponentMmr,
      opponentMmr: challengerMmr,
      myPokemonLevel: opponentPokemonState?.level ?? 1,
      opponentPokemonLevel: challengerPokemonState?.level ?? 1,
      myDamageDealt: opponentDamageDealt,
      opponentDamageDealt: challengerDamageDealt,
      turnCount: battleTurnCount
    });
    if (winner === "challenger" && opponentXpGainForUser >= challengerXpGainForUser) {
      opponentXpGainForUser = Math.max(6, challengerXpGainForUser - 2);
    }
    if (winner === "opponent" && challengerXpGainForUser >= opponentXpGainForUser) {
      challengerXpGainForUser = Math.max(6, opponentXpGainForUser - 2);
    }
    const challengerNextXpForUser = challengerCurrentXp + challengerXpGainForUser;
    const opponentNextXpForUser = opponentCurrentXp + opponentXpGainForUser;
    const challengerNextLevelForUser = Math.max(1, Math.floor(challengerNextXpForUser / 100) + 1);
    const opponentNextLevelForUser = Math.max(1, Math.floor(opponentNextXpForUser / 100) + 1);
    let challengerXpGain = this.calculatePokemonXpGain({
      didWin: winnerPokemonId === challengerPokemonId,
      myLevel: challengerPokemonState?.level ?? 1,
      opponentLevel: opponentPokemonState?.level ?? 1,
      myDamageDealt: challengerDamageDealt,
      opponentDamageDealt,
      turnCount: battleTurnCount
    });
    let opponentXpGain = this.calculatePokemonXpGain({
      didWin: winnerPokemonId === opponentPokemonId,
      myLevel: opponentPokemonState?.level ?? 1,
      opponentLevel: challengerPokemonState?.level ?? 1,
      myDamageDealt: opponentDamageDealt,
      opponentDamageDealt: challengerDamageDealt,
      turnCount: battleTurnCount
    });
    if (winnerPokemonId === challengerPokemonId && opponentXpGain >= challengerXpGain) {
      opponentXpGain = Math.max(6, challengerXpGain - 2);
    }
    if (winnerPokemonId === opponentPokemonId && challengerXpGain >= opponentXpGain) {
      challengerXpGain = Math.max(6, opponentXpGain - 2);
    }
    const now = new Date();
    const challengerLifeState = this.getLifeCycleAfterBattle(challengerPokemonState?.lifeUtil ?? 100, challengerPokemonState?.isLegacy ?? false, now);
    const opponentLifeState = this.getLifeCycleAfterBattle(opponentPokemonState?.lifeUtil ?? 100, opponentPokemonState?.isLegacy ?? false, now);
    const challengerProgress = this.getPokemonProgressAfterXpGain(
      challengerPokemonState?.level ?? 1,
      challengerPokemonState?.xp ?? 0,
      challengerXpGain
    );
    const opponentProgress = this.getPokemonProgressAfterXpGain(
      opponentPokemonState?.level ?? 1,
      opponentPokemonState?.xp ?? 0,
      opponentXpGain
    );

    await this.prisma.$transaction([
      this.prisma.battle.update({
        where: { id: battleId },
        data: {
          status: BattleStatus.finished,
          winnerUserId,
          challengerMmrDelta: mmrChange.challengerDelta,
          opponentMmrDelta: mmrChange.opponentDelta
        }
      }),
      this.prisma.user.update({
        where: { id: winnerUserId },
        data: {
          totalWins: { increment: 1 },
          xp:
            winner === "challenger"
              ? { increment: challengerXpGainForUser }
              : { increment: opponentXpGainForUser },
          coins: { increment: 10 + winnerBonusCoins },
          pokemonFragments: { increment: winnerBonusFragments },
          trainingPoints: { increment: 2 },
          mmr: winner === "challenger" ? challengerNextMmr : opponentNextMmr,
          level: winner === "challenger" ? challengerNextLevelForUser : opponentNextLevelForUser
        }
      }),
      this.prisma.user.update({
        where: { id: loserUserId },
        data: {
          totalLosses: { increment: 1 },
          xp:
            winner === "challenger"
              ? { increment: opponentXpGainForUser }
              : { increment: challengerXpGainForUser },
          coins: { increment: 3 },
          trainingPoints: { increment: 1 },
          mmr: winner === "challenger" ? opponentNextMmr : challengerNextMmr,
          level: winner === "challenger" ? opponentNextLevelForUser : challengerNextLevelForUser
        }
      }),
      this.prisma.userPokemon.update({
        where: { id: winnerPokemonId },
        data: {
          wins: { increment: 1 },
          xp: winnerPokemonId === challengerPokemonId ? challengerProgress.nextXp : opponentProgress.nextXp,
          level: winnerPokemonId === challengerPokemonId ? challengerProgress.nextLevel : opponentProgress.nextLevel,
          currentHp: {
            increment: winnerPokemonId === challengerPokemonId ? challengerProgress.hpGain : opponentProgress.hpGain
          },
          atk: {
            increment: winnerPokemonId === challengerPokemonId ? challengerProgress.atkGain : opponentProgress.atkGain
          },
          def: {
            increment: winnerPokemonId === challengerPokemonId ? challengerProgress.defGain : opponentProgress.defGain
          },
          speed: {
            increment: winnerPokemonId === challengerPokemonId ? challengerProgress.speedGain : opponentProgress.speedGain
          },
          lifeUtil: winnerPokemonId === challengerPokemonId ? challengerLifeState.lifeUtil : opponentLifeState.lifeUtil,
          isLegacy: winnerPokemonId === challengerPokemonId ? challengerLifeState.isLegacy : opponentLifeState.isLegacy,
          legacyAt: winnerPokemonId === challengerPokemonId ? challengerLifeState.legacyAt : opponentLifeState.legacyAt
        }
      }),
      this.prisma.userPokemon.update({
        where: { id: loserPokemonId },
        data: {
          losses: { increment: 1 },
          xp: loserPokemonId === challengerPokemonId ? challengerProgress.nextXp : opponentProgress.nextXp,
          level: loserPokemonId === challengerPokemonId ? challengerProgress.nextLevel : opponentProgress.nextLevel,
          currentHp: {
            increment: loserPokemonId === challengerPokemonId ? challengerProgress.hpGain : opponentProgress.hpGain
          },
          atk: {
            increment: loserPokemonId === challengerPokemonId ? challengerProgress.atkGain : opponentProgress.atkGain
          },
          def: {
            increment: loserPokemonId === challengerPokemonId ? challengerProgress.defGain : opponentProgress.defGain
          },
          speed: {
            increment: loserPokemonId === challengerPokemonId ? challengerProgress.speedGain : opponentProgress.speedGain
          },
          lifeUtil: loserPokemonId === challengerPokemonId ? challengerLifeState.lifeUtil : opponentLifeState.lifeUtil,
          isLegacy: loserPokemonId === challengerPokemonId ? challengerLifeState.isLegacy : opponentLifeState.isLegacy,
          legacyAt: loserPokemonId === challengerPokemonId ? challengerLifeState.legacyAt : opponentLifeState.legacyAt
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

    await this.auditService.write({
      actorUserId: winnerUserId,
      action: "BattleProgressionBonusGranted",
      entityName: "Battle",
      entityId: battleId,
      payload: {
        underdogWin,
        isFirstWinToday,
        winnerBonusCoins,
        winnerBonusFragments
      }
    });
  }

  private calculateMmrChange(
    winner: "challenger" | "opponent",
    challengerMmr: number,
    opponentMmr: number,
    challengerPokemonLevel: number,
    opponentPokemonLevel: number
  ) {
    const challengerPower = challengerMmr + Math.max(1, challengerPokemonLevel) * 12;
    const opponentPower = opponentMmr + Math.max(1, opponentPokemonLevel) * 12;
    const challengerExpected = 1 / (1 + 10 ** ((opponentPower - challengerPower) / 400));
    const opponentExpected = 1 / (1 + 10 ** ((challengerPower - opponentPower) / 400));
    const winnerExpected = winner === "challenger" ? challengerExpected : opponentExpected;
    const upsetFactor = Math.max(0, Math.min(1, 1 - winnerExpected));
    const winnerDeltaAbs = Math.round(8 + upsetFactor * 28);
    const loserDeltaAbs = Math.round(6 + upsetFactor * 24);
    const challengerDelta = winner === "challenger" ? winnerDeltaAbs : -loserDeltaAbs;
    const opponentDelta = winner === "opponent" ? winnerDeltaAbs : -loserDeltaAbs;
    return {
      challengerDelta,
      opponentDelta
    };
  }

  private calculatePokemonXpGain(args: {
    didWin: boolean;
    myLevel: number;
    opponentLevel: number;
    myDamageDealt: number;
    opponentDamageDealt: number;
    turnCount: number;
  }) {
    const safeMyLevel = Math.max(1, args.myLevel);
    const safeOpponentLevel = Math.max(1, args.opponentLevel);
    const totalDamage = Math.max(1, args.myDamageDealt + args.opponentDamageDealt);
    const damageShare = Math.max(0, Math.min(1, args.myDamageDealt / totalDamage));
    const levelDelta = safeOpponentLevel - safeMyLevel;
    const intensityBonus = Math.min(8, Math.floor(Math.max(0, args.turnCount) / 3));

    if (args.didWin) {
      const baseXp = 20;
      const levelBonus = this.clamp(levelDelta * 3, -20, 24);
      const performanceBonus = Math.round(4 + damageShare * 8);
      const stompPenalty = levelDelta < 0 ? Math.min(16, Math.floor(Math.abs(levelDelta) * 0.9)) : 0;
      const rawXp = baseXp + levelBonus + performanceBonus + intensityBonus - stompPenalty;
      return this.clamp(rawXp, 8, 52);
    }

    const baseXp = 9;
    const underdogBonus = this.clamp(Math.round(levelDelta * 1.6), -6, 22);
    const performanceBonus = Math.round(damageShare * 8);
    const rawXp = baseXp + underdogBonus + performanceBonus + intensityBonus;
    return this.clamp(rawXp, 6, 34);
  }

  private calculateUserAccountXpGain(args: {
    didWin: boolean;
    myMmr: number;
    opponentMmr: number;
    myPokemonLevel: number;
    opponentPokemonLevel: number;
    myDamageDealt: number;
    opponentDamageDealt: number;
    turnCount: number;
  }) {
    const mmrDelta = args.opponentMmr - args.myMmr;
    const pokemonLevelDelta = args.opponentPokemonLevel - args.myPokemonLevel;
    const totalDamage = Math.max(1, args.myDamageDealt + args.opponentDamageDealt);
    const damageShare = Math.max(0, Math.min(1, args.myDamageDealt / totalDamage));
    const intensityBonus = Math.min(8, Math.floor(Math.max(0, args.turnCount) / 3));
    const baseXp = args.didWin ? 20 : 8;
    const mmrBonus = args.didWin
      ? this.clamp(Math.round(mmrDelta / 45), -5, 14)
      : this.clamp(Math.round(mmrDelta / 60), -3, 9);
    const levelBonus = args.didWin
      ? this.clamp(Math.round(pokemonLevelDelta / 2), -4, 10)
      : this.clamp(Math.round(pokemonLevelDelta / 3), -2, 6);
    const performanceBonus = args.didWin
      ? Math.round(damageShare * 10)
      : Math.round(damageShare * 6);
    const rawXp = baseXp + mmrBonus + levelBonus + performanceBonus + intensityBonus;
    return args.didWin ? this.clamp(rawXp, 16, 48) : this.clamp(rawXp, 6, 24);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  private async settleBattleByHpOnTimeout(battle: {
    id: string;
    status: BattleStatus;
    winnerUserId: string | null;
    isRanked: boolean;
    challengerId: string;
    opponentId: string;
    challengerPokemonId: string;
    opponentPokemonId: string;
    challengerPokemon: { currentHp: number };
    opponentPokemon: { currentHp: number };
    turns: Array<{ challengerHp: number; opponentHp: number }>;
  }): Promise<{ status: BattleStatus; winnerUserId: string | null }> {
    if (battle.status === BattleStatus.finished && battle.winnerUserId) {
      return { status: BattleStatus.finished, winnerUserId: battle.winnerUserId };
    }
    const latestTurn = battle.turns.length > 0 ? battle.turns[battle.turns.length - 1] : null;
    const challengerHp = latestTurn ? latestTurn.challengerHp : battle.challengerPokemon.currentHp;
    const opponentHp = latestTurn ? latestTurn.opponentHp : battle.opponentPokemon.currentHp;

    if (challengerHp === opponentHp) {
      if (battle.status !== BattleStatus.expired) {
        await this.prisma.battle.update({
          where: { id: battle.id },
          data: { status: BattleStatus.expired, winnerUserId: null }
        });
      }
      return { status: BattleStatus.expired, winnerUserId: null };
    }

    const winner = challengerHp > opponentHp ? "challenger" : "opponent";
    await this.finishBattle(
      battle.id,
      winner,
      battle.challengerId,
      battle.opponentId,
      battle.challengerPokemonId,
      battle.opponentPokemonId,
      0,
      battle.isRanked
    );
    return {
      status: BattleStatus.finished,
      winnerUserId: winner === "challenger" ? battle.challengerId : battle.opponentId
    };
  }

  private getEffectiveFatigue(storedFatigue: number, fatigueUpdatedAt: Date, now: Date): number {
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - fatigueUpdatedAt.getTime()) / 60_000));
    return Math.max(0, storedFatigue - elapsedMinutes);
  }

  private getFatiguePenaltyMultiplier(fatigue: number): number {
    if (fatigue >= 95) {
      return 0.35;
    }
    if (fatigue >= 85) {
      return 0.45;
    }
    if (fatigue >= 75) {
      return 0.58;
    }
    if (fatigue >= 65) {
      return 0.68;
    }
    if (fatigue >= 50) {
      return 0.8;
    }
    if (fatigue >= 35) {
      return 0.9;
    }
    return 1;
  }

  private getAgePenaltyMultiplier(createdAt: Date, now: Date): number {
    const ageDays = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
    if (ageDays < 7) {
      return 1;
    }
    const penaltyPercent = Math.min(30, Math.floor((ageDays - 7) / 3) + 1);
    return Math.max(0.7, 1 - penaltyPercent / 100);
  }

  private getLifeCycleAfterBattle(currentLifeUtil: number, isLegacy: boolean, now: Date) {
    if (isLegacy) {
      return {
        lifeUtil: 0,
        isLegacy: true,
        legacyAt: now
      };
    }
    const nextLifeUtil = Math.max(0, currentLifeUtil - 1);
    return {
      lifeUtil: nextLifeUtil,
      isLegacy: nextLifeUtil === 0,
      legacyAt: nextLifeUtil === 0 ? now : null
    };
  }

  private getPokemonProgressAfterXpGain(currentLevel: number, currentXp: number, xpGain: number) {
    const safeCurrentLevel = Math.max(1, currentLevel);
    const safeCurrentXp = Math.max(0, currentXp);
    const nextXp = safeCurrentXp + Math.max(0, xpGain);
    let nextLevel = safeCurrentLevel;
    while (nextLevel < this.maxPokemonLevel) {
      const xpRequiredForNextLevel = this.getPokemonTotalXpForLevel(nextLevel + 1);
      if (nextXp < xpRequiredForNextLevel) {
        break;
      }
      nextLevel += 1;
    }
    const levelGain = Math.max(0, nextLevel - safeCurrentLevel);
    const speedGain = Math.max(0, Math.floor((nextLevel - 1) / 2) - Math.floor((safeCurrentLevel - 1) / 2));
    return {
      nextXp,
      nextLevel,
      hpGain: levelGain * 2,
      atkGain: levelGain,
      defGain: levelGain,
      speedGain
    };
  }

  private getPokemonXpToNextLevel(level: number): number {
    const safeLevel = Math.max(1, Math.min(this.maxPokemonLevel, level));
    if (safeLevel <= 10) {
      return 30 + (safeLevel - 1) * 4;
    }
    if (safeLevel <= 25) {
      return 70 + (safeLevel - 11) * 3;
    }
    if (safeLevel <= 50) {
      return 115 + (safeLevel - 26) * 2;
    }
    return 165 + Math.floor((safeLevel - 51) * 1.5);
  }

  private getPokemonTotalXpForLevel(level: number): number {
    const safeLevel = Math.max(1, Math.min(this.maxPokemonLevel, level));
    if (safeLevel <= 1) {
      return 0;
    }
    let totalXp = 0;
    for (let currentLevel = 1; currentLevel < safeLevel; currentLevel += 1) {
      totalXp += this.getPokemonXpToNextLevel(currentLevel);
    }
    return totalXp;
  }

  private getPokemonMoveSet(pokemon: { speciesName: string; level: number; typePrimary: string; typeSecondary?: string | null }) {
    const primaryType = pokemon.typePrimary.toLowerCase();
    const secondaryType = pokemon.typeSecondary?.toLowerCase() ?? null;
    const normalizedSpeciesName = pokemon.speciesName.toLowerCase();
    const formatTypeLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
    const formatSpeciesLabel = pokemon.speciesName.charAt(0).toUpperCase() + pokemon.speciesName.slice(1);
    const baseMoves: Array<{
      id: string;
      name: string;
      action: "attack" | "defend" | "skill";
      type: string;
      power: number;
      minLevel: number;
      category: "physical" | "special" | "status";
      priority: number;
    }> = [
      {
        id: `${normalizedSpeciesName}_guard_stance`,
        name: "Guard Stance",
        action: "defend",
        type: "normal",
        power: 12,
        minLevel: 1,
        category: "status",
        priority: 2
      },
      {
        id: `${normalizedSpeciesName}_${primaryType}_strike`,
        name: `${formatTypeLabel(primaryType)} Strike`,
        action: "attack",
        type: primaryType,
        power: 55,
        minLevel: 1,
        category: "physical",
        priority: 0
      },
      {
        id: `${normalizedSpeciesName}_${primaryType}_burst`,
        name: `${formatTypeLabel(primaryType)} Burst`,
        action: "skill",
        type: primaryType,
        power: 85,
        minLevel: 8,
        category: "special",
        priority: 0
      },
      {
        id: `${normalizedSpeciesName}_signature_impact`,
        name: `${formatSpeciesLabel} Impact`,
        action: "skill",
        type: primaryType,
        power: 95,
        minLevel: 36,
        category: "special",
        priority: -1
      }
    ];
    if (secondaryType) {
      baseMoves.push({
        id: `${normalizedSpeciesName}_${secondaryType}_slash`,
        name: `${formatTypeLabel(secondaryType)} Slash`,
        action: "attack",
        type: secondaryType,
        power: 68,
        minLevel: 12,
        category: "physical",
        priority: 0
      });
      baseMoves.push({
        id: `${normalizedSpeciesName}_${secondaryType}_nova`,
        name: `${formatTypeLabel(secondaryType)} Nova`,
        action: "skill",
        type: secondaryType,
        power: 92,
        minLevel: 24,
        category: "special",
        priority: 0
      });
    }
    return baseMoves.filter((move) => move.minLevel <= pokemon.level);
  }

  private getStatusTypeProfile(moveType: string) {
    const normalizedType = moveType.toLowerCase();
    if (normalizedType === "electric") {
      return {
        damageMultiplier: 0.5,
        controlChance: 0.84,
        priorityBonus: 0
      };
    }
    if (normalizedType === "rock") {
      return {
        damageMultiplier: 0.45,
        controlChance: 0.58,
        priorityBonus: 1
      };
    }
    if (normalizedType === "steel") {
      return {
        damageMultiplier: 0.48,
        controlChance: 0.64,
        priorityBonus: 1
      };
    }
    return {
      damageMultiplier: 0.55,
      controlChance: 0.75,
      priorityBonus: 0
    };
  }

  private getMoveTelemetry(move: {
    action: "attack" | "defend" | "skill";
    type: string;
    category: "physical" | "special" | "status";
    priority: number;
  }) {
    if (move.category !== "status") {
      return {
        category: move.category,
        effectivePriority: move.priority,
        damageMultiplier: 1,
        controlChance: 0
      };
    }
    const statusProfile = this.getStatusTypeProfile(move.type);
    return {
      category: move.category,
      effectivePriority: move.priority + statusProfile.priorityBonus,
      damageMultiplier: statusProfile.damageMultiplier,
      controlChance: statusProfile.controlChance
    };
  }

  private getStatsForLevel(
    speciesBaseStats: { baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number },
    level: number
  ) {
    const safeLevel = Math.max(1, level);
    const levelOffset = safeLevel - 1;
    return {
      currentHp: speciesBaseStats.baseHp + levelOffset * 2,
      atk: speciesBaseStats.baseAtk + levelOffset,
      def: speciesBaseStats.baseDef + levelOffset,
      speed: speciesBaseStats.baseSpeed + Math.floor(levelOffset / 2)
    };
  }

  private applyFatiguePenalty(baseValue: number, multiplier: number): number {
    return Math.max(1, Math.round(baseValue * multiplier));
  }

  private applyFatigueGain(currentFatigue: number, action: string, moveType?: string): number {
    const normalizedMoveType = (moveType ?? "").toLowerCase();
    const baseGain = action === "skill" ? 16 : action === "attack" ? 12 : action === "defend" ? 8 : 10;
    const gain =
      action === "defend" && (normalizedMoveType === "rock" || normalizedMoveType === "steel")
        ? Math.max(3, baseGain - 3)
        : baseGain;
    return Math.min(100, currentFatigue + gain);
  }

  private isUserOnline(userId: string): boolean {
    const lastSeen = this.userPresence.get(userId);
    if (!lastSeen) {
      return false;
    }
    return Date.now() - lastSeen <= this.presenceWindowMs;
  }

  private getBattleStartAt(createdAt: Date): Date {
    return new Date(createdAt.getTime() + this.pvpScheduleMs);
  }

  private getBattleExpiresAt(createdAt: Date): Date {
    const startsAt = this.getBattleStartAt(createdAt);
    return new Date(startsAt.getTime() + this.battleDurationMs);
  }

  private getEffectiveExpiresAt(createdAt: Date, storedExpiresAt: Date): Date {
    const capExpiresAt = this.getBattleExpiresAt(createdAt);
    return storedExpiresAt.getTime() > capExpiresAt.getTime() ? capExpiresAt : storedExpiresAt;
  }

  private getLeagueByMmr(mmr: number): (typeof this.rankedTiers)[number] {
    if (mmr >= 3000) return "Ruby 1";
    if (mmr >= 2700) return "Ruby 2";
    if (mmr >= 2400) return "Ruby 3";
    if (mmr >= 2300) return "Diamante 1";
    if (mmr >= 2200) return "Diamante 2";
    if (mmr >= 2100) return "Diamante 3";
    if (mmr >= 2000) return "Platina 1";
    if (mmr >= 1900) return "Platina 2";
    if (mmr >= 1800) return "Platina 3";
    if (mmr >= 1700) return "Ouro 1";
    if (mmr >= 1600) return "Ouro 2";
    if (mmr >= 1500) return "Ouro 3";
    if (mmr >= 1400) return "Prata 1";
    if (mmr >= 1300) return "Prata 2";
    if (mmr >= 1200) return "Prata 3";
    if (mmr >= 1100) return "Bronze 1";
    if (mmr >= 1000) return "Bronze 2";
    if (mmr >= 900) return "Bronze 3";
    if (mmr >= 800) return "Ferro 1";
    if (mmr >= 700) return "Ferro 2";
    return "Ferro 3";
  }

  private getRankTierIndexByMmr(mmr: number): number {
    const tier = this.getLeagueByMmr(mmr);
    return this.rankedTiers.indexOf(tier);
  }

  private canDuelByRank(challengerMmr: number, opponentMmr: number): boolean {
    const challengerTierIndex = this.getRankTierIndexByMmr(challengerMmr);
    const opponentTierIndex = this.getRankTierIndexByMmr(opponentMmr);
    if (challengerTierIndex < 0 || opponentTierIndex < 0) {
      return false;
    }
    const delta = opponentTierIndex - challengerTierIndex;
    return delta >= -3 && delta <= 2;
  }

  private getCurrentTurnUserId(
    challengerId: string,
    opponentId: string,
    challengerSpeed: number,
    opponentSpeed: number,
    turns: Array<{ actorUserId: string; nextActorUserId?: string | null }>
  ): string {
    if (turns.length === 0) {
      return challengerId;
    }
    const lastTurn = turns[turns.length - 1];
    if (lastTurn.nextActorUserId) {
      return lastTurn.nextActorUserId;
    }
    return lastTurn.actorUserId === challengerId ? opponentId : challengerId;
  }
}
