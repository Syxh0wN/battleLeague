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

function buildDemoPlayers(): DemoPlayerSeed[] {
  const rankDivisions = [
    { league: "Ferro", division: 3, minMmr: 550, maxMmr: 699 },
    { league: "Ferro", division: 2, minMmr: 700, maxMmr: 799 },
    { league: "Ferro", division: 1, minMmr: 800, maxMmr: 899 },
    { league: "Bronze", division: 3, minMmr: 900, maxMmr: 999 },
    { league: "Bronze", division: 2, minMmr: 1000, maxMmr: 1099 },
    { league: "Bronze", division: 1, minMmr: 1100, maxMmr: 1199 },
    { league: "Prata", division: 3, minMmr: 1200, maxMmr: 1299 },
    { league: "Prata", division: 2, minMmr: 1300, maxMmr: 1399 },
    { league: "Prata", division: 1, minMmr: 1400, maxMmr: 1499 },
    { league: "Ouro", division: 3, minMmr: 1500, maxMmr: 1599 },
    { league: "Ouro", division: 2, minMmr: 1600, maxMmr: 1699 },
    { league: "Ouro", division: 1, minMmr: 1700, maxMmr: 1799 },
    { league: "Platina", division: 3, minMmr: 1800, maxMmr: 1899 },
    { league: "Platina", division: 2, minMmr: 1900, maxMmr: 1999 },
    { league: "Platina", division: 1, minMmr: 2000, maxMmr: 2099 },
    { league: "Diamante", division: 3, minMmr: 2100, maxMmr: 2199 },
    { league: "Diamante", division: 2, minMmr: 2200, maxMmr: 2299 },
    { league: "Diamante", division: 1, minMmr: 2300, maxMmr: 2399 },
    { league: "Ruby", division: 3, minMmr: 2400, maxMmr: 2699 },
    { league: "Ruby", division: 2, minMmr: 2700, maxMmr: 2999 },
    { league: "Ruby", division: 1, minMmr: 3000, maxMmr: 3300 }
  ] as const;
  const totalPlayers = 1000;
  const playersPerDivision = Math.floor(totalPlayers / rankDivisions.length);
  const remainderPlayers = totalPlayers % rankDivisions.length;
  const demoPlayers: DemoPlayerSeed[] = [];
  let playerCounter = 1;

  for (let divisionIndex = 0; divisionIndex < rankDivisions.length; divisionIndex += 1) {
    const division = rankDivisions[divisionIndex];
    const playersInThisDivision = playersPerDivision + (divisionIndex < remainderPlayers ? 1 : 0);
    for (let localIndex = 0; localIndex < playersInThisDivision; localIndex += 1) {
      const playerTag = playerCounter.toString().padStart(4, "0");
      const level = 2 + ((playerCounter - 1) % 9);
      const wins = 6 + ((playerCounter * 7) % 38);
      const losses = 4 + ((playerCounter * 5) % 30);
      const span = Math.max(1, division.maxMmr - division.minMmr);
      const mmr = division.minMmr + ((playerCounter * 13) % span);
      const displayName = `Rival ${division.league} ${division.division} ${playerTag}`;
      const slug = `demo_${division.league.toLowerCase()}_${division.division}_${playerTag}`;
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
  const speciesCatalog = await prisma.pokemonSpecies.findMany({
    orderBy: { pokeApiId: "asc" },
    take: 30
  });
  if (speciesCatalog.length === 0) {
    return;
  }

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
    const desiredPokemonCount = 2 + (index % 9);
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
      const pokemonLevel = 2 + ((index + speciesIndex) % 9);
      const statBonus = pokemonLevel + speciesIndex;
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
