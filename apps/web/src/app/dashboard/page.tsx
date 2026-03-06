"use client";

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
  wins: number;
  losses: number;
  species: {
    name: string;
    typePrimary: string;
    imageUrl: string | null;
  };
};

export default function DashboardPage() {
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/users/me")
  });
  const championsQuery = useQuery({
    queryKey: ["myChampions"],
    queryFn: () => ApiFetch<ChampionItem[]>("/users/me/champions")
  });

  if (meQuery.isLoading) {
    return <main className="DashboardRoot">Carregando dashboard...</main>;
  }
  if (meQuery.error || !meQuery.data) {
    return <main className="DashboardRoot">Falha ao carregar dashboard.</main>;
  }

  const me = meQuery.data;
  const champions = championsQuery.data ?? [];

  return (
    <main className="DashboardRoot">
      <section className="DashboardHero">
        <div className="DashboardHeroTitle">
          <span className="DashboardHeroTag">PainelDoTreinador</span>
          <h1>{me.displayName}</h1>
          <p>Acompanhe seu progresso, seus campeoes e os proximos passos da temporada.</p>
        </div>

        <div className="DashboardStatsGrid">
          <article className="DashboardStatCard">
            <span className="DashboardIconTile">LV</span>
            <div>
              <small>Level atual</small>
              <strong>{me.level}</strong>
            </div>
          </article>

          <article className="DashboardStatCard">
            <span className="DashboardIconTile">XP</span>
            <div>
              <small>Experiencia</small>
              <strong>{me.xp}</strong>
            </div>
          </article>

          <article className="DashboardStatCard">
            <span className="DashboardIconTile">CO</span>
            <div>
              <small>Coins</small>
              <strong>{me.coins}</strong>
            </div>
          </article>

          <article className="DashboardStatCard">
            <span className="DashboardIconTile">WL</span>
            <div>
              <small>Win Rate</small>
              <strong>{me.stats.winRate}%</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="DashboardSection">
        <div className="DashboardSectionHeader">
          <h2>Navegacao rapida</h2>
        </div>
        <nav className="DashboardNavGrid">
          <Link className="DashboardNavCard" href="/pokemon">
            <strong>Pokemons</strong>
            <span>Colecao, evolucao e status do seu time.</span>
          </Link>
          <Link className="DashboardNavCard" href="/battles">
            <strong>Battles</strong>
            <span>Desafios, turnos e historico de duelo.</span>
          </Link>
          <Link className="DashboardNavCard" href="/social">
            <strong>Social</strong>
            <span>Amigos, perfis e campeoes em destaque.</span>
          </Link>
        </nav>
      </section>

      <section className="DashboardSection">
        <div className="DashboardSectionHeader">
          <h2>Campeoes do seu time</h2>
          <small>
            W/L total: {me.stats.totalWins}/{me.stats.totalLosses}
          </small>
        </div>
        {champions.length === 0 ? (
          <div className="DashboardEmptyState">Sem campeoes ainda. Capture seu primeiro pokemon para montar o time.</div>
        ) : (
          <div className="ChampionGrid">
            {champions.map((champion) => (
              <article className="ChampionCard" key={champion.id}>
                <div className="ChampionImageWrap">
                  {champion.species.imageUrl ? (
                    <img src={champion.species.imageUrl} alt={champion.species.name} className="ChampionImage" />
                  ) : (
                    <div className="ChampionImageFallback">PK</div>
                  )}
                </div>
                <div className="ChampionMeta">
                  <strong>{champion.species.name}</strong>
                  <small>Tipo: {champion.species.typePrimary}</small>
                  <small>
                    Level {champion.level} | W/L {champion.wins}/{champion.losses}
                  </small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
