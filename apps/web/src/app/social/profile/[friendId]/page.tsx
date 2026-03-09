"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiFetch } from "../../../../lib/api";

type PublicPokemon = {
  id: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  currentHp: number;
  atk: number;
  def: number;
  speed: number;
  isLegacy: boolean;
  species: {
    name: string;
    typePrimary: string;
    imageUrl?: string | null;
  };
};

type PublicProfile = {
  id: string;
  displayName: string;
  accountTag?: string | null;
  avatarUrl?: string | null;
  level: number;
  mmr: number;
  totalWins: number;
  totalLosses: number;
  totalPokemons: number;
  activePokemons: PublicPokemon[];
  legacyPokemons: PublicPokemon[];
};

const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 w-auto items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";

function GetLeagueByMmr(mmr: number) {
  if (mmr >= 3000) return "Ruby 1";
  if (mmr >= 2700) return "Ruby 2";
  if (mmr >= 2400) return "Ruby 3";
  if (mmr >= 2300) return "Diamante 1";
  if (mmr >= 2200) return "Diamante 2";
  if (mmr >= 2100) return "Diamante 3";
  if (mmr >= 2000) return "Platina 1";
  if (mmr >= 1900) return "Platina 2";
  if (mmr >= 1800) return "Platina 3";
  if (mmr >= 1700) return "Ouro 1";
  if (mmr >= 1600) return "Ouro 2";
  if (mmr >= 1500) return "Ouro 3";
  if (mmr >= 1400) return "Prata 1";
  if (mmr >= 1300) return "Prata 2";
  if (mmr >= 1200) return "Prata 3";
  if (mmr >= 1100) return "Bronze 1";
  if (mmr >= 1000) return "Bronze 2";
  if (mmr >= 900) return "Bronze 3";
  if (mmr >= 800) return "Ferro 1";
  if (mmr >= 700) return "Ferro 2";
  return "Ferro 3";
}

function ParseLeague(league: string) {
  const [baseLeague, tierRaw] = league.split(" ");
  const tier = Number(tierRaw);
  return {
    baseLeague,
    tier: Number.isFinite(tier) && tier >= 1 && tier <= 3 ? tier : 3
  };
}

function BuildLeagueToneClass(league: string) {
  const { baseLeague } = ParseLeague(league);
  if (baseLeague === "Ferro") {
    return "from-slate-600 to-slate-400 ring-slate-400/55";
  }
  if (baseLeague === "Bronze") {
    return "from-amber-900 to-amber-600 ring-amber-500/55";
  }
  if (baseLeague === "Prata") {
    return "from-slate-300 to-slate-100 ring-slate-200/70";
  }
  if (baseLeague === "Ouro") {
    return "from-yellow-500 to-amber-300 ring-yellow-300/70";
  }
  if (baseLeague === "Platina") {
    return "from-cyan-400 to-emerald-300 ring-cyan-300/70";
  }
  if (baseLeague === "Diamante") {
    return "from-sky-400 to-indigo-300 ring-sky-300/70";
  }
  return "from-fuchsia-500 to-rose-400 ring-fuchsia-300/70";
}

function LeagueIcon({ league }: { league: string }) {
  const { baseLeague, tier } = ParseLeague(league);
  const pipCount = Math.max(1, 4 - tier);
  const iconClass = "h-5 w-5 fill-none stroke-current stroke-[1.8]";
  return (
    <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/35">
      <span className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${BuildLeagueToneClass(league)} opacity-90`} />
      <span className="absolute inset-0 rounded-2xl ring-1 ring-inset" />
      <span className="relative z-10 text-slate-950">
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path d="M12 3l7 3.6v5.7c0 4.5-2.9 7.8-7 9.7-4.1-1.9-7-5.2-7-9.7V6.6z" />
          {baseLeague === "Ferro" ? (
            <>
              <path d="M9 10h6" />
              <path d="M9 13h6" />
            </>
          ) : baseLeague === "Bronze" ? (
            <path d="M8.5 14.5l3.5-5 3.5 5z" />
          ) : baseLeague === "Prata" ? (
            <path d="M12 8.5l3.5 3.5-3.5 3.5-3.5-3.5z" />
          ) : baseLeague === "Ouro" ? (
            <path d="M12 8.1l1.3 2.7 3 .4-2.1 2 .5 2.9-2.7-1.5-2.7 1.5.5-2.9-2.1-2 3-.4z" />
          ) : baseLeague === "Platina" ? (
            <>
              <path d="M8.3 15.1h7.4l-1-4.8H9.3z" />
              <path d="M10 10.3L12 8l2 2.3" />
            </>
          ) : baseLeague === "Diamante" ? (
            <>
              <path d="M8.2 10.8l1.8-2.4h4l1.8 2.4-3.8 4.9z" />
              <path d="M8.2 10.8h7.6" />
            </>
          ) : (
            <>
              <path d="M12 8.2l2.8 1.6v3.8L12 15l-2.8-1.4V9.8z" />
              <path d="M12 6.8v1.4" />
            </>
          )}
        </svg>
      </span>
      <span className="absolute bottom-1.5 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-0.5">
        {Array.from({ length: pipCount }).map((_, index) => (
          <span key={`${league}_pip_${index}`} className="h-1 w-1 rounded-full bg-slate-900/90" />
        ))}
      </span>
    </span>
  );
}

function PokemonCard({ pokemon }: { pokemon: PublicPokemon }) {
  const totalDuels = pokemon.wins + pokemon.losses;
  const winRate = totalDuels > 0 ? Math.round((pokemon.wins / totalDuels) * 100) : 0;
  return (
    <article
      className={`grid gap-2 rounded-xl p-2 ring-1 ring-inset ${
        pokemon.isLegacy ? "bg-yellow-500/15 ring-yellow-400/45" : "bg-slate-900/70 ring-slate-700/70"
      }`}
    >
      <div className="relative grid h-20 place-items-center overflow-hidden rounded-xl bg-slate-800/70">
        <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
          {pokemon.species.typePrimary}
        </span>
        {pokemon.species.imageUrl ? (
          <img src={pokemon.species.imageUrl} alt={pokemon.species.name} className="h-14 w-14 object-contain" />
        ) : (
          <span className="text-xs font-bold text-slate-300">PK</span>
        )}
      </div>
      <div className="grid gap-1">
        <div className="flex items-center justify-between gap-2">
          <strong className="truncate capitalize text-sm text-slate-100">{pokemon.species.name}</strong>
          <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">
            Nivel {pokemon.level}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-200">
          <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">HP {pokemon.currentHp}</span>
          <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">ATK {pokemon.atk}</span>
          <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">DEF {pokemon.def}</span>
          <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">SPD {pokemon.speed}</span>
        </div>
        <div className="flex flex-wrap gap-1 text-[10px] text-slate-300">
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">
            V/D {pokemon.wins}/{pokemon.losses}
          </span>
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">Taxa {winRate}%</span>
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">XP {pokemon.xp}</span>
          {pokemon.isLegacy ? (
            <span className="rounded-full bg-yellow-500/25 px-2 py-0.5 text-yellow-100 ring-1 ring-inset ring-yellow-300/60">Legado</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function FriendProfilePage() {
  const params = useParams<{ friendId: string }>();
  const friendId = typeof params?.friendId === "string" ? params.friendId : "";
  const profileQuery = useQuery({
    queryKey: ["friendPublicProfilePage", friendId],
    queryFn: () => ApiFetch<PublicProfile>(`/users/${friendId}`),
    enabled: friendId.length > 0
  });

  const profile = profileQuery.data ?? null;
  const totalBattles = useMemo(() => {
    if (!profile) {
      return 0;
    }
    return profile.totalWins + profile.totalLosses;
  }, [profile]);
  const winRate = totalBattles > 0 && profile ? Math.round((profile.totalWins / totalBattles) * 100) : 0;
  const league = profile ? GetLeagueByMmr(profile.mmr) : "Ferro 3";

  return (
    <main className="min-h-screen content-start grid gap-3 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll mt-2 mb-2">
        <Link className={NavLinkClass} href="/social">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M5 7h14" />
              <path d="M5 12h14" />
              <path d="M5 17h14" />
            </svg>
          </span>
          Voltar para Social
        </Link>
        <Link className={NavLinkClass} href="/dashboard">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5.5 9.5V20h13V9.5" />
              <path d="M10 20v-5h4v5" />
            </svg>
          </span>
          Ir para Dashboard
        </Link>
      </nav>

      {profileQuery.isLoading ? (
        <section className={SectionCardClass}>
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Carregando perfil...</div>
        </section>
      ) : profileQuery.error || !profile ? (
        <section className={SectionCardClass}>
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Nao foi possivel carregar o perfil.</div>
        </section>
      ) : (
        <>
          <section className={SectionCardClass}>
            <div className="grid gap-3 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-slate-800/75 p-3 ring-1 ring-inset ring-slate-700/70">
              <div className="grid gap-3 sm:grid-cols-[84px_1fr] sm:items-center">
                <div className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-600/80 shadow-[0_0_18px_rgba(148,163,184,0.18)]">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-slate-300">FR</span>
                  )}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="grid gap-1.5">
                    <h1 className="text-xl font-semibold tracking-wide text-slate-100 sm:text-2xl">{profile.displayName}</h1>
                    <div className="flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-slate-800/85 px-2.5 py-0.5 text-slate-100 ring-1 ring-inset ring-slate-600/70">
                        @{profile.accountTag ?? "semConta"}
                      </span>
                      <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-indigo-100 ring-1 ring-inset ring-indigo-300/45">
                        Elo {profile.mmr}
                      </span>
                      <span className="rounded-full bg-slate-800/85 px-2.5 py-0.5 text-slate-100 ring-1 ring-inset ring-slate-600/70">Nivel {profile.level}</span>
                    </div>
                  </div>
                  <div className="grid justify-items-start gap-1 rounded-xl p-2 sm:justify-items-center">
                    <LeagueIcon league={league} />
                    <small className="text-[11px] font-semibold text-slate-200">{league}</small>
                  </div>
                </div>
              </div>
              <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2.5 ring-1 ring-inset ring-slate-700/70">
                  <small className="text-[11px] text-slate-400">Vitorias</small>
                  <strong className="text-lg font-semibold text-slate-100">{profile.totalWins}</strong>
                </article>
                <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2.5 ring-1 ring-inset ring-slate-700/70">
                  <small className="text-[11px] text-slate-400">Derrotas</small>
                  <strong className="text-lg font-semibold text-slate-100">{profile.totalLosses}</strong>
                </article>
                <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2.5 ring-1 ring-inset ring-slate-700/70">
                  <small className="text-[11px] text-slate-400">Taxa de vitoria</small>
                  <strong className="text-lg font-semibold text-slate-100">{winRate}%</strong>
                </article>
                <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2.5 ring-1 ring-inset ring-slate-700/70">
                  <small className="text-[11px] text-slate-400">Pokemons</small>
                  <strong className="text-lg font-semibold text-slate-100">{profile.totalPokemons}</strong>
                </article>
              </div>
            </div>
          </section>

          <section className={SectionCardClass}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2>Pokemons Ativos</h2>
              <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-200">{profile.activePokemons.length}</small>
            </div>
            {profile.activePokemons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem pokemons ativos.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {profile.activePokemons.map((pokemon) => (
                  <PokemonCard key={pokemon.id} pokemon={pokemon} />
                ))}
              </div>
            )}
          </section>

          <section className={SectionCardClass}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2>Pokemons Legados</h2>
              <small className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-100 ring-1 ring-inset ring-yellow-300/50">
                {profile.legacyPokemons.length}
              </small>
            </div>
            {profile.legacyPokemons.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem pokemons legados.</div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {profile.legacyPokemons.map((pokemon) => (
                  <PokemonCard key={pokemon.id} pokemon={pokemon} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
