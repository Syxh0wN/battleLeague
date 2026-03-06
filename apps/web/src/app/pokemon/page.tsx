"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";

type UserPokemon = {
  id: string;
  level: number;
  xp: number;
  currentHp: number;
  atk: number;
  def: number;
  speed: number;
  wins: number;
  losses: number;
  restCooldownUntil: string | null;
  evolveCooldownUntil: string | null;
  species: {
    name: string;
    typePrimary: string;
    imageUrl?: string | null;
  };
};

type Species = {
  id: string;
  name: string;
  typePrimary: string;
  imageUrl: string | null;
};

export default function PokemonPage() {
  const queryClient = useQueryClient();
  const myPokemonsQuery = useQuery({
    queryKey: ["myPokemons"],
    queryFn: () => ApiFetch<UserPokemon[]>("/pokemon/my")
  });
  const speciesQuery = useQuery({
    queryKey: ["species"],
    queryFn: () => ApiFetch<Species[]>("/pokemon/species")
  });

  const claimMutation = useMutation({
    mutationFn: (speciesName: string) =>
      ApiFetch("/pokemon/claimStarter", {
        method: "POST",
        body: JSON.stringify({ speciesName })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
    }
  });

  const myPokemons = myPokemonsQuery.data ?? [];
  const starters = (speciesQuery.data ?? []).slice(0, 3);

  const formatCooldown = (value: string | null) => {
    if (!value) {
      return "Pronto";
    }
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) {
      return "Pronto";
    }
    if (target.getTime() <= Date.now()) {
      return "Pronto";
    }
    return target.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <main className="PokemonRoot">
      <section className="PokemonHero">
        <div className="PokemonHeroTop">
          <span className="PokemonHeroTag">BaseDoTreinador</span>
          <h1>Centro Pokemon</h1>
          <p>Aqui voce monta seu elenco, define seu starter e prepara os campeoes para a proxima batalha.</p>
        </div>
        <div className="PokemonHeroPills">
          <span>Evolucao por level</span>
          <span>Cooldown de descanso</span>
          <span>Historico de performance</span>
        </div>
      </section>

      <nav className="PageQuickNav">
        <Link className="PageQuickNavLink" href="/dashboard">
          Voltar para Dashboard
        </Link>
        <Link className="PageQuickNavLink" href="/battles">
          Ir para Battles
        </Link>
        <Link className="PageQuickNavLink" href="/social">
          Ir para Social
        </Link>
      </nav>

      {myPokemons.length > 0 ? (
        <section className="PokemonSection">
          <div className="PokemonSectionHeader">
            <h2>Seu time atual</h2>
            <small>{myPokemons.length} pokemon(s)</small>
          </div>
          <div className="PokemonGrid">
            {myPokemons.map((pokemon) => (
              <article key={pokemon.id} className="PokemonCard">
                <div className="PokemonCardImageWrap">
                  {pokemon.species.imageUrl ? (
                    <img src={pokemon.species.imageUrl} alt={pokemon.species.name} className="PokemonCardImage" />
                  ) : (
                    <div className="PokemonCardImageFallback">PK</div>
                  )}
                </div>
                <div className="PokemonCardMeta">
                  <strong>{pokemon.species.name}</strong>
                  <div className="PokemonMetaTopLine">
                    <small>Tipo: {pokemon.species.typePrimary}</small>
                    <small>Level: {pokemon.level}</small>
                  </div>
                  <div className="PokemonStatsGrid">
                    <span>HP {pokemon.currentHp}</span>
                    <span>ATK {pokemon.atk}</span>
                    <span>DEF {pokemon.def}</span>
                    <span>SPD {pokemon.speed}</span>
                    <span>XP {pokemon.xp}</span>
                  </div>
                  <small>
                    W/L: {pokemon.wins}/{pokemon.losses}
                  </small>
                  <div className="PokemonCooldowns">
                    <small>Descanso: {formatCooldown(pokemon.restCooldownUntil)}</small>
                    <small>Evolucao: {formatCooldown(pokemon.evolveCooldownUntil)}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="PokemonSection">
          <div className="PokemonEmptyState">
            <div className="PokemonEmptyIcon">PK</div>
            <div className="PokemonEmptyContent">
              <strong>Seu time ainda esta vazio</strong>
              <p>Escolha um starter agora para liberar duelos, ganhar XP e iniciar sua jornada no ranking.</p>
            </div>
          </div>

          <div className="StarterGrid">
            {starters.map((species) => (
              <article key={species.id} className="StarterCard">
                <div className="StarterImageWrap">
                  {species.imageUrl ? (
                    <img src={species.imageUrl} alt={species.name} className="StarterImage" />
                  ) : (
                    <div className="StarterImageFallback">PK</div>
                  )}
                </div>
                <div className="StarterMeta">
                  <strong>{species.name}</strong>
                  <small>Tipo: {species.typePrimary}</small>
                </div>
                <button className="StarterClaimButton" onClick={() => claimMutation.mutate(species.name)}>
                  Escolher {species.name}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
