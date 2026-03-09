import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, QuestStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { BuyLootBoxDto } from "./dto/buy-lootbox.dto";
import { ClaimEventRewardDto } from "./dto/claim-event-reward.dto";
import { CompleteQuestDto } from "./dto/complete-quest.dto";
import { CraftPokemonDto } from "./dto/craft-pokemon.dto";
import { OpenLootBoxDto } from "./dto/open-lootbox.dto";
import { UpgradePokemonDto } from "./dto/upgrade-pokemon.dto";

type LootBoxCatalogItem = {
  boxType: string;
  displayName: string;
  category: string;
  priceCoins: number;
  imageUrl: string;
  rarityWeights: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
};

type RarityKey = "common" | "uncommon" | "rare" | "epic" | "legendary";

@Injectable()
export class ProgressionService {
  private readonly dailyShopLimit = 5;
  private readonly maxPokemonLevel = 100;
  private readonly highTierMode: "epic" | "legendary" = "epic";
  private readonly lootEconomyCacheTtlMs = 30_000;
  private lootEconomyCatalogCache:
    | {
        expiresAtMs: number;
        normalizedSpecies: Array<{
          id: string;
          name: string;
          pokeApiId: number;
          imageUrl: string | null;
          dropRarity: string;
          evolutionTarget: string | null;
          baseHp: number;
          baseAtk: number;
          baseDef: number;
          baseSpeed: number;
        }>;
        boxDropPreview: ReturnType<ProgressionService["buildBoxDropPreview"]>;
      }
    | null = null;
  private readonly lootBoxCatalog: LootBoxCatalogItem[] = [
    {
      boxType: "fiesta",
      displayName: "Jornada BattleLeague",
      category: "specials",
      priceCoins: 40,
      imageUrl: "/boxArt/journeyKanto.svg",
      rarityWeights: { common: 62, uncommon: 25, rare: 9, epic: 3, legendary: 1 }
    },
    {
      boxType: "oleeee",
      displayName: "Jornada Johto",
      category: "specials",
      priceCoins: 120,
      imageUrl: "/boxArt/journeyJohto.svg",
      rarityWeights: { common: 46, uncommon: 30, rare: 14, epic: 7, legendary: 3 }
    },
    {
      boxType: "corrida",
      displayName: "Jornada Hoenn",
      category: "specials",
      priceCoins: 240,
      imageUrl: "/boxArt/journeyHoenn.svg",
      rarityWeights: { common: 28, uncommon: 32, rare: 22, epic: 12, legendary: 6 }
    },
    {
      boxType: "suerte",
      displayName: "Jornada Sinnoh",
      category: "specials",
      priceCoins: 500,
      imageUrl: "/boxArt/journeySinnoh.svg",
      rarityWeights: { common: 16, uncommon: 24, rare: 28, epic: 20, legendary: 12 }
    },
    {
      boxType: "hyper",
      displayName: "Jornada Unova",
      category: "holo",
      priceCoins: 60,
      imageUrl: "/boxArt/journeyUnova.svg",
      rarityWeights: { common: 58, uncommon: 26, rare: 10, epic: 4, legendary: 2 }
    },
    {
      boxType: "dart",
      displayName: "Jornada Kalos",
      category: "holo",
      priceCoins: 130,
      imageUrl: "/boxArt/journeyKalos.svg",
      rarityWeights: { common: 50, uncommon: 28, rare: 12, epic: 7, legendary: 3 }
    },
    {
      boxType: "aqua",
      displayName: "Jornada Alola",
      category: "holo",
      priceCoins: 200,
      imageUrl: "/boxArt/journeyAlola.svg",
      rarityWeights: { common: 42, uncommon: 30, rare: 16, epic: 8, legendary: 4 }
    },
    {
      boxType: "polychrome",
      displayName: "Jornada Galar",
      category: "holo",
      priceCoins: 280,
      imageUrl: "/boxArt/journeyGalar.svg",
      rarityWeights: { common: 35, uncommon: 30, rare: 18, epic: 11, legendary: 6 }
    },
    {
      boxType: "marbled",
      displayName: "Jornada Hisui",
      category: "holo",
      priceCoins: 360,
      imageUrl: "/boxArt/journeyHisui.svg",
      rarityWeights: { common: 30, uncommon: 29, rare: 20, epic: 13, legendary: 8 }
    },
    {
      boxType: "engrave",
      displayName: "Jornada Paldea",
      category: "holo",
      priceCoins: 430,
      imageUrl: "/boxArt/journeyPaldea.svg",
      rarityWeights: { common: 24, uncommon: 30, rare: 22, epic: 14, legendary: 10 }
    },
    {
      boxType: "jaina",
      displayName: "Elite BattleLeague",
      category: "holo",
      priceCoins: 520,
      imageUrl: "/boxArt/eliteKanto.svg",
      rarityWeights: { common: 20, uncommon: 28, rare: 24, epic: 16, legendary: 12 }
    },
    {
      boxType: "katana",
      displayName: "Elite Johto",
      category: "holo",
      priceCoins: 650,
      imageUrl: "/boxArt/eliteJohto.svg",
      rarityWeights: { common: 16, uncommon: 27, rare: 24, epic: 18, legendary: 15 }
    },
    {
      boxType: "mantis",
      displayName: "Elite Hoenn",
      category: "holo",
      priceCoins: 760,
      imageUrl: "/boxArt/eliteHoenn.svg",
      rarityWeights: { common: 13, uncommon: 25, rare: 25, epic: 20, legendary: 17 }
    },
    {
      boxType: "anders",
      displayName: "Elite Sinnoh",
      category: "holo",
      priceCoins: 880,
      imageUrl: "/boxArt/eliteSinnoh.svg",
      rarityWeights: { common: 11, uncommon: 24, rare: 25, epic: 20, legendary: 20 }
    },
    {
      boxType: "strange",
      displayName: "Elite Unova",
      category: "holo",
      priceCoins: 1080,
      imageUrl: "/boxArt/eliteUnova.svg",
      rarityWeights: { common: 8, uncommon: 22, rare: 26, epic: 21, legendary: 23 }
    },
    {
      boxType: "david",
      displayName: "Mestre Pokemon",
      category: "holo",
      priceCoins: 1300,
      imageUrl: "/boxArt/masterPokemon.svg",
      rarityWeights: { common: 6, uncommon: 20, rare: 26, epic: 22, legendary: 26 }
    }
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async getProgress(userId: string) {
    const [user, lootBoxStates] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userLootBoxState.findMany({
        where: { userId },
        select: {
          boxType: true,
          pityCounter: true,
          dailyShopPurchases: true,
          dailyShopPurchasedAt: true
        }
      })
    ]);
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    const now = new Date();
    const normalizedStates = this.lootBoxCatalog.map((box) => {
      const state = lootBoxStates.find((item) => item.boxType === box.boxType);
      const consumedToday = this.isSameUtcDay(state?.dailyShopPurchasedAt ?? null, now) ? state?.dailyShopPurchases ?? 0 : 0;
      return {
        boxType: box.boxType,
        pityCounter: state?.pityCounter ?? 0,
        dailyShopPurchases: consumedToday,
        dailyShopRemaining: Math.max(0, this.dailyShopLimit - consumedToday)
      };
    });
    return {
      userId: user.id,
      level: user.level,
      xp: user.xp,
      coins: user.coins,
      fragments: user.pokemonFragments,
      dailyShopLimit: this.dailyShopLimit,
      lootBoxStates: normalizedStates
    };
  }

  async getLootEconomy(userId: string) {
    const [user, history, lootBoxStates, historyAuditLogs, cachedCatalog] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          coins: true,
          pokemonFragments: true
        }
      }),
      this.prisma.lootBoxOpen.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20
      }),
      this.prisma.userLootBoxState.findMany({
        where: { userId },
        select: {
          boxType: true,
          pityCounter: true,
          dailyShopPurchases: true,
          dailyShopPurchasedAt: true
        }
      }),
      this.prisma.auditLog.findMany({
        where: {
          actorUserId: userId,
          action: "LootBoxOpened",
          entityName: "LootBoxOpen"
        },
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      this.getCachedLootEconomyCatalog()
    ]);
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    const now = new Date();
    const normalizedStates = this.lootBoxCatalog.map((box) => {
      const state = lootBoxStates.find((item) => item.boxType === box.boxType);
      const consumedToday = this.isSameUtcDay(state?.dailyShopPurchasedAt ?? null, now) ? state?.dailyShopPurchases ?? 0 : 0;
      return {
        boxType: box.boxType,
        pityCounter: state?.pityCounter ?? 0,
        dailyShopPurchases: consumedToday,
        dailyShopRemaining: Math.max(0, this.dailyShopLimit - consumedToday)
      };
    });
    const rewardLevelByOpeningId = new Map<string, number | null>();
    historyAuditLogs.forEach((log) => {
      if (!log.entityId || !log.payload) {
        return;
      }
      try {
        const parsedPayload = JSON.parse(log.payload) as { rewardLevel?: unknown };
        const rawRewardLevel = parsedPayload.rewardLevel;
        if (typeof rawRewardLevel === "number" && Number.isFinite(rawRewardLevel)) {
          rewardLevelByOpeningId.set(log.entityId, Math.max(1, Math.floor(rawRewardLevel)));
        }
      } catch {
        return;
      }
    });
    return {
      user,
      dailyShopLimit: this.dailyShopLimit,
      lootPriceCoins: this.lootBoxCatalog[0]?.priceCoins ?? 40,
      lootBoxCatalog: this.lootBoxCatalog,
      lootBoxStates: normalizedStates,
      boxDropPreview: cachedCatalog.boxDropPreview,
      history: history.map((entry) => ({
        ...entry,
        rewardLevel: rewardLevelByOpeningId.get(entry.id) ?? this.extractRewardLevelFromRewardValue(entry.rewardValue)
      }))
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

    const { completed, user } = await this.prisma.$transaction(async (tx) => {
      const markClaimed = await tx.userQuest.updateMany({
        where: {
          id: quest.id,
          status: {
            not: QuestStatus.claimed
          }
        },
        data: {
          progress: quest.target,
          status: QuestStatus.claimed
        }
      });
      if (markClaimed.count === 0) {
        throw new BadRequestException("questAlreadyClaimed");
      }
      const completedQuest = await tx.userQuest.findUnique({
        where: { id: quest.id }
      });
      if (!completedQuest) {
        throw new NotFoundException("questNotFound");
      }
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          xp: { increment: completedQuest.rewardXp },
          coins: { increment: completedQuest.rewardCoins }
        }
      });
      return {
        completed: completedQuest,
        user: updatedUser
      };
    });

    const questBonus = this.getQuestBonusByCode(dto.questCode);
    let lootRewards: Array<Awaited<ReturnType<ProgressionService["openLootBox"]>>> = [];
    if (questBonus.fragments > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { pokemonFragments: { increment: questBonus.fragments } }
      });
    }
    if (questBonus.lootBoxes > 0) {
      for (let i = 0; i < questBonus.lootBoxes; i += 1) {
        const loot = await this.openLootBox(userId, {
          requestId: `quest-${dto.questCode}-${Date.now()}-${i}`
        });
        lootRewards.push(loot);
      }
    }

    const leveled = await this.applyLevelUp(userId, user.xp);
    await this.auditService.write({
      actorUserId: userId,
      action: "QuestCompleted",
      entityName: "UserQuest",
      entityId: completed.id,
      payload: { questCode: dto.questCode, questBonus }
    });
    return {
      quest: completed,
      user: leveled,
      bonus: questBonus,
      lootRewards
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

  async openLootBox(userId: string, dto?: OpenLootBoxDto) {
    if (dto?.requestId) {
      const existing = await this.prisma.lootBoxOpen.findFirst({
        where: { userId, requestId: dto.requestId }
      });
      if (existing) {
        return {
          idempotentReplay: true,
          opening: existing,
          rewardLevel: this.extractRewardLevelFromRewardValue(existing.rewardValue)
        };
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pokemonFragments: true }
    });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }

    const selectedBoxType = this.normalizeBoxType(dto?.boxType);
    const boxConfig = this.getLootBoxConfig(selectedBoxType);
    const lootBoxState = await this.prisma.userLootBoxState.upsert({
      where: {
        userId_boxType: {
          userId,
          boxType: selectedBoxType
        }
      },
      update: {},
      create: {
        userId,
        boxType: selectedBoxType
      }
    });
    const pityBefore = Math.max(0, lootBoxState.pityCounter);
    const allSpecies = await this.prisma.pokemonSpecies.findMany({ take: 1025 });
    const normalizedSpecies = this.dedupeSpeciesCatalog(allSpecies);
    if (normalizedSpecies.length === 0) {
      throw new BadRequestException("speciesCatalogEmpty");
    }

    const eligibleSpecies = this.getEligibleSpeciesForBox(normalizedSpecies, boxConfig);
    const availableRarities = this.getAvailableRaritiesForBox(eligibleSpecies, selectedBoxType);
    const rarity = this.rollRarityWithPity(pityBefore, boxConfig.rarityWeights, selectedBoxType, availableRarities);
    const rarityPool = this.getSpeciesPoolForRarity(eligibleSpecies, rarity, selectedBoxType);
    const finalPool = rarityPool.length > 0 ? rarityPool : eligibleSpecies;
    const owned = await this.prisma.userPokemon.findMany({
      where: { userId },
      select: { speciesId: true }
    });
    const ownedSet = new Set(owned.map((item) => item.speciesId));
    const nonOwnedPool = finalPool.filter((item) => !ownedSet.has(item.id));
    const antiDuplicatePool = nonOwnedPool.length > 0 ? nonOwnedPool : finalPool;
    const selected = this.pickWeightedSpecies(antiDuplicatePool, normalizedSpecies);
    const rewardLevel = this.rollPokemonLevelByChance(boxConfig.priceCoins);
    const isDuplicate = ownedSet.has(selected.id);
    const fragmentGain = isDuplicate ? this.getFragmentGainByRarity(rarity) : 0;
    const pityAfter = this.isRareOrBetter(rarity) ? 0 : pityBefore + 1;

    let opening:
      | {
          id: string;
          rewardType: string;
          rewardValue: string;
          rewardRarity: string | null;
          fragmentGain: number;
          pityBefore: number;
          pityAfter: number;
        }
      | null = null;
    let createdPokemonId: string | null = null;
    try {
      const transactionResult = await this.prisma.$transaction(async (tx) => {
        let localCreatedPokemonId: string | null = null;
        if (!isDuplicate) {
          const lootboxStats = this.getStatsForLevel(
            {
              baseHp: selected.baseHp,
              baseAtk: selected.baseAtk,
              baseDef: selected.baseDef,
              baseSpeed: selected.baseSpeed
            },
            rewardLevel
          );
          const createdPokemon = await tx.userPokemon.create({
            data: {
              userId,
              speciesId: selected.id,
              level: rewardLevel,
              currentHp: lootboxStats.currentHp,
              atk: lootboxStats.atk,
              def: lootboxStats.def,
              speed: lootboxStats.speed
            }
          });
          localCreatedPokemonId = createdPokemon.id;
        }

        const createdOpening = await tx.lootBoxOpen.create({
          data: {
            userId,
            boxType: selectedBoxType,
            requestId: dto?.requestId ?? null,
            rewardRarity: rarity,
            rewardType: isDuplicate ? "fragments" : "pokemon",
            rewardValue: selected.name,
            fragmentGain,
            wasDuplicate: isDuplicate,
            pityBefore,
            pityAfter
          }
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            pokemonFragments: { increment: fragmentGain }
          }
        });
        await tx.userLootBoxState.update({
          where: {
            userId_boxType: {
              userId,
              boxType: selectedBoxType
            }
          },
          data: {
            pityCounter: pityAfter
          }
        });
        return {
          opening: createdOpening,
          createdPokemonId: localCreatedPokemonId
        };
      });
      opening = transactionResult.opening;
      createdPokemonId = transactionResult.createdPokemonId;
    } catch (error: unknown) {
      if (
        dto?.requestId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existingOpening = await this.prisma.lootBoxOpen.findFirst({
          where: { userId, requestId: dto.requestId }
        });
        if (existingOpening) {
          return {
            idempotentReplay: true,
            opening: existingOpening,
            rewardLevel: this.extractRewardLevelFromRewardValue(existingOpening.rewardValue)
          };
        }
      }
      throw error;
    }
    if (!opening) {
      throw new BadRequestException("lootBoxOpenFailed");
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "LootBoxOpened",
      entityName: "LootBoxOpen",
      entityId: opening.id,
      payload: {
        boxType: selectedBoxType,
        rarity,
        rewardType: opening.rewardType,
        rewardValue: opening.rewardValue,
        rewardLevel,
        fragmentGain,
        pityBefore,
        pityAfter,
        createdPokemonId
      }
    });

    return {
      idempotentReplay: false,
      opening,
      rewardLevel,
      createdPokemonId
    };
  }

  async buyLootBoxes(userId: string, dto: BuyLootBoxDto) {
    const quantity = dto.quantity ?? 1;
    const selectedBoxType = this.normalizeBoxType(dto.boxType);
    const boxConfig = this.getLootBoxConfig(selectedBoxType);
    const [user, lootBoxState, cachedCatalog, owned] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          coins: true
        }
      }),
      this.prisma.userLootBoxState.upsert({
        where: {
          userId_boxType: {
            userId,
            boxType: selectedBoxType
          }
        },
        update: {},
        create: {
          userId,
          boxType: selectedBoxType
        }
      }),
      this.getCachedLootEconomyCatalog(),
      this.prisma.userPokemon.findMany({
        where: { userId },
        select: { speciesId: true }
      })
    ]);
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    const now = new Date();
    const isSameDay = this.isSameUtcDay(lootBoxState.dailyShopPurchasedAt, now);
    const consumedToday = isSameDay ? lootBoxState.dailyShopPurchases : 0;
    if (consumedToday + quantity > this.dailyShopLimit) {
      throw new BadRequestException("dailyLootBoxLimitReached");
    }
    const totalCost = quantity * boxConfig.priceCoins;
    if (user.coins < totalCost) {
      throw new BadRequestException("insufficientCoins");
    }
    const normalizedSpecies = cachedCatalog.normalizedSpecies;
    if (normalizedSpecies.length === 0) {
      throw new BadRequestException("speciesCatalogEmpty");
    }
    const eligibleSpecies = this.getEligibleSpeciesForBox(normalizedSpecies, boxConfig);
    const availableRarities = this.getAvailableRaritiesForBox(eligibleSpecies, selectedBoxType);
    const ownedSet = new Set(owned.map((item) => item.speciesId));
    let currentPityCounter = Math.max(0, lootBoxState.pityCounter);
    const plannedOpenings: Array<{
      requestId: string;
      rarity: RarityKey;
      selectedSpecies: (typeof normalizedSpecies)[number];
      rewardLevel: number;
      isDuplicate: boolean;
      fragmentGain: number;
      pityBefore: number;
      pityAfter: number;
    }> = [];
    for (let i = 0; i < quantity; i += 1) {
      const pityBefore = currentPityCounter;
      const rarity = this.rollRarityWithPity(pityBefore, boxConfig.rarityWeights, selectedBoxType, availableRarities) as RarityKey;
      const rarityPool = this.getSpeciesPoolForRarity(eligibleSpecies, rarity, selectedBoxType);
      const finalPool = rarityPool.length > 0 ? rarityPool : eligibleSpecies;
      const nonOwnedPool = finalPool.filter((item) => !ownedSet.has(item.id));
      const antiDuplicatePool = nonOwnedPool.length > 0 ? nonOwnedPool : finalPool;
      const selectedSpecies = this.pickWeightedSpecies(antiDuplicatePool, normalizedSpecies);
      const isDuplicate = ownedSet.has(selectedSpecies.id);
      if (!isDuplicate) {
        ownedSet.add(selectedSpecies.id);
      }
      const fragmentGain = isDuplicate ? this.getFragmentGainByRarity(rarity) : 0;
      const pityAfter = this.isRareOrBetter(rarity) ? 0 : pityBefore + 1;
      const rewardLevel = this.rollPokemonLevelByChance(boxConfig.priceCoins);
      const requestId = dto.requestId ? `${dto.requestId}-${i}` : `shop-${Date.now()}-${i}`;
      plannedOpenings.push({
        requestId,
        rarity,
        selectedSpecies,
        rewardLevel,
        isDuplicate,
        fragmentGain,
        pityBefore,
        pityAfter
      });
      currentPityCounter = pityAfter;
    }
    const totalFragmentGain = plannedOpenings.reduce((total, item) => total + item.fragmentGain, 0);
    const openings = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          coins: { decrement: totalCost },
          pokemonFragments: { increment: totalFragmentGain }
        }
      });
      await tx.userLootBoxState.update({
        where: {
          userId_boxType: {
            userId,
            boxType: selectedBoxType
          }
        },
        data: {
          dailyShopPurchases: consumedToday + quantity,
          dailyShopPurchasedAt: now,
          pityCounter: currentPityCounter
        }
      });
      const txOpenings: Array<Awaited<ReturnType<ProgressionService["openLootBox"]>>> = [];
      for (const planned of plannedOpenings) {
        let createdPokemonId: string | null = null;
        if (!planned.isDuplicate) {
          const lootboxStats = this.getStatsForLevel(
            {
              baseHp: planned.selectedSpecies.baseHp,
              baseAtk: planned.selectedSpecies.baseAtk,
              baseDef: planned.selectedSpecies.baseDef,
              baseSpeed: planned.selectedSpecies.baseSpeed
            },
            planned.rewardLevel
          );
          const createdPokemon = await tx.userPokemon.create({
            data: {
              userId,
              speciesId: planned.selectedSpecies.id,
              level: planned.rewardLevel,
              currentHp: lootboxStats.currentHp,
              atk: lootboxStats.atk,
              def: lootboxStats.def,
              speed: lootboxStats.speed
            }
          });
          createdPokemonId = createdPokemon.id;
        }
        const opening = await tx.lootBoxOpen.create({
          data: {
            userId,
            boxType: selectedBoxType,
            requestId: planned.requestId,
            rewardRarity: planned.rarity,
            rewardType: planned.isDuplicate ? "fragments" : "pokemon",
            rewardValue: planned.selectedSpecies.name,
            fragmentGain: planned.fragmentGain,
            wasDuplicate: planned.isDuplicate,
            pityBefore: planned.pityBefore,
            pityAfter: planned.pityAfter
          }
        });
        txOpenings.push({
          idempotentReplay: false,
          opening,
          rewardLevel: planned.rewardLevel,
          createdPokemonId
        });
      }
      return txOpenings;
    });
    for (const opened of openings) {
      await this.auditService.write({
        actorUserId: userId,
        action: "LootBoxOpened",
        entityName: "LootBoxOpen",
        entityId: opened.opening.id,
        payload: {
          boxType: selectedBoxType,
          rarity: opened.opening.rewardRarity,
          rewardType: opened.opening.rewardType,
          rewardValue: opened.opening.rewardValue,
          rewardLevel: opened.rewardLevel,
          fragmentGain: opened.opening.fragmentGain,
          pityBefore: opened.opening.pityBefore,
          pityAfter: opened.opening.pityAfter,
          createdPokemonId: opened.createdPokemonId
        }
      });
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "LootBoxShopPurchase",
      entityName: "User",
      entityId: userId,
      payload: { quantity, totalCost, boxType: selectedBoxType }
    });

    return {
      quantity,
      totalCost,
      boxType: selectedBoxType,
      openings
    };
  }

  async claimEventReward(userId: string, dto: ClaimEventRewardDto) {
    const event = this.getEventConfig(dto.eventCode);
    const now = new Date();
    const dayKey = this.toDayKey(now);
    const existing = await this.prisma.progressionEventClaim.findUnique({
      where: {
        userId_eventCode_dayKey: {
          userId,
          eventCode: event.eventCode,
          dayKey
        }
      }
    });
    if (existing) {
      throw new BadRequestException("eventRewardAlreadyClaimedToday");
    }

    await this.prisma.progressionEventClaim.create({
      data: {
        userId,
        eventCode: event.eventCode,
        dayKey,
        rewardType: "bundle",
        rewardValue: JSON.stringify(event)
      }
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: { increment: event.xp },
        coins: { increment: event.coins },
        pokemonFragments: { increment: event.fragments }
      }
    });

    const openings: Array<Awaited<ReturnType<ProgressionService["openLootBox"]>>> = [];
    for (let i = 0; i < event.lootBoxes; i += 1) {
      const requestId = dto.requestId ? `${dto.requestId}-${i}` : `event-${event.eventCode}-${Date.now()}-${i}`;
      const result = await this.openLootBox(userId, { requestId, boxType: "fiesta" });
      openings.push(result);
    }

    await this.auditService.write({
      actorUserId: userId,
      action: "ProgressionEventClaimed",
      entityName: "ProgressionEventClaim",
      payload: { eventCode: event.eventCode, dayKey }
    });

    return {
      eventCode: event.eventCode,
      rewards: event,
      openings
    };
  }

  async craftPokemon(userId: string, dto: CraftPokemonDto) {
    const allSpecies = await this.prisma.pokemonSpecies.findMany({ take: 1025 });
    const target = allSpecies.find(
      (item) => item.name.trim().toLowerCase() === dto.speciesName.trim().toLowerCase()
    );
    if (!target) {
      throw new NotFoundException("speciesNotFound");
    }
    const rarity = this.normalizeRarity(target.dropRarity, target.pokeApiId);
    const cost = this.getCraftCostByRarity(rarity);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pokemonFragments: true }
    });
    if (!user) {
      throw new NotFoundException("userNotFound");
    }
    if (user.pokemonFragments < cost) {
      throw new BadRequestException("insufficientFragments");
    }

    const stats = this.getStatsForLevel(
      {
        baseHp: target.baseHp,
        baseAtk: target.baseAtk,
        baseDef: target.baseDef,
        baseSpeed: target.baseSpeed
      },
      1
    );

    const [pokemon] = await this.prisma.$transaction([
      this.prisma.userPokemon.create({
        data: {
          userId,
          speciesId: target.id,
          currentHp: stats.currentHp,
          atk: stats.atk,
          def: stats.def,
          speed: stats.speed
        },
        include: { species: true }
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { pokemonFragments: { decrement: cost } }
      })
    ]);

    await this.auditService.write({
      actorUserId: userId,
      action: "PokemonCrafted",
      entityName: "UserPokemon",
      entityId: pokemon.id,
      payload: { speciesName: target.name, rarity, cost }
    });

    return {
      pokemon,
      rarity,
      cost
    };
  }

  async upgradePokemon(userId: string, dto: UpgradePokemonDto) {
    const normalizedSourceIds = Array.from(new Set((dto.sourcePokemonIds ?? []).map((value) => value.trim()).filter((value) => value.length > 0)));
    const normalizedTargetSpeciesNames = Array.from(
      new Set((dto.targetSpeciesNames ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
    );
    if (
      normalizedSourceIds.length < 2 ||
      normalizedSourceIds.length > 15 ||
      normalizedTargetSpeciesNames.length < 1 ||
      normalizedTargetSpeciesNames.length > 15
    ) {
      throw new BadRequestException("upgradePayloadInvalid");
    }
    const sourcePokemons = await this.prisma.userPokemon.findMany({
      where: {
        id: { in: normalizedSourceIds },
        userId
      },
      include: { species: true }
    });
    if (sourcePokemons.length !== normalizedSourceIds.length) {
      throw new NotFoundException("sourcePokemonNotFound");
    }
    if (sourcePokemons.some((item) => item.isLegacy)) {
      throw new BadRequestException("sourcePokemonAlreadyLegacy");
    }
    const sourceOrder = new Map(normalizedSourceIds.map((pokemonId, index) => [pokemonId, index]));
    const orderedSourcePokemons = [...sourcePokemons].sort(
      (left, right) => (sourceOrder.get(left.id) ?? 0) - (sourceOrder.get(right.id) ?? 0)
    );
    const targetSpeciesPool = await this.prisma.pokemonSpecies.findMany({
      where: { name: { in: normalizedTargetSpeciesNames } }
    });
    if (targetSpeciesPool.length !== normalizedTargetSpeciesNames.length) {
      throw new NotFoundException("targetSpeciesNotFound");
    }
    const targetOrder = new Map(normalizedTargetSpeciesNames.map((name, index) => [name, index]));
    const orderedTargetSpeciesPool = [...targetSpeciesPool].sort(
      (left, right) => (targetOrder.get(left.name) ?? 0) - (targetOrder.get(right.name) ?? 0)
    );
    if (orderedTargetSpeciesPool.some((targetSpecies) => orderedSourcePokemons.some((item) => item.speciesId === targetSpecies.id))) {
      throw new BadRequestException("upgradeTargetMustBeDifferent");
    }
    const rolledTargetSpecies = orderedTargetSpeciesPool[Math.floor(Math.random() * orderedTargetSpeciesPool.length)] ?? orderedTargetSpeciesPool[0];
    if (!rolledTargetSpecies) {
      throw new NotFoundException("targetSpeciesNotFound");
    }
    const sourcePokemonIds = orderedSourcePokemons.map((item) => item.id);
    const sourceSummary = orderedSourcePokemons.map((item) => ({
      id: item.id,
      name: item.species.name,
      rarity: this.normalizeRarity(item.species.dropRarity, item.species.pokeApiId),
      level: item.level,
      baseHp: item.species.baseHp,
      baseAtk: item.species.baseAtk,
      baseDef: item.species.baseDef,
      baseSpeed: item.species.baseSpeed
    }));
    const sourceLevels = sourceSummary.map((item) => item.level);
    const sourceLevelAverage = Math.max(1, Math.round(sourceLevels.reduce((sum, level) => sum + level, 0) / Math.max(1, sourceLevels.length)));
    const rewardLevel = this.getUpgradeRewardLevel();
    const targetRarity = this.normalizeRarity(rolledTargetSpecies.dropRarity, rolledTargetSpecies.pokeApiId);
    const chancePercent = this.getUpgradeChancePercentBySources(
      sourceSummary,
      {
        rarity: targetRarity,
        level: sourceLevelAverage,
        baseHp: rolledTargetSpecies.baseHp,
        baseAtk: rolledTargetSpecies.baseAtk,
        baseDef: rolledTargetSpecies.baseDef,
        baseSpeed: rolledTargetSpecies.baseSpeed
      }
    );
    const rollPercent = Math.random() * 100;
    const success = rollPercent <= chancePercent;
    const stats = this.getStatsForLevel(
      {
        baseHp: rolledTargetSpecies.baseHp,
        baseAtk: rolledTargetSpecies.baseAtk,
        baseDef: rolledTargetSpecies.baseDef,
        baseSpeed: rolledTargetSpecies.baseSpeed
      },
      rewardLevel
    );
    let createdPokemon: Awaited<ReturnType<typeof this.prisma.userPokemon.create>> | null = null;
    try {
      createdPokemon = await this.prisma.$transaction(async (tx) => {
        const consumed = await tx.userPokemon.updateMany({
          where: {
            id: { in: sourcePokemonIds },
            userId,
            isLegacy: false
          },
          data: {
            isLegacy: true
          }
        });
        if (consumed.count !== sourcePokemonIds.length) {
          throw new BadRequestException("sourcePokemonUnavailable");
        }
        if (!success) {
          return null;
        }
        return tx.userPokemon.create({
          data: {
            userId,
            speciesId: rolledTargetSpecies.id,
            level: rewardLevel,
            currentHp: stats.currentHp,
            atk: stats.atk,
            def: stats.def,
            speed: stats.speed
          },
          include: { species: true }
        });
      });
    } catch (error) {
      throw error;
    }
    await this.auditService.write({
      actorUserId: userId,
      action: "PokemonUpgradeRolled",
      entityName: "UserPokemon",
      entityId: sourcePokemonIds[0] ?? "",
      payload: {
        requestId: dto.requestId ?? null,
        sourcePokemonIds,
        sourceCount: sourceSummary.length,
        sourceSpeciesList: sourceSummary.map((item) => item.name),
        sourceRarityList: sourceSummary.map((item) => item.rarity),
        targetSpeciesPool: orderedTargetSpeciesPool.map((item) => item.name),
        targetSpecies: rolledTargetSpecies.name,
        targetRarity,
        chancePercent: Math.round(chancePercent * 100) / 100,
        rollPercent: Math.round(rollPercent * 100) / 100,
        success,
        createdPokemonId: createdPokemon?.id ?? null
      }
    });
    return {
      success,
      chancePercent: Math.round(chancePercent * 100) / 100,
      rollPercent: Math.round(rollPercent * 100) / 100,
      sourceCount: sourceSummary.length,
      sources: sourceSummary.map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity,
        level: item.level
      })),
      target: {
        id: rolledTargetSpecies.id,
        name: rolledTargetSpecies.name,
        rarity: targetRarity
      },
      reward: createdPokemon
    };
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

  private getQuestBonusByCode(questCode: string) {
    const key = questCode.trim().toLowerCase();
    if (key === "winfirstbattle") {
      return { fragments: 20, lootBoxes: 1 };
    }
    if (key === "openfirstlootbox") {
      return { fragments: 10, lootBoxes: 0 };
    }
    return { fragments: 4, lootBoxes: 0 };
  }

  private async getCachedLootEconomyCatalog() {
    const nowMs = Date.now();
    if (this.lootEconomyCatalogCache && this.lootEconomyCatalogCache.expiresAtMs > nowMs) {
      return this.lootEconomyCatalogCache;
    }
    const allSpecies = await this.prisma.pokemonSpecies.findMany({
      select: {
        id: true,
        name: true,
        pokeApiId: true,
        imageUrl: true,
        dropRarity: true,
        evolutionTarget: true,
        baseHp: true,
        baseAtk: true,
        baseDef: true,
        baseSpeed: true
      },
      take: 1025
    });
    const normalizedSpecies = this.dedupeSpeciesCatalog(allSpecies);
    const nextCache = {
      expiresAtMs: nowMs + this.lootEconomyCacheTtlMs,
      normalizedSpecies,
      boxDropPreview: this.buildBoxDropPreview(normalizedSpecies)
    };
    this.lootEconomyCatalogCache = nextCache;
    return nextCache;
  }

  private getEventConfig(eventCode: string) {
    const normalized = eventCode.trim().toLowerCase();
    const table: Record<string, { eventCode: string; xp: number; coins: number; fragments: number; lootBoxes: number }> = {
      dailywin: { eventCode: "dailyWin", xp: 30, coins: 25, fragments: 12, lootBoxes: 1 },
      weeklyclash: { eventCode: "weeklyClash", xp: 80, coins: 60, fragments: 40, lootBoxes: 2 },
      comeback: { eventCode: "comeback", xp: 40, coins: 30, fragments: 20, lootBoxes: 1 }
    };
    const found = table[normalized];
    if (!found) {
      throw new BadRequestException("eventCodeInvalid");
    }
    return found;
  }

  private normalizeRarity(value?: string | null, pokeApiId?: number | null) {
    const key = (value ?? "common").trim().toLowerCase();
    const explicitRarity: RarityKey =
      key === "legendary" || key === "epic" || key === "rare" || key === "uncommon" || key === "common"
        ? (key as RarityKey)
        : "common";
    const derivedRarity: RarityKey =
      typeof pokeApiId === "number" && Number.isFinite(pokeApiId) ? this.getRarityByPokeApiId(pokeApiId) : "common";
    return this.getRarityScore(derivedRarity) > this.getRarityScore(explicitRarity) ? derivedRarity : explicitRarity;
  }

  private getRarityByPokeApiId(pokeApiId: number): RarityKey {
    if (pokeApiId >= 821) {
      return "legendary";
    }
    if (pokeApiId >= 616) {
      return "epic";
    }
    if (pokeApiId >= 411) {
      return "rare";
    }
    if (pokeApiId >= 206) {
      return "uncommon";
    }
    return "common";
  }

  private normalizeBoxType(value?: string | null) {
    const normalized = (value ?? this.lootBoxCatalog[0]?.boxType ?? "fiesta").trim().toLowerCase();
    const exists = this.lootBoxCatalog.some((item) => item.boxType === normalized);
    return exists ? normalized : this.lootBoxCatalog[0]?.boxType ?? "fiesta";
  }

  private getLootBoxConfig(boxType: string) {
    const selected = this.lootBoxCatalog.find((item) => item.boxType === boxType);
    if (selected) {
      return selected;
    }
    return {
      boxType: "fiesta",
      displayName: "Inicio BattleLeague",
      category: "specials",
      priceCoins: 40,
      imageUrl: "https://key-drop.com/uploads/skins/FIESTA.png",
      rarityWeights: { common: 62, uncommon: 25, rare: 9, epic: 3, legendary: 1 }
    };
  }

  private getEligibleSpeciesForBox<T extends { id: string; pokeApiId: number; name: string; dropRarity?: string | null }>(
    allSpecies: T[],
    boxConfig: { boxType: string; priceCoins: number }
  ): T[] {
    const deduped = this.dedupeSpeciesCatalog(allSpecies);
    const sorted = [...deduped].sort((a, b) => a.pokeApiId - b.pokeApiId);
    const maxByRarity = this.getMaxPokeApiIdByRarityForPrice(boxConfig.priceCoins);
    const floorByRarity = this.getMinPokeApiIdByRarityForBox(boxConfig.boxType);
    const filtered = sorted.filter((item) => {
      const rarity = this.normalizeRarity(item.dropRarity, item.pokeApiId) as RarityKey;
      const minPokeApiId = floorByRarity[rarity];
      const maxPokeApiId = Math.max(minPokeApiId, maxByRarity[rarity]);
      return item.pokeApiId >= minPokeApiId && item.pokeApiId <= maxPokeApiId;
    });
    return filtered.length > 0 ? filtered : sorted;
  }

  private buildBoxDropPreview(
    allSpecies: Array<{ id: string; name: string; pokeApiId: number; imageUrl: string | null; dropRarity: string; evolutionTarget?: string | null }>
  ) {
    const deduped = this.dedupeSpeciesCatalog(allSpecies);
    return this.lootBoxCatalog.map((box) => {
      const eligible = this.getEligibleSpeciesForBox(deduped, box);
      const rarityOrder: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
      const availableRarities = this.getAvailableRaritiesForBox(eligible, box.boxType);
      const balancedWeights = this.applyRarityChanceTuning(box.rarityWeights, box.boxType);
      const effectiveWeights = this.getEffectiveRarityWeights(balancedWeights, availableRarities);
      const totalWeight = rarityOrder.reduce((sum, rarity) => sum + effectiveWeights[rarity], 0);
      const drops = rarityOrder.map((rarity) => {
        const rarityPool = this.getSpeciesPoolForRarity(eligible, rarity, box.boxType);
        const rarityChancePercent = totalWeight > 0 ? Math.round((effectiveWeights[rarity] / totalWeight) * 1000) / 10 : 0;
        const previewPool = rarityPool
          .map((item) => ({
            item,
            weight: this.getSpeciesDropWeight(item, deduped)
          }));
        const previewTotalWeight = previewPool.reduce((sum, entry) => sum + entry.weight, 0);
        const pool = previewPool
          .map((item) => ({
            name: item.item.name,
            imageUrl: item.item.imageUrl,
            chancePercent: previewTotalWeight > 0 ? Math.round(((rarityChancePercent * item.weight) / previewTotalWeight) * 100000) / 100000 : 0
          }));
        return {
          rarity,
          chancePercent: rarityChancePercent,
          species: pool
        };
      });
      return {
        boxType: box.boxType,
        displayName: box.displayName,
        category: box.category,
        priceCoins: box.priceCoins,
        imageUrl: box.imageUrl,
        drops
      };
    });
  }

  private getSpeciesPoolForRarity<T extends { dropRarity: string; name: string }>(eligibleSpecies: T[], rarity: string, boxType?: string): T[] {
    const fromEligible = eligibleSpecies.filter((item) => this.normalizeRarity(item.dropRarity, (item as T & { pokeApiId?: number }).pokeApiId) === rarity);
    if (fromEligible.length > 0) {
      return this.limitSpeciesPoolForBox(fromEligible, rarity, boxType);
    }
    return [];
  }

  private limitSpeciesPoolForBox<T extends { name: string }>(pool: T[], rarity: string, boxType?: string) {
    const targetSize = this.getTargetPoolSizeForRarity(rarity as RarityKey, boxType);
    if (targetSize <= 0) {
      return [];
    }
    if (pool.length <= targetSize) {
      return pool;
    }
    const sortedPool = [...pool].sort((a, b) => a.name.localeCompare(b.name));
    const boxIndex = Math.max(0, this.lootBoxCatalog.findIndex((item) => item.boxType === boxType));
    const raritySeed = this.getRaritySeed(rarity as RarityKey);
    const startIndex = ((boxIndex + 1) * raritySeed) % sortedPool.length;
    const selectedPool: T[] = [];
    for (let cursor = 0; cursor < sortedPool.length && selectedPool.length < targetSize; cursor += 1) {
      const nextItem = sortedPool[(startIndex + cursor) % sortedPool.length];
      if (!selectedPool.some((item) => item.name === nextItem.name)) {
        selectedPool.push(nextItem);
      }
    }
    return selectedPool;
  }

  private getTargetPoolSizeForRarity(rarity: RarityKey, boxType?: string) {
    if (rarity === "common") {
      return 12;
    }
    if (rarity === "uncommon") {
      return 6;
    }
    if (rarity === "rare") {
      return 2;
    }
    const useLegendarySlot = this.shouldUseLegendarySlotForBox(boxType);
    if (rarity === "epic") {
      return useLegendarySlot ? 0 : 2;
    }
    if (rarity === "legendary") {
      return useLegendarySlot ? 1 : 0;
    }
    return 0;
  }

  private getRaritySeed(rarity: RarityKey) {
    if (rarity === "common") {
      return 5;
    }
    if (rarity === "uncommon") {
      return 7;
    }
    if (rarity === "rare") {
      return 11;
    }
    if (rarity === "epic") {
      return 13;
    }
    return 17;
  }

  private shouldUseLegendarySlotForBox(_boxType?: string) {
    return this.highTierMode === "legendary";
  }

  private dedupeSpeciesCatalog<T extends { pokeApiId: number; name: string }>(allSpecies: T[]) {
    const deduped = new Map<string, T>();
    for (const species of allSpecies) {
      const key = `${species.pokeApiId}-${species.name.trim().toLowerCase()}`;
      if (!deduped.has(key)) {
        deduped.set(key, species);
      }
    }
    return [...deduped.values()];
  }

  private getMaxPokeApiIdByRarityForPrice(priceCoins: number): Record<RarityKey, number> {
    if (priceCoins <= 120) {
      return { common: 280, uncommon: 560, rare: 820, epic: 1025, legendary: 1025 };
    }
    if (priceCoins <= 360) {
      return { common: 520, uncommon: 760, rare: 920, epic: 1025, legendary: 1025 };
    }
    if (priceCoins <= 700) {
      return { common: 760, uncommon: 920, rare: 1025, epic: 1025, legendary: 1025 };
    }
    return { common: 1025, uncommon: 1025, rare: 1025, epic: 1025, legendary: 1025 };
  }

  private getMinPokeApiIdByRarityForBox(boxType: string): Record<RarityKey, number> {
    const boxIndex = Math.max(0, this.lootBoxCatalog.findIndex((item) => item.boxType === boxType));
    const base = Math.min(520, boxIndex * 28);
    return {
      common: Math.max(1, base),
      uncommon: Math.max(1, base + 20),
      rare: Math.max(1, base + 40),
      epic: Math.max(1, base + 60),
      legendary: Math.max(1, base + 80)
    };
  }

  private getAvailableRaritiesForBox<T extends { dropRarity: string; name: string }>(eligibleSpecies: T[], boxType?: string) {
    const available: Record<RarityKey, boolean> = {
      common: false,
      uncommon: false,
      rare: false,
      epic: false,
      legendary: false
    };
    const rarityOrder: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
    for (const rarity of rarityOrder) {
      const pool = this.getSpeciesPoolForRarity(eligibleSpecies, rarity, boxType);
      available[rarity] = pool.length > 0;
    }
    if (!available.common && !available.uncommon && !available.rare && !available.epic && !available.legendary) {
      available.common = true;
    }
    return available;
  }

  private getEffectiveRarityWeights(
    baseWeights: { common: number; uncommon: number; rare: number; epic: number; legendary: number },
    availableRarities: Record<RarityKey, boolean>
  ) {
    const rarityOrder: RarityKey[] = ["common", "uncommon", "rare", "epic", "legendary"];
    const availableTotal = rarityOrder.reduce((sum, rarity) => {
      if (!availableRarities[rarity]) {
        return sum;
      }
      return sum + Math.max(0, baseWeights[rarity]);
    }, 0);
    if (availableTotal <= 0) {
      return {
        common: availableRarities.common ? 100 : 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
      };
    }
    return {
      common: availableRarities.common ? baseWeights.common / availableTotal : 0,
      uncommon: availableRarities.uncommon ? baseWeights.uncommon / availableTotal : 0,
      rare: availableRarities.rare ? baseWeights.rare / availableTotal : 0,
      epic: availableRarities.epic ? baseWeights.epic / availableTotal : 0,
      legendary: availableRarities.legendary ? baseWeights.legendary / availableTotal : 0
    };
  }

  private applyRarityChanceTuning(
    _weights: { common: number; uncommon: number; rare: number; epic: number; legendary: number },
    boxType?: string
  ) {
    const useLegendarySlot = this.shouldUseLegendarySlotForBox(boxType);
    return {
      common: 82.6,
      uncommon: 13,
      rare: 3.7,
      epic: useLegendarySlot ? 0 : 0.7,
      legendary: useLegendarySlot ? 0.7 : 0
    };
  }

  private pickWeightedSpecies<T extends { name: string; evolutionTarget?: string | null }>(pool: T[], speciesCatalog: Array<{ name: string; evolutionTarget?: string | null }>) {
    if (pool.length <= 1) {
      return pool[0];
    }
    const weightedPool = pool.map((species) => ({
      species,
      weight: this.getSpeciesDropWeight(species, speciesCatalog)
    }));
    const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const roll = Math.random() * totalWeight;
    let cursor = 0;
    for (const entry of weightedPool) {
      cursor += entry.weight;
      if (roll <= cursor) {
        return entry.species;
      }
    }
    return weightedPool[weightedPool.length - 1]?.species ?? pool[0];
  }

  private getSpeciesDropWeight<T extends { name: string; evolutionTarget?: string | null }>(
    species: T,
    speciesCatalog: Array<{ name: string; evolutionTarget?: string | null }>
  ) {
    const normalizedName = species.name.trim().toLowerCase();
    const hasPreEvolution = speciesCatalog.some((entry) => entry.evolutionTarget?.trim().toLowerCase() === normalizedName);
    if (hasPreEvolution) {
      return 0.7;
    }
    return 1;
  }

  private rollRarityWithPity(
    pityCounter: number,
    baseWeights: { common: number; uncommon: number; rare: number; epic: number; legendary: number },
    boxType: string,
    availableRarities: Record<RarityKey, boolean>
  ) {
    const pityBonus = pityCounter >= 10 ? Math.min(35, (pityCounter - 9) * 5) : 0;
    const adjustedWeights = {
      common: Math.max(0, baseWeights.common),
      uncommon: Math.max(0, baseWeights.uncommon),
      rare: Math.max(0, baseWeights.rare + pityBonus * 0.6),
      epic: Math.max(0, baseWeights.epic + pityBonus * 0.3),
      legendary: Math.max(0, baseWeights.legendary + pityBonus * 0.1)
    };
    const tunedWeights = this.applyRarityChanceTuning(adjustedWeights, boxType);
    const normalizedWeights = this.getEffectiveRarityWeights(tunedWeights, availableRarities);
    const table = [
      { rarity: "common", weight: normalizedWeights.common },
      { rarity: "uncommon", weight: normalizedWeights.uncommon },
      { rarity: "rare", weight: normalizedWeights.rare },
      { rarity: "epic", weight: normalizedWeights.epic },
      { rarity: "legendary", weight: normalizedWeights.legendary }
    ];
    const total = table.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) {
      if (availableRarities.legendary) return "legendary";
      if (availableRarities.epic) return "epic";
      if (availableRarities.rare) return "rare";
      if (availableRarities.uncommon) return "uncommon";
      return "common";
    }
    const roll = Math.random() * total;
    let cursor = 0;
    for (const item of table) {
      cursor += item.weight;
      if (roll <= cursor) {
        return item.rarity;
      }
    }
    return "common";
  }

  private rollPokemonLevelByChance(priceCoins: number) {
    const levelBands =
      priceCoins <= 120
        ? [
            { min: 1, max: 12, weight: 60 },
            { min: 13, max: 20, weight: 25 },
            { min: 21, max: 30, weight: 12 },
            { min: 31, max: 40, weight: 3 }
          ]
        : priceCoins <= 360
          ? [
              { min: 1, max: 18, weight: 48 },
              { min: 19, max: 28, weight: 30 },
              { min: 29, max: 40, weight: 16 },
              { min: 41, max: 52, weight: 6 }
            ]
          : priceCoins <= 700
            ? [
                { min: 1, max: 24, weight: 40 },
                { min: 25, max: 36, weight: 30 },
                { min: 37, max: 50, weight: 20 },
                { min: 51, max: 65, weight: 10 }
              ]
            : [
                { min: 1, max: 30, weight: 30 },
                { min: 31, max: 45, weight: 30 },
                { min: 46, max: 60, weight: 24 },
                { min: 61, max: 80, weight: 12 },
                { min: 81, max: 100, weight: 4 }
              ];
    const totalWeight = levelBands.reduce((sum, band) => sum + band.weight, 0);
    const roll = Math.random() * totalWeight;
    let cursor = 0;
    for (const band of levelBands) {
      cursor += band.weight;
      if (roll <= cursor) {
        return band.min + Math.floor(Math.random() * (band.max - band.min + 1));
      }
    }
    return 1;
  }

  private extractRewardLevelFromRewardValue(rewardValue: string) {
    const match = rewardValue.match(/lv\s*(\d+)/i);
    if (!match) {
      return null;
    }
    const parsed = Number(match[1]);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(1, Math.floor(parsed));
  }

  private isRareOrBetter(rarity: string) {
    return rarity === "rare" || rarity === "epic" || rarity === "legendary";
  }

  private getFragmentGainByRarity(rarity: string) {
    if (rarity === "legendary") {
      return 64;
    }
    if (rarity === "epic") {
      return 32;
    }
    if (rarity === "rare") {
      return 16;
    }
    if (rarity === "uncommon") {
      return 8;
    }
    return 4;
  }

  private getCraftCostByRarity(rarity: string) {
    if (rarity === "legendary") {
      return 1000;
    }
    if (rarity === "epic") {
      return 620;
    }
    if (rarity === "rare") {
      return 380;
    }
    if (rarity === "uncommon") {
      return 220;
    }
    return 120;
  }

  private getUpgradeChancePercentBySources(
    sources: Array<{ rarity: string; level: number; baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }>,
    target: { rarity: string; level: number; baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }
  ) {
    if (sources.length === 0) {
      return 5;
    }
    const sourceComputed = sources.map((source) => {
      const rarityScore = this.getRarityScore(source.rarity);
      const powerScore = this.getUpgradePowerScore(source.rarity, source.level, {
        baseHp: source.baseHp,
        baseAtk: source.baseAtk,
        baseDef: source.baseDef,
        baseSpeed: source.baseSpeed
      });
      return { ...source, rarityScore, powerScore };
    });
    const targetRarityScore = this.getRarityScore(target.rarity);
    const targetPower = this.getUpgradePowerScore(target.rarity, target.level, {
      baseHp: target.baseHp,
      baseAtk: target.baseAtk,
      baseDef: target.baseDef,
      baseSpeed: target.baseSpeed
    });
    const evaluateChanceForGroup = (group: typeof sourceComputed) => {
      const sourcePowerAverage = group.reduce((sum, source) => sum + source.powerScore, 0) / Math.max(1, group.length);
      const sourceRarityAverage = group.reduce((sum, source) => sum + source.rarityScore, 0) / Math.max(1, group.length);
      const sourceLevelAverage = group.reduce((sum, source) => sum + source.level, 0) / Math.max(1, group.length);
      const powerRatio = sourcePowerAverage / Math.max(1, targetPower);
      const powerScore = powerRatio * 45;
      const rarityDelta = targetRarityScore - sourceRarityAverage;
      const rarityPenalty = rarityDelta > 0 ? rarityDelta * 14 : rarityDelta * 6;
      const levelBonus = Math.min(8, Math.max(0, sourceLevelAverage / 6));
      const quantityBonus = Math.min(12, Math.max(0, (group.length - 2) * 2));
      const nearTierCount = group.filter((source) => source.rarityScore >= targetRarityScore - 1).length;
      const synergyBonus = Math.min(10, nearTierCount * 1.5);
      const epicToLegendBoost = targetRarityScore >= 5 && sourceRarityAverage >= 3.5 ? 6 : 0;
      const downgradeBonus = rarityDelta < 0 ? Math.min(10, Math.abs(rarityDelta) * 4) : 0;
      let rawChance = 4 + powerScore - Math.max(0, rarityPenalty) + levelBonus + quantityBonus + synergyBonus + epicToLegendBoost + downgradeBonus;
      if (rarityDelta >= 3) {
        rawChance = Math.min(rawChance, 18);
      } else if (rarityDelta >= 2) {
        rawChance = Math.min(rawChance, 35);
      } else if (rarityDelta >= 1) {
        rawChance = Math.min(rawChance, 48);
      }
      if (targetRarityScore >= 5 && sourceRarityAverage < 3) {
        rawChance = Math.min(rawChance, 30);
      }
      return Math.max(1, Math.min(85, rawChance));
    };

    const sortedByStrength = [...sourceComputed].sort((left, right) => right.powerScore - left.powerScore);
    let bestChance = evaluateChanceForGroup(sortedByStrength.slice(0, Math.min(2, sortedByStrength.length)));
    for (let index = 2; index <= sortedByStrength.length; index += 1) {
      const candidateChance = evaluateChanceForGroup(sortedByStrength.slice(0, index));
      if (candidateChance > bestChance) {
        bestChance = candidateChance;
      }
    }
    return bestChance;
  }

  private getUpgradePowerScore(
    rarity: string,
    level: number,
    stats: { baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }
  ) {
    const rarityScore = this.getRarityScore(rarity);
    return stats.baseHp + stats.baseAtk + stats.baseDef + stats.baseSpeed + level * 4 + rarityScore * 60;
  }

  private getUpgradeRewardLevel() {
    return Math.max(1, Math.floor(this.maxPokemonLevel * 0.1));
  }

  private getRarityScore(rarity: string) {
    if (rarity === "legendary") {
      return 5;
    }
    if (rarity === "epic") {
      return 4;
    }
    if (rarity === "rare") {
      return 3;
    }
    if (rarity === "uncommon") {
      return 2;
    }
    return 1;
  }

  private isSameUtcDay(source: Date | null, now: Date) {
    if (!source) {
      return false;
    }
    return (
      source.getUTCFullYear() === now.getUTCFullYear() &&
      source.getUTCMonth() === now.getUTCMonth() &&
      source.getUTCDate() === now.getUTCDate()
    );
  }

  private toDayKey(source: Date) {
    const year = source.getUTCFullYear();
    const month = String(source.getUTCMonth() + 1).padStart(2, "0");
    const day = String(source.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
}
