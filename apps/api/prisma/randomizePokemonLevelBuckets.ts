import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

function getRandomInt(min: number, max: number) {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

function getRandomLevelByCurrentLevel(currentLevel: number) {
  if (currentLevel === 1) {
    return getRandomInt(1, 15);
  }
  if (currentLevel === 16) {
    return getRandomInt(16, 35);
  }
  if (currentLevel === 36) {
    return getRandomInt(36, 100);
  }
  return currentLevel;
}

async function main() {
  const pokemons = await Prisma.userPokemon.findMany({
    where: {
      level: { in: [1, 16, 36] }
    },
    select: {
      id: true,
      level: true
    }
  });

  const batchSize = 200;
  let updated = 0;

  for (let index = 0; index < pokemons.length; index += batchSize) {
    const batch = pokemons.slice(index, index + batchSize);
    await Prisma.$transaction(
      batch.map((pokemon) =>
        Prisma.userPokemon.update({
          where: { id: pokemon.id },
          data: { level: getRandomLevelByCurrentLevel(pokemon.level) }
        })
      )
    );
    updated += batch.length;
  }

  process.stdout.write(
    `${JSON.stringify({
      touched: pokemons.length,
      updated,
      ranges: {
        oneToFifteen: "from 1",
        sixteenToThirtyFive: "from 16",
        thirtySixToOneHundred: "from 36"
      }
    })}\n`
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Prisma.$disconnect();
  });
