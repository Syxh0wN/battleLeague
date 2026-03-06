"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFetch } from "../../../lib/api";

type BattleTurn = {
  id: string;
  action: string;
  damage: number;
  actorUserId: string;
  challengerHp: number;
  opponentHp: number;
  createdAt: string;
};

type BattleDetails = {
  id: string;
  status: "pending" | "active" | "finished" | "expired";
  scheduledStartAt: string;
  fallbackAiForOfflineOpponent: boolean;
  winnerUserId: string | null;
  challenger: { id: string; displayName: string };
  opponent: { id: string; displayName: string };
  challengerPokemon: {
    id: string;
    level: number;
    species: { name: string; imageUrl: string | null };
  };
  opponentPokemon: {
    id: string;
    level: number;
    species: { name: string; imageUrl: string | null };
  };
  turns: BattleTurn[];
};

type TurnResponse = {
  battleId: string;
};

export default function BattleDetailsPage() {
  const params = useParams<{ battleId: string }>();
  const battleId = String(params.battleId ?? "");
  const queryClient = useQueryClient();
  const [turnError, setTurnError] = useState("");

  const battleQuery = useQuery({
    queryKey: ["battleDetails", battleId],
    queryFn: () => ApiFetch<BattleDetails>(`/battles/${battleId}`),
    enabled: battleId.length > 0,
    refetchInterval: 4000
  });

  const turnMutation = useMutation({
    mutationFn: (action: "attack" | "defend" | "skill") =>
      ApiFetch<TurnResponse>(`/battles/${battleId}/turn`, {
        method: "POST",
        body: JSON.stringify({
          action,
          idempotencyKey: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        })
      }),
    onSuccess: () => {
      setTurnError("");
      void queryClient.invalidateQueries({ queryKey: ["battleDetails", battleId] });
    },
    onError: () => {
      setTurnError("Nao foi possivel enviar o turno. Verifique se a batalha ainda esta ativa.");
    }
  });

  useEffect(() => {
    if (!battleId) {
      return;
    }
    const ping = async () => {
      try {
        await ApiFetch<{ ok: boolean }>("/battles/presence", { method: "POST" });
      } catch {}
    };
    void ping();
    const intervalId = window.setInterval(() => {
      void ping();
    }, 20_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [battleId]);

  const battle = battleQuery.data;
  const lastTurn = useMemo(() => {
    if (!battle || battle.turns.length === 0) {
      return null;
    }
    return battle.turns[battle.turns.length - 1];
  }, [battle]);

  const challengerCurrentHp = lastTurn?.challengerHp ?? 0;
  const opponentCurrentHp = lastTurn?.opponentHp ?? 0;
  const scheduledStartAt = battle ? new Date(battle.scheduledStartAt) : null;
  const battleStartsInMs = scheduledStartAt ? Math.max(0, scheduledStartAt.getTime() - Date.now()) : 0;
  const battleStartsInSec = Math.floor(battleStartsInMs / 1000);
  const canPlayTurn = battle?.status === "active";

  return (
    <main className="BattleDetailRoot">
      <section className="BattleDetailHero">
        <div>
          <span className="BattleDetailTag">DetalheDaBatalha</span>
          <h1>Batalha {battleId}</h1>
          <p>Acompanhe o estado da partida e envie seus turnos em tempo real.</p>
        </div>
        <nav className="PageQuickNav">
          <Link className="PageQuickNavLink" href="/battles">
            Voltar para Battles
          </Link>
          <Link className="PageQuickNavLink" href="/pokemon">
            Ir para Pokemon
          </Link>
        </nav>
      </section>

      {battleQuery.isLoading ? <section className="BattleDetailSection">Carregando batalha...</section> : null}
      {battleQuery.isError || !battle ? <section className="BattleDetailSection">Nao foi possivel carregar a batalha.</section> : null}

      {battle ? (
        <>
          <section className="BattleDetailSection">
            <div className="BattleDetailHeaderRow">
              <h2>Status da partida</h2>
              <small>Status: {battle.status}</small>
            </div>
            {battle.status === "pending" ? (
              <div className="BattleTinyNote">
                Duelo agendado. Inicio em {battleStartsInSec}s.
              </div>
            ) : null}
            {battle.fallbackAiForOfflineOpponent ? (
              <div className="BattleTinyNote">Se o oponente ficar offline, a IA luta por ele automaticamente.</div>
            ) : null}
            <div className="BattleVersusGrid">
              <article className="BattleFighterCard">
                <strong>{battle.challenger.displayName}</strong>
                <small>{battle.challengerPokemon.species.name} Lv {battle.challengerPokemon.level}</small>
                <small>HP atual: {challengerCurrentHp}</small>
              </article>
              <article className="BattleFighterCard">
                <strong>{battle.opponent.displayName}</strong>
                <small>{battle.opponentPokemon.species.name} Lv {battle.opponentPokemon.level}</small>
                <small>HP atual: {opponentCurrentHp}</small>
              </article>
            </div>
            {battle.winnerUserId ? <div className="BattleWinnerBox">Vencedor: {battle.winnerUserId}</div> : null}
          </section>

          <section className="BattleDetailSection">
            <div className="BattleDetailHeaderRow">
              <h2>Enviar turno</h2>
              <small>Acao atual</small>
            </div>
            <div className="BattleActionGrid">
              <button className="BattleActionButton" onClick={() => turnMutation.mutate("attack")} disabled={turnMutation.isPending || !canPlayTurn}>
                Attack
              </button>
              <button className="BattleActionButton" onClick={() => turnMutation.mutate("defend")} disabled={turnMutation.isPending || !canPlayTurn}>
                Defend
              </button>
              <button className="BattleActionButton" onClick={() => turnMutation.mutate("skill")} disabled={turnMutation.isPending || !canPlayTurn}>
                Skill
              </button>
            </div>
            {turnError ? <div className="BattleErrorBox">{turnError}</div> : null}
          </section>

          <section className="BattleDetailSection">
            <div className="BattleDetailHeaderRow">
              <h2>Historico de turnos</h2>
              <small>{battle.turns.length} turno(s)</small>
            </div>
            <div className="BattleTurnsList">
              {battle.turns.length === 0 ? (
                <div className="BattleTinyNote">Ainda nao ha turnos registrados.</div>
              ) : (
                battle.turns
                  .slice()
                  .reverse()
                  .map((turn) => (
                    <article key={turn.id} className="BattleTurnCard">
                      <strong>{turn.action.toUpperCase()}</strong>
                      <small>Dano: {turn.damage}</small>
                      <small>
                        HP C/O: {turn.challengerHp}/{turn.opponentHp}
                      </small>
                    </article>
                  ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
