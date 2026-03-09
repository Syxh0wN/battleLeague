import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ClaimPokemonDto } from "./dto/claim-pokemon.dto";

@Injectable()
export class PokemonService {
  private readonly maxPokemonLevel = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listSpecies() {
    return this.prisma.pokemonSpecies.findMany({
      orderBy: { pokeApiId: "asc" },
      take: 1025
    });
  }

  async listMyPokemons(userId: string) {
    const pokemons = await this.prisma.userPokemon.findMany({
      where: { userId, isLegacy: false },
      include: { species: true },
      orderBy: [{ level: "desc" }, { wins: "desc" }]
    });
    const now = new Date();
    return pokemons.map((pokemon) => {
      const ageDays = Math.max(0, Math.floor((now.getTime() - pokemon.createdAt.getTime()) / 86_400_000));
      const agePenaltyPercent = this.getAgePenaltyPercent(ageDays);
      const ageMultiplier = Math.max(0.7, 1 - agePenaltyPercent / 100);
      const effectiveAtk = Math.max(1, Math.round(pokemon.atk * ageMultiplier));
      const effectiveDef = Math.max(1, Math.round(pokemon.def * ageMultiplier));
      const effectiveSpeed = Math.max(1, Math.round(pokemon.speed * ageMultiplier));
      const xpCurrentLevelBase = this.getPokemonTotalXpForLevel(pokemon.level);
      const xpNextLevelBase = this.getPokemonTotalXpForLevel(Math.min(this.maxPokemonLevel, pokemon.level + 1));
      const xpToNextLevel = Math.max(1, xpNextLevelBase - xpCurrentLevelBase);
      const xpInCurrentLevel = Math.max(0, Math.min(xpToNextLevel, pokemon.xp - xpCurrentLevelBase));
      const xpProgressPercent = Math.max(0, Math.min(100, Math.round((xpInCurrentLevel / xpToNextLevel) * 100)));
      return {
        ...pokemon,
        ageDays,
        agePenaltyPercent,
        effectiveAtk,
        effectiveDef,
        effectiveSpeed,
        xpInCurrentLevel,
        xpToNextLevel,
        xpProgressPercent,
        lifeUtil: pokemon.lifeUtil,
        isLegacy: pokemon.isLegacy,
        lifeStage: pokemon.isLegacy ? "Legado" : pokemon.lifeUtil <= 10 ? "Critico" : pokemon.lifeUtil <= 35 ? "Baixo" : "Estavel",
        maxLevel: this.maxPokemonLevel
      };
    });
  }

  async claimStarter(userId: string, dto: ClaimPokemonDto) {
    const species = await this.prisma.pokemonSpecies.findUnique({
      where: { name: dto.speciesName.toLowerCase() }
    });
    if (!species) {
      throw new NotFoundException("speciesNotFound");
    }

    const starterStats = this.getStatsForLevel(
      {
        baseHp: species.baseHp,
        baseAtk: species.baseAtk,
        baseDef: species.baseDef,
        baseSpeed: species.baseSpeed
      },
      1
    );
    const createdPokemon = await this.prisma.$transaction(async (tx) => {
      const userPokemonCount = await tx.userPokemon.count({ where: { userId } });
      if (userPokemonCount > 0) {
        throw new BadRequestException("starterAlreadyClaimed");
      }
      return tx.userPokemon.create({
        data: {
          userId,
          speciesId: species.id,
          currentHp: starterStats.currentHp,
          atk: starterStats.atk,
          def: starterStats.def,
          speed: starterStats.speed
        },
        include: { species: true }
      });
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "StarterClaimed",
      entityName: "UserPokemon",
      entityId: createdPokemon.id
    });
    return createdPokemon;
  }

  async evolvePokemon(userId: string, userPokemonId: string) {
    const userPokemon = await this.prisma.userPokemon.findFirst({
      where: { id: userPokemonId, userId, isLegacy: false },
      include: { species: true }
    });
    if (!userPokemon) {
      throw new NotFoundException("userPokemonNotFound");
    }
    if (!userPokemon.species.evolutionTarget) {
      throw new BadRequestException("pokemonHasNoEvolution");
    }
    if (!userPokemon.species.evolutionLevel) {
      throw new BadRequestException("pokemonEvolutionRequiresSpecialCondition");
    }
    if (userPokemon.level < userPokemon.species.evolutionLevel) {
      throw new BadRequestException("insufficientLevelForEvolution");
    }
    if (userPokemon.evolveCooldownUntil && userPokemon.evolveCooldownUntil > new Date()) {
      throw new BadRequestException("evolutionInCooldown");
    }

    const targetSpecies = await this.prisma.pokemonSpecies.findUnique({
      where: { name: userPokemon.species.evolutionTarget }
    });
    if (!targetSpecies) {
      throw new NotFoundException("targetEvolutionSpeciesNotFound");
    }

    const evolvedStats = this.getStatsForLevel(
      {
        baseHp: targetSpecies.baseHp,
        baseAtk: targetSpecies.baseAtk,
        baseDef: targetSpecies.baseDef,
        baseSpeed: targetSpecies.baseSpeed
      },
      userPokemon.level
    );
    const evolvedPokemon = await this.prisma.userPokemon.update({
      where: { id: userPokemon.id },
      data: {
        speciesId: targetSpecies.id,
        currentHp: evolvedStats.currentHp,
        atk: evolvedStats.atk,
        def: evolvedStats.def,
        speed: evolvedStats.speed,
        evolveCooldownUntil: this.getEvolutionCooldownUntil(userPokemon.level, targetSpecies.evolutionTarget)
      },
      include: { species: true }
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "PokemonEvolved",
      entityName: "UserPokemon",
      entityId: evolvedPokemon.id
    });
    return evolvedPokemon;
  }

  async trainPokemon(userId: string, userPokemonId: string) {
    const now = new Date();
    const [user, userPokemon] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, trainingPoints: true }
      }),
      this.prisma.userPokemon.findFirst({
        where: { id: userPokemonId, userId, isLegacy: false },
        include: { species: true }
      })
    ]);
    if (!user || !userPokemon) {
      throw new NotFoundException("userPokemonNotFound");
    }
    if (user.trainingPoints <= 0) {
      throw new BadRequestException("insufficientTrainingPoints");
    }
    if (userPokemon.trainingCooldownUntil && userPokemon.trainingCooldownUntil > now) {
      throw new BadRequestException("trainingInCooldown");
    }

    const trainedPokemon = await this.prisma.$transaction(async (tx) => {
      const trainingSessions = this.getTrainingSessionsCount(userPokemon);
      const trainingCooldownUntil = this.getTrainingCooldownUntil(now, userPokemon.level, trainingSessions);
      await tx.user.update({
        where: { id: userId },
        data: { trainingPoints: { decrement: 1 } }
      });
      return tx.userPokemon.update({
        where: { id: userPokemon.id },
        data: {
          currentHp: { increment: 4 },
          atk: { increment: 2 },
          def: { increment: 2 },
          speed: { increment: 1 },
          trainingCooldownUntil
        },
        include: { species: true }
      });
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "PokemonTrained",
      entityName: "UserPokemon",
      entityId: trainedPokemon.id,
      payload: {
        hp: 4,
        atk: 2,
        def: 2,
        speed: 1
      }
    });
    return trainedPokemon;
  }

  private getAgePenaltyPercent(ageDays: number): number {
    if (ageDays < 7) {
      return 0;
    }
    return Math.min(30, Math.floor((ageDays - 7) / 3) + 1);
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

  private getTrainingSessionsCount(pokemon: {
    level: number;
    currentHp: number;
    atk: number;
    def: number;
    speed: number;
    species: { baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number };
  }) {
    const baseStatsForLevel = this.getStatsForLevel(
      {
        baseHp: pokemon.species.baseHp,
        baseAtk: pokemon.species.baseAtk,
        baseDef: pokemon.species.baseDef,
        baseSpeed: pokemon.species.baseSpeed
      },
      pokemon.level
    );
    const hpTraining = Math.max(0, Math.floor((pokemon.currentHp - baseStatsForLevel.currentHp) / 4));
    const atkTraining = Math.max(0, Math.floor((pokemon.atk - baseStatsForLevel.atk) / 2));
    const defTraining = Math.max(0, Math.floor((pokemon.def - baseStatsForLevel.def) / 2));
    const speedTraining = Math.max(0, Math.floor(pokemon.speed - baseStatsForLevel.speed));
    return Math.max(hpTraining, atkTraining, defTraining, speedTraining);
  }

  private getTrainingCooldownUntil(now: Date, level: number, trainingSessions: number) {
    const baseMinutes = 25;
    const levelMinutes = Math.floor(Math.max(1, level) / 4) * 3;
    const trainedMinutes = Math.min(240, trainingSessions * 14);
    const totalMinutes = Math.max(25, baseMinutes + levelMinutes + trainedMinutes);
    return new Date(now.getTime() + totalMinutes * 60 * 1000);
  }

  private getEvolutionCooldownUntil(level: number, nextEvolutionTarget: string | null) {
    const baseHours = 6;
    const stageHours = nextEvolutionTarget ? 4 : 9;
    const levelMinutes = Math.floor(Math.max(1, level) / 3) * 10;
    const totalMs = (baseHours + stageHours) * 60 * 60 * 1000 + levelMinutes * 60 * 1000;
    return new Date(Date.now() + totalMs);
  }
}
