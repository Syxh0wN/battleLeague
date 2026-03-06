"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type CreateBattleResponse = {
  id: string;
  status: string;
  roulettePokemonName?: string;
};

type SuggestedOpponent = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  totalWins: number;
  totalLosses: number;
  champions: Array<{
    id: string;
    level: number;
    species: {
      name: string;
      imageUrl: string | null;
    };
  }>;
};

type MyPokemonItem = {
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

type AiOpponent = {
  id: "easy" | "normal" | "hard";
  name: string;
  difficulty: "easy" | "normal" | "hard";
  strategy: string;
};

type OngoingBattleItem = {
  id: string;
  status: "pending" | "active";
  scheduledStartAt: string;
  currentTurnUserId: string;
  isAiBattle: boolean;
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
  lastTurn: {
    action: string;
    damage: number;
    actorUserId: string;
  } | null;
};

const RouletteItemStepPx = 132;
const SuggestionVisibleCount = 3;
const SectionCardClass = "rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:-translate-y-px hover:border-slate-400 sm:w-auto";
const GhostButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 transition hover:-translate-y-px hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const PrimaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl border border-blue-400/70 bg-blue-500/25 px-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-px hover:border-yellow-300/70 hover:bg-blue-500/35 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const OpenBattleLinkClass =
  "inline-flex h-9 w-fit items-center justify-center rounded-xl border border-blue-400/70 bg-blue-500/20 px-3 text-xs font-semibold text-slate-100 transition hover:-translate-y-px hover:border-yellow-300/70";

export default function BattlesPage() {
  const [pvpStep, setPvpStep] = useState<1 | 2 | 3 | 4>(1);
  const [opponentUserId, setOpponentUserId] = useState("");
  const [challengerPokemonId, setChallengerPokemonId] = useState("");
  const [aiChallengerPokemonId, setAiChallengerPokemonId] = useState("");
  const [createdPvpBattleId, setCreatedPvpBattleId] = useState("");
  const [createdAiBattleId, setCreatedAiBattleId] = useState("");
  const [isCreatingBattle, setIsCreatingBattle] = useState(false);
  const [battleError, setBattleError] = useState("");
  const [selectedAiDifficulty, setSelectedAiDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [isCreatingAiBattle, setIsCreatingAiBattle] = useState(false);
  const [isRouletteRolling, setIsRouletteRolling] = useState(false);
  const [roulettePreviewName, setRoulettePreviewName] = useState("");
  const [rouletteFinalName, setRouletteFinalName] = useState("");
  const [rouletteWinnerIndex, setRouletteWinnerIndex] = useState(-1);
  const [rouletteOffsetPx, setRouletteOffsetPx] = useState(0);
  const [rouletteUseTransition, setRouletteUseTransition] = useState(false);
  const [rouletteTrackCards, setRouletteTrackCards] = useState<SuggestedOpponent["champions"]>([]);
  const [postRouletteDelaySec, setPostRouletteDelaySec] = useState(0);
  const [suggestionStartIndex, setSuggestionStartIndex] = useState(0);
  const [suggestionMotion, setSuggestionMotion] = useState<"next" | "prev" | "">("");
  const [suggestionMotionKey, setSuggestionMotionKey] = useState(0);
  const rouletteRafRef = useRef<number | null>(null);
  const postRouletteTimerRef = useRef<number | null>(null);
  const rouletteOffsetRef = useRef(0);
  const rouletteShouldSpinRef = useRef(false);

  const suggestionsQuery = useQuery({
    queryKey: ["battleSuggestions"],
    queryFn: () => ApiFetch<SuggestedOpponent[]>("/battles/suggestions")
  });
  const myPokemonsQuery = useQuery({
    queryKey: ["myPokemonsForBattle"],
    queryFn: () => ApiFetch<MyPokemonItem[]>("/pokemon/my")
  });
  const aiOpponentsQuery = useQuery({
    queryKey: ["aiOpponentsForBattle"],
    queryFn: () => ApiFetch<AiOpponent[]>("/battles/ai/opponents")
  });
  const ongoingBattlesQuery = useQuery({
    queryKey: ["ongoingBattles"],
    queryFn: () => ApiFetch<OngoingBattleItem[]>("/battles/ongoing"),
    refetchInterval: 5000
  });

  const myPokemons = myPokemonsQuery.data ?? [];
  const aiOpponents = aiOpponentsQuery.data ?? [];
  const suggestedOpponents = suggestionsQuery.data ?? [];
  const ongoingBattles = ongoingBattlesQuery.data ?? [];
  const canCreatePvpBattle = opponentUserId.length > 0 && challengerPokemonId.length > 0;
  const selectedOpponent = suggestedOpponents.find((opponent) => opponent.id === opponentUserId) ?? null;
  const selectedMyPokemon = myPokemons.find((pokemon) => pokemon.id === challengerPokemonId) ?? null;
  const rouletteFocusIndex = Math.round(rouletteOffsetPx / RouletteItemStepPx);
  const maxSuggestionStart = Math.max(0, suggestedOpponents.length - SuggestionVisibleCount);
  const visibleSuggestions = suggestedOpponents.slice(suggestionStartIndex, suggestionStartIndex + SuggestionVisibleCount);
  const rouletteCards = useMemo(() => {
    if (!selectedOpponent || selectedOpponent.champions.length === 0) {
      return [];
    }
    const cards = selectedOpponent.champions
      .flatMap((champion) => [champion, champion, champion])
      .slice(0, 12);
    return cards;
  }, [selectedOpponent]);

  useEffect(() => {
    setSuggestionStartIndex((current) => Math.min(current, maxSuggestionStart));
  }, [maxSuggestionStart]);

  useEffect(() => {
    if (
      pvpStep !== 3 ||
      !selectedOpponent ||
      selectedOpponent.champions.length === 0 ||
      isRouletteRolling ||
      isCreatingBattle ||
      rouletteFinalName ||
      postRouletteDelaySec > 0
    ) {
      return;
    }
    const previewTrack = Array.from({ length: 120 }).map((_, index) => selectedOpponent.champions[index % selectedOpponent.champions.length]);
    const loopSpanPx = selectedOpponent.champions.length * RouletteItemStepPx;
    const initialOffset = loopSpanPx * 3;
    setRouletteTrackCards(previewTrack);
    rouletteOffsetRef.current = initialOffset;
    setRouletteOffsetPx(initialOffset);
    setRouletteUseTransition(false);
    setRouletteWinnerIndex(-1);
    setRoulettePreviewName(previewTrack[Math.floor(initialOffset / RouletteItemStepPx)]?.species.name ?? "Surpresa");
  }, [pvpStep, selectedOpponent, isRouletteRolling, isCreatingBattle, rouletteFinalName, postRouletteDelaySec]);

  useEffect(() => {
    return () => {
      if (postRouletteTimerRef.current !== null) {
        window.clearInterval(postRouletteTimerRef.current);
        postRouletteTimerRef.current = null;
      }
    };
  }, []);

  function ExtractBattleError(error: unknown) {
    if (!(error instanceof Error)) {
      return "Nao foi possivel criar a batalha agora.";
    }
    const rawMessage = error.message;
    if (rawMessage.includes("jwt expired") || rawMessage.includes("Unauthorized") || rawMessage.includes("invalidRefreshToken")) {
      return "Sessao expirada. Clique em login rapido novamente.";
    }
    if (rawMessage.includes("battlePokemonNotFound")) {
      return "Pokemon invalido para este duelo. Selecione novamente os campeoes.";
    }
    if (rawMessage.includes("pokemonInRestCooldown")) {
      return "Um dos pokemons esta em descanso. Escolha outro campeao.";
    }
    if (rawMessage.includes("opponentHasNoAvailablePokemon")) {
      return "Esse rival esta sem pokemon disponivel agora. Escolha outro rival.";
    }
    if (rawMessage.includes("Validation failed")) {
      return "Dados invalidos para criar a batalha. Revise as selecoes.";
    }
    return "Nao foi possivel criar a batalha agora.";
  }

  async function HandleCreateBattle() {
    if (!opponentUserId) {
      setBattleError("Selecione um oponente para duelo PvP.");
      return;
    }
    if (!challengerPokemonId) {
      setBattleError("Escolha seu pokemon para iniciar o duelo.");
      return;
    }
    setBattleError("");
    setIsCreatingBattle(true);
    setRouletteFinalName("");
    setPostRouletteDelaySec(0);
    setRouletteWinnerIndex(-1);
    setRouletteUseTransition(false);
    if (postRouletteTimerRef.current !== null) {
      window.clearInterval(postRouletteTimerRef.current);
      postRouletteTimerRef.current = null;
    }
    const roulettePool = selectedOpponent?.champions ?? [];
    if (roulettePool.length === 0) {
      setBattleError("Esse rival nao tem pokemons para roleta agora.");
      setIsCreatingBattle(false);
      return;
    }
    const initialTrack = Array.from({ length: 240 }).map((_, index) => roulettePool[index % roulettePool.length]);
    setRouletteTrackCards(initialTrack);
    const loopSpanPx = roulettePool.length * RouletteItemStepPx;
    rouletteOffsetRef.current = Math.max(rouletteOffsetRef.current, loopSpanPx * 4);
    setRouletteOffsetPx(rouletteOffsetRef.current);
    setRoulettePreviewName(initialTrack[Math.floor(rouletteOffsetRef.current / RouletteItemStepPx)]?.species.name ?? "Surpresa");
    setIsRouletteRolling(true);
    rouletteShouldSpinRef.current = true;
    const spinLoop = () => {
      if (!rouletteShouldSpinRef.current) {
        return;
      }
      rouletteOffsetRef.current += 11;
      if (rouletteOffsetRef.current >= loopSpanPx * 7) {
        rouletteOffsetRef.current -= loopSpanPx * 4;
      }
      const previewIndex = Math.floor(rouletteOffsetRef.current / RouletteItemStepPx);
      setRouletteOffsetPx(rouletteOffsetRef.current);
      setRoulettePreviewName(initialTrack[previewIndex]?.species.name ?? "Surpresa");
      rouletteRafRef.current = window.requestAnimationFrame(spinLoop);
    };
    rouletteRafRef.current = window.requestAnimationFrame(spinLoop);
    try {
      const response = await ApiFetch<CreateBattleResponse>("/battles", {
        method: "POST",
        body: JSON.stringify({
          opponentUserId,
          challengerPokemonId
        })
      });
      const winnerName = response.roulettePokemonName ?? initialTrack[0]?.species.name ?? "Surpresa";
      rouletteShouldSpinRef.current = false;
      if (rouletteRafRef.current !== null) {
        window.cancelAnimationFrame(rouletteRafRef.current);
        rouletteRafRef.current = null;
      }
      const currentIndex = Math.floor(rouletteOffsetRef.current / RouletteItemStepPx);
      const targetIndex = Math.min(initialTrack.length - 6, currentIndex + 34);
      const winnerChampion = roulettePool.find((champion) => champion.species.name === winnerName);
      const fixedTrack = initialTrack.slice();
      if (winnerChampion) {
        fixedTrack[targetIndex] = winnerChampion;
      }
      setRouletteTrackCards(fixedTrack);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      setRouletteUseTransition(true);
      window.requestAnimationFrame(() => {
        rouletteOffsetRef.current = targetIndex * RouletteItemStepPx;
        setRouletteOffsetPx(rouletteOffsetRef.current);
      });
      await new Promise((resolve) => window.setTimeout(resolve, 5600));
      setRouletteWinnerIndex(targetIndex);
      setCreatedPvpBattleId(response.id);
      setCreatedAiBattleId("");
      setRouletteFinalName(winnerName);
      setPostRouletteDelaySec(30);
      postRouletteTimerRef.current = window.setInterval(() => {
        setPostRouletteDelaySec((current) => {
          if (current <= 1) {
            if (postRouletteTimerRef.current !== null) {
              window.clearInterval(postRouletteTimerRef.current);
              postRouletteTimerRef.current = null;
            }
            setPvpStep(4);
            return 0;
          }
          return current - 1;
        });
      }, 1000);
    } catch (error) {
      setBattleError(ExtractBattleError(error));
    } finally {
      rouletteShouldSpinRef.current = false;
      if (rouletteRafRef.current !== null) {
        window.cancelAnimationFrame(rouletteRafRef.current);
        rouletteRafRef.current = null;
      }
      setIsRouletteRolling(false);
      setRouletteUseTransition(false);
      setIsCreatingBattle(false);
    }
  }

  const handleCreateAiBattle = async () => {
    if (!aiChallengerPokemonId) {
      setBattleError("Selecione seu pokemon para desafiar a IA.");
      return;
    }
    setBattleError("");
    setIsCreatingAiBattle(true);
    try {
      const response = await ApiFetch<CreateBattleResponse>("/battles/ai", {
        method: "POST",
        body: JSON.stringify({
          challengerPokemonId: aiChallengerPokemonId,
          difficulty: selectedAiDifficulty
        })
      });
      setCreatedAiBattleId(response.id);
      setCreatedPvpBattleId("");
    } catch {
      setBattleError("Nao foi possivel criar duelo com IA.");
    } finally {
      setIsCreatingAiBattle(false);
    }
  };

  const handleChooseOpponent = (opponentId: string) => {
    setOpponentUserId(opponentId);
    const previewOpponent = suggestedOpponents.find((opponent) => opponent.id === opponentId);
    setRoulettePreviewName(previewOpponent?.champions[0]?.species.name ?? "Surpresa");
    setRouletteFinalName("");
    setPostRouletteDelaySec(0);
    setRouletteTrackCards([]);
    setRouletteWinnerIndex(-1);
    setRouletteOffsetPx(0);
    rouletteOffsetRef.current = 0;
    rouletteShouldSpinRef.current = false;
    if (rouletteRafRef.current !== null) {
      window.cancelAnimationFrame(rouletteRafRef.current);
      rouletteRafRef.current = null;
    }
    if (postRouletteTimerRef.current !== null) {
      window.clearInterval(postRouletteTimerRef.current);
      postRouletteTimerRef.current = null;
    }
    setRouletteUseTransition(false);
    setChallengerPokemonId("");
    setCreatedPvpBattleId("");
    setBattleError("");
    setPvpStep(2);
  };

  const handlePrevSuggestions = () => {
    if (suggestionStartIndex === 0) {
      return;
    }
    setSuggestionMotion("prev");
    setSuggestionMotionKey((current) => current + 1);
    setSuggestionStartIndex((current) => Math.max(0, current - 1));
  };

  const handleNextSuggestions = () => {
    if (suggestionStartIndex >= maxSuggestionStart) {
      return;
    }
    setSuggestionMotion("next");
    setSuggestionMotionKey((current) => current + 1);
    setSuggestionStartIndex((current) => Math.min(maxSuggestionStart, current + 1));
  };

  return (
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl border border-blue-500/30 bg-slate-900/80 p-4 shadow-2xl sm:p-5">
        <div className="grid gap-2">
          <span className="inline-flex w-fit rounded-full border border-blue-400/60 bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">ArenaDeDuelo</span>
          <h1>Batalhas</h1>
          <p className="text-slate-300">Escolha seu campeao, desafie um rival e entre no duelo automatico com inicio em 60s.</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Inicio automatico em 60s</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Duracao maxima de 5 minutos</span>
          <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold">Roleta do campeao rival</span>
        </div>
      </section>

      <nav className="flex flex-wrap gap-2">
        <Link className={NavLinkClass} href="/dashboard">
          Voltar para Dashboard
        </Link>
        <Link className={NavLinkClass} href="/pokemon">
          Ir para Pokemon
        </Link>
        <Link className={NavLinkClass} href="/social">
          Ir para Social
        </Link>
      </nav>

      <section className={SectionCardClass}>
        <div className="mb-3 grid gap-1">
          <h2>Duelos em andamento</h2>
          <small className="text-slate-300">Partidas pendentes e ativas para acompanhar agora.</small>
        </div>
        {ongoingBattlesQuery.isLoading ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Carregando duelos em andamento...</div>
        ) : ongoingBattles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Voce ainda nao tem duelo pendente ou ativo.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ongoingBattles.map((battle) => {
              const turnDisplayName =
                battle.currentTurnUserId === battle.challenger.id ? battle.challenger.displayName : battle.opponent.displayName;
              const lastTurnActorName = !battle.lastTurn
                ? ""
                : battle.lastTurn.actorUserId === battle.challenger.id
                  ? battle.challenger.displayName
                  : battle.opponent.displayName;
              const startsInSec = Math.max(0, Math.floor((new Date(battle.scheduledStartAt).getTime() - Date.now()) / 1000));
              return (
                <article key={battle.id} className="grid gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${battle.status === "active" ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100" : "border-amber-400/70 bg-amber-500/20 text-amber-100"}`}>
                      {battle.status}
                    </span>
                    <small className="text-slate-300">{battle.isAiBattle ? "Duelo IA" : "Duelo PvP"}</small>
                  </div>
                  <strong>
                    {battle.challengerPokemon.species.name} vs {battle.opponentPokemon.species.name}
                  </strong>
                  <small className="text-slate-300">
                    {battle.challenger.displayName} x {battle.opponent.displayName}
                  </small>
                  {battle.status === "pending" ? <small className="text-slate-300">Inicio em {startsInSec}s</small> : <small className="text-slate-300">Turno atual: {turnDisplayName}</small>}
                  {battle.lastTurn ? (
                    <small className="text-slate-300">
                      Ultima acao: {lastTurnActorName} usou {battle.lastTurn.action} e causou {battle.lastTurn.damage}
                    </small>
                  ) : (
                    <small className="text-slate-300">Sem turno registrado ainda</small>
                  )}
                  <Link className={OpenBattleLinkClass} href={`/battles/${battle.id}`}>
                    Abrir batalha
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 grid gap-1">
          <h2>Duelos com jogadores</h2>
          <small className="text-slate-300">Fluxo em 4 etapas: rival, seu campeao, roleta e duelo.</small>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-semibold sm:text-xs">
          <span className={`rounded-full border px-3 py-1 ${pvpStep >= 1 ? "border-yellow-300/70 bg-yellow-500/15 text-yellow-100" : "border-slate-600 bg-slate-800 text-slate-300"}`}>Etapa 1 Rival</span>
          <span className={`rounded-full border px-3 py-1 ${pvpStep >= 2 ? "border-yellow-300/70 bg-yellow-500/15 text-yellow-100" : "border-slate-600 bg-slate-800 text-slate-300"}`}>Etapa 2 Seu Pokemon</span>
          <span className={`rounded-full border px-3 py-1 ${pvpStep >= 3 ? "border-yellow-300/70 bg-yellow-500/15 text-yellow-100" : "border-slate-600 bg-slate-800 text-slate-300"}`}>Etapa 3 Roleta</span>
          <span className={`rounded-full border px-3 py-1 ${pvpStep >= 4 ? "border-yellow-300/70 bg-yellow-500/15 text-yellow-100" : "border-slate-600 bg-slate-800 text-slate-300"}`}>Etapa 4 Duelo</span>
        </div>

        {pvpStep === 1 ? (
          <div className="grid gap-3">
            <strong className="text-sm sm:text-base">Sugestoes para desafiar</strong>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-stretch">
              <button
                type="button"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 py-2 text-slate-100 shadow-lg transition hover:-translate-y-px hover:border-yellow-300/70 disabled:cursor-not-allowed disabled:opacity-45 xl:grid xl:min-h-[122px] xl:min-w-[82px] xl:place-items-center xl:gap-1"
                onClick={handlePrevSuggestions}
                disabled={suggestionStartIndex === 0 || suggestedOpponents.length <= SuggestionVisibleCount}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-yellow-300/40 bg-slate-900/50 text-sm">&lt;</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">Voltar</span>
              </button>
              <div
                key={`suggestion_motion_${suggestionMotionKey}_${suggestionStartIndex}`}
                className={`grid grid-cols-1 gap-3 transition-all duration-300 md:grid-cols-2 xl:grid-cols-3 ${
                  suggestionMotion === "next"
                    ? "translate-x-1 opacity-95"
                    : suggestionMotion === "prev"
                      ? "-translate-x-1 opacity-95"
                      : ""
                }`}
              >
                {suggestedOpponents.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Gerando oponentes de sugestao...</div>
                ) : (
                  visibleSuggestions.map((opponent) => {
                    const totalBattles = opponent.totalWins + opponent.totalLosses;
                    const winRate = totalBattles === 0 ? 0 : Math.round((opponent.totalWins / totalBattles) * 100);
                    const averageChampionLevel =
                      opponent.champions.length === 0
                        ? 0
                        : Math.round(opponent.champions.reduce((acc, champion) => acc + champion.level, 0) / opponent.champions.length);
                    return (
                      <button
                        key={opponent.id}
                        className={`grid min-h-[122px] gap-2 rounded-2xl border p-3 text-left transition ${
                          opponentUserId === opponent.id
                            ? "border-yellow-300/70 bg-yellow-500/10"
                            : "border-blue-400/40 bg-slate-900/70 hover:-translate-y-px hover:border-blue-300/70"
                        }`}
                        type="button"
                        onClick={() => handleChooseOpponent(opponent.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
                            {opponent.champions[0]?.species.imageUrl ? (
                              <img src={opponent.champions[0].species.imageUrl} alt={opponent.displayName} className="h-full w-full object-contain" />
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400">RV</span>
                            )}
                          </div>
                          <div className="grid min-w-0 gap-0.5">
                            <span className="truncate font-semibold">{opponent.displayName}</span>
                            <small className="text-xs text-slate-300">Rival recomendado</small>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">Nivel {opponent.level}</span>
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">Taxa de vitoria {winRate}%</span>
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">{totalBattles} duelos</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-0.5 rounded-lg border border-slate-600 bg-slate-800/80 px-2 py-1">
                            <small className="text-[10px] text-slate-300">V/D</small>
                            <strong>
                              {opponent.totalWins}/{opponent.totalLosses}
                            </strong>
                          </div>
                          <div className="grid gap-0.5 rounded-lg border border-slate-600 bg-slate-800/80 px-2 py-1">
                            <small className="text-[10px] text-slate-300">Media nivel</small>
                            <strong>{averageChampionLevel}</strong>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-blue-400/60 bg-blue-500/15 px-3 py-2 text-slate-100 shadow-lg transition hover:-translate-y-px hover:border-yellow-300/70 disabled:cursor-not-allowed disabled:opacity-45 xl:grid xl:min-h-[122px] xl:min-w-[82px] xl:place-items-center xl:gap-1"
                onClick={handleNextSuggestions}
                disabled={suggestionStartIndex >= maxSuggestionStart || suggestedOpponents.length <= SuggestionVisibleCount}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">Avancar</span>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-yellow-300/40 bg-slate-900/50 text-sm">&gt;</span>
              </button>
            </div>
          </div>
        ) : null}

        {pvpStep === 2 ? (
          <div className="grid gap-3">
            <span className="text-xs font-semibold text-slate-300">Escolha seu campeao para enfrentar {selectedOpponent?.displayName}</span>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {myPokemons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem pokemon no time.</div>
              ) : (
                myPokemons.map((pokemon) => {
                  const totalBattles = pokemon.wins + pokemon.losses;
                  const winRate = totalBattles === 0 ? 0 : Math.round((pokemon.wins / totalBattles) * 100);
                  return (
                    <button
                      key={pokemon.id}
                      className={`grid gap-2 rounded-2xl border p-3 text-left transition ${
                        challengerPokemonId === pokemon.id
                          ? "border-yellow-300/70 bg-yellow-500/10"
                          : "border-blue-400/40 bg-slate-900/70 hover:-translate-y-px hover:border-blue-300/70"
                      }`}
                      type="button"
                      onClick={() => setChallengerPokemonId(pokemon.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
                          {pokemon.species.imageUrl ? (
                            <img src={pokemon.species.imageUrl} alt={pokemon.species.name} className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">PK</span>
                          )}
                        </div>
                        <div className="grid min-w-0 gap-0.5">
                          <strong className="truncate capitalize">{pokemon.species.name}</strong>
                          <small className="text-xs text-slate-300">Seu campeao</small>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full border border-teal-400/60 bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold capitalize text-teal-100">{pokemon.species.typePrimary}</span>
                        <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">Nivel {pokemon.level}</span>
                        <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold">Taxa de vitoria {winRate}%</span>
                      </div>
                      <small className="text-xs text-slate-300">V/D {pokemon.wins}/{pokemon.losses}</small>
                      <small className="text-xs text-slate-300">{totalBattles} duelos registrados</small>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={GhostButtonClass} onClick={() => setPvpStep(1)}>
                Voltar
              </button>
              <button type="button" className={PrimaryButtonClass} disabled={!challengerPokemonId} onClick={() => setPvpStep(3)}>
                Confirmar campeao
              </button>
            </div>
          </div>
        ) : null}

        {pvpStep === 3 ? (
          <div className="grid gap-3">
            <span className="text-xs font-semibold tracking-wide text-slate-300">Roleta do adversario</span>
            {!selectedOpponent || !selectedMyPokemon ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Selecione rival e seu pokemon para continuar.</div>
            ) : (
              <article className="grid gap-3 rounded-2xl border border-yellow-300/40 bg-slate-900/75 p-4">
                <div className="grid gap-1">
                  <strong>Rival selecionado: {selectedOpponent.displayName}</strong>
                  <small className="text-slate-300">A batalha inicia em 60s e termina em 5 minutos.</small>
                </div>
                <div className={`grid gap-2 rounded-xl border border-blue-400/50 bg-slate-950/70 p-3 ${isRouletteRolling ? "animate-pulse" : ""}`}>
                  <span className="inline-flex w-fit rounded-full border border-blue-400/60 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold">Roleta estilo caixa</span>
                  <div className="relative">
                    <div className="pointer-events-none absolute left-1/2 top-2 z-10 h-3 w-px -translate-x-1/2 rounded-full bg-gradient-to-b from-yellow-300 to-red-500 shadow-[0_0_8px_rgba(250,204,21,0.7)]" />
                    <div className="w-full overflow-hidden py-2">
                      <div
                        className={`flex gap-2 px-[calc(50%-61px)] ${rouletteUseTransition ? "transition-transform duration-[5600ms] ease-out" : ""}`}
                        style={{ transform: `translateX(-${rouletteOffsetPx}px)` }}
                      >
                        {(rouletteTrackCards.length > 0 ? rouletteTrackCards : rouletteCards).map((champion, index) => (
                          <article
                            key={`${champion.id}_${index}`}
                            className={`grid w-[122px] min-w-[122px] gap-1 rounded-xl border bg-slate-900/80 p-2 text-center transition ${
                              !isRouletteRolling && rouletteWinnerIndex === index
                                ? "scale-[1.14] border-yellow-300/80 bg-yellow-500/10 shadow-[0_0_18px_rgba(250,204,21,0.55)]"
                                : index === rouletteFocusIndex
                                  ? "scale-110 border-blue-300/80 shadow-[0_0_14px_rgba(59,130,246,0.35)]"
                                  : "border-slate-700"
                            }`}
                          >
                            <div className="grid h-[72px] w-full place-items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-800/80">
                              {champion.species.imageUrl ? (
                                <img src={champion.species.imageUrl} alt={champion.species.name} className="h-[88%] w-[88%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">PK</span>
                              )}
                            </div>
                            <small className="capitalize text-slate-200">{champion.species.name}</small>
                            <small className="text-slate-300">Nivel {champion.level}</small>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                  <strong className="text-sm sm:text-base">{isRouletteRolling ? roulettePreviewName || "Girando..." : rouletteFinalName || roulettePreviewName || "Aguardando roleta"}</strong>
                  {postRouletteDelaySec > 0 ? <small className="text-slate-300">Aguardando {postRouletteDelaySec}s para iniciar o duelo...</small> : null}
                </div>
                {rouletteFinalName ? <small className="text-sm font-semibold text-yellow-100">Campeao sorteado: {rouletteFinalName}</small> : null}
                <div className="flex flex-wrap gap-2">
                    <button
                    type="button"
                    className={GhostButtonClass}
                    onClick={() => setPvpStep(2)}
                    disabled={isCreatingBattle || postRouletteDelaySec > 0}
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    className={PrimaryButtonClass}
                    disabled={isCreatingBattle || !canCreatePvpBattle || postRouletteDelaySec > 0}
                    onClick={HandleCreateBattle}
                  >
                    {isCreatingBattle ? "Girando roleta..." : postRouletteDelaySec > 0 ? `Iniciando em ${postRouletteDelaySec}s` : "Girar roleta e criar duelo"}
                  </button>
                </div>
              </article>
            )}
          </div>
        ) : null}

        {pvpStep === 4 && createdPvpBattleId ? (
          <article className="grid gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-3">
            <strong>Duelo PvP criado com sucesso</strong>
            {rouletteFinalName ? <small>Roleta selecionou: {rouletteFinalName}</small> : null}
            <Link className={OpenBattleLinkClass} href={`/battles/${createdPvpBattleId}`}>
              Ir para tela de duelo
            </Link>
            <button type="button" className={GhostButtonClass} onClick={() => setPvpStep(1)}>
              Criar novo duelo
            </button>
          </article>
        ) : null}

        {battleError ? <div className="rounded-xl border border-red-400/60 bg-red-500/15 p-3 text-sm text-red-200">{battleError}</div> : null}
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 grid gap-1">
          <h2>Duelos com IA</h2>
          <small className="text-slate-300">Escolha a dificuldade. O duelo com IA tambem inicia em 60s e dura ate 5 minutos.</small>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-slate-300">Escolha seu Pokemon para duelo IA</span>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {myPokemons.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem pokemon no time.</div>
              ) : (
                myPokemons.map((pokemon) => (
                  <button
                    key={`ai_${pokemon.id}`}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      aiChallengerPokemonId === pokemon.id
                        ? "border-yellow-300/70 bg-yellow-500/10"
                        : "border-slate-600 bg-slate-900/70 hover:-translate-y-px hover:border-blue-300/70"
                    }`}
                    type="button"
                    onClick={() => setAiChallengerPokemonId(pokemon.id)}
                  >
                    <strong className="capitalize">{pokemon.species.name}</strong>
                    <small className="text-slate-300">Nivel {pokemon.level}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {aiOpponents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem perfis de IA disponiveis.</div>
            ) : (
              aiOpponents.map((ai) => (
                <button
                  key={ai.id}
                  type="button"
                  className={`grid gap-1 rounded-xl border p-3 text-left transition ${
                    selectedAiDifficulty === ai.difficulty
                      ? "border-yellow-300/70 bg-yellow-500/10"
                      : "border-slate-600 bg-slate-900/70 hover:-translate-y-px hover:border-blue-300/70"
                  }`}
                  onClick={() => setSelectedAiDifficulty(ai.difficulty)}
                >
                  <strong>{ai.name}</strong>
                  <small className="text-slate-300">Dificuldade: {ai.difficulty}</small>
                  <small className="text-slate-300">{ai.strategy}</small>
                </button>
              ))
            )}
          </div>
          <button type="button" className={PrimaryButtonClass} disabled={isCreatingAiBattle} onClick={handleCreateAiBattle}>
            {isCreatingAiBattle ? "Criando duelo IA..." : "Criar Batalha com IA"}
          </button>
        </div>

        {createdAiBattleId ? (
          <article className="grid gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-3">
            <strong>Batalha IA criada com sucesso</strong>
            <small>Inicio automatico em 60s</small>
            <Link className={OpenBattleLinkClass} href={`/battles/${createdAiBattleId}`}>
              Abrir batalha
            </Link>
          </article>
        ) : null}
      </section>
    </main>
  );
}
