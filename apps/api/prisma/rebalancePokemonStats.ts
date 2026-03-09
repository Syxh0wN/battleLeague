import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

type UserPokemonWithSpecies = {
  id: string;
  level: number;
  species: {
    baseHp: number;
    baseAtk: number;
    baseDef: number;
    baseSpeed: number;
  };
};

function getStatsForLevel(baseStats: UserPokemonWithSpecies["species"], level: number) {
  const safeLevel = Math.max(1, level);
  const levelOffset = safeLevel - 1;
  return {
    currentHp: baseStats.baseHp + levelOffset * 2,
    atk: baseStats.baseAtk + levelOffset,
    def: baseStats.baseDef + levelOffset,
    speed: baseStats.baseSpeed + Math.floor(levelOffset / 2)
  };
}

async function main() {
  const pokemons = await Prisma.userPokemon.findMany({
    select: {
      id: true,
      level: true,
      species: {
        select: {
          baseHp: true,
          baseAtk: true,
          baseDef: true,
          baseSpeed: true
        }
      }
    }
  });

  const batchSize = 200;
  let updated = 0;

  for (let index = 0; index < pokemons.length; index += batchSize) {
    const batch = pokemons.slice(index, index + batchSize);
    await Prisma.$transaction(
      batch.map((pokemon) => {
        const stats = getStatsForLevel(pokemon.species, pokemon.level);
        return Prisma.userPokemon.update({
          where: { id: pokemon.id },
          data: {
            currentHp: stats.currentHp,
            atk: stats.atk,
            def: stats.def,
            speed: stats.speed
          }
        });
      })
    );
    updated += batch.length;
  }

  const result = {
    total: pokemons.length,
    updated
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
