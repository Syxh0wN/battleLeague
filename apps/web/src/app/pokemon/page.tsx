"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type UserPokemon = {
  id: string;
  level: number;
  wins: number;
  losses: number;
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

  return (
    <main className="PokemonRoot">
      <section className="PokemonHero">
        <h1>Centro Pokemon</h1>
        <p>Gerencie seu time, escolha seu starter e acompanhe a evolucao de cada campeao.</p>
      </section>

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
                  <small>Tipo: {pokemon.species.typePrimary}</small>
                  <small>Level: {pokemon.level}</small>
                  <small>
                    W/L: {pokemon.wins}/{pokemon.losses}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="PokemonSection">
          <div className="PokemonEmptyState">
            <strong>Voce ainda nao tem pokemon</strong>
            <p>Escolha seu starter para comecar as batalhas.</p>
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
