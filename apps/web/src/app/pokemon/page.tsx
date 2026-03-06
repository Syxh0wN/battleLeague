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

const SectionCardClass = "rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:-translate-y-px hover:border-slate-400 sm:w-auto";
const PrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl border border-blue-400/70 bg-blue-500/25 px-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-px hover:border-yellow-300/70 hover:bg-blue-500/35";

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
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl border border-blue-500/30 bg-slate-900/80 p-4 shadow-2xl sm:p-5">
        <div className="grid gap-2">
          <span className="inline-flex w-fit rounded-full border border-blue-400/60 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">BaseDoTreinador</span>
          <h1>Centro Pokemon</h1>
          <p className="text-sm text-slate-300 sm:text-base">Aqui voce monta seu elenco, define seu starter e prepara os campeoes para a proxima batalha.</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Evolucao por level</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Cooldown de descanso</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Historico de performance</span>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2">
        <Link className={NavLinkClass} href="/dashboard">
          Voltar para Dashboard
        </Link>
        <Link className={NavLinkClass} href="/battles">
          Ir para Batalhas
        </Link>
        <Link className={NavLinkClass} href="/social">
          Ir para Social
        </Link>
      </nav>

      {myPokemons.length > 0 ? (
        <section className={SectionCardClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2>Seu time atual</h2>
            <small className="text-slate-300">{myPokemons.length} pokemon(s)</small>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {myPokemons.map((pokemon) => {
              const totalBattles = pokemon.wins + pokemon.losses;
              const winRate = totalBattles === 0 ? 0 : Math.round((pokemon.wins / totalBattles) * 100);
              const xpLevelProgress = Math.max(0, Math.min(100, pokemon.xp % 100));
              const restIsReady = formatCooldown(pokemon.restCooldownUntil) === "Pronto";
              const evolveIsReady = formatCooldown(pokemon.evolveCooldownUntil) === "Pronto";
              return (
                <article key={pokemon.id} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3">
                  <div className="grid h-24 w-full place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/70 sm:h-28">
                    {pokemon.species.imageUrl ? (
                      <img src={pokemon.species.imageUrl} alt={pokemon.species.name} className="h-full w-full object-contain" />
                    ) : (
                      <div className="text-xs font-bold text-slate-400">PK</div>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="capitalize">{pokemon.species.name}</strong>
                      <span className="rounded-full border border-yellow-300/60 bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-100">Nivel {pokemon.level}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-teal-400/60 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-teal-100">{pokemon.species.typePrimary}</span>
                      <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                        V/D {pokemon.wins}/{pokemon.losses}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-200 sm:text-xs">
                      <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1">HP {pokemon.currentHp}</span>
                      <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1">ATK {pokemon.atk}</span>
                      <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1">DEF {pokemon.def}</span>
                      <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1">SPD {pokemon.speed}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                      <small>XP {pokemon.xp}</small>
                      <small>{xpLevelProgress}% para proximo nivel</small>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${xpLevelProgress}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                      <small>Taxa de vitoria</small>
                      <small>{winRate}%</small>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${winRate}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${restIsReady ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100" : "border-amber-400/70 bg-amber-500/20 text-amber-100"}`}>
                        Descanso {restIsReady ? "Pronto" : formatCooldown(pokemon.restCooldownUntil)}
                      </span>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${evolveIsReady ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100" : "border-amber-400/70 bg-amber-500/20 text-amber-100"}`}>
                        Evolucao {evolveIsReady ? "Pronto" : formatCooldown(pokemon.evolveCooldownUntil)}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className={SectionCardClass}>
          <div className="mb-4 grid gap-3 rounded-xl border border-dashed border-slate-600 p-3 sm:p-4 md:grid-cols-[44px_1fr] md:items-center">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-xs font-bold text-slate-300">PK</div>
            <div className="grid gap-1">
              <strong>Seu time ainda esta vazio</strong>
              <p className="text-sm text-slate-300">Escolha um starter agora para liberar duelos, ganhar XP e iniciar sua jornada no ranking.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {starters.map((species) => (
              <article key={species.id} className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                <div className="grid h-24 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/70">
                  {species.imageUrl ? (
                    <img src={species.imageUrl} alt={species.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="text-xs font-bold text-slate-400">PK</div>
                  )}
                </div>
                <div className="grid gap-1">
                  <strong className="capitalize">{species.name}</strong>
                  <small className="text-slate-300">Tipo: {species.typePrimary}</small>
                </div>
                <button className={PrimaryButtonClass} onClick={() => claimMutation.mutate(species.name)}>
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
