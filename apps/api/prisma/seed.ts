import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const starters = [
    {
      pokeApiId: 1,
      name: "bulbasaur",
      typePrimary: "grass",
      typeSecondary: "poison",
      baseHp: 45,
      baseAtk: 49,
      baseDef: 49,
      baseSpeed: 45,
      evolutionTarget: "ivysaur",
      evolutionLevel: 16,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png"
    },
    {
      pokeApiId: 4,
      name: "charmander",
      typePrimary: "fire",
      typeSecondary: null,
      baseHp: 39,
      baseAtk: 52,
      baseDef: 43,
      baseSpeed: 65,
      evolutionTarget: "charmeleon",
      evolutionLevel: 16,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png"
    },
    {
      pokeApiId: 7,
      name: "squirtle",
      typePrimary: "water",
      typeSecondary: null,
      baseHp: 44,
      baseAtk: 48,
      baseDef: 65,
      baseSpeed: 43,
      evolutionTarget: "wartortle",
      evolutionLevel: 16,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png"
    }
  ];

  for (const species of starters) {
    await prisma.pokemonSpecies.upsert({
      where: { pokeApiId: species.pokeApiId },
      update: species,
      create: species
    });
  }
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
