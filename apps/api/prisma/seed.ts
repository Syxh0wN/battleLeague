import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SpeciesSeed = {
  pokeApiId: number;
  name: string;
  typePrimary: string;
  typeSecondary: string | null;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
  evolutionTarget: string | null;
  evolutionLevel: number | null;
  imageUrl: string;
};

type DemoPlayerSeed = {
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  mmr: number;
  wins: number;
  losses: number;
};

const DemoLevels = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 25, 27, 30, 35, 40] as const;
const MinDemoAccountsPerLevel = 30;
const MaxDemoAccountsPerLevel = 70;

function GetRarityByPokeApiId(pokeApiId: number) {
  if (pokeApiId >= 821) return "legendary";
  if (pokeApiId >= 616) return "epic";
  if (pokeApiId >= 411) return "rare";
  if (pokeApiId >= 206) return "uncommon";
  return "common";
}

const speciesCatalogSeed: SpeciesSeed[] = [
  { pokeApiId: 1, name: "bulbasaur", typePrimary: "grass", typeSecondary: "poison", baseHp: 45, baseAtk: 49, baseDef: 49, baseSpeed: 45, evolutionTarget: "ivysaur", evolutionLevel: 16, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png" },
  { pokeApiId: 2, name: "ivysaur", typePrimary: "grass", typeSecondary: "poison", baseHp: 60, baseAtk: 62, baseDef: 63, baseSpeed: 60, evolutionTarget: "venusaur", evolutionLevel: 32, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png" },
  { pokeApiId: 3, name: "venusaur", typePrimary: "grass", typeSecondary: "poison", baseHp: 80, baseAtk: 82, baseDef: 83, baseSpeed: 80, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/3.png" },
  { pokeApiId: 4, name: "charmander", typePrimary: "fire", typeSecondary: null, baseHp: 39, baseAtk: 52, baseDef: 43, baseSpeed: 65, evolutionTarget: "charmeleon", evolutionLevel: 16, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png" },
  { pokeApiId: 5, name: "charmeleon", typePrimary: "fire", typeSecondary: null, baseHp: 58, baseAtk: 64, baseDef: 58, baseSpeed: 80, evolutionTarget: "charizard", evolutionLevel: 36, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/5.png" },
  { pokeApiId: 6, name: "charizard", typePrimary: "fire", typeSecondary: "flying", baseHp: 78, baseAtk: 84, baseDef: 78, baseSpeed: 100, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png" },
  { pokeApiId: 7, name: "squirtle", typePrimary: "water", typeSecondary: null, baseHp: 44, baseAtk: 48, baseDef: 65, baseSpeed: 43, evolutionTarget: "wartortle", evolutionLevel: 16, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png" },
  { pokeApiId: 8, name: "wartortle", typePrimary: "water", typeSecondary: null, baseHp: 59, baseAtk: 63, baseDef: 80, baseSpeed: 58, evolutionTarget: "blastoise", evolutionLevel: 36, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/8.png" },
  { pokeApiId: 9, name: "blastoise", typePrimary: "water", typeSecondary: null, baseHp: 79, baseAtk: 83, baseDef: 100, baseSpeed: 78, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/9.png" },
  { pokeApiId: 25, name: "pikachu", typePrimary: "electric", typeSecondary: null, baseHp: 35, baseAtk: 55, baseDef: 40, baseSpeed: 90, evolutionTarget: "raichu", evolutionLevel: 22, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png" },
  { pokeApiId: 26, name: "raichu", typePrimary: "electric", typeSecondary: null, baseHp: 60, baseAtk: 90, baseDef: 55, baseSpeed: 110, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/26.png" },
  { pokeApiId: 39, name: "jigglypuff", typePrimary: "fairy", typeSecondary: null, baseHp: 115, baseAtk: 45, baseDef: 20, baseSpeed: 20, evolutionTarget: "wigglytuff", evolutionLevel: 26, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/39.png" },
  { pokeApiId: 65, name: "alakazam", typePrimary: "psychic", typeSecondary: null, baseHp: 55, baseAtk: 50, baseDef: 45, baseSpeed: 120, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/65.png" },
  { pokeApiId: 68, name: "machamp", typePrimary: "fighting", typeSecondary: null, baseHp: 90, baseAtk: 130, baseDef: 80, baseSpeed: 55, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/68.png" },
  { pokeApiId: 94, name: "gengar", typePrimary: "ghost", typeSecondary: "poison", baseHp: 60, baseAtk: 65, baseDef: 60, baseSpeed: 110, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png" },
  { pokeApiId: 130, name: "gyarados", typePrimary: "water", typeSecondary: "flying", baseHp: 95, baseAtk: 125, baseDef: 79, baseSpeed: 81, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png" },
  { pokeApiId: 131, name: "lapras", typePrimary: "water", typeSecondary: "ice", baseHp: 130, baseAtk: 85, baseDef: 80, baseSpeed: 60, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png" },
  { pokeApiId: 143, name: "snorlax", typePrimary: "normal", typeSecondary: null, baseHp: 160, baseAtk: 110, baseDef: 65, baseSpeed: 30, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png" },
  { pokeApiId: 149, name: "dragonite", typePrimary: "dragon", typeSecondary: "flying", baseHp: 91, baseAtk: 134, baseDef: 95, baseSpeed: 80, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png" },
  { pokeApiId: 150, name: "mewtwo", typePrimary: "psychic", typeSecondary: null, baseHp: 106, baseAtk: 110, baseDef: 90, baseSpeed: 130, evolutionTarget: null, evolutionLevel: null, imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png" }
];

function Clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function BuildMmrRangeByLevel(level: number) {
  const normalizedLevel = Clamp(level, 2, 40);
  const progress = (normalizedLevel - 2) / (40 - 2);
  const minMmr = Math.floor(650 + progress * 2350);
  const maxMmr = Math.floor(minMmr + 220 + progress * 280);
  return {
    minMmr,
    maxMmr
  };
}

function BuildAccountsCountForLevel(level: number) {
  const span = MaxDemoAccountsPerLevel - MinDemoAccountsPerLevel + 1;
  return MinDemoAccountsPerLevel + ((level * 17 + 11) % span);
}

function buildDemoPlayers(): DemoPlayerSeed[] {
  const demoPlayers: DemoPlayerSeed[] = [];
  let playerCounter = 1;

  for (let levelIndex = 0; levelIndex < DemoLevels.length; levelIndex += 1) {
    const level = DemoLevels[levelIndex];
    const accountsCount = BuildAccountsCountForLevel(level);
    const mmrRange = BuildMmrRangeByLevel(level);
    for (let localIndex = 0; localIndex < accountsCount; localIndex += 1) {
      const playerTag = playerCounter.toString().padStart(5, "0");
      const wins = Math.max(5, Math.floor(level * 1.5) + ((localIndex * 7 + level) % 42));
      const losses = Math.max(3, Math.floor(level * 0.9) + ((localIndex * 5 + level) % 27));
      const mmrSpan = Math.max(1, mmrRange.maxMmr - mmrRange.minMmr);
      const mmr = mmrRange.minMmr + ((localIndex * 23 + level * 11) % mmrSpan);
      const displayName = `Rival Lv${String(level).padStart(2, "0")} ${playerTag}`;
      const slug = `demo_lv_${String(level).padStart(2, "0")}_${playerTag}`;
      demoPlayers.push({
        googleSub: slug,
        email: `${slug}@battleleague.local`,
        displayName,
        avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(displayName)}`,
        level,
        mmr,
        wins,
        losses
      });
      playerCounter += 1;
    }
  }

  return demoPlayers;
}

async function ensureSpeciesCatalog() {
  for (const species of speciesCatalogSeed) {
    const dropRarity = GetRarityByPokeApiId(species.pokeApiId);
    await prisma.pokemonSpecies.upsert({
      where: { pokeApiId: species.pokeApiId },
      update: {
        ...species,
        dropRarity
      },
      create: {
        ...species,
        dropRarity
      }
    });
  }
}

async function ensureDemoOpponents() {
  const speciesCatalog = await prisma.pokemonSpecies.findMany();
  if (speciesCatalog.length === 0) {
    return;
  }

  const sortedSpeciesByPower = [...speciesCatalog].sort((left, right) => {
    const leftPower = left.baseHp + left.baseAtk + left.baseDef + left.baseSpeed;
    const rightPower = right.baseHp + right.baseAtk + right.baseDef + right.baseSpeed;
    if (rightPower !== leftPower) {
      return rightPower - leftPower;
    }
    return left.pokeApiId - right.pokeApiId;
  });

  const demoPlayers = buildDemoPlayers();
  for (let index = 0; index < demoPlayers.length; index += 1) {
    const demo = demoPlayers[index];
    const user = await prisma.user.upsert({
      where: { googleSub: demo.googleSub },
      update: {
        displayName: demo.displayName,
        avatarUrl: demo.avatarUrl,
        level: demo.level,
        mmr: demo.mmr,
        totalWins: demo.wins,
        totalLosses: demo.losses
      },
      create: {
        googleSub: demo.googleSub,
        email: demo.email,
        displayName: demo.displayName,
        avatarUrl: demo.avatarUrl,
        level: demo.level,
        mmr: demo.mmr,
        totalWins: demo.wins,
        totalLosses: demo.losses,
        profileHistory: {
          create: {
            battleCount: demo.wins + demo.losses,
            bestStreak: Math.max(2, Math.floor(demo.wins / 2)),
            totalDamage: 220 + demo.wins * 16
          }
        }
      }
    });

    const existingPokemons = await prisma.userPokemon.findMany({
      where: { userId: user.id },
      select: { speciesId: true }
    });
    const existingSpeciesIds = new Set(existingPokemons.map((pokemon) => pokemon.speciesId));
    const desiredPokemonCount = Clamp(2 + Math.floor((demo.level - 2) / 8), 2, 6);
    const missingPokemonCount = Math.max(0, desiredPokemonCount - existingPokemons.length);
    if (missingPokemonCount === 0) {
      continue;
    }

    const levelProgress = (Clamp(demo.level, 2, 40) - 2) / (40 - 2);
    const centerIndex = Math.floor(levelProgress * (sortedSpeciesByPower.length - 1));
    const rangeRadius = Math.max(6, Math.floor(sortedSpeciesByPower.length * 0.18));
    const startIndex = Clamp(centerIndex - rangeRadius, 0, sortedSpeciesByPower.length - 1);
    const endIndex = Clamp(centerIndex + rangeRadius, 0, sortedSpeciesByPower.length - 1);
    const speciesWindow = sortedSpeciesByPower.slice(startIndex, endIndex + 1);
    const fallbackWindow = speciesWindow.length > 0 ? speciesWindow : sortedSpeciesByPower;

    const chosenSpecies: typeof speciesCatalog = [];
    let speciesCursor = 0;
    while (chosenSpecies.length < missingPokemonCount && speciesCursor < fallbackWindow.length * 3) {
      const species = fallbackWindow[(index * 5 + speciesCursor * 3 + demo.level) % fallbackWindow.length];
      if (!existingSpeciesIds.has(species.id) && !chosenSpecies.some((item) => item.id === species.id)) {
        chosenSpecies.push(species);
      }
      speciesCursor += 1;
    }

    for (let speciesIndex = 0; speciesIndex < chosenSpecies.length; speciesIndex += 1) {
      const species = chosenSpecies[speciesIndex];
      const pokemonLevel = Clamp(demo.level + ((speciesIndex % 3) - 1), 2, 45);
      const statBonus = pokemonLevel + Math.floor(speciesIndex / 2);
      await prisma.userPokemon.create({
        data: {
          userId: user.id,
          speciesId: species.id,
          level: pokemonLevel,
          xp: pokemonLevel * 18,
          currentHp: species.baseHp + statBonus * 2,
          atk: species.baseAtk + statBonus,
          def: species.baseDef + statBonus,
          speed: species.baseSpeed + Math.floor(statBonus / 2),
          wins: Math.max(0, demo.wins - speciesIndex),
          losses: Math.max(0, demo.losses - speciesIndex),
          restCooldownUntil: null,
          evolveCooldownUntil: null
        }
      });
    }
  }
}

async function ensureQuickUserBattleHistory() {
  const quickUser = await prisma.user.upsert({
    where: { googleSub: "quickLoginLocalUser" },
    update: {
      displayName: "Treinador Local"
    },
    create: {
      googleSub: "quickLoginLocalUser",
      email: "quick.login@battleleague.local",
      displayName: "Treinador Local",
      avatarUrl: "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png",
      profileHistory: {
        create: {
          battleCount: 0,
          bestStreak: 0,
          totalDamage: 0
        }
      }
    }
  });

  const quickHistory = await prisma.userProfileHistory.findUnique({
    where: { userId: quickUser.id }
  });
  if (!quickHistory) {
    await prisma.userProfileHistory.create({
      data: {
        userId: quickUser.id,
        battleCount: 0,
        bestStreak: 0,
        totalDamage: 0
      }
    });
  }

  const speciesCatalog = await prisma.pokemonSpecies.findMany({
    orderBy: { pokeApiId: "asc" },
    take: 12
  });
  if (speciesCatalog.length === 0) {
    return;
  }

  const quickPokemons = await prisma.userPokemon.findMany({
    where: { userId: quickUser.id },
    orderBy: { createdAt: "asc" },
    include: { species: true }
  });
  if (quickPokemons.length === 0) {
    const starterSpecies = speciesCatalog.slice(0, 3);
    for (let index = 0; index < starterSpecies.length; index += 1) {
      const species = starterSpecies[index];
      const level = 5 + index;
      await prisma.userPokemon.create({
        data: {
          userId: quickUser.id,
          speciesId: species.id,
          level,
          xp: level * 20,
          currentHp: species.baseHp + level * 2,
          atk: species.baseAtk + level,
          def: species.baseDef + level,
          speed: species.baseSpeed + Math.floor(level / 2),
          wins: 0,
          losses: 0,
          restCooldownUntil: null,
          evolveCooldownUntil: null
        }
      });
    }
  }

  const myPokemonList = await prisma.userPokemon.findMany({
    where: { userId: quickUser.id },
    orderBy: { updatedAt: "desc" },
    include: { species: true }
  });
  if (myPokemonList.length === 0) {
    return;
  }

  const demoOpponents = await prisma.user.findMany({
    where: {
      googleSub: { startsWith: "demo_" }
    },
    orderBy: { level: "desc" },
    take: 30,
    include: {
      pokemons: {
        orderBy: [{ level: "desc" }, { wins: "desc" }],
        take: 1
      }
    }
  });
  const opponentsWithPokemon = demoOpponents.filter((opponent) => opponent.pokemons.length > 0);
  if (opponentsWithPokemon.length === 0) {
    return;
  }

  const existingFinished = await prisma.battle.count({
    where: {
      status: "finished",
      OR: [{ challengerId: quickUser.id }, { opponentId: quickUser.id }]
    }
  });
  const targetBattles = 10;
  const missingBattles = Math.max(0, targetBattles - existingFinished);
  if (missingBattles === 0) {
    return;
  }

  const now = Date.now();
  let addedWins = 0;
  let addedLosses = 0;
  for (let index = 0; index < missingBattles; index += 1) {
    const myPokemon = myPokemonList[index % myPokemonList.length];
    const opponent = opponentsWithPokemon[index % opponentsWithPokemon.length];
    const opponentPokemon = opponent.pokemons[0];
    const createdAt = new Date(now - (index + 1) * 45 * 60 * 1000);
    const expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
    const iWon = index % 2 === 0;
    const winnerUserId = iWon ? quickUser.id : opponent.id;

    await prisma.battle.create({
      data: {
        challengerId: quickUser.id,
        opponentId: opponent.id,
        challengerPokemonId: myPokemon.id,
        opponentPokemonId: opponentPokemon.id,
        status: "finished",
        expiresAt,
        winnerUserId,
        createdAt,
        updatedAt: new Date(createdAt.getTime() + 3 * 60 * 1000)
      }
    });
    if (iWon) {
      addedWins += 1;
    } else {
      addedLosses += 1;
    }
  }

  if (addedWins > 0 || addedLosses > 0) {
    await prisma.user.update({
      where: { id: quickUser.id },
      data: {
        totalWins: { increment: addedWins },
        totalLosses: { increment: addedLosses },
        mmr: { increment: addedWins * 20 - addedLosses * 18 },
        xp: { increment: addedWins * 25 + addedLosses * 10 },
        coins: { increment: addedWins * 10 + addedLosses * 3 }
      }
    });
    await prisma.userProfileHistory.update({
      where: { userId: quickUser.id },
      data: {
        battleCount: { increment: addedWins + addedLosses },
        bestStreak: { increment: addedWins > addedLosses ? 1 : 0 },
        totalDamage: { increment: (addedWins + addedLosses) * 80 }
      }
    });
  }
}

async function main(): Promise<void> {
  await ensureSpeciesCatalog();
  await ensureDemoOpponents();
  await prisma.user.updateMany({
    where: {
      googleSub: {
        in: ["quickLoginLocalUser", "quickLoginLanUser"]
      }
    },
    data: {
      pokemonFragments: 120,
      lootPityCounter: 0,
      dailyShopPurchases: 0
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
