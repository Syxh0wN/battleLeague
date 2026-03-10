import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ClaimPokemonDto } from "./dto/claim-pokemon.dto";
import { ClaimStarterBundleDto } from "./dto/claim-starter-bundle.dto";

type StarterChoiceItem = {
  id: string;
  name: string;
  typePrimary: string;
  imageUrl: string | null;
};

const StarterChoicesByStage = {
  stageOne: ["bulbasaur", "charmander", "squirtle", "abra", "gastly"],
  stageTwo: ["bayleef", "quilava", "croconaw", "grovyle", "combusken"],
  stageThree: ["dragonite", "tyranitar", "metagross", "salamence", "garchomp"]
} as const;

type StarterStageKey = keyof typeof StarterChoicesByStage;

@Injectable()
export class PokemonService {
  private readonly maxPokemonLevel = 100;
  private readonly starterChoicesByStage = this.buildStarterChoicesByStage();

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

  async getStarterChoices() {
    try {
      return await this.loadStarterChoicesByStage(this.starterChoicesByStage);
    } catch {
      try {
        return await this.loadStarterChoicesByStage(StarterChoicesByStage);
      } catch {
        return this.buildStarterChoicesFromCatalog();
      }
    }
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

  async claimStarterBundle(userId: string, dto: ClaimStarterBundleDto) {
    const starterChoices = await this.getStarterChoices();
    const normalizedStageOne = dto.stageOneSpeciesName.trim().toLowerCase();
    const normalizedStageTwo = dto.stageTwoSpeciesName.trim().toLowerCase();
    const normalizedStageThree = dto.stageThreeSpeciesName.trim().toLowerCase();
    if (new Set([normalizedStageOne, normalizedStageTwo, normalizedStageThree]).size !== 3) {
      throw new BadRequestException("starterChoicesMustBeDistinct");
    }
    const stageOneAllowed = new Set(starterChoices.stageOne.map((species) => species.name.trim().toLowerCase()));
    const stageTwoAllowed = new Set(starterChoices.stageTwo.map((species) => species.name.trim().toLowerCase()));
    const stageThreeAllowed = new Set(starterChoices.stageThree.map((species) => species.name.trim().toLowerCase()));
    if (!stageOneAllowed.has(normalizedStageOne) || !stageTwoAllowed.has(normalizedStageTwo) || !stageThreeAllowed.has(normalizedStageThree)) {
      throw new BadRequestException("starterChoiceInvalid");
    }
    const selectedSpeciesNames = [normalizedStageOne, normalizedStageTwo, normalizedStageThree];
    const selectedSpecies = await this.prisma.pokemonSpecies.findMany({
      where: {
        name: {
          in: selectedSpeciesNames
        }
      }
    });
    if (selectedSpecies.length !== 3) {
      throw new NotFoundException("speciesNotFound");
    }
    const selectedSpeciesByName = new Map(selectedSpecies.map((species) => [species.name.trim().toLowerCase(), species]));
    const orderedSpecies = selectedSpeciesNames.map((name) => selectedSpeciesByName.get(name)).filter((species) => !!species);
    if (orderedSpecies.length !== 3) {
      throw new NotFoundException("speciesNotFound");
    }
    const createdPokemons = await this.prisma.$transaction(async (tx) => {
      const userPokemonCount = await tx.userPokemon.count({ where: { userId } });
      if (userPokemonCount > 0) {
        throw new BadRequestException("starterAlreadyClaimed");
      }
      const created = [];
      for (const species of orderedSpecies) {
        if (!species) {
          continue;
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
        const createdPokemon = await tx.userPokemon.create({
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
        created.push(createdPokemon);
      }
      return created;
    });
    await this.auditService.write({
      actorUserId: userId,
      action: "StarterBundleClaimed",
      entityName: "UserPokemon",
      payload: {
        speciesNames: createdPokemons.map((pokemon) => pokemon.species.name)
      }
    });
    return {
      claimedCount: createdPokemons.length,
      pokemons: createdPokemons
    };
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

  private buildStarterChoicesByStage() {
    const configuredChoices = {
      stageOne: this.resolveStarterStageChoices("stageOne", process.env.STARTER_STAGE_ONE_CHOICES),
      stageTwo: this.resolveStarterStageChoices("stageTwo", process.env.STARTER_STAGE_TWO_CHOICES),
      stageThree: this.resolveStarterStageChoices("stageThree", process.env.STARTER_STAGE_THREE_CHOICES)
    };
    const combinedConfiguredNames = [
      ...configuredChoices.stageOne,
      ...configuredChoices.stageTwo,
      ...configuredChoices.stageThree
    ];
    if (this.hasDuplicateNames(combinedConfiguredNames)) {
      return {
        stageOne: [...StarterChoicesByStage.stageOne],
        stageTwo: [...StarterChoicesByStage.stageTwo],
        stageThree: [...StarterChoicesByStage.stageThree]
      };
    }
    return configuredChoices;
  }

  private resolveStarterStageChoices(stage: StarterStageKey, rawValue?: string) {
    const fallback = [...StarterChoicesByStage[stage]];
    if (!rawValue || rawValue.trim().length === 0) {
      return fallback;
    }
    const parsed = rawValue
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter((name) => name.length > 0);
    const deduped = Array.from(new Set(parsed));
    if (deduped.length !== 5) {
      return fallback;
    }
    return deduped;
  }

  private hasDuplicateNames(names: string[]) {
    return new Set(names).size !== names.length;
  }

  private async loadStarterChoicesByStage(choicesByStage: {
    stageOne: readonly string[];
    stageTwo: readonly string[];
    stageThree: readonly string[];
  }) {
    const requestedNames = [...choicesByStage.stageOne, ...choicesByStage.stageTwo, ...choicesByStage.stageThree];
    const selectedSpecies = await this.prisma.pokemonSpecies.findMany({
      where: {
        name: {
          in: requestedNames
        }
      },
      select: {
        id: true,
        name: true,
        typePrimary: true,
        imageUrl: true
      }
    });
    if (selectedSpecies.length !== requestedNames.length) {
      throw new NotFoundException("starterChoicesNotAvailable");
    }
    const speciesEvolutionCatalog = await this.prisma.pokemonSpecies.findMany({
      select: {
        name: true,
        evolutionTarget: true
      }
    });
    if (this.hasEvolutionFamilyConflict(requestedNames, speciesEvolutionCatalog)) {
      throw new BadRequestException("starterEvolutionFamilyConflict");
    }
    const selectedSpeciesByName = new Map(selectedSpecies.map((species) => [species.name.trim().toLowerCase(), species]));
    const buildStageChoices = (stageNames: readonly string[]) =>
      stageNames
        .map((name) => selectedSpeciesByName.get(name))
        .filter((species): species is StarterChoiceItem => !!species)
        .slice(0, 5);
    const stageOneChoices = buildStageChoices(choicesByStage.stageOne);
    const stageTwoChoices = buildStageChoices(choicesByStage.stageTwo);
    const stageThreeChoices = buildStageChoices(choicesByStage.stageThree);
    if (stageOneChoices.length !== 5 || stageTwoChoices.length !== 5 || stageThreeChoices.length !== 5) {
      throw new NotFoundException("starterChoicesNotAvailable");
    }
    return {
      stageOne: stageOneChoices,
      stageTwo: stageTwoChoices,
      stageThree: stageThreeChoices
    };
  }

  private hasEvolutionFamilyConflict(
    selectedNames: string[],
    speciesCatalog: Array<{
      name: string;
      evolutionTarget: string | null;
    }>
  ) {
    const graph = new Map<string, Set<string>>();
    const connect = (leftName: string, rightName: string) => {
      if (!graph.has(leftName)) {
        graph.set(leftName, new Set());
      }
      if (!graph.has(rightName)) {
        graph.set(rightName, new Set());
      }
      graph.get(leftName)?.add(rightName);
      graph.get(rightName)?.add(leftName);
    };
    for (const species of speciesCatalog) {
      const sourceName = species.name.trim().toLowerCase();
      if (!graph.has(sourceName)) {
        graph.set(sourceName, new Set());
      }
      if (!species.evolutionTarget) {
        continue;
      }
      const targetName = species.evolutionTarget.trim().toLowerCase();
      if (targetName.length === 0) {
        continue;
      }
      connect(sourceName, targetName);
    }
    const familyIdByName = new Map<string, string>();
    for (const rootName of graph.keys()) {
      if (familyIdByName.has(rootName)) {
        continue;
      }
      const queue = [rootName];
      familyIdByName.set(rootName, rootName);
      while (queue.length > 0) {
        const currentName = queue.shift();
        if (!currentName) {
          continue;
        }
        for (const neighborName of graph.get(currentName) ?? []) {
          if (familyIdByName.has(neighborName)) {
            continue;
          }
          familyIdByName.set(neighborName, rootName);
          queue.push(neighborName);
        }
      }
    }
    const selectedFamilyIds = selectedNames
      .map((name) => name.trim().toLowerCase())
      .map((name) => familyIdByName.get(name) ?? name);
    return this.hasDuplicateNames(selectedFamilyIds);
  }

  private async buildStarterChoicesFromCatalog() {
    const catalog = await this.prisma.pokemonSpecies.findMany({
      orderBy: { pokeApiId: "asc" },
      select: {
        id: true,
        name: true,
        typePrimary: true,
        imageUrl: true,
        evolutionTarget: true
      }
    });
    if (catalog.length === 0) {
      throw new NotFoundException("starterChoicesNotAvailable");
    }
    const evolvedFromNameSet = new Set(
      catalog
        .map((species) => species.evolutionTarget?.trim().toLowerCase() ?? "")
        .filter((value) => value.length > 0)
    );
    const stageOnePool = catalog.filter(
      (species) => !!species.evolutionTarget && !evolvedFromNameSet.has(species.name.trim().toLowerCase())
    );
    const stageTwoPool = catalog.filter(
      (species) => !!species.evolutionTarget && evolvedFromNameSet.has(species.name.trim().toLowerCase())
    );
    const stageThreePool = catalog.filter((species) => !species.evolutionTarget);
    const familyIdByName = this.buildFamilyIdBySpeciesName(catalog);
    const mapToItem = (species: {
      id: string;
      name: string;
      typePrimary: string;
      imageUrl: string | null;
    }): StarterChoiceItem => ({
      id: species.id,
      name: species.name,
      typePrimary: species.typePrimary,
      imageUrl: species.imageUrl
    });
    const pickUniqueFamilies = (
      primaryPool: Array<{
        id: string;
        name: string;
        typePrimary: string;
        imageUrl: string | null;
      }>,
      usedFamilyIds: Set<string>,
      maxItems: number
    ) => {
      const selected: StarterChoiceItem[] = [];
      for (const species of primaryPool) {
        const normalizedName = species.name.trim().toLowerCase();
        const familyId = familyIdByName.get(normalizedName) ?? normalizedName;
        if (usedFamilyIds.has(familyId)) {
          continue;
        }
        selected.push(mapToItem(species));
        usedFamilyIds.add(familyId);
        if (selected.length >= maxItems) {
          break;
        }
      }
      return selected;
    };
    const usedFamilyIds = new Set<string>();
    const stageTwo = pickUniqueFamilies(stageTwoPool, usedFamilyIds, 5);
    const stageOne = pickUniqueFamilies(stageOnePool, usedFamilyIds, 5);
    const stageThree = pickUniqueFamilies(stageThreePool, usedFamilyIds, 5);
    if (stageOne.length === 0 || stageTwo.length === 0 || stageThree.length === 0) {
      throw new NotFoundException("starterChoicesNotAvailable");
    }
    return {
      stageOne,
      stageTwo,
      stageThree
    };
  }

  private buildFamilyIdBySpeciesName(
    speciesCatalog: Array<{
      name: string;
      evolutionTarget: string | null;
    }>
  ) {
    const graph = new Map<string, Set<string>>();
    const connect = (leftName: string, rightName: string) => {
      if (!graph.has(leftName)) {
        graph.set(leftName, new Set());
      }
      if (!graph.has(rightName)) {
        graph.set(rightName, new Set());
      }
      graph.get(leftName)?.add(rightName);
      graph.get(rightName)?.add(leftName);
    };
    for (const species of speciesCatalog) {
      const sourceName = species.name.trim().toLowerCase();
      if (!graph.has(sourceName)) {
        graph.set(sourceName, new Set());
      }
      if (!species.evolutionTarget) {
        continue;
      }
      const targetName = species.evolutionTarget.trim().toLowerCase();
      if (targetName.length === 0) {
        continue;
      }
      connect(sourceName, targetName);
    }
    const familyIdByName = new Map<string, string>();
    for (const rootName of graph.keys()) {
      if (familyIdByName.has(rootName)) {
        continue;
      }
      const queue = [rootName];
      familyIdByName.set(rootName, rootName);
      while (queue.length > 0) {
        const currentName = queue.shift();
        if (!currentName) {
          continue;
        }
        for (const neighborName of graph.get(currentName) ?? []) {
          if (familyIdByName.has(neighborName)) {
            continue;
          }
          familyIdByName.set(neighborName, rootName);
          queue.push(neighborName);
        }
      }
    }
    return familyIdByName;
  }

}
