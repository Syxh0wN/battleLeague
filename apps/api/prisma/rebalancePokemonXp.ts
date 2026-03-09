import { PrismaClient } from "@prisma/client";

const Prisma = new PrismaClient();

function getLevelByXp(xp: number) {
  const safeXp = Math.max(0, xp);
  const rawLevel = Math.floor(safeXp / 100) + 1;
  return Math.min(100, Math.max(1, rawLevel));
}

function getMinXpForLevel(level: number) {
  const safeLevel = Math.min(100, Math.max(1, level));
  return (safeLevel - 1) * 100;
}

async function main() {
  const pokemons = await Prisma.userPokemon.findMany({
    select: {
      id: true,
      level: true,
      xp: true
    }
  });

  const toFix = pokemons.filter((pokemon) => getLevelByXp(pokemon.xp) !== pokemon.level);

  const batchSize = 200;
  let fixed = 0;

  for (let index = 0; index < toFix.length; index += batchSize) {
    const batch = toFix.slice(index, index + batchSize);
    await Prisma.$transaction(
      batch.map((pokemon) =>
        Prisma.userPokemon.update({
          where: { id: pokemon.id },
          data: { xp: getMinXpForLevel(pokemon.level) }
        })
      )
    );
    fixed += batch.length;
  }

  process.stdout.write(
    `${JSON.stringify({
      total: pokemons.length,
      inconsistent: toFix.length,
      fixed
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
