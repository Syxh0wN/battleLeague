"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFetch } from "../../../lib/api";

type BattleTurn = {
  id: string;
  action: string;
  moveName?: string | null;
  moveType?: string | null;
  moveCategory?: string | null;
  movePriority?: number | null;
  moveDamageMultiplier?: number | null;
  moveControlChance?: number | null;
  damage: number;
  actorUserId: string;
  challengerHp: number;
  opponentHp: number;
  createdAt: string;
};

type BattleMove = {
  id: string;
  name: string;
  action: "attack" | "defend" | "skill";
  type: string;
  power: number;
  minLevel: number;
  category: "physical" | "special" | "status";
  priority: number;
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
  currentTurnMoves?: BattleMove[];
  turns: BattleTurn[];
};

type TurnResponse = {
  battleId: string;
};

const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 ring-1 ring-inset ring-slate-700/70 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const PrimaryActionClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70";

export default function BattleDetailsPage() {
  const params = useParams<{ battleId: string }>();
  const battleId = String(params.battleId ?? "");
  const queryClient = useQueryClient();
  const [turnError, setTurnError] = useState("");
  const [highlightTurnId, setHighlightTurnId] = useState("");
  const [highlightSide, setHighlightSide] = useState<"challenger" | "opponent" | null>(null);
  const [highlightMoveName, setHighlightMoveName] = useState("");
  const [highlightMoveAction, setHighlightMoveAction] = useState<"attack" | "defend" | "skill" | "">("");
  const [submittingMoveId, setSubmittingMoveId] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const autoTurnInFlightRef = useRef(false);

  const battleQuery = useQuery({
    queryKey: ["battleDetails", battleId],
    queryFn: () => ApiFetch<BattleDetails>(`/battles/${battleId}`),
    enabled: battleId.length > 0,
    staleTime: 4000,
    refetchInterval: 6000,
    refetchIntervalInBackground: false
  });
  const meQuery = useQuery({
    queryKey: ["meForBattleDetail"],
    queryFn: () => ApiFetch<{ id: string }>("/users/me")
  });

  const turnMutation = useMutation({
    mutationFn: (selectedMove: { action: "attack" | "defend" | "skill"; moveId?: string }) =>
      ApiFetch<TurnResponse>(`/battles/${battleId}/turn`, {
        method: "POST",
        body: JSON.stringify({
          action: selectedMove.action,
          moveId: selectedMove.moveId,
          idempotencyKey: `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        })
      }),
    onSuccess: () => {
      setTurnError("");
      setSubmittingMoveId("");
      void queryClient.invalidateQueries({ queryKey: ["battleDetails", battleId] });
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
      void queryClient.invalidateQueries({ queryKey: ["myChampions"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["battleSummary"] });
    },
    onError: (error) => {
      setSubmittingMoveId("");
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
  const turnAutoFallbackMs = 20_000;

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

  useEffect(() => {
    if (!lastTurn) {
      return;
    }
    setHighlightMoveName(lastTurn.moveName ?? "");
    setHighlightMoveAction(lastTurn.action === "attack" || lastTurn.action === "defend" || lastTurn.action === "skill" ? lastTurn.action : "");
    const timeoutId = window.setTimeout(() => {
      setHighlightMoveName("");
      setHighlightMoveAction("");
    }, 1400);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [lastTurn?.id]);

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
  const canChooseMove = canPlayTurn && !turnMutation.isPending;
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
      : lastTurn.moveName && lastTurn.moveName.length > 0
        ? lastTurn.moveName
        : lastTurn.action === "attack"
        ? "Attack"
        : lastTurn.action === "defend"
          ? "Defend"
          : "Skill";
  const lastMoveTelemetry = !lastTurn
    ? null
    : {
        category: lastTurn.moveCategory ?? (lastTurn.action === "defend" ? "status" : lastTurn.action === "skill" ? "special" : "physical"),
        priority: lastTurn.movePriority ?? 0,
        damageMultiplier: lastTurn.moveDamageMultiplier ?? 1,
        controlChance: lastTurn.moveControlChance ?? 0
      };
  const lastTurnActionToneClass =
    !lastTurn
      ? "bg-slate-800/80 text-slate-100 ring-slate-600/70"
      : lastTurn.action === "attack"
        ? "bg-rose-500/15 text-rose-100 ring-rose-400/45"
        : lastTurn.action === "defend"
          ? "bg-emerald-500/15 text-emerald-100 ring-emerald-400/45"
          : "bg-violet-500/15 text-violet-100 ring-violet-400/45";
  const totalActions = battle?.turns.length ?? 0;
  const battleActions = battle
    ? battle.turns
        .slice()
        .reverse()
        .map((turn) => {
          const actorName = turn.actorUserId === battle.challenger.id ? battle.challenger.displayName : battle.opponent.displayName;
          const actionLabel = turn.moveName && turn.moveName.length > 0 ? turn.moveName : turn.action === "attack" ? "Attack" : turn.action === "defend" ? "Defend" : "Skill";
          const actorSide = turn.actorUserId === battle.challenger.id ? "CH" : "OP";
          const actionIcon = turn.action === "attack" ? "ATK" : turn.action === "defend" ? "DEF" : "SKL";
          return {
            id: turn.id,
            actorName,
            actorSide,
            actionKind: turn.action,
            actionLabel,
            actionIcon,
            moveType: turn.moveType ?? "normal",
            moveCategory: turn.moveCategory ?? (turn.action === "defend" ? "status" : turn.action === "skill" ? "special" : "physical"),
            movePriority: turn.movePriority ?? 0,
            moveDamageMultiplier: turn.moveDamageMultiplier ?? 1,
            moveControlChance: turn.moveControlChance ?? 0,
            damage: turn.damage,
            challengerHp: turn.challengerHp,
            opponentHp: turn.opponentHp
          };
        })
    : [];
  const currentTurnMoves = battle?.currentTurnMoves ?? [];
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
      ? "O campeao do seu perfil terminou com mais vida e venceu por vantagem."
      : expiredResultTone === "lose"
        ? "O rival terminou com mais vida e venceu por vantagem."
        : "Os dois lados terminaram com a mesma vida no fim do tempo.";
  const battleDurationMs = battle && expiresAt && scheduledStartAt ? Math.max(1, expiresAt.getTime() - scheduledStartAt.getTime()) : 300_000;
  const battleRemainingProgress = Math.max(0, Math.min(100, Math.round((battleRemainingMs / battleDurationMs) * 100)));
  const battleRemainingClock = FormatClock(battleRemainingSec);
  const battleStartClock = FormatClock(battleStartsInSec);
  const battleTimeToneClass = battleRemainingSec <= 30 ? "text-slate-100" : battleRemainingSec <= 90 ? "text-slate-200" : "text-slate-300";

  function PickAutoMove() {
    const currentMoves = battle?.currentTurnMoves ?? [];
    if (currentMoves.length === 0) {
      return { action: "attack" as const };
    }
    if (!lastTurn) {
      const openingMove = currentMoves.find((move) => move.action === "attack") ?? currentMoves[0];
      return { action: openingMove.action, moveId: openingMove.id };
    }
    const myIsChallenger = battle?.challenger.id === currentUserId;
    if (!battle || !myIsChallenger) {
      const randomMove = currentMoves[Math.floor(Math.random() * currentMoves.length)] ?? currentMoves[0];
      return { action: randomMove.action, moveId: randomMove.id };
    }
    const myHp = lastTurn.challengerHp;
    const enemyHp = lastTurn.opponentHp;
    if (myHp <= 16 && Math.random() < 0.45) {
      const defendMove = currentMoves.find((move) => move.action === "defend");
      if (defendMove) {
        return { action: defendMove.action, moveId: defendMove.id };
      }
    }
    if (enemyHp <= 22 && Math.random() < 0.7) {
      const skillMove = currentMoves.find((move) => move.action === "skill");
      if (skillMove) {
        return { action: skillMove.action, moveId: skillMove.id };
      }
    }
    const fallbackMove = currentMoves.find((move) => move.action === "attack") ?? currentMoves[0];
    return { action: fallbackMove.action, moveId: fallbackMove.id };
  }

  function HpPercent(currentHp: number, maxHp: number) {
    if (maxHp <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));
  }

  function FormatClock(totalSec: number) {
    const safeSec = Math.max(0, totalSec);
    const minutes = Math.floor(safeSec / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (safeSec % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function CategoryBadgeClass(category: string) {
    if (category === "status") {
      return "bg-cyan-500/15 text-cyan-100 ring-cyan-400/40";
    }
    if (category === "special") {
      return "bg-violet-500/15 text-violet-100 ring-violet-400/40";
    }
    return "bg-rose-500/15 text-rose-100 ring-rose-400/40";
  }

  function PriorityBadgeClass(priority: number) {
    if (priority >= 2) {
      return "bg-amber-500/20 text-amber-100 ring-amber-400/50";
    }
    if (priority >= 1) {
      return "bg-yellow-500/20 text-yellow-100 ring-yellow-400/45";
    }
    if (priority <= -1) {
      return "bg-violet-500/20 text-violet-100 ring-violet-400/45";
    }
    return "bg-slate-800/80 text-slate-200 ring-slate-600/70";
  }

  function MultiplierBadgeClass(multiplier: number) {
    if (multiplier >= 1.1) {
      return "bg-emerald-500/20 text-emerald-100 ring-emerald-400/45";
    }
    if (multiplier <= 0.5) {
      return "bg-rose-500/20 text-rose-100 ring-rose-400/45";
    }
    if (multiplier < 1) {
      return "bg-amber-500/20 text-amber-100 ring-amber-400/45";
    }
    return "bg-slate-800/80 text-slate-200 ring-slate-600/70";
  }

  function ControlBadgeClass(controlChance: number) {
    if (controlChance >= 0.75) {
      return "bg-cyan-500/20 text-cyan-100 ring-cyan-400/50";
    }
    if (controlChance >= 0.5) {
      return "bg-sky-500/20 text-sky-100 ring-sky-400/45";
    }
    return "bg-slate-800/80 text-slate-200 ring-slate-600/70";
  }

  useEffect(() => {
    if (!battle || !canPlayTurn || turnMutation.isPending || battle.status !== "active" || battle.winnerUserId) {
      return;
    }
    if (autoTurnInFlightRef.current) {
      return;
    }
    autoTurnInFlightRef.current = true;
    let hasStartedMutation = false;
    const timeoutId = window.setTimeout(() => {
      hasStartedMutation = true;
      const autoMove = PickAutoMove();
      setSubmittingMoveId(autoMove.moveId ?? "");
      turnMutation.mutate(autoMove, {
        onSettled: () => {
          autoTurnInFlightRef.current = false;
        }
      });
    }, turnAutoFallbackMs);
    return () => {
      window.clearTimeout(timeoutId);
      if (!hasStartedMutation) {
        autoTurnInFlightRef.current = false;
      }
    };
  }, [battle?.id, battle?.status, battle?.turns.length, battle?.currentTurnUserId, battle?.winnerUserId, canPlayTurn, turnMutation]);

  return (
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl bg-slate-900/80 p-4 ring-1 ring-inset ring-slate-700/70 sm:p-5">
        <nav className="TopNavScroll mb-3 self-start">
          <Link className={NavLinkClass} href="/battles">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M14.5 4l5.5 5.5-2 2L12.5 6z" />
                <path d="M9.5 20l-5.5-5.5 2-2L11.5 18z" />
                <path d="M8.5 15.5l7-7" />
              </svg>
            </span>
            Voltar para Batalhas
          </Link>
          <Link className={NavLinkClass} href="/pokemon">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M3.5 12h17" />
                <circle cx="12" cy="12" r="2.2" />
              </svg>
            </span>
            Ir para Pokemon
          </Link>
        </nav>
        <div className="grid gap-2">
          <span className="inline-flex w-fit rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
            Detalhe da batalha
          </span>
          <h1 className="text-xl font-bold sm:text-2xl">{battle ? `${battle.challenger.displayName} VS ${battle.opponent.displayName}` : "Duelo em carregamento"}</h1>
          <p className="text-sm text-slate-300 sm:text-base">
            {battle
              ? `${battle.challengerPokemon.species.name} Nivel ${battle.challengerPokemon.level} contra ${battle.opponentPokemon.species.name} Nivel ${battle.opponentPokemon.level}`
              : "Acompanhe o estado da partida e envie os turnos em tempo real."}
          </p>
          <small className="text-xs text-slate-400 sm:text-sm">Codigo da batalha: {battleId}</small>
        </div>
        {battle ? (
          <div className="mt-2 grid items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
            <article className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-2 ring-1 ring-inset ring-slate-700/70">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg bg-slate-800/70 ring-1 ring-inset ring-slate-700/70">
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
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/25 via-amber-400/25 to-emerald-400/25 text-xs font-bold text-slate-100 ring-1 ring-inset ring-slate-500/80">
              VS
            </span>
            <article className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-2 ring-1 ring-inset ring-slate-700/70">
              <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-lg bg-slate-800/70 ring-1 ring-inset ring-slate-700/70">
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
              <div className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/70 sm:text-sm">
                Duelo agendado. Inicio em {battleStartClock}.
              </div>
            ) : null}
            {battle.status === "active" ? (
              <div className="grid gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="flex items-center justify-between gap-2">
                  <small className="text-[11px] font-semibold tracking-wide text-slate-300 sm:text-xs">Tempo restante</small>
                  <strong className={`text-sm font-bold tabular-nums sm:text-base ${battleTimeToneClass}`}>{battleRemainingClock}</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-slate-500 via-slate-400 to-slate-300 transition-[width] duration-500"
                    style={{ width: `${battleRemainingProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
              <article
                className={`grid gap-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-inset ring-slate-700/70 ${challengerIsCurrentTurn ? "ring-slate-500/80" : ""} ${highlightSide === "challenger" ? "translate-x-1" : ""} ${
                  highlightSide === "opponent" ? "-translate-x-1 brightness-125" : ""
                }`}
              >
                <div className="grid grid-cols-[72px_1fr] items-center gap-3 sm:grid-cols-[92px_1fr]">
                  <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl bg-slate-800/70 ring-1 ring-inset ring-slate-700/70 sm:h-[92px] sm:w-[92px]">
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
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">{challengerSideLabel}</span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">{battle.challengerPokemon.species.typePrimary}</span>
                    </div>
                    <strong>{battle.challenger.displayName}</strong>
                    <div className="flex items-center justify-between gap-2">
                      <small className="capitalize text-slate-300">{battle.challengerPokemon.species.name}</small>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">Nivel {battle.challengerPokemon.level}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <small>
                    HP {challengerCurrentHp}/{challengerMaxHp}
                  </small>
                  <small>{HpPercent(challengerCurrentHp, challengerMaxHp)}%</small>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-inset ring-slate-700/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${HpPercent(challengerCurrentHp, challengerMaxHp)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-200">
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">ATK {battle.challengerPokemon.atk}</span>
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">DEF {battle.challengerPokemon.def}</span>
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">SPD {battle.challengerPokemon.speed}</span>
                </div>
              </article>

              <div
                className={`grid h-fit place-items-center self-center rounded-xl px-3 py-2 text-center ring-1 ring-inset ${lastTurnActionToneClass} ${
                  highlightSide ? "shadow-[0_0_16px_rgba(148,163,184,0.28)]" : "opacity-90"
                }`}
              >
                <small className="text-[10px] font-semibold tracking-wide text-slate-200">Ultima acao</small>
                <strong className="text-xs font-bold">{lastTurn ? `${lastTurn.action.toUpperCase()} -${lastTurn.damage}` : "VS"}</strong>
              </div>

              <article
                className={`grid gap-3 rounded-2xl bg-slate-900/80 p-3 ring-1 ring-inset ring-slate-700/70 ${opponentIsCurrentTurn ? "ring-slate-500/80" : ""} ${highlightSide === "opponent" ? "translate-x-1" : ""} ${
                  highlightSide === "challenger" ? "-translate-x-1 brightness-125" : ""
                }`}
              >
                <div className="grid grid-cols-[72px_1fr] items-center gap-3 sm:grid-cols-[92px_1fr]">
                  <div className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-xl bg-slate-800/70 ring-1 ring-inset ring-slate-700/70 sm:h-[92px] sm:w-[92px]">
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
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">{opponentSideLabel}</span>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">{battle.opponentPokemon.species.typePrimary}</span>
                    </div>
                    <strong>{battle.opponent.displayName}</strong>
                    <div className="flex items-center justify-between gap-2">
                      <small className="capitalize text-slate-300">{battle.opponentPokemon.species.name}</small>
                      <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">Nivel {battle.opponentPokemon.level}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                  <small>
                    HP {opponentCurrentHp}/{opponentMaxHp}
                  </small>
                  <small>{HpPercent(opponentCurrentHp, opponentMaxHp)}%</small>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800 ring-1 ring-inset ring-slate-700/70">
                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400" style={{ width: `${HpPercent(opponentCurrentHp, opponentMaxHp)}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-200">
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">ATK {battle.opponentPokemon.atk}</span>
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">DEF {battle.opponentPokemon.def}</span>
                  <span className="rounded-lg bg-slate-800 px-2 py-1 text-center ring-1 ring-inset ring-slate-700/70">SPD {battle.opponentPokemon.speed}</span>
                </div>
              </article>
            </div>
            {battle.status === "finished" ? (
              <div className={`mt-3 grid gap-2 rounded-2xl p-4 text-center ring-1 ring-inset ${didIWin ? "bg-emerald-500/10 ring-emerald-400/35" : "bg-rose-500/10 ring-rose-400/35"}`}>
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Resultado final</span>
                  <strong className={`text-2xl font-black tracking-wide sm:text-4xl ${didIWin ? "text-emerald-100" : "text-rose-100"}`}>{didIWin ? "VITORIA" : "DERROTA"}</strong>
                  <small className="text-sm text-slate-200">
                    {didIWin
                      ? "O time do seu perfil dominou a arena e finalizou o duelo com poder total."
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
                className={`mt-3 grid gap-2 rounded-2xl p-4 text-center ring-1 ring-inset ${
                  expiredResultTone === "win"
                    ? "bg-emerald-500/10 ring-emerald-400/35"
                    : expiredResultTone === "lose"
                      ? "bg-rose-500/10 ring-rose-400/35"
                      : "bg-amber-500/10 ring-amber-400/35"
                }`}
              >
                <div className="grid gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Tempo encerrado</span>
                  <strong
                    className={`text-2xl font-black tracking-wide sm:text-4xl ${
                      expiredResultTone === "win" ? "text-emerald-100" : expiredResultTone === "lose" ? "text-rose-100" : "text-amber-100"
                    }`}
                  >
                    {expiredResultTitle}
                  </strong>
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
              <h2>Painel de combate</h2>
              <small className="text-xs text-slate-300 sm:text-sm">
                {canPlayTurn ? "Sua vez: escolha um golpe" : "Aguardando turno"} | {totalActions} acoes
              </small>
            </div>
            <div className="mb-3 rounded-xl bg-slate-900/70 p-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-slate-700/70 sm:text-sm">
              Sua jogada -&gt; Revida automatica do rival -&gt; Sua jogada
            </div>
            {currentTurnMoves.length > 0 ? (
              <div className="mb-3 grid gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Golpes disponiveis</strong>
                  <small className="text-xs text-slate-300">{currentTurnMoves.length} golpe(s) | fallback auto em 20s</small>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentTurnMoves.map((move) => (
                    <button
                      key={move.id}
                      type="button"
                      onClick={() => {
                        if (!canChooseMove) {
                          return;
                        }
                        setSubmittingMoveId(move.id);
                        turnMutation.mutate({ action: move.action, moveId: move.id });
                      }}
                      disabled={!canChooseMove}
                      className={`grid gap-1 rounded-xl bg-slate-900/65 p-2 ring-1 ring-inset transition ${
                        (highlightMoveName.length > 0 && move.name === highlightMoveName) || (highlightMoveName.length === 0 && highlightMoveAction.length > 0 && move.action === highlightMoveAction)
                          ? "ring-slate-300/80 shadow-[0_0_18px_rgba(226,232,240,0.35)]"
                          : "ring-slate-700/70"
                      } ${canChooseMove ? "hover:-translate-y-px hover:ring-slate-400/70" : "opacity-70"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm">{move.name}</strong>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                            move.action === "attack"
                              ? "bg-rose-500/15 text-rose-100 ring-rose-400/40"
                              : move.action === "defend"
                                ? "bg-emerald-500/15 text-emerald-100 ring-emerald-400/40"
                                : "bg-violet-500/15 text-violet-100 ring-violet-400/40"
                          }`}
                        >
                          {move.action.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                        <small className="capitalize">Tipo {move.type}</small>
                        <small>{submittingMoveId === move.id && turnMutation.isPending ? "Enviando..." : `Power ${move.power}`}</small>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                        <small className="capitalize">Categoria {move.category}</small>
                        <small>Prioridade {move.priority}</small>
                      </div>
                      {(highlightMoveName.length > 0 && move.name === highlightMoveName) || (highlightMoveName.length === 0 && highlightMoveAction.length > 0 && move.action === highlightMoveAction) ? (
                        <small className="text-[10px] font-semibold text-slate-100">Ultimo golpe usado</small>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {lastMoveTelemetry ? (
              <div className="mb-3 grid gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">Telemetria do ultimo golpe</strong>
                  <small className="text-xs text-slate-300">{lastTurnActionLabel}</small>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2 ring-1 ring-inset ring-slate-700/70">
                    <small className="text-[11px] text-slate-300">Categoria</small>
                    <strong className="capitalize">{lastMoveTelemetry.category}</strong>
                  </article>
                  <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2 ring-1 ring-inset ring-slate-700/70">
                    <small className="text-[11px] text-slate-300">Multiplicador de dano</small>
                    <strong>{lastMoveTelemetry.damageMultiplier.toFixed(2)}x</strong>
                  </article>
                  <article className="grid gap-1 rounded-xl bg-slate-900/65 p-2 ring-1 ring-inset ring-slate-700/70">
                    <small className="text-[11px] text-slate-300">Prioridade efetiva</small>
                    <strong>{lastMoveTelemetry.priority}</strong>
                  </article>
                </div>
                {lastMoveTelemetry.controlChance > 0 ? (
                  <small className="text-xs text-slate-300">Chance de controle aplicada: {(lastMoveTelemetry.controlChance * 100).toFixed(0)}%</small>
                ) : null}
              </div>
            ) : null}
            {battleActions.length === 0 ? (
              <div className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/70 sm:text-sm">Aguardando primeira acao automatica da batalha.</div>
            ) : (
              <div className="grid gap-2">
                {battleActions.map((action, index) => (
                  <article
                    key={action.id}
                    className={`grid gap-2 rounded-xl p-3 ring-1 ring-inset ring-slate-700/70 ${
                      action.actionKind === "attack"
                        ? "bg-rose-500/10"
                        : action.actionKind === "defend"
                          ? "bg-emerald-500/10"
                          : "bg-violet-500/10"
                    } ${index === 0 ? "shadow-[0_0_16px_rgba(148,163,184,0.2)]" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset ${
                            action.actorSide === "CH"
                              ? "bg-cyan-500/20 text-cyan-100 ring-cyan-400/40"
                              : "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-400/40"
                          }`}
                        >
                          {action.actorSide}
                        </span>
                        <strong>{action.actorName}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ring-1 ring-inset ${
                            action.actionKind === "attack"
                              ? "bg-rose-500/20 text-rose-100 ring-rose-400/40"
                              : action.actionKind === "defend"
                                ? "bg-emerald-500/20 text-emerald-100 ring-emerald-400/40"
                                : "bg-violet-500/20 text-violet-100 ring-violet-400/40"
                          }`}
                        >
                          {action.actionIcon}
                        </span>
                        <small
                          className={`${
                            action.actionKind === "attack"
                              ? "text-rose-100"
                              : action.actionKind === "defend"
                                ? "text-emerald-100"
                                : "text-violet-100"
                          }`}
                        >
                          {action.actionLabel}
                        </small>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
                      <small className="inline-flex items-center gap-1">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-slate-600/70">DMG</span> {action.damage}
                      </small>
                      <small className="inline-flex items-center gap-1">
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-slate-600/70">HP</span> C/O {action.challengerHp}/{action.opponentHp}
                      </small>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-300">
                      <span className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${CategoryBadgeClass(String(action.moveCategory).toLowerCase())}`}>
                        CAT {String(action.moveCategory).toUpperCase()}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${PriorityBadgeClass(action.movePriority)}`}>PRI {action.movePriority}</span>
                      <span className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${MultiplierBadgeClass(action.moveDamageMultiplier)}`}>
                        MULT {action.moveDamageMultiplier.toFixed(2)}x
                      </span>
                      {action.moveControlChance > 0 ? (
                        <span className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${ControlBadgeClass(action.moveControlChance)}`}>
                          CTRL {(action.moveControlChance * 100).toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="mt-3 grid gap-2">
              {lastTurn ? <div className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-300 ring-1 ring-inset ring-slate-700/70 sm:text-sm">Ultima acao: {lastTurnActorName} usou {lastTurnActionLabel}.</div> : null}
              {turnError ? <div className="rounded-xl bg-slate-900/70 p-3 text-xs text-slate-200 ring-1 ring-inset ring-slate-700/70 sm:text-sm">{turnError}</div> : null}
            </div>
          </section>

        </>
      ) : null}
    </main>
  );
}
