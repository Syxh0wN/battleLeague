"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  expiresAt: string;
  currentTurnUserId: string;
  fallbackAiForOfflineOpponent: boolean;
  winnerUserId: string | null;
  challenger: { id: string; displayName: string };
  opponent: { id: string; displayName: string };
  challengerPokemon: {
    id: string;
    level: number;
    currentHp: number;
    atk: number;
    def: number;
    speed: number;
    species: { name: string; imageUrl: string | null; typePrimary: string };
  };
  opponentPokemon: {
    id: string;
    level: number;
    currentHp: number;
    atk: number;
    def: number;
    speed: number;
    species: { name: string; imageUrl: string | null; typePrimary: string };
  };
  turns: BattleTurn[];
};

type TurnResponse = {
  battleId: string;
};

const SectionCardClass = "rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:-translate-y-px hover:border-slate-400 sm:w-auto";
const PrimaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl border border-blue-400/70 bg-blue-500/25 px-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-px hover:border-yellow-300/70 hover:bg-blue-500/35";

export default function BattleDetailsPage() {
  const params = useParams<{ battleId: string }>();
  const battleId = String(params.battleId ?? "");
  const queryClient = useQueryClient();
  const [turnError, setTurnError] = useState("");
  const [highlightTurnId, setHighlightTurnId] = useState("");
  const [highlightSide, setHighlightSide] = useState<"challenger" | "opponent" | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const autoTurnInFlightRef = useRef(false);

  const battleQuery = useQuery({
    queryKey: ["battleDetails", battleId],
    queryFn: () => ApiFetch<BattleDetails>(`/battles/${battleId}`),
    enabled: battleId.length > 0,
    refetchInterval: 4000
  });
  const meQuery = useQuery({
    queryKey: ["meForBattleDetail"],
    queryFn: () => ApiFetch<{ id: string }>("/users/me")
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
    onError: (error) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("notYourTurn")) {
        setTurnError("Agora e a vez do oponente. Aguarde o proximo turno.");
        return;
      }
      if (message.includes("battleNotStartedYet")) {
        setTurnError("A batalha ainda nao iniciou. Aguarde o horario agendado.");
        return;
      }
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const battle = battleQuery.data;
  const lastTurn = useMemo(() => {
    if (!battle || battle.turns.length === 0) {
      return null;
    }
    return battle.turns[battle.turns.length - 1];
  }, [battle]);

  useEffect(() => {
    if (!battle || !lastTurn) {
      return;
    }
    if (lastTurn.id === highlightTurnId) {
      return;
    }
    const side = lastTurn.actorUserId === battle.challenger.id ? "challenger" : "opponent";
    setHighlightTurnId(lastTurn.id);
    setHighlightSide(side);
    const timeoutId = window.setTimeout(() => {
      setHighlightSide(null);
    }, 900);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [battle, lastTurn, highlightTurnId]);

  const challengerMaxHp = battle?.challengerPokemon.currentHp ?? 1;
  const opponentMaxHp = battle?.opponentPokemon.currentHp ?? 1;
  const challengerCurrentHp = lastTurn ? lastTurn.challengerHp : challengerMaxHp;
  const opponentCurrentHp = lastTurn ? lastTurn.opponentHp : opponentMaxHp;
  const scheduledStartAt = battle ? new Date(battle.scheduledStartAt) : null;
  const battleStartsInMs = scheduledStartAt ? Math.max(0, scheduledStartAt.getTime() - nowMs) : 0;
  const battleStartsInSec = Math.floor(battleStartsInMs / 1000);
  const expiresAt = battle ? new Date(battle.expiresAt) : null;
  const battleRemainingMs = expiresAt ? Math.max(0, expiresAt.getTime() - nowMs) : 0;
  const battleRemainingSec = Math.floor(battleRemainingMs / 1000);
  const currentUserId = meQuery.data?.id ?? "";
  const isMyTurn = !!battle && currentUserId.length > 0 && battle.currentTurnUserId === currentUserId;
  const canPlayTurn = battle?.status === "active" && isMyTurn;
  const currentTurnDisplayName =
    !battle
      ? ""
      : battle.currentTurnUserId === battle.challenger.id
        ? battle.challenger.displayName
        : battle.opponent.displayName;
  const isUserChallenger = !!battle && currentUserId.length > 0 && currentUserId === battle.challenger.id;
  const challengerSideLabel = isUserChallenger ? "Voce" : "Rival";
  const opponentSideLabel = isUserChallenger ? "Rival" : "Voce";
  const challengerIsCurrentTurn = !!battle && battle.currentTurnUserId === battle.challenger.id;
  const opponentIsCurrentTurn = !!battle && battle.currentTurnUserId === battle.opponent.id;
  const lastTurnActorName =
    !battle || !lastTurn
      ? ""
      : lastTurn.actorUserId === battle.challenger.id
        ? battle.challenger.displayName
        : battle.opponent.displayName;
  const lastTurnActionLabel =
    !lastTurn
      ? ""
      : lastTurn.action === "attack"
        ? "Attack"
        : lastTurn.action === "defend"
          ? "Defend"
          : "Skill";
  const totalActions = battle?.turns.length ?? 0;
  const battleActions = battle
    ? battle.turns
        .slice()
        .reverse()
        .map((turn) => {
          const actorName = turn.actorUserId === battle.challenger.id ? battle.challenger.displayName : battle.opponent.displayName;
          const actionLabel = turn.action === "attack" ? "Attack" : turn.action === "defend" ? "Defend" : "Skill";
          const actorSide = turn.actorUserId === battle.challenger.id ? "CH" : "OP";
          const actionIcon = turn.action === "attack" ? "ATK" : turn.action === "defend" ? "DEF" : "SKL";
          return {
            id: turn.id,
            actorName,
            actorSide,
            actionLabel,
            actionIcon,
            damage: turn.damage,
            challengerHp: turn.challengerHp,
            opponentHp: turn.opponentHp
          };
        })
    : [];
  const didIWin = !!battle && !!battle.winnerUserId && battle.winnerUserId === currentUserId;
  const winnerName =
    !battle || !battle.winnerUserId
      ? ""
      : battle.winnerUserId === battle.challenger.id
        ? battle.challenger.displayName
        : battle.opponent.displayName;
  const myCurrentHp = isUserChallenger ? challengerCurrentHp : opponentCurrentHp;
  const enemyCurrentHp = isUserChallenger ? opponentCurrentHp : challengerCurrentHp;
  const expiredResultTone = myCurrentHp > enemyCurrentHp ? "win" : myCurrentHp < enemyCurrentHp ? "lose" : "draw";
  const expiredResultTitle = expiredResultTone === "win" ? "VITORIA POR TEMPO" : expiredResultTone === "lose" ? "DERROTA POR TEMPO" : "EMPATE POR TEMPO";
  const expiredResultSubtitle =
    expiredResultTone === "win"
      ? "Seu campeao terminou com mais vida e venceu por vantagem."
      : expiredResultTone === "lose"
        ? "O rival terminou com mais vida e venceu por vantagem."
        : "Os dois lados terminaram com a mesma vida no fim do tempo.";

  function PickAutoAction() {
    if (!lastTurn) {
      return "attack" as const;
    }
    const myIsChallenger = battle?.challenger.id === currentUserId;
    if (!battle || !myIsChallenger) {
      if (Math.random() < 0.2) {
        return "defend" as const;
      }
      return Math.random() < 0.35 ? ("skill" as const) : ("attack" as const);
    }
    const myHp = lastTurn.challengerHp;
    const enemyHp = lastTurn.opponentHp;
    if (myHp <= 16 && Math.random() < 0.45) {
      return "defend" as const;
    }
    if (enemyHp <= 22 && Math.random() < 0.7) {
      return "skill" as const;
    }
    return Math.random() < 0.2 ? ("defend" as const) : ("attack" as const);
  }

  function HpPercent(currentHp: number, maxHp: number) {
    if (maxHp <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
  }

  useEffect(() => {
    if (!battle || !canPlayTurn || turnMutation.isPending || battle.status !== "active" || battle.winnerUserId) {
      return;
    }
    if (autoTurnInFlightRef.current) {
      return;
    }
    autoTurnInFlightRef.current = true;
    const timeoutId = window.setTimeout(() => {
      turnMutation.mutate(PickAutoAction(), {
        onSettled: () => {
          autoTurnInFlightRef.current = false;
        }
      });
    }, 350);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [battle?.id, battle?.status, battle?.turns.length, battle?.currentTurnUserId, battle?.winnerUserId, canPlayTurn, turnMutation]);

  return (
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl border border-blue-500/30 bg-slate-900/80 p-4 shadow-2xl sm:p-5">
        <div className="grid gap-2">
          <span className="inline-flex w-fit rounded-full border border-blue-400/60 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">
            DetalheDaBatalha
          </span>
          <h1 className="text-xl font-bold sm:text-2xl">{battle ? `${battle.challenger.displayName} VS ${battle.opponent.displayName}` : "DueloEmCarregamento"}</h1>
          <p className="text-sm text-slate-300 sm:text-base">
            {battle
              ? `${battle.challengerPokemon.species.name} Nivel ${battle.challengerPokemon.level} contra ${battle.opponentPokemon.species.name} Nivel ${battle.opponentPokemon.level}`
              : "Acompanhe o estado da partida e envie seus turnos em tempo real."}
          </p>
          <small className="text-xs text-slate-400 sm:text-sm">CodigoDaBatalha: {battleId}</small>
        </div>
        {battle ? (
          <div className="mt-2 grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
            <article className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800/70">
                {battle.challengerPokemon.species.imageUrl ? (
                  <img
                    src={battle.challengerPokemon.species.imageUrl}
                    alt={battle.challengerPokemon.species.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs font-bold text-slate-400">PK</div>
                )}
              </div>
              <div className="grid gap-0.5">
                <strong>{battle.challengerPokemon.species.name}</strong>
                <small className="text-slate-300">{battle.challenger.displayName}</small>
              </div>
            </article>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/60 bg-yellow-500/20 text-xs font-bold text-yellow-100">VS</span>
            <article className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/70 p-2">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800/70">
                {battle.opponentPokemon.species.imageUrl ? (
                  <img
                    src={battle.opponentPokemon.species.imageUrl}
                    alt={battle.opponentPokemon.species.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs font-bold text-slate-400">PK</div>
                )}
              </div>
              <div className="grid gap-0.5">
                <strong>{battle.opponentPokemon.species.name}</strong>
                <small className="text-slate-300">{battle.opponent.displayName}</small>
              </div>
            </article>
          </div>
        ) : null}
        <nav className="flex flex-wrap gap-2">
          <Link className={NavLinkClass} href="/battles">
            Voltar para Batalhas
          </Link>
          <Link className={NavLinkClass} href="/pokemon">
            Ir para Pokemon
          </Link>
        </nav>
      </section>

      {battleQuery.isLoading ? <section className={SectionCardClass}>Carregando batalha...</section> : null}
      {battleQuery.isError || !battle ? <section className={SectionCardClass}>Nao foi possivel carregar a batalha.</section> : null}

      {battle ? (
        <>
          <section className={SectionCardClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2>Status da partida</h2>
              <small className="text-xs text-slate-300 sm:text-sm">Status: {battle.status}</small>
            </div>
            {battle.status === "pending" ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300 sm:text-sm">
                Duelo agendado. Inicio em {battleStartsInSec}s.
              </div>
            ) : null}
            {battle.status === "active" ? <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300 sm:text-sm">Tempo restante: {battleRemainingSec}s.</div> : null}
            {battle.status === "active" ? <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300 sm:text-sm">Turno atual: {currentTurnDisplayName}</div> : null}
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
              <article
                className={`grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 ${challengerIsCurrentTurn ? "ring-1 ring-yellow-300/50" : ""} ${highlightSide === "challenger" ? "translate-x-1" : ""} ${
                  highlightSide === "opponent" ? "-translate-x-1 brightness-125" : ""
                }`}
              >
                <div className="grid grid-cols-[72px_1fr] items-center gap-3 sm:grid-cols-[92px_1fr]">
                  <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/70 sm:h-[92px] sm:w-[92px]">
                    {battle.challengerPokemon.species.imageUrl ? (
                      <img
                        src={battle.challengerPokemon.species.imageUrl}
                        alt={battle.challengerPokemon.species.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-400">PK</div>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-blue-400/60 bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-100">{challengerSideLabel}</span>
                      <span className="rounded-full border border-teal-400/60 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-teal-100">{battle.challengerPokemon.species.typePrimary}</span>
                    </div>
                    <strong>{battle.challenger.displayName}</strong>
                    <div className="flex items-center justify-between gap-2">
                      <small className="capitalize text-slate-300">{battle.challengerPokemon.species.name}</small>
                      <span className="rounded-full border border-yellow-300/60 bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-100">Nivel {battle.challengerPokemon.level}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <small>
                    HP {challengerCurrentHp}/{challengerMaxHp}
                  </small>
                  <small>{HpPercent(challengerCurrentHp, challengerMaxHp)}%</small>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${HpPercent(challengerCurrentHp, challengerMaxHp)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-200">
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">ATK {battle.challengerPokemon.atk}</span>
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">DEF {battle.challengerPokemon.def}</span>
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">SPD {battle.challengerPokemon.speed}</span>
                </div>
              </article>

              <div className={`grid min-h-[72px] place-items-center rounded-xl border border-yellow-300/50 bg-yellow-500/10 text-xs font-bold text-yellow-100 lg:min-h-full ${highlightSide ? "animate-pulse" : "opacity-80"}`}>
                {lastTurn ? `${lastTurn.action.toUpperCase()} -${lastTurn.damage}` : "VS"}
              </div>

              <article
                className={`grid gap-3 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 ${opponentIsCurrentTurn ? "ring-1 ring-yellow-300/50" : ""} ${highlightSide === "opponent" ? "translate-x-1" : ""} ${
                  highlightSide === "challenger" ? "-translate-x-1 brightness-125" : ""
                }`}
              >
                <div className="grid grid-cols-[72px_1fr] items-center gap-3 sm:grid-cols-[92px_1fr]">
                  <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/70 sm:h-[92px] sm:w-[92px]">
                    {battle.opponentPokemon.species.imageUrl ? (
                      <img
                        src={battle.opponentPokemon.species.imageUrl}
                        alt={battle.opponentPokemon.species.name}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-400">PK</div>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-blue-400/60 bg-blue-500/15 px-2 py-0.5 text-[11px] font-semibold text-blue-100">{opponentSideLabel}</span>
                      <span className="rounded-full border border-teal-400/60 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-teal-100">{battle.opponentPokemon.species.typePrimary}</span>
                    </div>
                    <strong>{battle.opponent.displayName}</strong>
                    <div className="flex items-center justify-between gap-2">
                      <small className="capitalize text-slate-300">{battle.opponentPokemon.species.name}</small>
                      <span className="rounded-full border border-yellow-300/60 bg-yellow-500/15 px-2 py-0.5 text-[11px] font-semibold text-yellow-100">Nivel {battle.opponentPokemon.level}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <small>
                    HP {opponentCurrentHp}/{opponentMaxHp}
                  </small>
                  <small>{HpPercent(opponentCurrentHp, opponentMaxHp)}%</small>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${HpPercent(opponentCurrentHp, opponentMaxHp)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-200">
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">ATK {battle.opponentPokemon.atk}</span>
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">DEF {battle.opponentPokemon.def}</span>
                  <span className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-center">SPD {battle.opponentPokemon.speed}</span>
                </div>
              </article>
            </div>
            {battle.status === "finished" ? (
              <div className={`mt-3 grid gap-2 rounded-2xl border p-4 text-center ${didIWin ? "border-emerald-400/60 bg-emerald-500/10" : "border-red-400/60 bg-red-500/10"}`}>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Resultado final</span>
                  <strong className="text-2xl font-black tracking-wide sm:text-4xl">{didIWin ? "VITORIA" : "DERROTA"}</strong>
                  <small className="text-sm text-slate-200">
                    {didIWin
                      ? "Seu time dominou a arena e finalizou o duelo com poder total."
                      : `${winnerName} venceu o confronto. Reorganize o time e busque a revanche.`}
                  </small>
                </div>
                <div className="flex justify-center">
                  <Link className={PrimaryActionClass} href="/battles">
                    Jogar novo duelo
                  </Link>
                </div>
              </div>
            ) : null}
            {battle.status === "expired" ? (
              <div
                className={`mt-3 grid gap-2 rounded-2xl border p-4 text-center ${
                  expiredResultTone === "win"
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : expiredResultTone === "lose"
                      ? "border-red-400/60 bg-red-500/10"
                      : "border-yellow-300/60 bg-yellow-500/10"
                }`}
              >
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Tempo encerrado</span>
                  <strong className="text-2xl font-black tracking-wide sm:text-4xl">{expiredResultTitle}</strong>
                  <small className="text-sm text-slate-200">{expiredResultSubtitle}</small>
                </div>
                <div className="flex justify-center">
                  <Link className={PrimaryActionClass} href="/battles">
                    Criar revanche
                  </Link>
                </div>
              </div>
            ) : null}
          </section>

          <section className={SectionCardClass}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2>Combate automatico</h2>
              <small className="text-xs text-slate-300 sm:text-sm">{canPlayTurn ? "Executando jogada" : "Aguardando turno"} | {totalActions} acoes</small>
            </div>
            {battleActions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300 sm:text-sm">Aguardando primeira acao automatica da batalha.</div>
            ) : (
              <div className="grid gap-2">
                {battleActions.map((action, index) => (
                  <article key={action.id} className={`grid gap-2 rounded-xl border p-3 ${index === 0 ? "border-yellow-300/60 bg-yellow-500/10" : "border-slate-700 bg-slate-900/70"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 bg-slate-800 text-[10px] font-bold">{action.actorSide}</span>
                        <strong>{action.actorName}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-500 bg-slate-800 text-[10px] font-bold">{action.actionIcon}</span>
                        <small className="text-slate-300">{action.actionLabel}</small>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                      <small className="inline-flex items-center gap-1">
                        <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold">DMG</span> {action.damage}
                      </small>
                      <small className="inline-flex items-center gap-1">
                        <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold">HP</span> C/O {action.challengerHp}/{action.opponentHp}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {lastTurn ? <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300 sm:text-sm">Ultima acao: {lastTurnActorName} usou {lastTurnActionLabel}.</div> : null}
            {turnError ? <div className="rounded-xl border border-red-400/60 bg-red-500/15 p-3 text-xs text-red-200 sm:text-sm">{turnError}</div> : null}
          </section>

        </>
      ) : null}
    </main>
  );
}
