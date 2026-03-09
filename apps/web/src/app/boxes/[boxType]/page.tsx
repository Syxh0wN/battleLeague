"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFetch } from "../../../lib/api";
import { useToast } from "../../../providers/toast-provider";

type LootEconomyResponse = {
  user: {
    coins: number;
    pokemonFragments: number;
  };
  dailyShopLimit: number;
  lootPriceCoins: number;
  lootBoxStates: Array<{
    boxType: string;
    pityCounter: number;
    dailyShopPurchases: number;
    dailyShopRemaining: number;
  }>;
  lootBoxCatalog: Array<{
    boxType: string;
    displayName: string;
    category: string;
    priceCoins: number;
    imageUrl: string;
  }>;
  boxDropPreview: Array<{
    boxType: string;
    displayName: string;
    category: string;
    priceCoins: number;
    imageUrl: string;
    drops: Array<{
      rarity: string;
      chancePercent: number;
      species: Array<{ name: string; imageUrl: string | null; chancePercent: number }>;
    }>;
  }>;
  history: Array<{
    id: string;
    boxType: string;
    rewardType: string;
    rewardValue: string;
    rewardLevel?: number | null;
    rewardRarity: string | null;
    fragmentGain: number;
    pityBefore: number;
    pityAfter: number;
    createdAt?: string;
    userName?: string;
    userAvatarUrl?: string;
    playerName?: string;
    playerAvatarUrl?: string;
    accountTag?: string;
    avatarUrl?: string;
  }>;
};

type LootSpinItem = {
  name: string;
  rarity: string;
  imageUrl?: string | null;
  level?: number;
};

const PrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-50";
const RouletteTrackSize = 11;
const SpinDurationMs = 5600;
const SpinStartIntervalMs = 55;
const SpinEndIntervalMs = 430;

function GetLevelBandsByPrice(priceCoins: number) {
  if (priceCoins <= 120) {
    return [
      { minLevel: 1, maxLevel: 12, weight: 60 },
      { minLevel: 13, maxLevel: 20, weight: 25 },
      { minLevel: 21, maxLevel: 30, weight: 12 },
      { minLevel: 31, maxLevel: 40, weight: 3 }
    ];
  }
  if (priceCoins <= 360) {
    return [
      { minLevel: 1, maxLevel: 18, weight: 48 },
      { minLevel: 19, maxLevel: 28, weight: 30 },
      { minLevel: 29, maxLevel: 40, weight: 16 },
      { minLevel: 41, maxLevel: 52, weight: 6 }
    ];
  }
  if (priceCoins <= 700) {
    return [
      { minLevel: 1, maxLevel: 24, weight: 40 },
      { minLevel: 25, maxLevel: 36, weight: 30 },
      { minLevel: 37, maxLevel: 50, weight: 20 },
      { minLevel: 51, maxLevel: 65, weight: 10 }
    ];
  }
  return [
    { minLevel: 1, maxLevel: 30, weight: 30 },
    { minLevel: 31, maxLevel: 45, weight: 30 },
    { minLevel: 46, maxLevel: 60, weight: 24 },
    { minLevel: 61, maxLevel: 80, weight: 12 },
    { minLevel: 81, maxLevel: 100, weight: 4 }
  ];
}

function BuildRarityToneClass(rarity: string) {
  if (rarity === "legendary") return "border-amber-300/60 bg-amber-400/10 text-amber-100";
  if (rarity === "epic") return "border-fuchsia-300/60 bg-fuchsia-400/10 text-fuchsia-100";
  if (rarity === "rare") return "border-cyan-300/60 bg-cyan-400/10 text-cyan-100";
  if (rarity === "uncommon") return "border-emerald-300/60 bg-emerald-400/10 text-emerald-100";
  return "border-slate-300/60 bg-slate-400/10 text-slate-100";
}

function BuildRarityGlowClass(rarity: string) {
  if (rarity === "legendary") return "bg-amber-400/20";
  if (rarity === "epic") return "bg-fuchsia-400/20";
  if (rarity === "rare") return "bg-cyan-400/20";
  if (rarity === "uncommon") return "bg-emerald-400/20";
  return "bg-slate-400/20";
}

function BuildRarityTextClass(rarity: string) {
  if (rarity === "legendary") return "text-amber-300";
  if (rarity === "epic") return "text-fuchsia-300";
  if (rarity === "rare") return "text-cyan-300";
  if (rarity === "uncommon") return "text-emerald-300";
  return "text-slate-300";
}

function BuildDropTimeLabel(createdAt?: string) {
  if (!createdAt) return "recente";
  const dropDate = new Date(createdAt);
  if (Number.isNaN(dropDate.getTime())) return "recente";
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(dropDate.getFullYear(), dropDate.getMonth(), dropDate.getDate())) / oneDayMs);
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "ontem";
  return `${diffDays}d atras`;
}

function NormalizeEntityName(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\blv\b\.?\s*\d+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function BuildPokemonImageFallback(value: string) {
  const normalized = NormalizeEntityName(value);
  if (!normalized) {
    return null;
  }
  const specialNameMap: Record<string, string> = {
    "mr mime": "mr-mime",
    "mime jr": "mime-jr",
    "nidoran f": "nidoran-f",
    "nidoran m": "nidoran-m",
    "farfetch d": "farfetchd",
    "sirfetch d": "sirfetchd",
    "type null": "type-null",
    "tapu koko": "tapu-koko",
    "tapu lele": "tapu-lele",
    "tapu bulu": "tapu-bulu",
    "tapu fini": "tapu-fini"
  };
  const slug = specialNameMap[normalized] ?? normalized.replace(/\s+/g, "-");
  return `https://img.pokemondb.net/sprites/home/normal/${slug}.png`;
}

function ExtractRewardLevel(value: string) {
  const levelMatch = value.match(/\blv\b\.?\s*(\d+)/i);
  if (!levelMatch) {
    return undefined;
  }
  const parsed = Number(levelMatch[1]);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function BuildRarityRank(rarity: string) {
  if (rarity === "legendary") return 5;
  if (rarity === "epic") return 4;
  if (rarity === "rare") return 3;
  if (rarity === "uncommon") return 2;
  return 1;
}

export default function BoxDetailPage() {
  const ContentCardsPerPage = 24;
  const params = useParams<{ boxType: string }>();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const rouletteTickTimeoutRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rouletteTrackRef = useRef<HTMLDivElement | null>(null);
  const topDropsCarouselRef = useRef<HTMLUListElement | null>(null);
  const [isRouletteSpinning, setIsRouletteSpinning] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<LootSpinItem[]>([]);
  const [rouletteWinner, setRouletteWinner] = useState<LootSpinItem | null>(null);
  const [canScrollRoulettePrev, setCanScrollRoulettePrev] = useState(false);
  const [canScrollRouletteNext, setCanScrollRouletteNext] = useState(false);
  const [canScrollTopDropsPrev, setCanScrollTopDropsPrev] = useState(false);
  const [canScrollTopDropsNext, setCanScrollTopDropsNext] = useState(false);
  const [openedInfoCardKey, setOpenedInfoCardKey] = useState<string | null>(null);
  const [contentSearchTerm, setContentSearchTerm] = useState("");
  const [contentPage, setContentPage] = useState(1);

  const lootEconomyQuery = useQuery({
    queryKey: ["loot-economy"],
    queryFn: () => ApiFetch<LootEconomyResponse>("/progression/loot/economy")
  });

  const activeBoxType = useMemo(() => {
    const requested = (params?.boxType ?? "").toString();
    const catalog = lootEconomyQuery.data?.lootBoxCatalog ?? [];
    if (catalog.some((item) => item.boxType === requested)) {
      return requested;
    }
    return catalog[0]?.boxType ?? "fiesta";
  }, [lootEconomyQuery.data, params]);

  const selectedBox = useMemo(() => {
    return lootEconomyQuery.data?.lootBoxCatalog.find((item) => item.boxType === activeBoxType) ?? null;
  }, [lootEconomyQuery.data, activeBoxType]);

  const selectedBoxPreview = useMemo(() => {
    return lootEconomyQuery.data?.boxDropPreview.find((item) => item.boxType === activeBoxType) ?? null;
  }, [lootEconomyQuery.data, activeBoxType]);

  const selectedBoxState = useMemo(() => {
    return lootEconomyQuery.data?.lootBoxStates.find((item) => item.boxType === activeBoxType) ?? null;
  }, [lootEconomyQuery.data, activeBoxType]);

  const previewDrops = useMemo(() => {
    const drops = selectedBoxPreview?.drops ?? [];
    const usedSpecies = new Set<string>();
    return drops.map((drop) => {
      const species = drop.species.filter((item) => {
        const key = item.name.trim().toLowerCase();
        if (usedSpecies.has(key)) {
          return false;
        }
        usedSpecies.add(key);
        return true;
      });
      return {
        ...drop,
        species
      };
    });
  }, [selectedBoxPreview]);

  const roulettePreviewPool = useMemo(() => {
    return previewDrops.flatMap((drop) =>
      drop.species.map((species) => ({
        name: species.name,
        rarity: drop.rarity,
        imageUrl: species.imageUrl
      }))
    );
  }, [previewDrops]);

  const RollPreviewLevel = () => {
    const boxPriceCoins = selectedBox?.priceCoins ?? 40;
    const levelBands = GetLevelBandsByPrice(boxPriceCoins);
    const totalWeight = levelBands.reduce((sum, band) => sum + band.weight, 0);
    const roll = Math.random() * totalWeight;
    let cursor = 0;
    for (const band of levelBands) {
      cursor += band.weight;
      if (roll <= cursor) {
        return band.minLevel + Math.floor(Math.random() * (band.maxLevel - band.minLevel + 1));
      }
    }
    return 1;
  };

  const openLootBoxMutation = useMutation({
    mutationFn: () =>
      ApiFetch<{
        quantity: number;
        totalCost: number;
        boxType: string;
        openings?: Array<{
          opening?: { rewardValue: string; rewardRarity: string | null; rewardType: string };
          rewardLevel?: number | null;
        }>;
      }>("/progression/lootbox/shop/buy", {
        method: "POST",
        body: JSON.stringify({ boxType: activeBoxType, quantity: 1 })
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["loot-economy"] });
      const openingResult = result.openings?.[0];
      const opening = openingResult?.opening ?? {
        rewardValue: "desconhecido",
        rewardRarity: "common",
        rewardType: "pokemon"
      };
      const winnerName = opening.rewardValue.replace(/\blv\b\.?\s*\d+/gi, "").trim();
      const winnerLevel = openingResult?.rewardLevel ?? ExtractRewardLevel(opening.rewardValue) ?? 1;
      const normalizedWinnerName = NormalizeEntityName(winnerName);
      const winnerPreviewItem =
        roulettePreviewPool.find((item) => NormalizeEntityName(item.name) === normalizedWinnerName) ?? null;
      const winnerItem: LootSpinItem = {
        name: winnerName,
        rarity: opening.rewardRarity ?? "common",
        level: winnerLevel,
        imageUrl: winnerPreviewItem?.imageUrl ?? BuildPokemonImageFallback(winnerName)
      };
      setRouletteWinner(winnerItem);
      setRouletteItems((previousItems) => {
        const nextItems =
          previousItems.length === RouletteTrackSize
            ? [...previousItems]
            : Array.from({ length: RouletteTrackSize }).map(() => ({
                ...roulettePreviewPool[Math.floor(Math.random() * roulettePreviewPool.length)],
                level: RollPreviewLevel()
              }));
        nextItems[5] = winnerItem;
        return nextItems;
      });
      setIsRouletteSpinning(false);
      playRouletteWinSound();
      addToast({
        title: "Caixa aberta",
        message: `${opening.rewardValue} (${opening.rewardRarity ?? "common"})`,
        tone: "success"
      });
    },
    onError: (error) => {
      setIsRouletteSpinning(false);
      addToast({
        title: "Falha ao abrir caixa",
        message: error instanceof Error ? error.message : "Erro inesperado",
        tone: "error"
      });
    }
  });

  useEffect(() => {
    return () => {
      if (rouletteTickTimeoutRef.current) {
        window.clearTimeout(rouletteTickTimeoutRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

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

  const getAudioContext = () => {
    if (typeof window === "undefined") {
      return null;
    }
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const playRouletteTickSound = () => {
    const audioContext = getAudioContext();
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
    const audioContext = getAudioContext();
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
    setRouletteWinner(null);
  }, [activeBoxType]);

  useEffect(() => {
    setContentSearchTerm("");
    setContentPage(1);
  }, [activeBoxType]);

  useEffect(() => {
    setContentPage(1);
  }, [contentSearchTerm]);

  useEffect(() => {
    if (isRouletteSpinning || roulettePreviewPool.length === 0 || rouletteWinner) {
      return;
    }
    const BuildItems = () =>
      Array.from({ length: RouletteTrackSize }).map(
        () => ({
          ...roulettePreviewPool[Math.floor(Math.random() * roulettePreviewPool.length)],
          level: RollPreviewLevel()
        })
      );
    setRouletteItems((previousItems) => (previousItems.length === RouletteTrackSize ? previousItems : BuildItems()));
  }, [activeBoxType, isRouletteSpinning, roulettePreviewPool, rouletteWinner]);

  const StartRoulette = () => {
    if (isRouletteSpinning || openLootBoxMutation.isPending) return;
    if (roulettePreviewPool.length === 0) {
      addToast({
        title: "Sem dados",
        message: "Nao foi possivel montar a roleta desta caixa",
        tone: "error"
      });
      return;
    }
    const boxPriceCoins = selectedBox?.priceCoins ?? lootEconomyQuery.data?.lootPriceCoins ?? 40;
    const userCoins = lootEconomyQuery.data?.user.coins ?? 0;
    if (userCoins < boxPriceCoins) {
      addToast({
        title: "Coins insuficientes",
        message: `Voce precisa de ${boxPriceCoins} coins para abrir esta caixa`,
        tone: "error"
      });
      return;
    }
    if ((selectedBoxState?.dailyShopRemaining ?? 0) <= 0) {
      addToast({
        title: "Limite diario atingido",
        message: "Voce ja atingiu o limite de aberturas para hoje",
        tone: "error"
      });
      return;
    }

    const BuildItems = () =>
      Array.from({ length: RouletteTrackSize }).map(
        () => ({
          ...roulettePreviewPool[Math.floor(Math.random() * roulettePreviewPool.length)],
          level: RollPreviewLevel()
        })
      );

    setRouletteWinner(null);
    setRouletteItems(BuildItems());
    setIsRouletteSpinning(true);

    if (rouletteTickTimeoutRef.current) {
      window.clearTimeout(rouletteTickTimeoutRef.current);
    }
    const spinStartedAt = Date.now();
    const runSpinTick = () => {
      const elapsedMs = Date.now() - spinStartedAt;
      if (elapsedMs >= SpinDurationMs) {
        rouletteTickTimeoutRef.current = null;
        openLootBoxMutation.mutate();
        return;
      }
      playRouletteTickSound();
      setRouletteItems(BuildItems());
      const progress = Math.min(1, elapsedMs / SpinDurationMs);
      const easedProgress = progress < 0.7 ? progress * progress : Math.min(1, 0.49 + Math.pow((progress - 0.7) / 0.3, 4) * 0.51);
      const nextDelayMs = Math.round(SpinStartIntervalMs + (SpinEndIntervalMs - SpinStartIntervalMs) * easedProgress);
      rouletteTickTimeoutRef.current = window.setTimeout(runSpinTick, nextDelayMs);
    };
    runSpinTick();
  };

  const boxHistory = useMemo(() => {
    return (lootEconomyQuery.data?.history ?? []).filter((item) => item.boxType === activeBoxType);
  }, [lootEconomyQuery.data, activeBoxType]);

  const contentCards = useMemo(() => {
    return previewDrops.flatMap((drop) =>
      drop.species.map((species) => ({
        rarity: drop.rarity,
        chancePercent: species.chancePercent,
        name: species.name,
        imageUrl: species.imageUrl
      }))
    );
  }, [previewDrops]);

  const filteredContentCards = useMemo(() => {
    const normalizedSearch = NormalizeEntityName(contentSearchTerm);
    if (!normalizedSearch) {
      return contentCards;
    }
    return contentCards.filter((card) => NormalizeEntityName(card.name).includes(normalizedSearch));
  }, [contentCards, contentSearchTerm]);

  const contentTotalPages = Math.max(1, Math.ceil(filteredContentCards.length / ContentCardsPerPage));

  useEffect(() => {
    setContentPage((currentPage) => Math.min(currentPage, contentTotalPages));
  }, [contentTotalPages]);

  const paginatedContentCards = useMemo(() => {
    const startIndex = (contentPage - 1) * ContentCardsPerPage;
    return filteredContentCards.slice(startIndex, startIndex + ContentCardsPerPage);
  }, [contentPage, filteredContentCards]);

  const contentCardIntervals = useMemo(() => {
    const map = new Map<string, { start: number; end: number }>();
    const totalRange = 100000;
    const safeCards = contentCards.length > 0 ? contentCards : [];
    const totalChance = safeCards.reduce((sum, card) => sum + Math.max(0, card.chancePercent), 0);
    let cursor = 1;

    safeCards.forEach((card, index) => {
      const key = `${card.rarity}-${card.name}-${index}`;
      const isLast = index === safeCards.length - 1;
      let span = 1;

      if (totalChance > 0) {
        span = Math.max(1, Math.round((card.chancePercent / totalChance) * totalRange));
      } else {
        span = Math.max(1, Math.floor(totalRange / Math.max(1, safeCards.length)));
      }

      const start = Math.min(totalRange, cursor);
      const end = isLast ? totalRange : Math.min(totalRange, start + span - 1);
      map.set(key, { start, end });
      cursor = end + 1;
    });

    return map;
  }, [contentCards]);

  const chanceBySpecies = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of contentCards) {
      const key = NormalizeEntityName(card.name);
      if (!map.has(key)) {
        map.set(key, card.chancePercent);
      }
    }
    return map;
  }, [contentCards]);

  const chanceByRarity = useMemo(() => {
    const map = new Map<string, number>();
    for (const drop of previewDrops) {
      const key = (drop.rarity ?? "common").trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, drop.chancePercent);
      }
    }
    return map;
  }, [previewDrops]);

  const imageBySpecies = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const card of contentCards) {
      const key = NormalizeEntityName(card.name);
      if (!map.has(key)) {
        map.set(key, card.imageUrl);
      }
    }
    return map;
  }, [contentCards]);

  const topDrops = useMemo(() => {
    const findExactSpeciesImage = (rewardValue: string) => {
      const normalizedReward = NormalizeEntityName(rewardValue);
      return imageBySpecies.get(normalizedReward) ?? null;
    };
    return boxHistory
      .map((item) => {
        const rewardLevel = ExtractRewardLevel(item.rewardValue);
        const normalizedRewardName = item.rewardValue.replace(/\blv\b\.?\s*\d+/gi, "").trim();
        const key = NormalizeEntityName(normalizedRewardName);
        return {
          id: item.id,
          rewardValue: normalizedRewardName,
          level: item.rewardLevel ?? rewardLevel ?? 1,
          rarity: item.rewardRarity ?? "common",
          chancePercent: chanceBySpecies.get(key) ?? chanceByRarity.get((item.rewardRarity ?? "common").trim().toLowerCase()) ?? 0,
          imageUrl: findExactSpeciesImage(normalizedRewardName) ?? BuildPokemonImageFallback(normalizedRewardName),
          dropTimeLabel: BuildDropTimeLabel(item.createdAt),
          dropperName: item.userName ?? item.playerName ?? item.accountTag ?? "Jogador",
          dropperAvatarUrl: item.userAvatarUrl ?? item.playerAvatarUrl ?? item.avatarUrl ?? null
        };
      })
      .sort((a, b) => {
        const rarityDiff = BuildRarityRank(b.rarity) - BuildRarityRank(a.rarity);
        if (rarityDiff !== 0) {
          return rarityDiff;
        }
        return b.chancePercent - a.chancePercent;
      })
      .slice(0, 18);
  }, [boxHistory, chanceByRarity, chanceBySpecies, imageBySpecies]);

  const UpdateRouletteScrollButtons = () => {
    const trackElement = rouletteTrackRef.current;
    if (!trackElement) {
      setCanScrollRoulettePrev(false);
      setCanScrollRouletteNext(false);
      return;
    }
    const maxScrollLeft = Math.max(0, trackElement.scrollWidth - trackElement.clientWidth);
    setCanScrollRoulettePrev(trackElement.scrollLeft > 4);
    setCanScrollRouletteNext(trackElement.scrollLeft < maxScrollLeft - 4);
  };

  const ScrollRoulette = (direction: "prev" | "next") => {
    const trackElement = rouletteTrackRef.current;
    if (!trackElement) {
      return;
    }
    const offset = Math.max(180, Math.floor(trackElement.clientWidth * 0.62));
    trackElement.scrollBy({
      left: direction === "next" ? offset : -offset,
      behavior: "smooth"
    });
  };

  const UpdateTopDropsScrollButtons = () => {
    const listElement = topDropsCarouselRef.current;
    if (!listElement) {
      setCanScrollTopDropsPrev(false);
      setCanScrollTopDropsNext(false);
      return;
    }
    const maxScrollLeft = Math.max(0, listElement.scrollWidth - listElement.clientWidth);
    setCanScrollTopDropsPrev(listElement.scrollLeft > 4);
    setCanScrollTopDropsNext(listElement.scrollLeft < maxScrollLeft - 4);
  };

  const ScrollTopDrops = (direction: "prev" | "next") => {
    const listElement = topDropsCarouselRef.current;
    if (!listElement) {
      return;
    }
    const cardWidth = listElement.querySelector("li")?.getBoundingClientRect().width ?? 0;
    const visibleCards = Math.floor(listElement.clientWidth / (cardWidth + 8));
    const offset = cardWidth * visibleCards;
    listElement.scrollBy({
      left: direction === "next" ? offset : -offset,
      behavior: "smooth"
    });
  };

  useEffect(() => {
    UpdateTopDropsScrollButtons();
    const listElement = topDropsCarouselRef.current;
    if (!listElement) {
      return;
    }
    const HandleScroll = () => UpdateTopDropsScrollButtons();
    listElement.addEventListener("scroll", HandleScroll, { passive: true });
    window.addEventListener("resize", HandleScroll);
    return () => {
      listElement.removeEventListener("scroll", HandleScroll);
      window.removeEventListener("resize", HandleScroll);
    };
  }, [topDrops.length]);

  useEffect(() => {
    UpdateRouletteScrollButtons();
    const trackElement = rouletteTrackRef.current;
    if (!trackElement) {
      return;
    }
    const HandleScroll = () => UpdateRouletteScrollButtons();
    trackElement.addEventListener("scroll", HandleScroll, { passive: true });
    window.addEventListener("resize", HandleScroll);
    return () => {
      trackElement.removeEventListener("scroll", HandleScroll);
      window.removeEventListener("resize", HandleScroll);
    };
  }, [rouletteItems.length, activeBoxType]);

  const HandleContentCardInfo = (cardKey: string) => {
    setOpenedInfoCardKey((previous) => (previous === cardKey ? null : cardKey));
  };

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.55)]">
        {selectedBox?.imageUrl ? (
          <>
            <img loading="lazy" decoding="async" src={selectedBox.imageUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/70 to-slate-950/25" />
          </>
        ) : null}
        <div className="relative z-10 grid min-w-0 gap-4 lg:grid-cols-[260px_1fr]">
          <div className="relative mx-auto grid aspect-[270/375] w-full max-w-[230px] overflow-hidden rounded-xl ring-1 ring-slate-500/60">
            {selectedBox?.imageUrl ? <img loading="lazy" decoding="async" src={selectedBox.imageUrl} alt={selectedBox.displayName} className="h-full w-full object-cover" /> : null}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/80" />
            <div className="absolute left-3 top-3 rounded-lg bg-amber-400/20 px-2 py-1 text-[11px] font-semibold text-amber-100 ring-1 ring-amber-300/35">
              {selectedBox?.priceCoins ?? lootEconomyQuery.data?.lootPriceCoins ?? 40} coins
            </div>
            <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-900/70 px-2 py-1 text-center text-xs font-bold uppercase text-slate-100 ring-1 ring-slate-500/50">
              {selectedBox?.displayName ?? "Caixa"}
            </div>
          </div>
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link href="/boxes" className={PrimaryButtonClass}>
                  Voltar
                </Link>
                <h1 className="text-xl font-bold uppercase tracking-wide text-slate-100">{selectedBox?.displayName ?? "Caixa"}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100">Coins {lootEconomyQuery.data?.user.coins ?? 0}</span>
                <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100">Pity {selectedBoxState?.pityCounter ?? 0}</span>
                <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100">
                  Limite {selectedBoxState?.dailyShopPurchases ?? 0}/{lootEconomyQuery.data?.dailyShopLimit ?? 5}
                </span>
              </div>
            </div>
            <div className="max-w-full overflow-x-hidden rounded-xl bg-slate-900/65 p-3 ring-1 ring-slate-700/70">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-100">Roleta da caixa</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={`${PrimaryButtonClass} ${
                      isRouletteSpinning
                        ? "bg-amber-500/20 text-amber-100 ring-amber-300/85 shadow-[0_0_22px_rgba(251,191,36,0.45)]"
                        : ""
                    }`}
                    onClick={StartRoulette}
                    disabled={isRouletteSpinning || openLootBoxMutation.isPending}
                  >
                    {isRouletteSpinning ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/90" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-200" />
                        </span>
                        Girando Roleta...
                      </span>
                    ) : (
                      `Abrir por (${selectedBox?.priceCoins ?? lootEconomyQuery.data?.lootPriceCoins ?? 40} coins)`
                    )}
                  </button>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-300">
                <span>Som ativo: Arcade</span>
              </div>
              <div className="relative max-w-full overflow-hidden rounded-xl bg-slate-950/85 px-2 py-3 ring-1 ring-inset ring-slate-700/80">
                <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-amber-300/90" />
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 text-amber-300">
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
                <div ref={rouletteTrackRef} className="w-full max-w-full overflow-hidden px-2 sm:px-6">
                  <div className="relative left-1/2 flex w-max -translate-x-1/2 items-stretch gap-1.5 py-1">
                  {(rouletteItems.length > 0
                    ? rouletteItems
                    : roulettePreviewPool.length > 0
                      ? Array.from({ length: RouletteTrackSize }).map(
                          () => ({
                            ...roulettePreviewPool[Math.floor(Math.random() * roulettePreviewPool.length)],
                            level: RollPreviewLevel()
                          })
                        )
                      : Array.from({ length: RouletteTrackSize }).map(() => ({ name: "?", rarity: "common", level: 1, imageUrl: null })))
                    .slice(0, RouletteTrackSize)
                    .map((item, index) => (
                    <article
                      key={`${item.name}-${item.rarity}-${index}`}
                      className={`relative grid w-[74px] min-w-[74px] gap-1 rounded-lg border bg-slate-900/85 p-2 text-center transition sm:w-[96px] sm:min-w-[96px] lg:w-[106px] lg:min-w-[106px] ${
                        index === 5 && !isRouletteSpinning
                          ? "scale-105 border-amber-300/80 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.35)]"
                          : "border-slate-700/80 text-slate-200"
                      }`}
                    >
                      <div className={`absolute inset-x-1 bottom-0 h-[2px] rounded-full ${BuildRarityToneClass(item.rarity).split(" ")[1] ?? "bg-slate-400/20"}`} />
                      <div className="grid min-h-[44px] place-items-center sm:min-h-[52px]">
                        {item.imageUrl ? <img loading="lazy" decoding="async" src={item.imageUrl} alt={item.name} className="h-8 w-8 object-contain sm:h-10 sm:w-10" /> : <small className="text-[10px] font-bold text-slate-400">PK</small>}
                      </div>
                      <small className="truncate text-[11px] font-semibold capitalize">{item.name}</small>
                      <small className="text-[10px] font-bold text-amber-200">Lv {item.level ?? 1}</small>
                    </article>
                  ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 rounded-lg bg-slate-900/65 px-2 py-1.5 text-xs text-slate-200 ring-1 ring-inset ring-slate-700/70">
                Premio: <strong className="capitalize">{rouletteWinner?.name ?? "Aguardando abertura"}</strong>{" "}
                <strong>{rouletteWinner?.level ? `(Lv ${rouletteWinner.level})` : ""}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-full overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 font-sans shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
        <h2 className="mb-3 flex min-h-[3.8rem] items-center justify-center gap-2 text-center text-base font-semibold uppercase leading-tight text-slate-100">
          <span className="bg-gradient-to-r from-rose-400 to-amber-300 bg-clip-text text-transparent">Os melhores drops</span>
        </h2>
        <div className="relative w-full max-w-full px-0 sm:px-8">
          <button
            type="button"
            aria-label="Mostrar drops anteriores"
            onClick={() => {
              if (canScrollTopDropsPrev) {
                ScrollTopDrops("prev");
              }
            }}
            aria-disabled={!canScrollTopDropsPrev}
            className={`absolute left-0 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-slate-300 transition duration-200 hover:text-white sm:flex ${
              canScrollTopDropsPrev ? "cursor-pointer opacity-100" : "cursor-default opacity-30"
            }`}
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="block h-5 w-5" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z" />
            </svg>
          </button>
          <div className="rounded-xl bg-gradient-to-r from-rose-400/55 to-amber-300/55 p-[1px]">
            <div className="overflow-hidden rounded-xl bg-slate-950/70 p-2">
              <ul ref={topDropsCarouselRef} className="flex w-full max-w-full items-stretch overflow-x-auto pb-1 pt-0.5 sm:overflow-hidden">
              {topDrops.length === 0 ? (
                <li className="w-full rounded-lg border border-slate-700/70 bg-slate-900/65 px-3 py-3 text-center text-xs text-slate-300">
                  Sem drops recentes para esta caixa
                </li>
              ) : (
                topDrops.map((drop) => (
                  <li key={drop.id} className="mx-auto flex-shrink-0 basis-full min-w-0 max-w-none px-1 sm:mx-0 sm:max-w-none sm:basis-[50%] md:basis-[33.333%] lg:basis-[25%] xl:basis-[20%] 2xl:basis-[16.6667%]">
                    <article className="group relative flex h-full w-full aspect-[188/248] min-w-0 flex-col rounded-lg border border-slate-700/70 bg-gradient-to-b from-[#23232C] to-[#1F1F27] p-1.5 font-sans transition duration-300 hover:border-transparent sm:aspect-[230/293]">
                      <div className={`absolute -inset-px z-0 rounded-[inherit] opacity-0 blur-md transition duration-300 group-hover:opacity-100 ${BuildRarityGlowClass(drop.rarity)}`} />
                      <div className="z-10 flex items-start">
                        <div className="mr-auto p-1.5 text-[9px] font-medium leading-tight text-slate-300 sm:p-2 sm:text-[10px]">
                          Foi sorteado
                          <br />
                          <span className="font-semibold">{drop.dropTimeLabel}</span>
                        </div>
                        <div className="m-1.5 ml-auto text-right text-[8px] uppercase leading-tight text-slate-300 sm:m-2 sm:text-[9px]">
                          <span className="font-medium">Chance</span>
                          <br />
                          <span className="font-semibold">{drop.chancePercent.toFixed(3)}%</span>
                        </div>
                      </div>
                      <div className="pointer-events-none relative m-auto grid w-10/12 flex-1 place-items-center">
                        {drop.imageUrl ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            src={drop.imageUrl}
                            alt={drop.rewardValue}
                            className="absolute inset-0 z-10 m-auto h-full max-h-20 w-full object-contain transition duration-300 ease-in-out group-hover:scale-90 group-hover:opacity-0 sm:max-h-24"
                          />
                        ) : (
                          <div className="relative z-10 flex h-16 w-16 items-center justify-center transition duration-300 ease-in-out group-hover:scale-90 group-hover:opacity-0">
                            <small className="text-[9px] font-bold text-slate-400">PK</small>
                          </div>
                        )}
                        <div className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 ease-in-out group-hover:opacity-100">
                          <div className="flex flex-col items-center gap-1">
                            {drop.dropperAvatarUrl ? (
                              <img loading="lazy" decoding="async" src={drop.dropperAvatarUrl} alt={drop.dropperName} className="h-14 w-14 rounded-full border border-slate-200/40 object-cover" />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200/40 bg-slate-800 text-xs font-semibold text-slate-200">
                                {drop.dropperName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <small className="max-w-[90px] truncate text-[10px] font-semibold text-slate-100">{drop.dropperName}</small>
                          </div>
                        </div>
                      </div>
                      <div className="pointer-events-none z-10 -mt-1 min-w-0 max-w-full px-2.5 font-semibold leading-tight sm:px-3">
                        <div className="truncate text-[10px] uppercase text-slate-300 sm:text-xs">{drop.rarity}</div>
                        <div className="truncate text-xs capitalize text-white sm:text-sm">{drop.rewardValue}</div>
                      </div>
                      <div className="m-2.5 mt-1.5 rounded bg-slate-950/85 py-2 text-center text-sm font-semibold leading-none text-amber-300 sm:m-3 sm:mt-2 sm:py-2.5 sm:text-base">
                        Lv {drop.level}
                      </div>
                      <div className={`absolute inset-x-7 bottom-px h-px ${BuildRarityToneClass(drop.rarity).split(" ")[1] ?? "bg-slate-400/20"}`} />
                    </article>
                  </li>
                ))
              )}
              </ul>
            </div>
          </div>
          <button
            type="button"
            aria-label="Mostrar proximos drops"
            onClick={() => {
              if (canScrollTopDropsNext) {
                ScrollTopDrops("next");
              }
            }}
            aria-disabled={!canScrollTopDropsNext}
            className={`absolute right-0 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center text-slate-300 transition duration-200 hover:text-white sm:flex ${
              canScrollTopDropsNext ? "cursor-pointer opacity-100" : "cursor-default opacity-30"
            }`}
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="block h-5 w-5 rotate-180 transform" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z" />
            </svg>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
        <div className="mb-3 grid min-h-[3.6rem] grid-cols-[1fr_auto_1fr] items-center">
          <h2 className="col-start-2 text-center text-base font-semibold uppercase leading-tight text-slate-100">Conteudo da caixa</h2>
        </div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={contentSearchTerm}
            onChange={(event) => setContentSearchTerm(event.target.value)}
            placeholder="Buscar pokemon..."
            className="h-10 w-full rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 text-sm text-slate-100 outline-none transition focus:border-slate-500/80 sm:max-w-xs"
          />
          <div className="text-xs text-slate-300">
            Mostrando {paginatedContentCards.length} de {filteredContentCards.length} pokemons
          </div>
        </div>
        <ul className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredContentCards.length === 0 ? (
            <li className="col-span-full rounded-lg border border-slate-700/70 bg-slate-900/65 px-3 py-3 text-center text-xs text-slate-300">Sem pokemons disponiveis nesta caixa</li>
          ) : (
            paginatedContentCards.map((card, index) => {
              const globalIndex = (contentPage - 1) * ContentCardsPerPage + index;
              const cardKey = `${card.rarity}-${card.name}-${globalIndex}`;
              const interval = contentCardIntervals.get(cardKey) ?? { start: 1, end: 1 };
              const isInfoOpen = openedInfoCardKey === cardKey;
              return (
              <li key={cardKey} data-testid="case-content-card" className="will-change-transform [contain:content]">
                <article className="group relative z-0 flex aspect-[177/200] min-h-0 w-full flex-col rounded-lg border border-slate-700/70 bg-gradient-to-b from-slate-800/70 to-slate-900/90 transition-colors duration-300 hover:border-transparent">
                  <div className={`absolute -inset-px z-[-1] rounded-[inherit] opacity-0 blur-md transition duration-300 group-hover:opacity-100 ${BuildRarityGlowClass(card.rarity)}`} />
                  <div className="flex items-start justify-between p-3 pb-0">
                    <button
                      type="button"
                      aria-label={`Mostrar detalhes de ${card.name}`}
                      onClick={() => HandleContentCardInfo(cardKey)}
                      className="z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-center text-[10px] font-semibold text-slate-900 transition hover:bg-white"
                    >
                      i
                    </button>
                    <div className="ml-auto text-right text-[10px] uppercase leading-tight text-slate-300">
                      <div className="flex flex-col">
                        <span className="font-medium">Chance</span>
                        <span className="font-semibold">{card.chancePercent.toFixed(3)}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative m-auto grid min-h-0 w-10/12 flex-1 place-items-center">
                    <div className={`pointer-events-none absolute h-16 w-16 rounded-full opacity-65 blur-xl transition duration-300 group-hover:h-24 group-hover:w-24 group-hover:opacity-100 ${BuildRarityGlowClass(card.rarity)}`} />
                    {card.imageUrl ? <img loading="lazy" decoding="async" src={card.imageUrl} alt={card.name} className="pointer-events-none relative z-10 h-full w-9/12 object-contain" /> : <small className="relative z-10 text-[10px] font-bold text-slate-400">PK</small>}
                  </div>
                  <div className="z-10 w-full self-end p-3 pt-0 font-semibold leading-tight">
                    <div className={`truncate text-xs uppercase ${BuildRarityTextClass(card.rarity)}`}>{card.rarity}</div>
                    <div className="truncate text-sm capitalize text-white">{card.name}</div>
                    <div className="mt-2 rounded bg-slate-950/85 py-[0.4375rem] text-center text-sm font-semibold leading-none text-amber-300">
                      Chance {card.chancePercent.toFixed(3)}%
                    </div>
                  </div>
                  {isInfoOpen ? (
                    <div className="absolute inset-0 z-20 h-full w-full rounded bg-slate-900/80 p-3 backdrop-blur-sm transition duration-300 sm:rounded-lg">
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          aria-label={`Fechar detalhes de ${card.name}`}
                          onClick={() => HandleContentCardInfo(cardKey)}
                          className="rounded bg-slate-700/80 px-2 py-1 text-[10px] font-semibold text-slate-100 transition hover:bg-slate-600/80"
                        >
                          fechar
                        </button>
                      </div>
                      <div data-testid="case-info-content" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] text-slate-200">
                        <div className="font-bold uppercase text-white">Preco</div>
                        <div className="text-right text-amber-300">{selectedBox?.priceCoins ?? 0} moedas</div>
                        <div className="font-bold uppercase text-white">Intervalo</div>
                        <div className="text-right">{interval.start} - {interval.end}</div>
                        <div className="font-bold uppercase text-white">Probabilidades</div>
                        <div className="text-right">{card.chancePercent.toFixed(3)}%</div>
                        <div className="font-bold uppercase text-white">Raridade</div>
                        <div className={`text-right uppercase ${BuildRarityTextClass(card.rarity)}`}>{card.rarity}</div>
                      </div>
                    </div>
                  ) : null}
                  <div className={`absolute inset-x-7 bottom-0 h-px ${BuildRarityToneClass(card.rarity).split(" ")[1] ?? "bg-slate-400/20"}`} />
                </article>
              </li>
            );
            })
          )}
        </ul>
        {contentTotalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setContentPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={contentPage === 1}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <div className="text-sm font-semibold text-slate-200">
              Pagina {contentPage} de {contentTotalPages}
            </div>
            <button
              type="button"
              onClick={() => setContentPage((currentPage) => Math.min(contentTotalPages, currentPage + 1))}
              disabled={contentPage === contentTotalPages}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Proxima
            </button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
        <h2 className="mb-2 text-base font-bold text-slate-100">Historico desta caixa</h2>
        <div className="grid gap-2">
          {boxHistory.length === 0 ? (
            <div className="rounded-lg bg-slate-900/65 px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-700/70">Sem aberturas recentes</div>
          ) : (
            boxHistory.slice(0, 12).map((item) => (
              <article key={item.id} className="rounded-lg bg-slate-900/65 px-3 py-2 ring-1 ring-slate-700/70">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm capitalize text-slate-100">{item.rewardValue}</strong>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${BuildRarityToneClass(item.rewardRarity ?? "common")}`}>
                    {item.rewardRarity ?? "common"}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
