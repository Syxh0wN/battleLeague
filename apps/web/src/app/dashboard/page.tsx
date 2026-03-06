"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";

type MeResponse = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  coins: number;
  stats: {
    totalWins: number;
    totalLosses: number;
    winRate: number;
  };
};

type ChampionItem = {
  id: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  restCooldownUntil: string | null;
  evolveCooldownUntil: string | null;
  species: {
    name: string;
    typePrimary: string;
    imageUrl: string | null;
    evolutionTarget: string | null;
    evolutionLevel: number | null;
  };
};

const SectionCardClass = "rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass = "rounded-xl border border-slate-700 bg-slate-900/70 p-3 transition hover:-translate-y-0.5 hover:border-blue-400/70";

export default function DashboardPage() {
  const [nowMs, setNowMs] = useState(Date.now());
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/users/me")
  });
  const championsQuery = useQuery({
    queryKey: ["myChampions"],
    queryFn: () => ApiFetch<ChampionItem[]>("/users/me/champions")
  });

  const me = meQuery.data ?? null;
  const champions = championsQuery.data ?? [];
  const xpCurrentLevel = me ? me.xp % 100 : 0;
  const xpToNextLevel = 100 - xpCurrentLevel;
  const xpProgressPercent = Math.max(0, Math.min(100, Math.round((xpCurrentLevel / 100) * 100)));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const categorizedChampions = useMemo(() => {
    const restCooldownWindowMs = 2 * 60 * 60 * 1000;
    const tired: ChampionItem[] = [];
    const evolutionReady: ChampionItem[] = [];
    const ready: ChampionItem[] = [];

    for (const champion of champions) {
      const restUntilMs = champion.restCooldownUntil ? new Date(champion.restCooldownUntil).getTime() : 0;
      const isTired = restUntilMs > nowMs;
      const canEvolve =
        !!champion.species.evolutionTarget &&
        !!champion.species.evolutionLevel &&
        champion.level >= champion.species.evolutionLevel &&
        (!champion.evolveCooldownUntil || new Date(champion.evolveCooldownUntil).getTime() <= nowMs);
      if (isTired) {
        tired.push(champion);
      } else if (canEvolve) {
        evolutionReady.push(champion);
      } else {
        ready.push(champion);
      }
    }

    return { tired, evolutionReady, ready, restCooldownWindowMs };
  }, [champions, nowMs]);

  const renderChampionCard = (champion: ChampionItem) => {
    const totalBattles = champion.wins + champion.losses;
    const winRate = totalBattles === 0 ? 0 : Math.round((champion.wins / totalBattles) * 100);
    const restCooldownUntilMs = champion.restCooldownUntil ? new Date(champion.restCooldownUntil).getTime() : 0;
    const restRemainingMs = Math.max(0, restCooldownUntilMs - nowMs);
    const restRemainingMin = Math.ceil(restRemainingMs / 60_000);
    const isTired = restRemainingMs > 0;
    const restProgressPercent = isTired
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((categorizedChampions.restCooldownWindowMs - restRemainingMs) / categorizedChampions.restCooldownWindowMs) * 100)
          )
        )
      : 100;
    const hasEvolution = !!champion.species.evolutionTarget && !!champion.species.evolutionLevel;
    const needLevel = hasEvolution && champion.species.evolutionLevel ? Math.max(0, champion.species.evolutionLevel - champion.level) : 0;
    const evolveCooldownMs = champion.evolveCooldownUntil ? new Date(champion.evolveCooldownUntil).getTime() - nowMs : 0;
    const evolveCooldownMin = Math.ceil(Math.max(0, evolveCooldownMs) / 60_000);
    const evolutionStatus = !hasEvolution
      ? "Sem evolucao"
      : needLevel > 0
        ? `Evolucao em ${needLevel} lv`
        : evolveCooldownMs > 0
          ? `Evolucao em cooldown ${evolveCooldownMin}min`
          : "Pronto para evoluir";

    return (
      <article className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 sm:grid-cols-[88px_1fr]" key={champion.id}>
        <div className="h-[88px] w-full max-w-[88px] overflow-hidden rounded-xl border border-slate-700 bg-slate-800/70">
          {champion.species.imageUrl ? (
            <img src={champion.species.imageUrl} alt={champion.species.name} className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs font-bold text-slate-400">PK</div>
          )}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <strong className="truncate capitalize">{champion.species.name}</strong>
            <span className="rounded-full border border-yellow-300/60 bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-100">Nivel {champion.level}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-teal-400/60 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-teal-100">{champion.species.typePrimary}</span>
            <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200">V/D {champion.wins}/{champion.losses}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <small>Taxa de vitoria {winRate}%</small>
            <small>{totalBattles} duelos</small>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400" style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <small>Cansaco</small>
            <small>{isTired ? `${restRemainingMin}min` : "Pronto"}</small>
          </div>
          <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
            <div
              className={`h-full rounded-full ${isTired ? "bg-gradient-to-r from-amber-500 to-red-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
              style={{ width: `${restProgressPercent}%` }}
            />
          </div>
          <div className="rounded-lg border border-slate-600 bg-slate-800/70 px-2 py-1 text-xs text-slate-200">{evolutionStatus}</div>
        </div>
      </article>
    );
  };

  if (meQuery.isLoading) {
    return <main className="min-h-screen p-3 sm:p-4 lg:p-6">Carregando dashboard...</main>;
  }
  if (meQuery.error || !me) {
    return <main className="min-h-screen p-3 sm:p-4 lg:p-6">Falha ao carregar dashboard.</main>;
  }

  return (
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl border border-blue-500/30 bg-slate-900/80 p-4 shadow-2xl sm:p-5">
        <div className="grid gap-2">
          <span className="inline-flex w-fit rounded-full border border-blue-400/60 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">PainelDoTreinador</span>
          <h1>{me.displayName}</h1>
          <p className="text-sm text-slate-300 sm:text-base">Acompanhe seu progresso, seus campeoes e os proximos passos da temporada.</p>
        </div>

        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <article className="grid grid-cols-[36px_1fr] gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:grid-cols-[40px_1fr]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-400/50 bg-blue-500/20 text-[10px] font-bold sm:h-10 sm:w-10 sm:text-xs">LV</span>
            <div className="grid gap-1">
              <small>Nivel atual</small>
              <strong>{me.level}</strong>
              <div className="text-xs text-slate-300">
                <small>
                  Proximo nivel {me.level + 1} em {xpToNextLevel} XP
                </small>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${xpProgressPercent}%` }} />
              </div>
            </div>
          </article>

          <article className="grid grid-cols-[36px_1fr] gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:grid-cols-[40px_1fr]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/50 bg-indigo-500/20 text-[10px] font-bold sm:h-10 sm:w-10 sm:text-xs">XP</span>
            <div className="grid gap-1">
              <small>Experiencia</small>
              <strong>{me.xp}</strong>
              <div className="text-xs text-slate-300">
                <small>
                  Faltam {xpToNextLevel} XP para nivel {me.level + 1}
                </small>
              </div>
              <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{ width: `${xpProgressPercent}%` }} />
              </div>
              <div className="text-xs text-slate-300">
                <small>
                  Progresso do nivel: {xpCurrentLevel}/100
                </small>
              </div>
            </div>
          </article>

          <article className="grid grid-cols-[36px_1fr] gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:grid-cols-[40px_1fr]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/50 bg-amber-500/20 text-[10px] font-bold sm:h-10 sm:w-10 sm:text-xs">CO</span>
            <div className="grid gap-1">
              <small>Coins</small>
              <strong>{me.coins}</strong>
            </div>
          </article>

          <article className="grid grid-cols-[36px_1fr] gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-3 sm:grid-cols-[40px_1fr]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/50 bg-emerald-500/20 text-[10px] font-bold sm:h-10 sm:w-10 sm:text-xs">WL</span>
            <div className="grid gap-1">
              <small>Taxa de vitoria</small>
              <strong>{me.stats.winRate}%</strong>
            </div>
          </article>
        </div>
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 grid gap-1">
          <h2>Navegacao rapida</h2>
        </div>
        <nav className="grid gap-3 md:grid-cols-3">
          <Link className={`${NavLinkClass} grid gap-2`} href="/pokemon">
            <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-400/60 bg-blue-500/20 text-[10px] font-bold">PK</span>
              <strong>Pokemon</strong>
              <small className="rounded-full border border-blue-400/60 bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold">Entrar</small>
            </div>
            <span className="text-sm text-slate-300">Colecao, evolucao e status do seu time.</span>
          </Link>
          <Link className={`${NavLinkClass} grid gap-2`} href="/battles">
            <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-400/60 bg-blue-500/20 text-[10px] font-bold">BT</span>
              <strong>Batalhas</strong>
              <small className="rounded-full border border-blue-400/60 bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold">Entrar</small>
            </div>
            <span className="text-sm text-slate-300">Desafios, turnos e historico de duelo.</span>
          </Link>
          <Link className={`${NavLinkClass} grid gap-2`} href="/social">
            <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-400/60 bg-blue-500/20 text-[10px] font-bold">SC</span>
              <strong>Social</strong>
              <small className="rounded-full border border-blue-400/60 bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold">Entrar</small>
            </div>
            <span className="text-sm text-slate-300">Amigos, perfis e campeoes em destaque.</span>
          </Link>
        </nav>
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Campeoes do seu time</h2>
          <small className="text-slate-300">
            V/D total: {me.stats.totalWins}/{me.stats.totalLosses}
          </small>
        </div>
        {champions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-4 text-sm text-slate-300">Sem campeoes ainda. Capture seu primeiro pokemon para montar o time.</div>
        ) : (
          <div className="grid gap-3">
            {categorizedChampions.tired.length > 0 ? (
              <section className="grid gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>Em descanso</strong>
                  <small className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs">{categorizedChampions.tired.length}</small>
                </div>
                <div className="grid gap-3">{categorizedChampions.tired.map((champion) => renderChampionCard(champion))}</div>
              </section>
            ) : null}
            {categorizedChampions.evolutionReady.length > 0 ? (
              <section className="grid gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>Prontos para evoluir</strong>
                  <small className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs">{categorizedChampions.evolutionReady.length}</small>
                </div>
                <div className="grid gap-3">{categorizedChampions.evolutionReady.map((champion) => renderChampionCard(champion))}</div>
              </section>
            ) : null}
            {categorizedChampions.ready.length > 0 ? (
              <section className="grid gap-2 rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong>Prontos para batalha</strong>
                  <small className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs">{categorizedChampions.ready.length}</small>
                </div>
                <div className="grid gap-3">{categorizedChampions.ready.map((champion) => renderChampionCard(champion))}</div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
