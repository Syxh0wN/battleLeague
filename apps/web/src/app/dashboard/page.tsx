"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";

type MeResponse = {
  displayName: string;
  level: number;
  xp: number;
  coins: number;
  stats: {
    totalWins: number;
    totalLosses: number;
    winRate: number;
  };
};

export default function DashboardPage() {
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/users/me")
  });

  if (meQuery.isLoading) {
    return <main style={{ padding: 24 }}>CarregandoDashboard...</main>;
  }
  if (meQuery.error || !meQuery.data) {
    return <main style={{ padding: 24 }}>FalhaAoCarregarDashboard</main>;
  }

  const me = meQuery.data;

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      <section style={{ background: "var(--SurfaceDark)", padding: 16, borderRadius: 12 }}>
        <strong>{me.displayName}</strong>
        <div>Level: {me.level}</div>
        <div>XP: {me.xp}</div>
        <div>Coins: {me.coins}</div>
        <div>
          W/L: {me.stats.totalWins}/{me.stats.totalLosses} ({me.stats.winRate}%)
        </div>
      </section>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/pokemon">Pokemons</Link>
        <Link href="/battles">Battles</Link>
        <Link href="/social">Social</Link>
      </nav>
    </main>
  );
}
