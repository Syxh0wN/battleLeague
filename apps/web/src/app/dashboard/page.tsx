"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";
import { GetTrainerLabelLower, GetTrainerPossessive } from "../../lib/trainer-gender";
import { useToast } from "../../providers/toast-provider";

type MeResponse = {
  id: string;
  displayName: string;
  accountTag?: string | null;
  avatarUrl: string | null;
  gender?: "male" | "female";
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
  isLegacy?: boolean;
  fatigue?: number;
  fatigueUpdatedAt?: string;
  restCooldownUntil: string | null;
  evolveCooldownUntil: string | null;
  trainingCooldownUntil?: string | null;
  species: {
    name: string;
    typePrimary: string;
    imageUrl: string | null;
    evolutionTarget: string | null;
    evolutionLevel: number | null;
  };
};

type BattleSummaryResponse = {
  me: {
    displayName: string;
  };
  recentBattles: Array<{
    id: string;
    result: "Vitoria" | "Derrota" | "Expirada" | "Sem resultado";
    iWasChallenged?: boolean;
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

type OngoingBattleItem = {
  id: string;
  status: "pending" | "active";
  scheduledStartAt: string;
  challenger: { id: string; displayName: string };
  opponent: { id: string; displayName: string };
  challengerPokemon: { species: { name: string } };
  opponentPokemon: { species: { name: string } };
};

type MyPokemonStatusItem = {
  id: string;
  evolveCooldownUntil: string | null;
  trainingCooldownUntil?: string | null;
  species: {
    name: string;
  };
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAtMs: number;
};

type LootEconomyResponse = {
  user: {
    id: string;
    coins: number;
    pokemonFragments: number;
    lootPityCounter: number;
    dailyShopPurchases: number;
    dailyShopPurchasedAt: string | null;
  };
  dailyShopLimit: number;
  lootPriceCoins: number;
  lootBoxCatalog: Array<{
    boxType: string;
    displayName: string;
    category: string;
    priceCoins: number;
    imageUrl: string;
  }>;
  history: Array<{
    id: string;
    rewardType: string;
    rewardValue: string;
    rewardRarity: string | null;
    fragmentGain: number;
    wasDuplicate: boolean;
    pityBefore: number;
    pityAfter: number;
    createdAt: string;
  }>;
};

type LootBoxOpeningResponse = {
  opening?: {
    rewardType: string;
    rewardValue: string;
    rewardRarity?: string | null;
    fragmentGain?: number;
  };
};

type SpeciesListItem = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type LootSpinItem = {
  name: string;
  rarity: string;
  imageUrl?: string | null;
};

const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "relative z-10 pointer-events-auto inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const GoogleDefaultAvatarUrl = "https://www.gstatic.com/images/branding/product/1x/avatar_circle_blue_512dp.png";
const HiddenPoolFallbackKey = "battleleague:hiddenDashboardChampionIds";
const PoolChangedEvent = "battleleague:poolChanged";
const ChampionCategoryFeedBatchSize = 12;

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

export default function DashboardPage() {
  const { addToast } = useToast();
  const [nowMs, setNowMs] = useState(Date.now());
  const [recentLevelUpTo, setRecentLevelUpTo] = useState<number | null>(null);
  const [hiddenChampionIds, setHiddenChampionIds] = useState<string[]>([]);
  const [isHiddenPoolHydrated, setIsHiddenPoolHydrated] = useState(false);
  const [recentBattlesStartIndex, setRecentBattlesStartIndex] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [isNotificationPulse, setIsNotificationPulse] = useState(false);
  const [selectedLootBoxType, setSelectedLootBoxType] = useState("fiesta");
  const [isLootRouletteOpen, setIsLootRouletteOpen] = useState(false);
  const [isLootRouletteSpinning, setIsLootRouletteSpinning] = useState(false);
  const [lootRouletteItems, setLootRouletteItems] = useState<LootSpinItem[]>([]);
  const [lootRouletteWinner, setLootRouletteWinner] = useState<LootSpinItem | null>(null);
  const [lootRouletteError, setLootRouletteError] = useState("");
  const [visibleTiredCount, setVisibleTiredCount] = useState(ChampionCategoryFeedBatchSize);
  const [visibleEvolutionReadyCount, setVisibleEvolutionReadyCount] = useState(ChampionCategoryFeedBatchSize);
  const [visibleReadyCount, setVisibleReadyCount] = useState(ChampionCategoryFeedBatchSize);
  const [recentBattlesVisibleCount, setRecentBattlesVisibleCount] = useState(1);
  const tiredLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const evolutionReadyLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const readyLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const unreadNotificationCountRef = useRef(0);
  const notificationPulseTimeoutRef = useRef<number | null>(null);
  const lootRouletteIntervalRef = useRef<number | null>(null);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/users/me")
  });
  const championsQuery = useQuery({
    queryKey: ["myChampions"],
    queryFn: () => ApiFetch<ChampionItem[]>("/users/me/champions")
  });
  const battleSummaryQuery = useQuery({
    queryKey: ["battleSummary"],
    queryFn: () => ApiFetch<BattleSummaryResponse>("/battles/summary"),
    staleTime: 10000,
    refetchInterval: 15000,
    refetchIntervalInBackground: false
  });
  const ongoingBattlesQuery = useQuery({
    queryKey: ["ongoingBattlesForDashboard"],
    queryFn: () => ApiFetch<OngoingBattleItem[]>("/battles/ongoing"),
    staleTime: 8000,
    refetchInterval: 12000,
    refetchIntervalInBackground: false
  });
  const myPokemonsNotificationQuery = useQuery({
    queryKey: ["myPokemonsForDashboardNotifications"],
    queryFn: () => ApiFetch<MyPokemonStatusItem[]>("/pokemon/my"),
    staleTime: 15000,
    refetchInterval: 20000,
    refetchIntervalInBackground: false
  });
  const lootEconomyQuery = useQuery({
    queryKey: ["lootEconomyDashboard"],
    queryFn: () => ApiFetch<LootEconomyResponse>("/progression/loot/economy"),
    staleTime: 15000,
    refetchInterval: 20000,
    refetchIntervalInBackground: false
  });
  const speciesQuery = useQuery({
    queryKey: ["speciesForLootRouletteDashboard"],
    queryFn: () => ApiFetch<SpeciesListItem[]>("/pokemon/species")
  });

  const me = meQuery.data ?? null;
  const hiddenPoolKey = me ? `battleleague:hiddenDashboardChampionIds:${me.id}` : HiddenPoolFallbackKey;
  const champions = championsQuery.data ?? [];
  const recentBattles = (battleSummaryQuery.data?.recentBattles ?? []).filter((battle) => battle.result === "Vitoria" || battle.result === "Derrota");
  const maxRecentBattlesStart = Math.max(0, recentBattles.length - recentBattlesVisibleCount);
  const visibleRecentBattles = recentBattles.slice(recentBattlesStartIndex, recentBattlesStartIndex + recentBattlesVisibleCount);
  const ongoingBattles = ongoingBattlesQuery.data ?? [];
  const myPokemonsForNotifications = myPokemonsNotificationQuery.data ?? [];
  const activeChampions = useMemo(() => champions.filter((champion) => !champion.isLegacy), [champions]);
  const dashboardChampions = activeChampions.filter((champion) => !hiddenChampionIds.includes(champion.id));
  const trainerLabel = GetTrainerLabelLower(me?.gender);
  const trainerPossessive = GetTrainerPossessive(me?.gender);
  const nickName = `@${me?.accountTag ?? me?.displayName.replace(/\s+/g, "").toLowerCase() ?? trainerLabel}`;
  const profileAvatarUrl = useMemo(() => {
    const rawAvatarUrl = me?.avatarUrl?.trim();
    if (!rawAvatarUrl) {
      return GoogleDefaultAvatarUrl;
    }
    if (rawAvatarUrl.includes("googleusercontent.com")) {
      return `/api/avatar-proxy?url=${encodeURIComponent(rawAvatarUrl)}`;
    }
    return rawAvatarUrl;
  }, [me?.avatarUrl]);
  const xpCurrentLevel = me ? me.xp % 100 : 0;
  const xpToNextLevel = 100 - xpCurrentLevel;
  const xpProgressPercent = Math.max(0, Math.min(100, Math.round((xpCurrentLevel / 100) * 100)));
  const readNotificationKey = me ? `battleleague:readNotifications:${me.id}` : "battleleague:readNotifications:fallback";
  const buildRequestId = () => {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}-${randomPart}`;
  };
  const selectedLootBox = useMemo(() => {
    const catalog = lootEconomyQuery.data?.lootBoxCatalog ?? [];
    return catalog.find((item) => item.boxType === selectedLootBoxType) ?? catalog[0] ?? null;
  }, [lootEconomyQuery.data?.lootBoxCatalog, selectedLootBoxType]);
  const groupedLootBoxes = useMemo(() => {
    const byCategory = new Map<string, Array<{ boxType: string; displayName: string; category: string; priceCoins: number; imageUrl: string }>>();
    for (const box of lootEconomyQuery.data?.lootBoxCatalog ?? []) {
      const current = byCategory.get(box.category) ?? [];
      current.push(box);
      byCategory.set(box.category, current);
    }
    return Array.from(byCategory.entries());
  }, [lootEconomyQuery.data?.lootBoxCatalog]);
  const openLootBoxMutation = useMutation({
    mutationFn: () =>
      ApiFetch<LootBoxOpeningResponse>("/progression/lootbox/open", {
        method: "POST",
        body: JSON.stringify({ requestId: buildRequestId(), boxType: selectedLootBoxType })
      })
  });
  const buyLootBoxMutation = useMutation({
    mutationFn: () =>
      ApiFetch<{ quantity: number; totalCost: number }>("/progression/lootbox/shop/buy", {
        method: "POST",
        body: JSON.stringify({ quantity: 1, requestId: buildRequestId(), boxType: selectedLootBoxType })
      }),
    onSuccess: (payload) => {
      addToast({
        title: "Compra concluida",
        message: `${payload.quantity} caixa comprada por ${payload.totalCost} coins.`,
        tone: "success"
      });
      lootEconomyQuery.refetch();
      meQuery.refetch();
      championsQuery.refetch();
    },
    onError: (error) => {
      addToast({
        title: "Falha na compra",
        message: error instanceof Error ? error.message : "Erro inesperado.",
        tone: "error"
      });
    }
  });
  const claimEventMutation = useMutation({
    mutationFn: () =>
      ApiFetch<{ eventCode: string }>("/progression/events/claim", {
        method: "POST",
        body: JSON.stringify({ eventCode: "dailyWin", requestId: buildRequestId() })
      }),
    onSuccess: () => {
      addToast({
        title: "Evento resgatado",
        message: "Recompensa diaria recebida.",
        tone: "success"
      });
      lootEconomyQuery.refetch();
      meQuery.refetch();
      championsQuery.refetch();
    },
    onError: (error) => {
      addToast({
        title: "Falha no evento",
        message: error instanceof Error ? error.message : "Erro inesperado.",
        tone: "error"
      });
    }
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }
    const levelKey = `battleleague:lastSeenLevel:${me.id}`;
    const storedLevelRaw = window.localStorage.getItem(levelKey);
    const storedLevel = storedLevelRaw ? Number(storedLevelRaw) : null;
    const hasStoredLevel = storedLevel !== null && Number.isFinite(storedLevel);
    if (hasStoredLevel && me.level > storedLevel) {
      setRecentLevelUpTo(me.level);
    } else {
      setRecentLevelUpTo(null);
    }
    window.localStorage.setItem(levelKey, String(me.level));
  }, [me]);

  useEffect(() => {
    const rawValue = window.localStorage.getItem(readNotificationKey);
    if (!rawValue) {
      setReadNotificationIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        setReadNotificationIds(parsed.filter((value) => typeof value === "string"));
        return;
      }
      setReadNotificationIds([]);
    } catch {
      setReadNotificationIds([]);
    }
  }, [readNotificationKey]);

  useEffect(() => {
    window.localStorage.setItem(readNotificationKey, JSON.stringify(readNotificationIds.slice(-300)));
  }, [readNotificationIds, readNotificationKey]);

  useEffect(() => {
    setIsHiddenPoolHydrated(false);
    const parseHiddenIds = (rawValue: string | null): string[] => {
      if (!rawValue) {
        return [];
      }
      try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
          return [];
        }
        return parsed.filter((value) => typeof value === "string");
      } catch {
        return [];
      }
    };
    const syncHiddenIds = () => {
      const userScopedIds = parseHiddenIds(window.localStorage.getItem(hiddenPoolKey));
      const fallbackIds = parseHiddenIds(window.localStorage.getItem(HiddenPoolFallbackKey));
      const mergedIds = Array.from(new Set([...userScopedIds, ...fallbackIds]));
      setHiddenChampionIds((current) => {
        if (current.length === mergedIds.length && current.every((id, index) => id === mergedIds[index])) {
          return current;
        }
        return mergedIds;
      });
      setIsHiddenPoolHydrated(true);
    };
    syncHiddenIds();
    const onStorage = () => syncHiddenIds();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncHiddenIds();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onStorage);
    window.addEventListener(PoolChangedEvent, onStorage as EventListener);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onStorage);
      window.removeEventListener(PoolChangedEvent, onStorage as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hiddenPoolKey]);

  useEffect(() => {
    if (!isHiddenPoolHydrated) {
      return;
    }
    window.localStorage.setItem(hiddenPoolKey, JSON.stringify(hiddenChampionIds));
    window.localStorage.setItem(HiddenPoolFallbackKey, JSON.stringify(hiddenChampionIds));
    window.dispatchEvent(new CustomEvent(PoolChangedEvent));
  }, [hiddenChampionIds, hiddenPoolKey, isHiddenPoolHydrated]);

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
    if (championsQuery.isLoading) {
      return;
    }
    const activeIds = new Set(activeChampions.map((champion) => champion.id));
    setHiddenChampionIds((current) => {
      const next = current.filter((id) => activeIds.has(id));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [activeChampions, championsQuery.isLoading]);

  useEffect(() => {
    setRecentBattlesStartIndex((current) => Math.min(current, maxRecentBattlesStart));
  }, [maxRecentBattlesStart]);

  const notificationCandidates = useMemo<NotificationItem[]>(() => {
    if (!me) {
      return [];
    }
    const items: NotificationItem[] = [];
    for (const battle of ongoingBattles) {
      if (battle.opponent.id !== me.id) {
        continue;
      }
      items.push({
        id: `challenge_${battle.id}`,
        title: "Desafio recebido",
        message: `${battle.challenger.displayName} desafiou voce`,
        createdAtMs: new Date(battle.scheduledStartAt).getTime()
      });
    }
    for (const battle of recentBattles) {
      if (!battle.iWasChallenged || (battle.result !== "Vitoria" && battle.result !== "Derrota")) {
        continue;
      }
      const rivalTag = battle.rivalName.trim().toLowerCase().replace(/\s+/g, "");
      items.push({
        id: `result_${battle.id}_${battle.result}`,
        title: "Resultado de desafio",
        message:
          battle.result === "Vitoria"
            ? `${battle.myPokemonName}, venceu o ${battle.rivalPokemonName} de @${rivalTag}`
            : `${battle.myPokemonName}, perdeu para o ${battle.rivalPokemonName} de @${rivalTag}`,
        createdAtMs: new Date(battle.updatedAt).getTime()
      });
    }
    for (const pokemon of myPokemonsForNotifications) {
      if (pokemon.evolveCooldownUntil && new Date(pokemon.evolveCooldownUntil).getTime() <= nowMs) {
        items.push({
          id: `evolution_ready_${pokemon.id}_${pokemon.evolveCooldownUntil}`,
          title: "Evolucao concluida",
          message: `${pokemon.species.name} ja pode evoluir`,
          createdAtMs: new Date(pokemon.evolveCooldownUntil).getTime()
        });
      }
      if (pokemon.trainingCooldownUntil && new Date(pokemon.trainingCooldownUntil).getTime() <= nowMs) {
        items.push({
          id: `training_ready_${pokemon.id}_${pokemon.trainingCooldownUntil}`,
          title: "Treino concluido",
          message: `${pokemon.species.name} terminou o treino`,
          createdAtMs: new Date(pokemon.trainingCooldownUntil).getTime()
        });
      }
    }
    const uniqueById = new Map<string, NotificationItem>();
    for (const item of items) {
      uniqueById.set(item.id, item);
    }
    return Array.from(uniqueById.values()).sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 40);
  }, [me, myPokemonsForNotifications, nowMs, ongoingBattles, recentBattles]);

  const unreadNotifications = useMemo(() => {
    const readSet = new Set(readNotificationIds);
    return notificationCandidates.filter((item) => !readSet.has(item.id));
  }, [notificationCandidates, readNotificationIds]);

  const unreadNotificationsCount = unreadNotifications.length;
  useEffect(() => {
    const previousCount = unreadNotificationCountRef.current;
    if (unreadNotificationsCount > previousCount) {
      setIsNotificationPulse(true);
      if (notificationPulseTimeoutRef.current !== null) {
        window.clearTimeout(notificationPulseTimeoutRef.current);
      }
      notificationPulseTimeoutRef.current = window.setTimeout(() => {
        setIsNotificationPulse(false);
      }, 2600);
    }
    unreadNotificationCountRef.current = unreadNotificationsCount;
  }, [unreadNotificationsCount]);
  useEffect(() => {
    return () => {
      if (notificationPulseTimeoutRef.current !== null) {
        window.clearTimeout(notificationPulseTimeoutRef.current);
      }
    };
  }, []);
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

  const BuildRouletteRarity = (rawRarity?: string | null) => {
    const safeRarity = (rawRarity ?? "common").toLowerCase();
    if (safeRarity === "legendary" || safeRarity === "epic" || safeRarity === "rare" || safeRarity === "uncommon") {
      return safeRarity;
    }
    return "common";
  };

  const BuildRandomRouletteItems = (count: number) => {
    const speciesPool = speciesQuery.data ?? [];
    const fallbackNames = ["bulbasaur", "charmander", "squirtle", "pikachu", "snorlax", "gengar", "dragonite"];
    const rarityPool = ["common", "common", "common", "uncommon", "uncommon", "rare", "epic"];
    const list: LootSpinItem[] = [];
    for (let index = 0; index < count; index += 1) {
      const pickedSpecies = speciesPool.length > 0 ? speciesPool[Math.floor(Math.random() * speciesPool.length)] : null;
      const randomName = pickedSpecies?.name ?? fallbackNames[index % fallbackNames.length];
      const randomRarity = rarityPool[Math.floor(Math.random() * rarityPool.length)] ?? "common";
      list.push({
        name: randomName,
        rarity: randomRarity,
        imageUrl: pickedSpecies?.imageUrl ?? null
      });
    }
    return list;
  };

  const BuildRarityToneClass = (rarity: string) => {
    if (rarity === "legendary") {
      return "border-amber-300/70 bg-amber-500/20 text-amber-100";
    }
    if (rarity === "epic") {
      return "border-fuchsia-300/70 bg-fuchsia-500/20 text-fuchsia-100";
    }
    if (rarity === "rare") {
      return "border-cyan-300/70 bg-cyan-500/20 text-cyan-100";
    }
    if (rarity === "uncommon") {
      return "border-emerald-300/70 bg-emerald-500/20 text-emerald-100";
    }
    return "border-slate-600/70 bg-slate-800/75 text-slate-100";
  };

  const BuildRarityBottomBarClass = (rarity: string) => {
    if (rarity === "legendary") {
      return "bg-amber-400";
    }
    if (rarity === "epic") {
      return "bg-fuchsia-400";
    }
    if (rarity === "rare") {
      return "bg-cyan-400";
    }
    if (rarity === "uncommon") {
      return "bg-emerald-400";
    }
    return "bg-slate-500";
  };

  const StopLootRouletteInterval = () => {
    if (lootRouletteIntervalRef.current !== null) {
      window.clearInterval(lootRouletteIntervalRef.current);
      lootRouletteIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      StopLootRouletteInterval();
    };
  }, []);

  useEffect(() => {
    const catalog = lootEconomyQuery.data?.lootBoxCatalog ?? [];
    if (catalog.length === 0) {
      return;
    }
    const exists = catalog.some((item) => item.boxType === selectedLootBoxType);
    if (!exists) {
      setSelectedLootBoxType(catalog[0].boxType);
    }
  }, [lootEconomyQuery.data?.lootBoxCatalog, selectedLootBoxType]);

  const HandleOpenLootRoulette = async () => {
    if (isLootRouletteSpinning) {
      return;
    }
    setLootRouletteError("");
    setLootRouletteWinner(null);
    setIsLootRouletteOpen(true);
    setIsLootRouletteSpinning(true);
    setLootRouletteItems(BuildRandomRouletteItems(40));
    StopLootRouletteInterval();
    lootRouletteIntervalRef.current = window.setInterval(() => {
      setLootRouletteItems((current) => {
        if (current.length < 2) {
          return current;
        }
        return [...current.slice(1), current[0]];
      });
    }, 55);

    const spinStartAt = Date.now();
    try {
      const payload = await openLootBoxMutation.mutateAsync();
      const opening = payload?.opening;
      const winnerName = opening?.rewardValue ?? "pokemon";
      const winnerRarity = BuildRouletteRarity(opening?.rewardRarity);
      const winnerSpecies = (speciesQuery.data ?? []).find(
        (species) => species.name.trim().toLowerCase() === winnerName.trim().toLowerCase()
      );
      const winner: LootSpinItem = {
        name: winnerName,
        rarity: winnerRarity,
        imageUrl: winnerSpecies?.imageUrl ?? null
      };
      const minimumSpinMs = 3400;
      const remainingMs = Math.max(0, minimumSpinMs - (Date.now() - spinStartAt));
      window.setTimeout(() => {
        StopLootRouletteInterval();
        let decelerationStep = 0;
        const totalSteps = 20;
        const RunDeceleration = () => {
          setLootRouletteItems((current) => {
            if (current.length < 2) {
              return current;
            }
            return [...current.slice(1), current[0]];
          });
          decelerationStep += 1;
          if (decelerationStep < totalSteps) {
            const nextDelay = 35 + decelerationStep * 10;
            window.setTimeout(RunDeceleration, nextDelay);
            return;
          }
          setLootRouletteItems((current) => {
            const next = current.length > 0 ? [...current] : BuildRandomRouletteItems(40);
            const centerIndex = Math.min(next.length - 1, 4);
            next[centerIndex] = winner;
            return next;
          });
          setIsLootRouletteSpinning(false);
          setLootRouletteWinner(winner);
          if (opening?.rewardType === "fragments") {
            addToast({
              title: "Caixa aberta",
              message: `${winnerName} virou fragmentos +${opening.fragmentGain ?? 0}.`,
              tone: "info"
            });
          } else {
            addToast({
              title: "Caixa aberta",
              message: `Voce recebeu ${winnerName}.`,
              tone: "success"
            });
          }
          lootEconomyQuery.refetch();
          meQuery.refetch();
          championsQuery.refetch();
        };
        RunDeceleration();
      }, remainingMs);
    } catch (error) {
      StopLootRouletteInterval();
      setIsLootRouletteSpinning(false);
      const errorMessage = error instanceof Error ? error.message : "Erro inesperado.";
      setLootRouletteError(errorMessage);
      addToast({
        title: "Falha ao abrir caixa",
        message: errorMessage,
        tone: "error"
      });
    }
  };

  useEffect(() => {
    if (championsQuery.isLoading) {
      return;
    }
    const nowMs = Date.now();
    const forcedHiddenIds = activeChampions
      .filter((champion) => {
        const evolutionCooldownActive =
          !!champion.evolveCooldownUntil && new Date(champion.evolveCooldownUntil).getTime() > nowMs;
        const trainingCooldownActive =
          !!champion.trainingCooldownUntil && new Date(champion.trainingCooldownUntil).getTime() > nowMs;
        return evolutionCooldownActive || trainingCooldownActive;
      })
      .map((champion) => champion.id);
    if (forcedHiddenIds.length === 0) {
      return;
    }
    setHiddenChampionIds((current) => {
      const next = Array.from(new Set([...current, ...forcedHiddenIds]));
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [activeChampions, championsQuery.isLoading]);

  const categorizedChampions = useMemo(() => {
    const restCooldownWindowMs = 2 * 60 * 60 * 1000;
    const tired: ChampionItem[] = [];
    const evolutionReady: ChampionItem[] = [];
    const ready: ChampionItem[] = [];

    for (const champion of dashboardChampions) {
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
  }, [dashboardChampions, nowMs]);

  const visibleTiredChampions = categorizedChampions.tired.slice(0, visibleTiredCount);
  const visibleEvolutionReadyChampions = categorizedChampions.evolutionReady.slice(0, visibleEvolutionReadyCount);
  const visibleReadyChampions = categorizedChampions.ready.slice(0, visibleReadyCount);
  const hasMoreTiredChampions = visibleTiredCount < categorizedChampions.tired.length;
  const hasMoreEvolutionReadyChampions = visibleEvolutionReadyCount < categorizedChampions.evolutionReady.length;
  const hasMoreReadyChampions = visibleReadyCount < categorizedChampions.ready.length;

  useEffect(() => {
    setVisibleTiredCount(ChampionCategoryFeedBatchSize);
  }, [categorizedChampions.tired.length]);

  useEffect(() => {
    setVisibleEvolutionReadyCount(ChampionCategoryFeedBatchSize);
  }, [categorizedChampions.evolutionReady.length]);

  useEffect(() => {
    setVisibleReadyCount(ChampionCategoryFeedBatchSize);
  }, [categorizedChampions.ready.length]);

  useEffect(() => {
    if (!hasMoreTiredChampions) {
      return;
    }
    const sentinel = tiredLoadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleTiredCount((current) => Math.min(categorizedChampions.tired.length, current + ChampionCategoryFeedBatchSize));
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreTiredChampions, categorizedChampions.tired.length]);

  useEffect(() => {
    if (!hasMoreEvolutionReadyChampions) {
      return;
    }
    const sentinel = evolutionReadyLoadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleEvolutionReadyCount((current) =>
            Math.min(categorizedChampions.evolutionReady.length, current + ChampionCategoryFeedBatchSize)
          );
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreEvolutionReadyChampions, categorizedChampions.evolutionReady.length]);

  useEffect(() => {
    if (!hasMoreReadyChampions) {
      return;
    }
    const sentinel = readyLoadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleReadyCount((current) => Math.min(categorizedChampions.ready.length, current + ChampionCategoryFeedBatchSize));
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreReadyChampions, categorizedChampions.ready.length]);

  const renderChampionCard = (champion: ChampionItem) => {
    const totalBattles = champion.wins + champion.losses;
    const winRate = totalBattles === 0 ? 0 : Math.round((champion.wins / totalBattles) * 100);
    const canEvolveNow =
      !!champion.species.evolutionTarget &&
      !!champion.species.evolutionLevel &&
      champion.level >= champion.species.evolutionLevel &&
      (!champion.evolveCooldownUntil || new Date(champion.evolveCooldownUntil).getTime() <= nowMs);
    const hasEvolutionLine = !!champion.species.evolutionTarget;
    const evolutionGlowClass = canEvolveNow
      ? "ring-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.24)]"
      : hasEvolutionLine
        ? "ring-cyan-300/35 shadow-[0_0_14px_rgba(34,211,238,0.12)]"
        : "ring-slate-700/70";
    const fatigueUpdatedAtMs = champion.fatigueUpdatedAt ? new Date(champion.fatigueUpdatedAt).getTime() : nowMs;
    const fatigueElapsedMin = Math.max(0, Math.floor((nowMs - fatigueUpdatedAtMs) / 60_000));
    const currentFatigue = Math.max(0, (champion.fatigue ?? 0) - fatigueElapsedMin);
    const fatigueProgressPercent = Math.max(0, Math.min(100, currentFatigue));
    const fatigueToneClass =
      fatigueProgressPercent >= 75
        ? "bg-gradient-to-r from-rose-500 to-red-400"
        : fatigueProgressPercent >= 45
          ? "bg-gradient-to-r from-amber-500 to-orange-400"
          : fatigueProgressPercent >= 20
            ? "bg-gradient-to-r from-yellow-500 to-lime-400"
            : "bg-gradient-to-r from-emerald-500 to-teal-400";
    return (
      <article className={`grid min-h-[250px] gap-2 rounded-2xl bg-slate-900/65 p-3 ring-1 ring-inset ${evolutionGlowClass}`} key={champion.id}>
        <div className={`relative grid place-items-center rounded-xl bg-slate-800/70 p-2 ${canEvolveNow ? "shadow-[0_0_20px_rgba(251,191,36,0.20)]" : ""}`}>
          <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-900/85 px-2 py-0.5 text-xs font-semibold capitalize text-slate-100">
            {champion.species.typePrimary}
          </span>
          {canEvolveNow ? (
            <span className="absolute bottom-1.5 right-1.5 rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-amber-300/50">
              Evolucao
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setHiddenChampionIds((current) => (current.includes(champion.id) ? current : [...current, champion.id]));
              addToast({
                title: "Pokemon removido da pool",
                message: `${champion.species.name} saiu de Prontos para batalha.`,
                tone: "info"
              });
            }}
            className="absolute left-1.5 top-1.5 inline-flex h-6 items-center rounded-full bg-slate-900/85 px-2 text-[10px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-800/95"
          >
            Remover
          </button>
          {champion.species.imageUrl ? (
            <img loading="lazy" decoding="async" src={champion.species.imageUrl} alt={champion.species.name} className="h-16 w-16 object-contain" />
          ) : (
            <div className="grid h-16 w-16 place-items-center text-xs font-bold text-slate-400">PK</div>
          )}
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <strong className="truncate capitalize">{champion.species.name}</strong>
            <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-sm font-semibold text-slate-100">Nivel {champion.level}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-100">
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">V/D {champion.wins}/{champion.losses}</span>
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">Taxa {winRate}%</span>
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-800/80 px-2 py-0.5 ring-1 ring-inset ring-slate-600/70">Duelos {totalBattles}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400" style={{ width: `${winRate}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm font-medium text-slate-200">
            <small>Cansaco Atual</small>
            <small>{fatigueProgressPercent}%</small>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className={`h-full rounded-full ${fatigueToneClass}`} style={{ width: `${fatigueProgressPercent}%` }} />
          </div>
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
    <>
      <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <section className="rounded-2xl border border-blue-500/20 bg-slate-900/85 p-4 shadow-[0_20px_60px_rgba(2,6,23,0.45)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid flex-1 gap-3">
            <div className="grid grid-cols-[68px_1fr] items-start gap-3 sm:grid-cols-[76px_1fr] sm:gap-4">
              <div className="h-[68px] w-[68px] overflow-hidden rounded-full border border-slate-700 bg-slate-800 sm:h-[76px] sm:w-[76px]">
                <img
                  loading="eager"
                  decoding="async"
                  src={profileAvatarUrl}
                  alt={me.displayName}
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = GoogleDefaultAvatarUrl;
                  }}
                />
              </div>
              <div className="grid min-w-0 gap-1">
                <h1 className="break-words text-xl font-semibold text-slate-100 sm:text-2xl">{me.displayName}</h1>
                <small className="break-words text-sm font-medium text-blue-200/90">{nickName}</small>
                <p className="break-words text-sm text-slate-300">Visao rapida da temporada e do desempenho {trainerPossessive}.</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationOpen((current) => !current)}
              className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800/85 text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:bg-slate-700/90 ${
                isNotificationPulse && unreadNotificationsCount > 0 ? "dashboardNotificationBellPulse ring-blue-400/70" : ""
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.9]">
                <path d="M8 10a4 4 0 118 0v3.2l1.4 2.2H6.6L8 13.2z" />
                <path d="M10 17.4a2 2 0 004 0" />
              </svg>
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                  {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                </span>
              ) : null}
            </button>
            {isNotificationOpen ? (
              <article className="absolute right-0 top-12 z-20 grid w-[320px] max-w-[92vw] gap-2 rounded-2xl bg-slate-900/95 p-3 shadow-[0_14px_40px_rgba(2,6,23,0.55)] ring-1 ring-inset ring-slate-700/80">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm text-slate-100">Notificacoes</strong>
                  {unreadNotificationsCount > 0 ? (
                    <button
                      type="button"
                      className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70"
                      onClick={() => setReadNotificationIds((current) => Array.from(new Set([...current, ...unreadNotifications.map((item) => item.id)])))}
                    >
                      Marcar tudo
                    </button>
                  ) : null}
                </div>
                <div className="grid max-h-[320px] gap-1.5 overflow-y-auto pr-1">
                  {unreadNotificationsCount === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-600 p-3 text-xs text-slate-300">Sem notificacoes novas.</div>
                  ) : (
                    unreadNotifications.map((item) => (
                      <article key={item.id} className="grid gap-1 rounded-xl bg-slate-900/70 p-2.5 ring-1 ring-inset ring-slate-700/70">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs text-slate-100">{item.title}</strong>
                          <button
                            type="button"
                            className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70"
                            onClick={() => setReadNotificationIds((current) => (current.includes(item.id) ? current : [...current, item.id]))}
                          >
                            Ok
                          </button>
                        </div>
                        <small className="text-xs text-slate-300">{item.message}</small>
                        <small className="text-[11px] text-slate-400">{new Date(item.createdAtMs).toLocaleString()}</small>
                      </article>
                    ))
                  )}
                </div>
              </article>
            ) : null}
          </div>
        </div>

        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <div className="mt-4 grid gap-2 rounded-xl bg-slate-900/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">Nivel {me.level}</span>
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">XP {me.xp}</span>
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">Coins {me.coins}</span>
            <span className="inline-flex rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-200">Taxa {me.stats.winRate}%</span>
          </div>
          {recentLevelUpTo ? (
            <div className="inline-flex w-fit items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-inset ring-emerald-400/40">
              Subiu para Nivel {recentLevelUpTo}
            </div>
          ) : null}
          <div className="grid gap-1">
            <div className="flex items-center justify-between text-sm font-medium text-slate-200">
              <small>Progresso de experiencia</small>
              <small>{xpCurrentLevel}/100</small>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-slate-600 bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${xpProgressPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <section className={`${SectionCardClass} overflow-hidden`}>
        <div className="mb-3 grid gap-1">
          <h2>Navegacao rapida</h2>
        </div>
        <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        <nav className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <Link
            className={NavLinkClass}
            href="/pokemon"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z" />
                <path d="M3 12h18" />
                <circle cx="12" cy="12" r="2.2" />
              </svg>
            </span>
            Ir para Pokemon
          </Link>
          <Link
            className={NavLinkClass}
            href="/battles"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M14.5 4l5.5 5.5-2 2L12.5 6z" />
                <path d="M9.5 20l-5.5-5.5 2-2L11.5 18z" />
                <path d="M8.5 15.5l7-7" />
              </svg>
            </span>
            Ir para Batalhas
          </Link>
          <Link
            className={NavLinkClass}
            href="/social"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z" />
                <path d="M4 20a8 8 0 0 1 16 0" />
              </svg>
            </span>
            Ir para Social
          </Link>
          <Link
            className={NavLinkClass}
            href="/pokedex"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </span>
            Ir para Pokedex
          </Link>
          <Link
            className={NavLinkClass}
            href="/boxes"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M4 8l8-4 8 4-8 4-8-4z" />
                <path d="M4 8v8l8 4 8-4V8" />
              </svg>
            </span>
            Ir para Caixas
          </Link>
          <Link
            className={NavLinkClass}
            href="/upgrade"
          >
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                <path d="M12 4v16" />
                <path d="M5 12h14" />
              </svg>
            </span>
            Ir para Melhorar
          </Link>
        </nav>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <section className={SectionCardClass}>
        {battleSummaryQuery.isLoading ? (
          <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">Carregando ultimas batalhas...</div>
        ) : recentBattles.length === 0 ? (
          <div className="rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300">Sem historico recente.</div>
        ) : (
          <div className="grid gap-2">
            <strong className="text-sm">Ultimas batalhas</strong>
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
                            <small className="max-w-full truncate text-[11px] font-semibold text-slate-200">{battleSummaryQuery.data?.me.displayName ?? me.displayName}</small>
                            {battle.myPokemonImageUrl ? (
                              <img loading="lazy" decoding="async" src={battle.myPokemonImageUrl} alt={battle.myPokemonName} className="h-10 w-10 object-contain" />
                            ) : (
                              <div className="grid h-10 w-10 place-items-center text-xs text-slate-400">PK</div>
                            )}
                            <small className="text-xs font-medium capitalize text-slate-100">{battle.myPokemonName}</small>
                          </div>
                          <span className="text-xs font-bold tracking-wide text-slate-200">VS</span>
                          <div className="grid justify-items-center gap-1 rounded-lg bg-slate-800/75 p-2">
                            <small className="max-w-full truncate text-[11px] font-semibold text-slate-200">{battle.rivalName}</small>
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
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildPokemonXpToneClass(battle.myPokemonXpGain)}`}>
                              +{battle.myPokemonXpGain}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                            <small>XP pokemon rival</small>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildPokemonXpToneClass(battle.rivalPokemonXpGain)}`}>
                              +{battle.rivalPokemonXpGain}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                            <small>XP conta {trainerPossessive}</small>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildAccountXpToneClass(battle.myAccountXpGain)}`}>
                              +{battle.myAccountXpGain}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-300">
                            <small>XP conta rival</small>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${BuildAccountXpToneClass(battle.rivalAccountXpGain)}`}>
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
          </div>
        )}
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
      <section className={SectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Campeoes do time {trainerPossessive}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <small className="text-slate-300">
              V/D total: {me.stats.totalWins}/{me.stats.totalLosses}
            </small>
          </div>
        </div>
        <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
        {dashboardChampions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-4 text-sm text-slate-300">Sem campeoes ainda. Capture um primeiro pokemon para montar o time.</div>
        ) : (
          <div className="grid gap-3">
            {categorizedChampions.tired.length > 0 ? (
              <section className="grid gap-2 rounded-xl p-1">
                <div className="flex items-center justify-between gap-2">
                  <strong>Em descanso</strong>
                  <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs">
                    {visibleTiredChampions.length}/{categorizedChampions.tired.length}
                  </small>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visibleTiredChampions.map((champion) => renderChampionCard(champion))}</div>
                {hasMoreTiredChampions ? <div ref={tiredLoadMoreSentinelRef} className="h-1 w-full" aria-hidden /> : null}
              </section>
            ) : null}
            {categorizedChampions.evolutionReady.length > 0 ? (
              <section className="grid gap-2 rounded-xl p-1">
                <div className="flex items-center justify-between gap-2">
                  <strong>Prontos para evoluir</strong>
                  <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs">
                    {visibleEvolutionReadyChampions.length}/{categorizedChampions.evolutionReady.length}
                  </small>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visibleEvolutionReadyChampions.map((champion) => renderChampionCard(champion))}</div>
                {hasMoreEvolutionReadyChampions ? <div ref={evolutionReadyLoadMoreSentinelRef} className="h-1 w-full" aria-hidden /> : null}
              </section>
            ) : null}
            {categorizedChampions.ready.length > 0 ? (
              <section className="grid gap-2 rounded-xl p-1">
                <div className="flex items-center justify-between gap-2">
                  <strong>Prontos para batalha</strong>
                  <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs">
                    {visibleReadyChampions.length}/{categorizedChampions.ready.length}
                  </small>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{visibleReadyChampions.map((champion) => renderChampionCard(champion))}</div>
                {hasMoreReadyChampions ? <div ref={readyLoadMoreSentinelRef} className="h-1 w-full" aria-hidden /> : null}
              </section>
            ) : null}
          </div>
        )}
      </section>
      </main>
      <style jsx global>{`
        @keyframes dashboardNotificationBellPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(59, 130, 246, 0);
          }
          28% {
            transform: scale(1.06) rotate(-2deg);
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.16);
          }
          56% {
            transform: scale(1.09) rotate(2deg);
            box-shadow: 0 0 0 10px rgba(59, 130, 246, 0.08);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        .dashboardNotificationBellPulse {
          animation: dashboardNotificationBellPulse 0.9s cubic-bezier(0.22, 1, 0.36, 1) 2;
        }
      `}</style>
    </>
  );
}
