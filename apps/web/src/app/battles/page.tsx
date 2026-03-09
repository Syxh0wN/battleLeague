"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";
import { GetTrainerPossessive } from "../../lib/trainer-gender";

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
  currentHp?: number;
  atk?: number;
  def?: number;
  speed?: number;
  fatigue?: number;
  fatigueUpdatedAt?: string;
  isLegacy?: boolean;
  lifeUtil?: number;
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

type BattleSummaryResponse = {
  me: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
  };
  rank: {
    elo: number;
    league: string;
    position: number;
    totalPlayers: number;
  };
  recentBattles: Array<{
    id: string;
    result: "Vitoria" | "Derrota" | "Expirada" | "Sem resultado";
    rivalName: string;
    myPokemonName: string;
    rivalPokemonName: string;
    myMmrDelta: number | null;
    rivalMmrDelta: number | null;
    myPokemonXpGain: number;
    rivalPokemonXpGain: number;
    myAccountXpGain: number;
    rivalAccountXpGain: number;
    myPokemonImageUrl: string | null;
    rivalPokemonImageUrl: string | null;
    updatedAt: string;
  }>;
};

type MeGenderResponse = {
  gender?: "male" | "female";
};

const RouletteItemStepPx = 112;
const SuggestionVisibleCount = 10;
const MyPokemonVisibleCount = 5;
const OngoingBattlesFeedBatchSize = 6;
const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const GhostButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const PrimaryButtonClass =
  "inline-flex h-10 w-full items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto";
const OpenBattleLinkClass =
  "inline-flex h-9 w-fit items-center justify-center rounded-xl bg-slate-800/90 px-3 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70";

function GetRecentBattlesVisibleCountByWidth(screenWidth: number) {
  if (screenWidth >= 1536) {
    return 12;
  }
  if (screenWidth >= 1024) {
    return 10;
  }
  if (screenWidth >= 640) {
    return 6;
  }
  return 1;
}

export default function BattlesPage() {
  const router = useRouter();
  const ParseLeague = (league: string) => {
    const [baseLeague, tierRaw] = league.split(" ");
    const tier = Number(tierRaw);
    return {
      baseLeague,
      tier: Number.isFinite(tier) && tier >= 1 && tier <= 3 ? tier : 3
    };
  };
  const BuildLeagueToneClass = (league: string) => {
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
  };
  const RenderLeagueIcon = (league: string) => {
    const { baseLeague, tier } = ParseLeague(league);
    const pipCount = Math.max(1, 4 - tier);
    const iconClass = "h-4 w-4 fill-none stroke-current stroke-[1.8]";
    return (
      <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/35">
        <span className={`absolute inset-0 rounded-xl bg-gradient-to-br ${BuildLeagueToneClass(league)} opacity-90`} />
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset" />
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
  };
  const formatLeagueDelta = (value: number | null | undefined) => {
    const safeValue = Number(value ?? 0);
    if (safeValue > 0) {
      return `+${safeValue}`;
    }
    return `${safeValue}`;
  };
  const RenderLeagueDeltaIcon = (value: number | null | undefined) => {
    const safeValue = Number(value ?? 0);
    if (safeValue > 0) {
      return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-[2]">
          <path d="M12 5l6 7h-4v7h-4v-7H6z" />
        </svg>
      );
    }
    if (safeValue < 0) {
      return (
        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-[2]">
          <path d="M12 19l-6-7h4V5h4v7h4z" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-[2]">
        <path d="M6 12h12" />
      </svg>
    );
  };
  const BuildPokemonXpToneClass = (value: number) => {
    if (value >= 36) {
      return "bg-cyan-500/25 text-cyan-100 ring-cyan-300/50";
    }
    if (value >= 20) {
      return "bg-sky-500/20 text-sky-100 ring-sky-300/45";
    }
    return "bg-slate-700/70 text-slate-200 ring-slate-500/50";
  };
  const BuildAccountXpToneClass = (value: number) => {
    if (value >= 34) {
      return "bg-emerald-500/25 text-emerald-100 ring-emerald-300/50";
    }
    if (value >= 18) {
      return "bg-lime-500/20 text-lime-100 ring-lime-300/45";
    }
    return "bg-slate-700/70 text-slate-200 ring-slate-500/50";
  };

  const [pvpStep, setPvpStep] = useState<1 | 2 | 3 | 4>(1);
  const [pvpMode, setPvpMode] = useState<"ranked" | "friends">("ranked");
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
  const [myPokemonStartIndex, setMyPokemonStartIndex] = useState(0);
  const [recentBattlesStartIndex, setRecentBattlesStartIndex] = useState(0);
  const [recentBattlesVisibleCount, setRecentBattlesVisibleCount] = useState(1);
  const [visibleOngoingBattlesCount, setVisibleOngoingBattlesCount] = useState(OngoingBattlesFeedBatchSize);
  const ongoingBattlesLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const rouletteRafRef = useRef<number | null>(null);
  const postRouletteTimerRef = useRef<number | null>(null);
  const rouletteOffsetRef = useRef(0);
  const rouletteShouldSpinRef = useRef(false);
  const rouletteAudioContextRef = useRef<AudioContext | null>(null);
  const rouletteSoundStepRef = useRef(-1);

  const suggestionsQuery = useQuery({
    queryKey: ["battleSuggestions"],
    queryFn: () => ApiFetch<SuggestedOpponent[]>("/battles/suggestions")
  });
  const friendSuggestionsQuery = useQuery({
    queryKey: ["friendBattleSuggestions"],
    queryFn: () => ApiFetch<SuggestedOpponent[]>("/battles/friends/suggestions")
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
    staleTime: 6000,
    refetchInterval: 8000,
    refetchIntervalInBackground: false
  });
  const battleSummaryQuery = useQuery({
    queryKey: ["battleSummary"],
    queryFn: () => ApiFetch<BattleSummaryResponse>("/battles/summary"),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchIntervalInBackground: false
  });
  const meGenderQuery = useQuery({
    queryKey: ["meForBattlesGender"],
    queryFn: () => ApiFetch<MeGenderResponse>("/users/me")
  });

  const myPokemons = (myPokemonsQuery.data ?? []).filter((pokemon) => !pokemon.isLegacy && (pokemon.lifeUtil ?? 1) > 0);
  const aiOpponents = aiOpponentsQuery.data ?? [];
  const rankedOpponents = suggestionsQuery.data ?? [];
  const friendOpponents = friendSuggestionsQuery.data ?? [];
  const suggestedOpponents = pvpMode === "friends" ? friendOpponents : rankedOpponents;
  const ongoingBattles = ongoingBattlesQuery.data ?? [];
  const visibleOngoingBattles = ongoingBattles.slice(0, visibleOngoingBattlesCount);
  const hasMoreOngoingBattles = visibleOngoingBattlesCount < ongoingBattles.length;
  const battleSummary = battleSummaryQuery.data ?? null;
  const trainerPossessive = GetTrainerPossessive(meGenderQuery.data?.gender);
  const recentBattles = (battleSummary?.recentBattles ?? []).filter((battle) => battle.result === "Vitoria" || battle.result === "Derrota");
  const maxRecentBattlesStart = Math.max(0, recentBattles.length - recentBattlesVisibleCount);
  const visibleRecentBattles = recentBattles.slice(recentBattlesStartIndex, recentBattlesStartIndex + recentBattlesVisibleCount);
  const canCreatePvpBattle = opponentUserId.length > 0 && challengerPokemonId.length > 0;
  const selectedOpponent = suggestedOpponents.find((opponent) => opponent.id === opponentUserId) ?? null;
  const selectedMyPokemon = myPokemons.find((pokemon) => pokemon.id === challengerPokemonId) ?? null;
  const maxSuggestionStart = Math.max(0, suggestedOpponents.length - SuggestionVisibleCount);
  const visibleSuggestions = suggestedOpponents.slice(suggestionStartIndex, suggestionStartIndex + SuggestionVisibleCount);
  const maxMyPokemonStart = Math.max(0, myPokemons.length - MyPokemonVisibleCount);
  const visibleMyPokemons = myPokemons.slice(myPokemonStartIndex, myPokemonStartIndex + MyPokemonVisibleCount);
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
    return () => {
      if (rouletteAudioContextRef.current) {
        rouletteAudioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    setVisibleOngoingBattlesCount(OngoingBattlesFeedBatchSize);
  }, [ongoingBattles.length]);

  useEffect(() => {
    if (!hasMoreOngoingBattles) {
      return;
    }
    const sentinel = ongoingBattlesLoadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleOngoingBattlesCount((current) => Math.min(ongoingBattles.length, current + OngoingBattlesFeedBatchSize));
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreOngoingBattles, ongoingBattles.length]);

  const getArcadeSoundConfig = () => {
    return {
      tickWave: "square" as OscillatorType,
      tickFrequency: 780,
      tickGain: 0.03,
      winWave: "sawtooth" as OscillatorType,
      winStartFrequency: 640,
      winEndFrequency: 1120,
      winGain: 0.05
    };
  };

  const getRouletteAudioContext = () => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!rouletteAudioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      rouletteAudioContextRef.current = new AudioContextClass();
    }
    if (rouletteAudioContextRef.current.state === "suspended") {
      void rouletteAudioContextRef.current.resume();
    }
    return rouletteAudioContextRef.current;
  };

  const playRouletteTickSound = () => {
    const audioContext = getRouletteAudioContext();
    if (!audioContext) {
      return;
    }
    const soundPresetConfig = getArcadeSoundConfig();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = soundPresetConfig.tickWave;
    oscillator.frequency.setValueAtTime(soundPresetConfig.tickFrequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(soundPresetConfig.tickGain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.065);
  };

  const playRouletteWinSound = () => {
    const audioContext = getRouletteAudioContext();
    if (!audioContext) {
      return;
    }
    const soundPresetConfig = getArcadeSoundConfig();
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = soundPresetConfig.winWave;
    oscillator.frequency.setValueAtTime(soundPresetConfig.winStartFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(soundPresetConfig.winEndFrequency, now + 0.17);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(soundPresetConfig.winGain, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  };

  useEffect(() => {
    setSuggestionStartIndex((current) => Math.min(current, maxSuggestionStart));
  }, [maxSuggestionStart]);

  useEffect(() => {
    setMyPokemonStartIndex((current) => Math.min(current, maxMyPokemonStart));
  }, [maxMyPokemonStart]);

  useEffect(() => {
    setSuggestionStartIndex(0);
    setSuggestionMotion("");
    setSuggestionMotionKey((current) => current + 1);
    setOpponentUserId("");
    setChallengerPokemonId("");
    setMyPokemonStartIndex(0);
    setRoulettePreviewName("");
    setRouletteFinalName("");
    setRouletteTrackCards([]);
    setRouletteWinnerIndex(-1);
    setRouletteOffsetPx(0);
    rouletteOffsetRef.current = 0;
    rouletteSoundStepRef.current = -1;
    setPostRouletteDelaySec(0);
    setBattleError("");
    setPvpStep(1);
  }, [pvpMode]);

  useEffect(() => {
    const syncRecentBattlesVisibleCount = () => {
      setRecentBattlesVisibleCount(GetRecentBattlesVisibleCountByWidth(window.innerWidth));
    };
    syncRecentBattlesVisibleCount();
    window.addEventListener("resize", syncRecentBattlesVisibleCount);
    return () => {
      window.removeEventListener("resize", syncRecentBattlesVisibleCount);
    };
  }, []);

  useEffect(() => {
    setRecentBattlesStartIndex((current) => Math.min(current, maxRecentBattlesStart));
  }, [maxRecentBattlesStart]);

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
    if (rawMessage.includes("opponentRankOutOfRange")) {
      return "Voce so pode desafiar jogadores com rank proximo. Selecione outro rival.";
    }
    if (rawMessage.includes("friendshipRequiredForFriendBattle")) {
      return "Esse duelo exige amizade aceita entre os jogadores.";
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
      setBattleError(`Escolha o pokemon ${trainerPossessive} para iniciar o duelo.`);
      return;
    }
    setBattleError("");
    setIsCreatingBattle(true);
    setRouletteFinalName("");
    setPostRouletteDelaySec(0);
    setRouletteWinnerIndex(-1);
    setRouletteUseTransition(false);
    rouletteSoundStepRef.current = -1;
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
      if (previewIndex !== rouletteSoundStepRef.current) {
        rouletteSoundStepRef.current = previewIndex;
        playRouletteTickSound();
      }
      setRouletteOffsetPx(rouletteOffsetRef.current);
      setRoulettePreviewName(initialTrack[previewIndex]?.species.name ?? "Surpresa");
      rouletteRafRef.current = window.requestAnimationFrame(spinLoop);
    };
    rouletteRafRef.current = window.requestAnimationFrame(spinLoop);
    try {
      const createEndpoint = pvpMode === "friends" ? "/battles/friends" : "/battles";
      const response = await ApiFetch<CreateBattleResponse>(createEndpoint, {
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
      playRouletteWinSound();
      setCreatedPvpBattleId(response.id);
      setCreatedAiBattleId("");
      setRouletteFinalName(winnerName);
      setPostRouletteDelaySec(20);
      postRouletteTimerRef.current = window.setInterval(() => {
        setPostRouletteDelaySec((current) => {
          if (current <= 1) {
            if (postRouletteTimerRef.current !== null) {
              window.clearInterval(postRouletteTimerRef.current);
              postRouletteTimerRef.current = null;
            }
            router.push(`/battles/${response.id}`);
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
      setBattleError(`Selecione o pokemon ${trainerPossessive} para desafiar a IA.`);
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
    rouletteSoundStepRef.current = -1;
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

  const handlePrevMyPokemons = () => {
    if (myPokemonStartIndex === 0) {
      return;
    }
    setMyPokemonStartIndex((current) => Math.max(0, current - 1));
  };

  const handleNextMyPokemons = () => {
    if (myPokemonStartIndex >= maxMyPokemonStart) {
      return;
    }
    setMyPokemonStartIndex((current) => Math.min(maxMyPokemonStart, current + 1));
  };

  return (
    <main className="min-h-screen flex flex-col gap-2 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll self-start">
        <Link className={NavLinkClass} href="/dashboard">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5.5 9.5V20h13V9.5" />
              <path d="M10 20v-5h4v5" />
            </svg>
          </span>
          Voltar para Dashboard
        </Link>
        <Link className={NavLinkClass} href="/pokemon">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M3.5 12h17" />
              <circle cx="12" cy="12" r="2.2" />
            </svg>
          </span>
          Ir para Pokemons
        </Link>
      </nav>

      <section className={`${SectionCardClass} order-2`}>
        {battleSummaryQuery.isLoading || !battleSummary ? (
          <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">Carregando estatisticas...</div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <article className="grid min-w-0 gap-1 rounded-xl bg-slate-900/70 p-2.5 sm:p-3">
                <small className="text-xs text-slate-300">Estatistica minha</small>
                <strong className="truncate text-sm sm:text-base">{battleSummary.me.displayName}</strong>
                <small className="truncate text-xs text-slate-300 sm:text-sm">
                  V/D {battleSummary.me.totalWins}/{battleSummary.me.totalLosses} | Taxa {battleSummary.me.winRate}%
                </small>
              </article>
              <article className="grid min-w-0 gap-1 rounded-xl bg-slate-900/70 p-2.5 sm:p-3">
                <small className="text-xs text-slate-300">Meu rank</small>
                <strong className="inline-flex min-w-0 items-center gap-1.5 text-sm sm:gap-2 sm:text-base">
                  {RenderLeagueIcon(battleSummary.rank.league)}
                  <span className="truncate">{battleSummary.rank.league}</span>
                </strong>
                <small className="truncate text-xs text-slate-300 sm:text-sm">Posicao {battleSummary.rank.position}/{battleSummary.rank.totalPlayers}</small>
              </article>
            </div>
          </div>
        )}
      </section>

      {ongoingBattles.length > 0 ? (
        <section className={`${SectionCardClass} order-4`}>
          <div className="mb-3 grid gap-1">
            <h2>Duelos em andamento</h2>
            <small className="text-slate-300">
              Partidas pendentes e ativas para acompanhar agora. {visibleOngoingBattles.length}/{ongoingBattles.length}
            </small>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {visibleOngoingBattles.map((battle) => {
              const turnDisplayName =
                battle.currentTurnUserId === battle.challenger.id ? battle.challenger.displayName : battle.opponent.displayName;
              const lastTurnActorName = !battle.lastTurn
                ? ""
                : battle.lastTurn.actorUserId === battle.challenger.id
                  ? battle.challenger.displayName
                  : battle.opponent.displayName;
              const startsInSec = Math.max(0, Math.floor((new Date(battle.scheduledStartAt).getTime() - Date.now()) / 1000));
              const startsInClock = `${Math.floor(startsInSec / 60)
                .toString()
                .padStart(2, "0")}:${(startsInSec % 60).toString().padStart(2, "0")}`;
              return (
                <article key={battle.id} className="grid gap-3 rounded-2xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-700/70">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ring-inset ${battle.status === "active" ? "bg-slate-800/90 text-slate-100 ring-slate-500/70" : "bg-slate-800/65 text-slate-300 ring-slate-600/70"}`}>
                      {battle.status}
                    </span>
                    <small className="rounded-full bg-slate-800/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                      {battle.isAiBattle ? "IA" : "PVP"}
                    </small>
                  </div>
                  <div className="grid gap-2 rounded-xl bg-slate-950/60 p-2.5 ring-1 ring-inset ring-slate-700/70">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <div className="grid justify-items-center gap-1">
                        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-slate-800/75 ring-1 ring-inset ring-slate-700/70">
                          {battle.challengerPokemon.species.imageUrl ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={battle.challengerPokemon.species.imageUrl}
                              alt={battle.challengerPokemon.species.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">PK</span>
                          )}
                        </div>
                        <small className="max-w-full truncate text-[11px] font-semibold capitalize text-slate-100">
                          {battle.challengerPokemon.species.name}
                        </small>
                        <small className="max-w-full truncate text-[10px] text-slate-300">{battle.challenger.displayName}</small>
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-slate-300">VS</span>
                      <div className="grid justify-items-center gap-1">
                        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-slate-800/75 ring-1 ring-inset ring-slate-700/70">
                          {battle.opponentPokemon.species.imageUrl ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={battle.opponentPokemon.species.imageUrl}
                              alt={battle.opponentPokemon.species.name}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400">PK</span>
                          )}
                        </div>
                        <small className="max-w-full truncate text-[11px] font-semibold capitalize text-slate-100">
                          {battle.opponentPokemon.species.name}
                        </small>
                        <small className="max-w-full truncate text-[10px] text-slate-300">{battle.opponent.displayName}</small>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                        Lv {battle.challengerPokemon.level} x Lv {battle.opponentPokemon.level}
                      </span>
                      {battle.status === "pending" ? (
                        <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-200 ring-1 ring-inset ring-slate-600/70">
                          Inicio {startsInClock}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                          Turno {turnDisplayName}
                        </span>
                      )}
                    </div>
                  </div>
                  {battle.lastTurn ? (
                    <small className="rounded-lg bg-slate-900/65 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">
                      Ultima acao: {lastTurnActorName} usou {battle.lastTurn.action.toUpperCase()} e causou {battle.lastTurn.damage}
                    </small>
                  ) : (
                    <small className="rounded-lg bg-slate-900/65 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">Sem turno registrado ainda</small>
                  )}
                  <Link className={`${OpenBattleLinkClass} justify-self-center`} href={`/battles/${battle.id}`}>
                    Abrir batalha
                  </Link>
                </article>
              );
            })}
          </div>
          {hasMoreOngoingBattles ? <div ref={ongoingBattlesLoadMoreSentinelRef} className="mt-3 h-1 w-full" aria-hidden /> : null}
        </section>
      ) : null}

      <section className="order-3 w-full min-w-0 max-w-full rounded-2xl bg-slate-900/80 p-2">
        <div className="mb-2 grid gap-1">
          <h2 className="text-center font-mono text-xl font-bold tracking-[0.16em] text-slate-100">Desafie</h2>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        </div>
        {pvpStep === 1 ? (
          <div className="grid gap-1.5">
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                  pvpMode === "ranked"
                    ? "bg-slate-800/90 text-slate-100 ring-slate-500/70"
                    : "bg-slate-900/70 text-slate-300 ring-slate-600/70 hover:bg-slate-800/75"
                }`}
                onClick={() => setPvpMode("ranked")}
              >
                Ranked
              </button>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                  pvpMode === "friends"
                    ? "bg-slate-800/90 text-slate-100 ring-slate-500/70"
                    : "bg-slate-900/70 text-slate-300 ring-slate-600/70 hover:bg-slate-800/75"
                }`}
                onClick={() => setPvpMode("friends")}
              >
                Amigos
              </button>
            </div>
            <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-stretch gap-1.5">
              <button
                type="button"
                className="inline-flex items-center justify-center text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handlePrevSuggestions}
                disabled={suggestionStartIndex === 0 || suggestedOpponents.length <= SuggestionVisibleCount}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs transition hover:bg-slate-700/90">&lt;</span>
              </button>
              <div className="overflow-hidden rounded-2xl">
                <div
                  key={`suggestion_motion_${suggestionMotionKey}_${suggestionStartIndex}`}
                  className={`flex items-stretch justify-center gap-2 transition-all duration-300 ${
                    suggestionMotion === "next"
                      ? "translate-x-1 opacity-95"
                      : suggestionMotion === "prev"
                        ? "-translate-x-1 opacity-95"
                        : ""
                  }`}
                >
                  {suggestedOpponents.length === 0 ? (
                    <div className="w-full rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">
                      {pvpMode === "friends" ? "Voce ainda nao tem amigos com pokemons disponiveis." : "Gerando oponentes de sugestao..."}
                    </div>
                  ) : (
                    visibleSuggestions.map((opponent, opponentIndex) => {
                      const totalBattles = opponent.totalWins + opponent.totalLosses;
                      const winRate = totalBattles === 0 ? 0 : Math.round((opponent.totalWins / totalBattles) * 100);
                      const averageChampionLevel =
                        opponent.champions.length === 0
                          ? 0
                          : Math.round(opponent.champions.reduce((acc, champion) => acc + champion.level, 0) / opponent.champions.length);
                      return (
                        <button
                          key={opponent.id}
                          className={`${opponentIndex > 0 ? "hidden sm:grid" : "grid"} min-h-[116px] w-[212px] min-w-[212px] flex-none gap-1 rounded-2xl p-2 text-left shadow-[0_8px_20px_rgba(2,6,23,0.35)] transition ${
                            opponentUserId === opponent.id
                              ? "bg-slate-800/90"
                              : "bg-slate-900/70 hover:-translate-y-px hover:bg-slate-800/75"
                          }`}
                          type="button"
                          onClick={() => handleChooseOpponent(opponent.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-800/80">
                              {opponent.avatarUrl ? (
                                <img loading="lazy" decoding="async" src={opponent.avatarUrl} alt={opponent.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[11px] font-bold text-slate-300">{opponent.displayName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="grid min-w-0 gap-0.5">
                              <span className="truncate font-semibold">{opponent.displayName}</span>
                              <small className="text-[10px] text-slate-300">{pvpMode === "friends" ? "Amigo disponivel" : "Rival recomendado"}</small>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold">Nivel {opponent.level}</span>
                            <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold">Taxa {winRate}%</span>
                            <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold">{totalBattles} duelos</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div className="grid gap-0.5 rounded-lg bg-slate-800/80 px-2 py-0.5">
                              <small className="text-[10px] text-slate-300">V/D</small>
                              <strong>
                                {opponent.totalWins}/{opponent.totalLosses}
                              </strong>
                            </div>
                            <div className="grid gap-0.5 rounded-lg bg-slate-800/80 px-2 py-0.5">
                              <small className="text-[10px] text-slate-300">Media nivel</small>
                              <strong>{averageChampionLevel}</strong>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleNextSuggestions}
                disabled={suggestionStartIndex >= maxSuggestionStart || suggestedOpponents.length <= SuggestionVisibleCount}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs transition hover:bg-slate-700/90">&gt;</span>
              </button>
            </div>
          </div>
        ) : null}

        {pvpStep === 2 ? (
          <div className="grid gap-2">
            <span className="text-xs font-semibold text-slate-300">Escolha o pokemon {trainerPossessive} para enfrentar {selectedOpponent?.displayName}</span>
            <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-stretch gap-1.5">
              <button
                type="button"
                className="inline-flex items-center justify-center text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handlePrevMyPokemons}
                disabled={myPokemonStartIndex === 0 || myPokemons.length <= MyPokemonVisibleCount}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs transition hover:bg-slate-700/90">&lt;</span>
              </button>
              <div className="overflow-hidden rounded-2xl px-1 py-1">
                <div className="flex items-stretch justify-center gap-2">
              {myPokemons.length === 0 ? (
                      <div className="w-full rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Sem pokemon no time.</div>
              ) : (
                      visibleMyPokemons.map((pokemon, pokemonIndex) => {
                  const totalBattles = pokemon.wins + pokemon.losses;
                  const winRate = totalBattles === 0 ? 0 : Math.round((pokemon.wins / totalBattles) * 100);
                  const fatigueUpdatedAtMs = pokemon.fatigueUpdatedAt ? new Date(pokemon.fatigueUpdatedAt).getTime() : Date.now();
                  const fatigueElapsedMin = Math.max(0, Math.floor((Date.now() - fatigueUpdatedAtMs) / 60_000));
                  const currentFatigue = Math.max(0, (pokemon.fatigue ?? 0) - fatigueElapsedMin);
                  const fatigueProgressPercent = Math.max(0, Math.min(100, currentFatigue));
                  const fatigueToneClass =
                    fatigueProgressPercent >= 75
                      ? "from-rose-500 to-red-400"
                      : fatigueProgressPercent >= 45
                        ? "from-amber-500 to-orange-400"
                        : fatigueProgressPercent >= 20
                          ? "from-yellow-500 to-lime-400"
                          : "from-emerald-500 to-teal-400";
                  return (
                    <button
                      key={pokemon.id}
                      className={`${pokemonIndex > 0 ? "hidden sm:grid" : "grid"} min-h-[196px] w-[210px] min-w-[210px] gap-2 rounded-2xl border p-2.5 text-left transition ${
                        challengerPokemonId === pokemon.id
                          ? "border-cyan-300/70 bg-slate-800/85 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                          : "border-slate-600 bg-slate-900/75 hover:-translate-y-px hover:border-slate-400/70"
                      }`}
                      type="button"
                      onClick={() => setChallengerPokemonId(pokemon.id)}
                    >
                      <div className="grid h-[74px] w-full place-items-center overflow-hidden rounded-xl bg-slate-800/75">
                        <div className="grid h-[56px] w-[56px] place-items-center overflow-hidden rounded-xl bg-slate-900/65 ring-1 ring-slate-700/70">
                          {pokemon.species.imageUrl ? (
                            <img loading="lazy" decoding="async" src={pokemon.species.imageUrl} alt={pokemon.species.name} className="h-[86%] w-[86%] object-contain" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">PK</span>
                          )}
                        </div>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-sm capitalize text-slate-100">{pokemon.species.name}</strong>
                          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-100">Nivel {pokemon.level}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">{pokemon.species.typePrimary}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-200">
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">HP {pokemon.currentHp ?? "-"}</span>
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">ATK {pokemon.atk ?? "-"}</span>
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">DEF {pokemon.def ?? "-"}</span>
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">SPD {pokemon.speed ?? "-"}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-200">
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">V/D {pokemon.wins}/{pokemon.losses}</span>
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70">Taxa {winRate}%</span>
                        <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-slate-700/70 col-span-2">{totalBattles} duelos</span>
                      </div>
                      <div className="grid gap-1">
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                          <small>Cansaco Atual</small>
                          <small>{fatigueProgressPercent}%</small>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div className={`h-full rounded-full bg-gradient-to-r ${fatigueToneClass}`} style={{ width: `${fatigueProgressPercent}%` }} />
                        </div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400" style={{ width: `${winRate}%` }} />
                      </div>
                    </button>
                  );
                })
              )}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex items-center justify-center text-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={handleNextMyPokemons}
                disabled={myPokemonStartIndex >= maxMyPokemonStart || myPokemons.length <= MyPokemonVisibleCount}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs transition hover:bg-slate-700/90">&gt;</span>
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={GhostButtonClass} onClick={() => setPvpStep(1)}>
                Voltar
              </button>
              <button type="button" className={PrimaryButtonClass} disabled={!challengerPokemonId} onClick={() => setPvpStep(3)}>
                Confirmar pokemon
              </button>
            </div>
          </div>
        ) : null}

        {pvpStep === 3 ? (
          <div className="grid gap-3">
            {!selectedOpponent || !selectedMyPokemon ? (
              <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Selecione rival e o pokemon {trainerPossessive} para continuar.</div>
            ) : (
              <article className="grid w-full min-w-0 max-w-full gap-3 rounded-2xl p-4">
                <div className="grid gap-1">
                  <strong>{pvpMode === "friends" ? `Amigo selecionado: ${selectedOpponent.displayName}` : `Rival selecionado: ${selectedOpponent.displayName}`}</strong>
                </div>
                <div className="grid gap-2">
                  <div className="relative max-w-full overflow-hidden rounded-xl bg-slate-950/85 px-2 py-3 ring-1 ring-inset ring-slate-700/80">
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-amber-300/90" />
                    <div className="pointer-events-none absolute top-0 left-1/2 z-20 -translate-x-1/2 text-amber-300">
                      <svg viewBox="0 0 18 16" className="h-4 w-4 fill-current">
                        <path d="M7.2 14.6c.8 1.2 2.8 1.2 3.6 0l6.7-10C18.3 3.1 17.4 1.5 15.9 1.5H2.1C.6 1.5-.3 3.1.5 4.6z" />
                      </svg>
                    </div>
                    <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 rotate-180 text-amber-300">
                      <svg viewBox="0 0 18 16" className="h-4 w-4 fill-current">
                        <path d="M7.2 14.6c.8 1.2 2.8 1.2 3.6 0l6.7-10C18.3 3.1 17.4 1.5 15.9 1.5H2.1C.6 1.5-.3 3.1.5 4.6z" />
                      </svg>
                    </div>
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-slate-950/95 to-transparent sm:w-14" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-slate-950/95 to-transparent sm:w-14" />
                    <div className="w-full max-w-full overflow-hidden px-2 sm:px-6">
                      <div
                        className={`flex w-max items-stretch gap-1.5 py-1 ${rouletteUseTransition ? "transition-transform duration-[5600ms] ease-out" : ""}`}
                        style={{
                          transform: `translateX(-${rouletteOffsetPx}px)`,
                          paddingLeft: "calc(50% - 53px)",
                          paddingRight: "calc(50% - 53px)"
                        }}
                      >
                        {(rouletteTrackCards.length > 0 ? rouletteTrackCards : rouletteCards).map((champion, index) => (
                          <article
                            key={`${champion.id}_${index}`}
                            className={`relative grid w-[106px] min-w-[106px] gap-1 rounded-lg border bg-slate-900/85 p-2 text-center transition ${
                              !isRouletteRolling && rouletteWinnerIndex === index
                                ? "z-20 scale-[1.05] border-amber-300/80 bg-slate-900/90 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                                : "border-slate-700/80 text-slate-200"
                            }`}
                          >
                            <div className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-slate-400/20" />
                            <div className="grid min-h-[52px] place-items-center">
                              {champion.species.imageUrl ? (
                                <img loading="lazy" decoding="async" src={champion.species.imageUrl} alt={champion.species.name} className="h-10 w-10 object-contain" />
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">PK</span>
                              )}
                            </div>
                            <small className="truncate text-[11px] font-semibold capitalize">{champion.species.name}</small>
                            <small className="text-[10px] font-bold text-amber-200">Lv {champion.level}</small>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg bg-slate-900/65 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-inset ring-slate-700/70">
                    Premio: <strong className="capitalize">{rouletteFinalName || roulettePreviewName || "Aguardando roleta"}</strong>
                  </div>
                  {postRouletteDelaySec > 0 ? <small className="text-slate-300">Aguardando {postRouletteDelaySec}s para iniciar o duelo...</small> : null}
                </div>
                {rouletteFinalName ? <small className="text-sm font-semibold text-slate-100">Campeao sorteado: {rouletteFinalName}</small> : null}
                <div className="flex flex-wrap justify-center gap-2">
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
          <article className="grid gap-2 rounded-xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-500/70">
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

        {battleError ? <div className="rounded-xl bg-slate-900/75 p-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-500/70">{battleError}</div> : null}
      </section>

      <section className={`${SectionCardClass} order-5`}>
        {battleSummaryQuery.isLoading || !battleSummary ? (
          <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">Carregando ultimas batalhas...</div>
        ) : (
          <div className="grid gap-2">
            <strong className="text-sm">Ultimas batalhas</strong>
            {recentBattles.length === 0 ? (
              <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">Sem historico recente.</div>
            ) : (
              <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1 sm:grid-cols-[34px_minmax(0,1fr)_34px] sm:gap-2">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs text-slate-100 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7"
                  disabled={recentBattlesStartIndex === 0}
                  onClick={() => setRecentBattlesStartIndex((current) => Math.max(0, current - 1))}
                >
                  &lt;
                </button>
                <div className="overflow-x-auto overflow-y-hidden px-1 py-1 sm:px-2">
                  <div className="flex min-w-full items-stretch justify-center gap-2 sm:min-w-max sm:justify-start sm:gap-3">
                    {visibleRecentBattles.map((battle, battleIndex) => {
                      const resultClass =
                        battle.result === "Vitoria"
                          ? "bg-emerald-500/10 shadow-[0_0_14px_rgba(16,185,129,0.28)]"
                          : battle.result === "Derrota"
                            ? "bg-red-500/10 shadow-[0_0_14px_rgba(239,68,68,0.28)]"
                            : "bg-slate-900/70";
                      return (
                        <article
                          key={battle.id}
                          className={`${battleIndex > 0 ? "hidden sm:grid" : "grid"} w-[212px] min-w-[212px] flex-none gap-2 rounded-xl p-3 sm:w-[228px] sm:min-w-[228px] ${resultClass}`}
                        >
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <div className="grid justify-items-center gap-1 rounded-lg bg-slate-800/75 p-2">
                              <small className="max-w-full truncate text-[11px] font-semibold text-slate-200">
                                {battleSummary.me.displayName}
                              </small>
                              {battle.myPokemonImageUrl ? (
                                <img loading="lazy" decoding="async" src={battle.myPokemonImageUrl} alt={battle.myPokemonName} className="h-10 w-10 object-contain" />
                              ) : (
                                <div className="grid h-10 w-10 place-items-center text-xs text-slate-400">PK</div>
                              )}
                              <small className="text-xs font-medium capitalize text-slate-100">{battle.myPokemonName}</small>
                            </div>
                            <span className="text-xs font-bold tracking-wide text-slate-200">VS</span>
                            <div className="grid justify-items-center gap-1 rounded-lg bg-slate-800/75 p-2">
                              <small className="max-w-full truncate text-[11px] font-semibold text-slate-200">
                                {battle.rivalName}
                              </small>
                              {battle.rivalPokemonImageUrl ? (
                                <img loading="lazy" decoding="async" src={battle.rivalPokemonImageUrl} alt={battle.rivalPokemonName} className="h-10 w-10 object-contain" />
                              ) : (
                                <div className="grid h-10 w-10 place-items-center text-xs text-slate-400">PK</div>
                              )}
                              <small className="text-xs font-medium capitalize text-slate-100">{battle.rivalPokemonName}</small>
                            </div>
                          </div>
                          <span
                            className={`inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-bold ${
                              battle.result === "Vitoria" ? "bg-emerald-500/25 text-emerald-100" : "bg-red-500/25 text-red-100"
                            }`}
                          >
                            {battle.result}
                          </span>
                          <div className="grid gap-1 rounded-lg bg-slate-900/65 p-2 ring-1 ring-inset ring-slate-700/70">
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>PDLs voce</small>
                              <span
                                className={
                                  (battle.myMmrDelta ?? 0) > 0
                                    ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-100"
                                    : (battle.myMmrDelta ?? 0) < 0
                                      ? "inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-100"
                                      : "inline-flex items-center gap-1 rounded-full bg-slate-700/70 px-2 py-0.5 text-slate-200"
                                }
                              >
                                {RenderLeagueDeltaIcon(battle.myMmrDelta)}
                                {formatLeagueDelta(battle.myMmrDelta)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>PDLs rival</small>
                              <span
                                className={
                                  (battle.rivalMmrDelta ?? 0) > 0
                                    ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-100"
                                    : (battle.rivalMmrDelta ?? 0) < 0
                                      ? "inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-100"
                                      : "inline-flex items-center gap-1 rounded-full bg-slate-700/70 px-2 py-0.5 text-slate-200"
                                }
                              >
                                {RenderLeagueDeltaIcon(battle.rivalMmrDelta)}
                                {formatLeagueDelta(battle.rivalMmrDelta)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>XP pokemon {trainerPossessive}</small>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildPokemonXpToneClass(
                                  battle.myPokemonXpGain
                                )}`}
                              >
                                +{battle.myPokemonXpGain}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>XP pokemon rival</small>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildPokemonXpToneClass(
                                  battle.rivalPokemonXpGain
                                )}`}
                              >
                                +{battle.rivalPokemonXpGain}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>XP conta {trainerPossessive}</small>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildAccountXpToneClass(
                                  battle.myAccountXpGain
                                )}`}
                              >
                                +{battle.myAccountXpGain}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                              <small>XP conta rival</small>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildAccountXpToneClass(
                                  battle.rivalAccountXpGain
                                )}`}
                              >
                                +{battle.rivalAccountXpGain}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800/80 text-xs text-slate-100 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={recentBattlesStartIndex >= maxRecentBattlesStart}
                  onClick={() => setRecentBattlesStartIndex((current) => Math.min(maxRecentBattlesStart, current + 1))}
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
        )}
      </section>

    </main>
  );
}
