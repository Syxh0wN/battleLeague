import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../../prisma/prisma.service";

type PokeApiPokemon = {
  id: number;
  name: string;
  types: Array<{ slot: number; type: { name: string } }>;
  stats: Array<{ base_stat: number; stat: { name: string } }>;
  sprites: { front_default: string | null };
};

type PokeApiEvolution = {
  chain: {
    species: { name: string };
    evolves_to: Array<{
      species: { name: string };
      evolution_details: Array<{ min_level: number | null }>;
      evolves_to: Array<{
        species: { name: string };
        evolution_details: Array<{ min_level: number | null }>;
      }>;
    }>;
  };
};

@Injectable()
export class IngestionService {
  private readonly fetchTimeoutMs = 12000;
  private readonly syncCooldownMs = 5 * 60_000;
  private readonly allowedHosts = new Set(["pokeapi.co"]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private async SafeFetchJson<T>(rawUrl: string): Promise<T> {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new BadRequestException("ingestionInvalidProtocol");
    }
    const hostName = parsedUrl.hostname.toLowerCase();
    const isAllowedHost = hostName === "pokeapi.co" || hostName.endsWith(".pokeapi.co") || this.allowedHosts.has(hostName);
    if (!isAllowedHost) {
      throw new BadRequestException("ingestionHostNotAllowed");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await fetch(parsedUrl.toString(), {
        signal: controller.signal
      });
      if (!response.ok) {
        throw new BadRequestException("ingestionUpstreamFailure");
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async syncCatalog(triggeredById: string, limit = 1025) {
    const runningWindowStart = new Date(Date.now() - this.syncCooldownMs);
    const runningSync = await this.prisma.catalogSyncRun.findFirst({
      where: {
        status: "running",
        startedAt: { gte: runningWindowStart }
      },
      select: { id: true, startedAt: true }
    });
    if (runningSync) {
      throw new BadRequestException("catalogSyncAlreadyRunning");
    }
    const syncRun = await this.prisma.catalogSyncRun.create({
      data: {
        triggeredById,
        status: "running",
        limitUsed: limit
      }
    });

    const list = await this.SafeFetchJson<{ results: Array<{ url: string }> }>(`https://pokeapi.co/api/v2/pokemon?limit=${limit}`);

    let upserted = 0;
    try {
      for (const item of list.results) {
        const pokemon = await this.SafeFetchJson<PokeApiPokemon>(item.url);
        const speciesResponse = await this.SafeFetchJson<{ evolution_chain: { url: string } }>(
          `https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}`
        );
        const evolution = await this.SafeFetchJson<PokeApiEvolution>(speciesResponse.evolution_chain.url);

      const hp = pokemon.stats.find((stat) => stat.stat.name === "hp")?.base_stat ?? 1;
      const atk = pokemon.stats.find((stat) => stat.stat.name === "attack")?.base_stat ?? 1;
      const def = pokemon.stats.find((stat) => stat.stat.name === "defense")?.base_stat ?? 1;
      const speed = pokemon.stats.find((stat) => stat.stat.name === "speed")?.base_stat ?? 1;
      const typePrimary = pokemon.types.find((type) => type.slot === 1)?.type.name ?? "normal";
      const typeSecondary = pokemon.types.find((type) => type.slot === 2)?.type.name ?? null;
      const evolutionTarget = this.findEvolutionTarget(evolution, pokemon.name);
      const evolutionLevel = this.findEvolutionLevel(evolution, pokemon.name);

        await this.prisma.pokemonSpecies.upsert({
          where: { pokeApiId: pokemon.id },
          update: {
            name: pokemon.name,
            typePrimary,
            typeSecondary,
            baseHp: hp,
            baseAtk: atk,
            baseDef: def,
            baseSpeed: speed,
            evolutionTarget,
            evolutionLevel,
            imageUrl: pokemon.sprites.front_default
          },
          create: {
            pokeApiId: pokemon.id,
            name: pokemon.name,
            typePrimary,
            typeSecondary,
            baseHp: hp,
            baseAtk: atk,
            baseDef: def,
            baseSpeed: speed,
            evolutionTarget,
            evolutionLevel,
            imageUrl: pokemon.sprites.front_default
          }
        });
        upserted += 1;
      }

      await this.prisma.catalogSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "finished",
          finishedAt: new Date(),
          details: JSON.stringify({ upserted })
        }
      });
      await this.auditService.write({
        actorUserId: triggeredById,
        action: "CatalogSyncExecuted",
        entityName: "PokemonSpecies",
        payload: { upserted, limit }
      });
    } catch (error) {
      await this.prisma.catalogSyncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "failed",
          finishedAt: new Date(),
          details: JSON.stringify({
            upserted,
            error: error instanceof Error ? error.message : "unknownError"
          })
        }
      });
      throw error;
    }

    return { synced: upserted, syncRunId: syncRun.id };
  }

  private findEvolutionTarget(evolution: PokeApiEvolution, currentName: string): string | null {
    const first = evolution.chain;
    if (first.species.name === currentName) {
      return first.evolves_to[0]?.species.name ?? null;
    }
    const second = first.evolves_to.find((node) => node.species.name === currentName);
    if (second) {
      return second.evolves_to[0]?.species.name ?? null;
    }
    return null;
  }

  private findEvolutionLevel(evolution: PokeApiEvolution, currentName: string): number | null {
    const first = evolution.chain;
    if (first.species.name === currentName) {
      return first.evolves_to[0]?.evolution_details[0]?.min_level ?? null;
    }
    const second = first.evolves_to.find((node) => node.species.name === currentName);
    if (second) {
      return second.evolves_to[0]?.evolution_details[0]?.min_level ?? null;
    }
    return null;
  }
}
