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
  };
};

type Species = {
  name: string;
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

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Pokemon</h1>
      {myPokemonsQuery.data && myPokemonsQuery.data.length > 0 ? (
        <section style={{ display: "grid", gap: 12 }}>
          {myPokemonsQuery.data.map((pokemon) => (
            <article key={pokemon.id} style={{ background: "var(--SurfaceDark)", padding: 12, borderRadius: 10 }}>
              <strong>{pokemon.species.name}</strong>
              <div>Level: {pokemon.level}</div>
              <div>W/L: {pokemon.wins}/{pokemon.losses}</div>
            </article>
          ))}
        </section>
      ) : (
        <section style={{ display: "grid", gap: 8 }}>
          <p>NenhumPokemonAinda</p>
          {speciesQuery.data?.slice(0, 3).map((species) => (
            <button
              key={species.name}
              onClick={() => claimMutation.mutate(species.name)}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "10px 12px",
                background: "var(--PrimaryBlue)",
                color: "white",
                cursor: "pointer"
              }}
            >
              Claim {species.name}
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
