import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ClaimPokemonDto } from "./dto/claim-pokemon.dto";

@Injectable()
export class PokemonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listSpecies() {
    return this.prisma.pokemonSpecies.findMany({
      orderBy: { pokeApiId: "asc" },
      take: 151
    });
  }

  async listMyPokemons(userId: string) {
    return this.prisma.userPokemon.findMany({
      where: { userId },
      include: { species: true },
      orderBy: [{ level: "desc" }, { wins: "desc" }]
    });
  }

  async claimStarter(userId: string, dto: ClaimPokemonDto) {
    const userPokemonCount = await this.prisma.userPokemon.count({ where: { userId } });
    if (userPokemonCount > 0) {
      throw new BadRequestException("starterAlreadyClaimed");
    }
    const species = await this.prisma.pokemonSpecies.findUnique({
      where: { name: dto.speciesName.toLowerCase() }
    });
    if (!species) {
      throw new NotFoundException("speciesNotFound");
    }

    const createdPokemon = await this.prisma.userPokemon.create({
      data: {
        userId,
        speciesId: species.id,
        currentHp: species.baseHp,
        atk: species.baseAtk,
        def: species.baseDef,
        speed: species.baseSpeed
      },
      include: { species: true }
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
      where: { id: userPokemonId, userId },
      include: { species: true }
    });
    if (!userPokemon) {
      throw new NotFoundException("userPokemonNotFound");
    }
    if (!userPokemon.species.evolutionTarget || !userPokemon.species.evolutionLevel) {
      throw new BadRequestException("pokemonHasNoEvolution");
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

    const evolvedPokemon = await this.prisma.userPokemon.update({
      where: { id: userPokemon.id },
      data: {
        speciesId: targetSpecies.id,
        currentHp: targetSpecies.baseHp + userPokemon.level * 2,
        atk: targetSpecies.baseAtk + userPokemon.level,
        def: targetSpecies.baseDef + userPokemon.level,
        speed: targetSpecies.baseSpeed + Math.floor(userPokemon.level / 2),
        evolveCooldownUntil: new Date(Date.now() + 12 * 60 * 60 * 1000)
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
}
