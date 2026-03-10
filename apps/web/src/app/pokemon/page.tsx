"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiFetch } from "../../lib/api";
import { GetTrainerPossessive } from "../../lib/trainer-gender";
import { useToast } from "../../providers/toast-provider";

type UserPokemon = {
  id: string;
  level: number;
  xp: number;
  xpInCurrentLevel?: number;
  xpToNextLevel?: number;
  xpProgressPercent?: number;
  currentHp: number;
  atk: number;
  def: number;
  speed: number;
  wins: number;
  losses: number;
  restCooldownUntil: string | null;
  evolveCooldownUntil: string | null;
  trainingCooldownUntil?: string | null;
  ageDays?: number;
  agePenaltyPercent?: number;
  effectiveAtk?: number;
  effectiveDef?: number;
  effectiveSpeed?: number;
  lifeUtil?: number;
  isLegacy?: boolean;
  lifeStage?: string;
  maxLevel?: number;
  species: {
    name: string;
    typePrimary: string;
    imageUrl?: string | null;
    evolutionTarget?: string | null;
    evolutionLevel?: number | null;
  };
};

type Species = {
  id: string;
  name: string;
  typePrimary: string;
  imageUrl: string | null;
};

type StarterChoicesResponse = {
  stageOne: Species[];
  stageTwo: Species[];
  stageThree: Species[];
};

type MeSummary = {
  id: string;
  displayName: string;
  trainingPoints: number;
  gender?: "male" | "female";
};

type DashboardChampionItem = {
  id: string;
  isLegacy?: boolean;
};

type LootEconomyResponse = {
  user: {
    pokemonFragments: number;
    lootPityCounter: number;
    dailyShopPurchases: number;
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
    pityBefore: number;
    pityAfter: number;
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

type LootSpinItem = {
  name: string;
  rarity: string;
  imageUrl?: string | null;
};

const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 w-auto items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const PrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-slate-800/90 disabled:hover:ring-slate-500/70";
const HiddenPoolFallbackKey = "battleleague:hiddenDashboardChampionIds";
const PoolChangedEvent = "battleleague:poolChanged";
const TeamFeedBatchSize = 12;

export default function PokemonPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [nowMs, setNowMs] = useState(Date.now());
  const [pokemonActionError, setPokemonActionError] = useState("");
  const [evolvingPokemonId, setEvolvingPokemonId] = useState("");
  const [hiddenChampionIds, setHiddenChampionIds] = useState<string[]>([]);
  const [isHiddenPoolHydrated, setIsHiddenPoolHydrated] = useState(false);
  const [evolutionCooldownBaselineByPokemonId, setEvolutionCooldownBaselineByPokemonId] = useState<Record<string, number>>({});
  const [isLootPanelOpen, setIsLootPanelOpen] = useState(false);
  const [isLootRouletteOpen, setIsLootRouletteOpen] = useState(false);
  const [isLootRouletteSpinning, setIsLootRouletteSpinning] = useState(false);
  const [lootRouletteItems, setLootRouletteItems] = useState<LootSpinItem[]>([]);
  const [lootRouletteWinner, setLootRouletteWinner] = useState<LootSpinItem | null>(null);
  const [lootRouletteError, setLootRouletteError] = useState("");
  const [selectedLootBoxType, setSelectedLootBoxType] = useState("fiesta");
  const [visibleTeamCount, setVisibleTeamCount] = useState(TeamFeedBatchSize);
  const [selectedStarterByStage, setSelectedStarterByStage] = useState<{
    stageOne: string;
    stageTwo: string;
    stageThree: string;
  }>({
    stageOne: "",
    stageTwo: "",
    stageThree: ""
  });
  const [isStarterRewardModalOpen, setIsStarterRewardModalOpen] = useState(false);
  const [starterStep, setStarterStep] = useState<1 | 2 | 3>(1);
  const teamLoadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const lootRouletteIntervalRef = useRef<number | null>(null);
  const myPokemonsQuery = useQuery({
    queryKey: ["myPokemons"],
    queryFn: () => ApiFetch<UserPokemon[]>("/pokemon/my")
  });
  const speciesQuery = useQuery({
    queryKey: ["species"],
    queryFn: () => ApiFetch<Species[]>("/pokemon/species")
  });
  const starterChoicesQuery = useQuery({
    queryKey: ["starterChoices"],
    queryFn: () => ApiFetch<StarterChoicesResponse>("/pokemon/starterChoices")
  });
  const meQuery = useQuery({
    queryKey: ["meForPokemonTraining"],
    queryFn: () => ApiFetch<MeSummary>("/users/me")
  });
  const dashboardChampionsQuery = useQuery({
    queryKey: ["myChampionsForPool"],
    queryFn: () => ApiFetch<DashboardChampionItem[]>("/users/me/champions")
  });
  const lootEconomyQuery = useQuery({
    queryKey: ["lootEconomyPokemonPage"],
    queryFn: () => ApiFetch<LootEconomyResponse>("/progression/loot/economy"),
    staleTime: 15000,
    refetchInterval: 20000,
    refetchIntervalInBackground: false
  });

  const BuildRequestId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
        body: JSON.stringify({ requestId: BuildRequestId(), boxType: selectedLootBoxType })
      })
  });

  const buyLootBoxMutation = useMutation({
    mutationFn: () =>
      ApiFetch<{ quantity: number; totalCost: number }>("/progression/lootbox/shop/buy", {
        method: "POST",
        body: JSON.stringify({ quantity: 1, requestId: BuildRequestId(), boxType: selectedLootBoxType })
      }),
    onSuccess: (payload) => {
      addToast({
        title: "Compra concluida",
        message: `${payload.quantity} caixa comprada por ${payload.totalCost} coins.`,
        tone: "success"
      });
      void lootEconomyQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
      void queryClient.invalidateQueries({ queryKey: ["meForPokemonTraining"] });
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
        body: JSON.stringify({ eventCode: "dailyWin", requestId: BuildRequestId() })
      }),
    onSuccess: () => {
      addToast({
        title: "Evento resgatado",
        message: "Recompensa diaria recebida.",
        tone: "success"
      });
      void lootEconomyQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
      void queryClient.invalidateQueries({ queryKey: ["meForPokemonTraining"] });
    },
    onError: (error) => {
      addToast({
        title: "Falha no evento",
        message: error instanceof Error ? error.message : "Erro inesperado.",
        tone: "error"
      });
    }
  });

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
          void lootEconomyQuery.refetch();
          void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
          void queryClient.invalidateQueries({ queryKey: ["meForPokemonTraining"] });
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

  const claimStarterBundleMutation = useMutation({
    mutationFn: (payload: { stageOneSpeciesName: string; stageTwoSpeciesName: string; stageThreeSpeciesName: string }) =>
      ApiFetch("/pokemon/claimStarterBundle", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      setPokemonActionError("");
      setIsStarterRewardModalOpen(true);
      addToast({
        title: "Time inicial confirmado",
        message: "Seus 3 pokemons iniciais foram adicionados.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
    }
  });

  const evolveMutation = useMutation({
    mutationFn: (userPokemonId: string) =>
      ApiFetch(`/pokemon/evolve/${userPokemonId}`, {
        method: "POST"
      }),
    onMutate: (userPokemonId) => {
      setPokemonActionError("");
      setEvolvingPokemonId(userPokemonId);
    },
    onSuccess: () => {
      setEvolvingPokemonId("");
      setPokemonActionError("Pokemon evoluido com sucesso.");
      addToast({
        title: "Evolucao concluida",
        message: "Seu pokemon evoluiu com sucesso.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
    },
    onError: (error) => {
      setEvolvingPokemonId("");
      if (!(error instanceof Error)) {
        setPokemonActionError("Nao foi possivel evoluir agora.");
        addToast({ title: "Falha na evolucao", tone: "error" });
        return;
      }
      const message = error.message;
      if (message.includes("insufficientLevelForEvolution")) {
        setPokemonActionError("Nivel insuficiente para evoluir.");
        addToast({ title: "Nivel insuficiente", tone: "error" });
        return;
      }
      if (message.includes("evolutionInCooldown")) {
        setPokemonActionError("Evolucao em cooldown. Aguarde.");
        addToast({ title: "Evolucao em cooldown", tone: "error" });
        return;
      }
      if (message.includes("pokemonHasNoEvolution")) {
        setPokemonActionError("Esse pokemon nao possui evolucao.");
        addToast({ title: "Sem evolucao disponivel", tone: "error" });
        return;
      }
      if (message.includes("pokemonEvolutionRequiresSpecialCondition")) {
        setPokemonActionError("Essa evolucao depende de condicao especial.");
        addToast({ title: "Condicao especial necessaria", tone: "error" });
        return;
      }
      setPokemonActionError("Nao foi possivel evoluir agora.");
      addToast({ title: "Falha na evolucao", tone: "error" });
    }
  });
  const trainMutation = useMutation({
    mutationFn: (userPokemonId: string) =>
      ApiFetch(`/pokemon/train/${userPokemonId}`, {
        method: "POST"
      }),
    onMutate: (userPokemonId) => {
      setPokemonActionError("");
      setEvolvingPokemonId(`train:${userPokemonId}`);
    },
    onSuccess: () => {
      setEvolvingPokemonId("");
      setPokemonActionError("Treino concluido com sucesso.");
      addToast({
        title: "Treino concluido",
        message: "Atributos atualizados com sucesso.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
      void queryClient.invalidateQueries({ queryKey: ["meForPokemonTraining"] });
    },
    onError: (error) => {
      setEvolvingPokemonId("");
      if (!(error instanceof Error)) {
        setPokemonActionError("Nao foi possivel treinar agora.");
        addToast({ title: "Falha no treino", tone: "error" });
        return;
      }
      const message = error.message;
      if (message.includes("insufficientTrainingPoints")) {
        setPokemonActionError("Voce esta sem Pontos de Treino.");
        addToast({ title: "Sem pontos de treino", tone: "error" });
        return;
      }
      if (message.includes("trainingInCooldown")) {
        setPokemonActionError("Treino em cooldown. Aguarde.");
        addToast({ title: "Treino em cooldown", tone: "error" });
        return;
      }
      setPokemonActionError("Nao foi possivel treinar agora.");
      addToast({ title: "Falha no treino", tone: "error" });
    }
  });

  const myPokemons = myPokemonsQuery.data ?? [];
  const showStarterSelectionModal = !myPokemonsQuery.isLoading && myPokemons.length === 0;
  const visibleMyPokemons = useMemo(() => myPokemons.slice(0, visibleTeamCount), [myPokemons, visibleTeamCount]);
  const hasMoreMyPokemons = visibleTeamCount < myPokemons.length;
  const me = meQuery.data ?? null;
  const trainerPossessive = GetTrainerPossessive(me?.gender);
  const dashboardChampionIds = useMemo(
    () =>
      new Set(
        (dashboardChampionsQuery.data ?? [])
          .filter((champion) => !champion.isLegacy)
          .map((champion) => champion.id)
      ),
    [dashboardChampionsQuery.data]
  );
  const myTrainingPoints = meQuery.data?.trainingPoints ?? 0;
  const starterChoices = starterChoicesQuery.data ?? { stageOne: [], stageTwo: [], stageThree: [] };
  const starterStageFlow: Array<{
    stageKey: "stageOne" | "stageTwo" | "stageThree";
    title: string;
    subtitle: string;
    choices: Species[];
  }> = [
    { stageKey: "stageOne", title: "Evolucao minima", subtitle: "Primeira escolha", choices: starterChoices.stageOne },
    { stageKey: "stageTwo", title: "Evolucao 2", subtitle: "Segunda escolha", choices: starterChoices.stageTwo },
    { stageKey: "stageThree", title: "Evolucao maxima", subtitle: "Ultima escolha", choices: starterChoices.stageThree }
  ];
  const currentStarterStage = starterStageFlow[starterStep - 1];
  const currentStarterStageSelection = selectedStarterByStage[currentStarterStage.stageKey];
  const canAdvanceStarterStep = currentStarterStageSelection.length > 0;
  const canConfirmStarterBundle =
    selectedStarterByStage.stageOne.length > 0 &&
    selectedStarterByStage.stageTwo.length > 0 &&
    selectedStarterByStage.stageThree.length > 0;
  const hiddenKey = me ? `battleleague:hiddenDashboardChampionIds:${me.id}` : HiddenPoolFallbackKey;

  useEffect(() => {
    if (!showStarterSelectionModal) {
      return;
    }
    setStarterStep(1);
    setSelectedStarterByStage({
      stageOne: "",
      stageTwo: "",
      stageThree: ""
    });
  }, [showStarterSelectionModal]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    setVisibleTeamCount(TeamFeedBatchSize);
  }, [myPokemons.length]);

  useEffect(() => {
    if (!hasMoreMyPokemons) {
      return;
    }
    const sentinel = teamLoadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleTeamCount((current) => Math.min(myPokemons.length, current + TeamFeedBatchSize));
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreMyPokemons, myPokemons.length]);

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
    const userScopedIds = parseHiddenIds(window.localStorage.getItem(hiddenKey));
    const fallbackIds = parseHiddenIds(window.localStorage.getItem(HiddenPoolFallbackKey));
    const mergedIds = Array.from(new Set([...userScopedIds, ...fallbackIds]));
    setHiddenChampionIds(mergedIds);
    setIsHiddenPoolHydrated(true);
  }, [hiddenKey]);

  useEffect(() => {
    if (!isHiddenPoolHydrated) {
      return;
    }
    window.localStorage.setItem(hiddenKey, JSON.stringify(hiddenChampionIds));
    window.localStorage.setItem(HiddenPoolFallbackKey, JSON.stringify(hiddenChampionIds));
    window.dispatchEvent(new CustomEvent(PoolChangedEvent));
  }, [hiddenChampionIds, hiddenKey, isHiddenPoolHydrated]);

  useEffect(() => {
    if (!isHiddenPoolHydrated) {
      return;
    }
    const nowMs = Date.now();
    const forcedHiddenIds = myPokemons
      .filter((pokemon) => {
        if (!dashboardChampionIds.has(pokemon.id)) {
          return false;
        }
        const evolutionCooldownActive = !!pokemon.evolveCooldownUntil && new Date(pokemon.evolveCooldownUntil).getTime() > nowMs;
        const trainingCooldownActive =
          !!pokemon.trainingCooldownUntil && new Date(pokemon.trainingCooldownUntil).getTime() > nowMs;
        return evolutionCooldownActive || trainingCooldownActive;
      })
      .map((pokemon) => pokemon.id);
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
  }, [myPokemons, dashboardChampionIds, isHiddenPoolHydrated]);

  useEffect(() => {
    setEvolutionCooldownBaselineByPokemonId((current) => {
      const next: Record<string, number> = {};
      for (const pokemon of myPokemons) {
        const cooldownUntilMs = pokemon.evolveCooldownUntil ? new Date(pokemon.evolveCooldownUntil).getTime() : 0;
        if (!cooldownUntilMs || cooldownUntilMs <= nowMs) {
          continue;
        }
        const remainingMs = Math.max(1000, cooldownUntilMs - nowMs);
        const previousBaseline = current[pokemon.id];
        if (!previousBaseline || remainingMs > previousBaseline + 5000) {
          next[pokemon.id] = remainingMs;
          continue;
        }
        next[pokemon.id] = previousBaseline;
      }
      return next;
    });
  }, [myPokemons, nowMs]);

  const togglePoolMembership = (pokemonId: string, isInPool: boolean) => {
    setHiddenChampionIds((current) => {
      const next = isInPool
        ? current.concat(pokemonId).filter((value, index, array) => array.indexOf(value) === index)
        : current.filter((id) => id !== pokemonId);
      window.localStorage.setItem(hiddenKey, JSON.stringify(next));
      window.localStorage.setItem(HiddenPoolFallbackKey, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(PoolChangedEvent));
      return next;
    });
  };

  const formatCooldown = (value: string | null) => {
    if (!value) {
      return "Pronto";
    }
    const target = new Date(value);
    if (Number.isNaN(target.getTime())) {
      return "Pronto";
    }
    if (target.getTime() <= Date.now()) {
      return "Pronto";
    }
    return target.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };
  const formatDurationClock = (durationMs: number) => {
    const safeMs = Math.max(0, durationMs);
    const totalSeconds = Math.floor(safeMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const getEvolutionBlockReason = (pokemon: UserPokemon, evolveIsReady: boolean, isInPool: boolean) => {
    if (pokemon.isLegacy) {
      return "Pokemon em Legado";
    }
    if (isInPool) {
      return "Retire da Pool para evoluir";
    }
    if (!pokemon.species.evolutionTarget) {
      return "Forma final atingida";
    }
    if (!pokemon.species.evolutionLevel) {
      return "Evolucao especial indisponivel";
    }
    if (!evolveIsReady) {
      return "Aguarde o cooldown de evolucao";
    }
    if (pokemon.level < pokemon.species.evolutionLevel) {
      return `Alcance nivel ${pokemon.species.evolutionLevel} para evoluir`;
    }
    return "";
  };
  const getTrainingBlockReason = (pokemon: UserPokemon, trainIsReady: boolean, isInPool: boolean) => {
    if (pokemon.isLegacy) {
      return "Pokemon em Legado";
    }
    if (isInPool) {
      return "Retire da Pool para treinar";
    }
    if (!trainIsReady) {
      return "Aguarde o cooldown de treino";
    }
    if (myTrainingPoints <= 0) {
      return "Ganhe Pontos de Treino em batalhas";
    }
    return "";
  };
  const HandleStarterPick = (stageKey: "stageOne" | "stageTwo" | "stageThree", speciesName: string) => {
    setSelectedStarterByStage((current) => ({
      ...current,
      [stageKey]: speciesName
    }));
  };
  const HandleStarterBundleClaim = () => {
    if (!canConfirmStarterBundle || claimStarterBundleMutation.isPending) {
      return;
    }
    claimStarterBundleMutation.mutate({
      stageOneSpeciesName: selectedStarterByStage.stageOne,
      stageTwoSpeciesName: selectedStarterByStage.stageTwo,
      stageThreeSpeciesName: selectedStarterByStage.stageThree
    });
  };

  return (
    <main className="min-h-screen content-start grid gap-1 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll mt-3 mb-3 self-start px-1 py-2">
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
        <Link className={NavLinkClass} href="/battles">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M14.5 4l5.5 5.5-2 2L12.5 6z" />
              <path d="M9.5 20l-5.5-5.5 2-2L11.5 18z" />
              <path d="M8.5 15.5l7-7" />
            </svg>
          </span>
          Ir para Batalhas
        </Link>
        <Link className={NavLinkClass} href="/pokedex">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </span>
          Ir para Pokedex
        </Link>
        <Link className={NavLinkClass} href="/boxes">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M4 8l8-4 8 4-8 4-8-4z" />
              <path d="M4 8v8l8 4 8-4V8" />
            </svg>
          </span>
          Ir para Caixas
        </Link>
        <Link className={NavLinkClass} href="/upgrade">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M12 4v16" />
              <path d="M5 12h14" />
            </svg>
          </span>
          Ir para Melhorar
        </Link>
      </nav>

      {myPokemons.length > 0 ? (
        <section className={SectionCardClass}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2>Seu time atual</h2>
            <small className="text-slate-300">
              {visibleMyPokemons.length}/{myPokemons.length} pokemon(s) | Pontos de Treino {myTrainingPoints}
            </small>
          </div>
          <div className="grid items-start gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visibleMyPokemons.map((pokemon) => {
              const canBeInDashboardPool = dashboardChampionIds.has(pokemon.id) && !pokemon.isLegacy;
              const isInPool = canBeInDashboardPool && !hiddenChampionIds.includes(pokemon.id);
              const totalBattles = pokemon.wins + pokemon.losses;
              const winRate = totalBattles === 0 ? 0 : Math.round((pokemon.wins / totalBattles) * 100);
              const xpLevelProgress = Math.max(0, Math.min(100, pokemon.xpProgressPercent ?? 0));
              const xpCurrentProgress = Math.max(0, pokemon.xpInCurrentLevel ?? 0);
              const xpRequiredForNext = Math.max(1, pokemon.xpToNextLevel ?? 100);
              const restIsReady = formatCooldown(pokemon.restCooldownUntil) === "Pronto";
              const evolveIsReady = formatCooldown(pokemon.evolveCooldownUntil) === "Pronto";
              const evolveCooldownActive = !evolveIsReady;
              const evolveCooldownRemainingMs =
                pokemon.evolveCooldownUntil && new Date(pokemon.evolveCooldownUntil).getTime() > nowMs
                  ? new Date(pokemon.evolveCooldownUntil).getTime() - nowMs
                  : 0;
              const evolveCooldownBaselineMs = evolutionCooldownBaselineByPokemonId[pokemon.id] ?? evolveCooldownRemainingMs;
              const evolveCooldownProgressPercent =
                evolveCooldownBaselineMs > 0
                  ? Math.max(0, Math.min(100, Math.round((evolveCooldownRemainingMs / evolveCooldownBaselineMs) * 100)))
                  : 0;
              const canEvolveNow =
                !pokemon.isLegacy &&
                !isInPool &&
                !!pokemon.species.evolutionTarget &&
                !!pokemon.species.evolutionLevel &&
                evolveIsReady &&
                pokemon.level >= pokemon.species.evolutionLevel;
              const trainIsReady = formatCooldown(pokemon.trainingCooldownUntil ?? null) === "Pronto";
              const trainingCooldownActive = !trainIsReady;
              const hasProgressCooldown = evolveCooldownActive || trainingCooldownActive;
              const canTrainNow = !pokemon.isLegacy && !isInPool && trainIsReady && myTrainingPoints > 0;
              const isEvolveButtonDisabled = !canEvolveNow || evolvingPokemonId === pokemon.id || trainMutation.isPending;
              const isTrainButtonDisabled =
                !canTrainNow || evolvingPokemonId === `train:${pokemon.id}` || evolveMutation.isPending;
              const evolutionBlockReason = getEvolutionBlockReason(pokemon, evolveIsReady, isInPool);
              const trainingBlockReason = getTrainingBlockReason(pokemon, trainIsReady, isInPool);
              return (
                <article
                  key={pokemon.id}
                  className={`grid content-start gap-2 self-start rounded-2xl p-2 ring-1 ring-inset ${
                    pokemon.isLegacy ? "bg-yellow-900/35 ring-yellow-500/45" : "bg-slate-900/70 ring-slate-700/70"
                  }`}
                >
                  <div className="relative grid h-20 w-full place-items-center overflow-hidden rounded-xl bg-slate-800/70 sm:h-24">
                    <span className="absolute right-2 top-2 rounded-full bg-slate-900/85 px-2 py-0.5 text-xs font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                      {pokemon.species.typePrimary}
                    </span>
                    {pokemon.species.imageUrl ? (
                      <img loading="lazy" decoding="async" src={pokemon.species.imageUrl} alt={pokemon.species.name} className="h-14 w-14 object-contain sm:h-16 sm:w-16" />
                    ) : (
                      <div className="text-xs font-bold text-slate-400">PK</div>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="capitalize">{pokemon.species.name}</strong>
                      <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-xs font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">Nivel {pokemon.level}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">
                        V/D {pokemon.wins}/{pokemon.losses}
                      </span>
                      <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">
                        Taxa {winRate}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-200">
                      <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">HP {pokemon.currentHp}</span>
                      <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">ATK {pokemon.atk}</span>
                      <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">DEF {pokemon.def}</span>
                      <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">SPD {pokemon.speed}</span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-300">
                      <small>XP {pokemon.xp}</small>
                      <small>
                        {xpCurrentProgress}/{xpRequiredForNext} para proximo nivel ({xpLevelProgress}%)
                      </small>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style={{ width: `${xpLevelProgress}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[11px] text-slate-300">
                      <small>Taxa de vitoria</small>
                      <small>{winRate}%</small>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: `${winRate}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-slate-600/70 ${restIsReady ? "bg-slate-800/85 text-slate-100" : "bg-slate-800/65 text-slate-300"}`}>
                        Descanso {restIsReady ? "Pronto" : formatCooldown(pokemon.restCooldownUntil)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-slate-600/70 ${evolveIsReady ? "bg-slate-800/85 text-slate-100" : "bg-slate-800/65 text-slate-300"}`}>
                        Evolucao {evolveIsReady ? "Pronto" : formatCooldown(pokemon.evolveCooldownUntil)}
                      </span>
                      {pokemon.isLegacy ? (
                        <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-inset ring-slate-600/70">
                          Legado
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ring-slate-600/70 ${
                          isInPool ? "bg-emerald-900/35 text-emerald-100" : "bg-slate-800/65 text-slate-300"
                        }`}
                      >
                        {isInPool ? "Na Pool" : "Fora Da Pool"}
                      </span>
                    </div>
                    {evolveCooldownActive ? (
                      <div className="grid gap-1 rounded-lg bg-slate-900/65 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">
                        <div className="flex items-center justify-between gap-2">
                          <small>Tempo restante evolucao</small>
                          <small>{formatDurationClock(evolveCooldownRemainingMs)}</small>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                            style={{ width: `${evolveCooldownProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={PrimaryButtonClass}
                      onClick={() => {
                        if (!canBeInDashboardPool) {
                          setPokemonActionError(
                            pokemon.isLegacy
                              ? "Pokemon em Legado nao pode entrar na Pool."
                              : "Esse pokemon nao esta no conjunto de campeoes exibidos no dashboard."
                          );
                          addToast({
                            title: pokemon.isLegacy ? "Legado bloqueado na Pool" : "Nao esta no dashboard",
                            message: pokemon.isLegacy
                              ? "Pokemon legado e apenas trofeu e nao entra na pool."
                              : "Esse pokemon nao pode entrar na pool agora.",
                            tone: "error"
                          });
                          return;
                        }
                        if (!isInPool && hasProgressCooldown) {
                          setPokemonActionError("Pokemon em treino ou evolucao nao pode ficar na Pool.");
                          addToast({
                            title: "Pool bloqueada por cooldown",
                            message: "Aguarde concluir treino/evolucao para colocar na pool.",
                            tone: "error"
                          });
                          return;
                        }
                        setPokemonActionError("");
                        togglePoolMembership(pokemon.id, isInPool);
                        addToast({
                          title: isInPool ? "Pokemon removido da pool" : "Pokemon adicionado na pool",
                          tone: "info"
                        });
                      }}
                    >
                      {!canBeInDashboardPool
                        ? pokemon.isLegacy
                          ? "Legado nao entra na Pool"
                          : "Nao esta na pool"
                        : isInPool
                          ? "Tirar Da Pool"
                          : "Colocar Na Pool"}
                    </button>
                    <button
                      type="button"
                      className={PrimaryButtonClass}
                      onClick={() => {
                        if (isEvolveButtonDisabled) {
                          return;
                        }
                        evolveMutation.mutate(pokemon.id);
                      }}
                      disabled={isEvolveButtonDisabled}
                    >
                      {evolvingPokemonId === pokemon.id ? "Evoluindo..." : `Evoluir para ${pokemon.species.evolutionTarget ?? "forma final"}`}
                    </button>
                    {!canEvolveNow ? (
                      <small className="rounded-lg bg-slate-900/65 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">{evolutionBlockReason}</small>
                    ) : null}
                    <button
                      type="button"
                      className={PrimaryButtonClass}
                      onClick={() => {
                        if (isTrainButtonDisabled) {
                          return;
                        }
                        trainMutation.mutate(pokemon.id);
                      }}
                      disabled={isTrainButtonDisabled}
                    >
                      {evolvingPokemonId === `train:${pokemon.id}` ? "Treinando..." : "Treinar atributos"}
                    </button>
                    {!canTrainNow ? (
                      <small className="rounded-lg bg-slate-900/65 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">{trainingBlockReason}</small>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          {hasMoreMyPokemons ? <div ref={teamLoadMoreSentinelRef} className="mt-3 h-1 w-full" aria-hidden /> : null}
          {pokemonActionError ? <div className="rounded-xl bg-slate-900/75 p-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-500/70">{pokemonActionError}</div> : null}
        </section>
      ) : (
        <section className={SectionCardClass}>
          <div className="grid min-h-[240px] place-items-center rounded-xl bg-slate-900/65 p-4 ring-1 ring-inset ring-slate-700/70">
            <div className="grid max-w-md gap-2 text-center">
              <strong className="text-lg text-slate-100">Monte seu time inicial</strong>
              <p className="text-sm text-slate-300">O draft inicial agora abre em modal com escolha por estagio.</p>
            </div>
          </div>
        </section>
      )}
      {showStarterSelectionModal ? (
        <div className="fixed inset-0 z-[115] grid place-items-center overflow-y-auto bg-slate-950/80 p-3 sm:p-5">
          <div className="grid w-full max-w-[1200px] max-h-[92vh] gap-4 overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-[0_26px_80px_rgba(2,6,23,0.65)] sm:max-h-[94vh] sm:p-5">
            <div className="grid gap-2 rounded-xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-700/70 sm:p-4">
              <strong className="text-lg text-slate-100">Escolha seus 3 pokemons iniciais</strong>
              <p className="text-sm text-slate-300">
                Selecione 1 pokemon por estagio para iniciar o ranking {trainerPossessive}. Depois voce recebe 1000 coins para abrir caixas.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {starterStageFlow.map((stage, stageIndex) => {
                  const stageNumber = stageIndex + 1;
                  const isCurrent = stageNumber === starterStep;
                  const hasSelection = selectedStarterByStage[stage.stageKey].length > 0;
                  return (
                    <button
                      key={stage.stageKey}
                      type="button"
                      onClick={() => setStarterStep(stageNumber as 1 | 2 | 3)}
                      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                        isCurrent
                          ? "border-cyan-300/70 bg-cyan-500/20 text-cyan-100"
                          : hasSelection
                            ? "border-emerald-300/60 bg-emerald-500/15 text-emerald-100"
                            : "border-slate-700/70 bg-slate-900/75 text-slate-300 hover:border-slate-500/70"
                      }`}
                    >
                      Etapa {stageNumber}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4">
              {starterChoicesQuery.isLoading ? (
                <div className="grid min-h-[160px] place-items-center rounded-xl border border-slate-700/70 bg-slate-900/70 p-4 text-sm text-slate-300">
                  Carregando opcoes...
                </div>
              ) : starterChoicesQuery.isError ? (
                <div className="grid gap-3 rounded-xl border border-red-400/35 bg-red-500/10 p-4">
                  <small className="text-sm text-red-100">Nao foi possivel listar os pokemons iniciais agora.</small>
                  <button
                    type="button"
                    className={PrimaryButtonClass}
                    onClick={() => {
                      void starterChoicesQuery.refetch();
                    }}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <>
                  <div className="hidden max-h-[66vh] gap-4 overflow-y-auto pr-1 sm:grid">
                    {starterStageFlow.map((stage) => (
                      <section key={stage.stageKey} className="grid gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="grid">
                            <strong className="text-slate-100">{stage.title}</strong>
                            <small className="text-slate-400">{stage.subtitle}</small>
                          </div>
                          <small className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                            Escolha 1/{stage.choices.length}
                          </small>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          {stage.choices.map((species) => {
                            const isSelected = selectedStarterByStage[stage.stageKey].trim().toLowerCase() === species.name.trim().toLowerCase();
                            return (
                              <button
                                key={species.id}
                                type="button"
                                className={`relative grid min-h-[164px] overflow-hidden rounded-xl border text-left transition ${
                                  isSelected
                                    ? "border-cyan-300/70 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                                    : "border-slate-700/70 bg-slate-900/80 hover:border-cyan-300/50 hover:bg-slate-800/90 hover:shadow-[0_0_16px_rgba(34,211,238,0.18)]"
                                }`}
                                onClick={() => HandleStarterPick(stage.stageKey, species.name)}
                              >
                                {species.imageUrl ? (
                                  <div className="absolute inset-0 grid place-items-center p-3">
                                    <img src={species.imageUrl} alt={species.name} className="h-24 w-24 max-w-full object-contain opacity-85 drop-shadow-[0_8px_20px_rgba(2,6,23,0.55)]" />
                                  </div>
                                ) : null}
                                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 to-slate-950/90" />
                                <div className="relative z-10 mt-auto grid gap-1 p-3">
                                  <span className="inline-flex w-fit rounded-full bg-slate-900/90 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                                    {species.typePrimary}
                                  </span>
                                  <strong className="capitalize text-slate-100">{species.name}</strong>
                                  <small className={isSelected ? "text-cyan-200" : "text-slate-300"}>
                                    {isSelected ? "Selecionado" : "Toque para escolher"}
                                  </small>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                  <section className="grid gap-3 rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 sm:hidden">
                    <div className="flex items-center justify-between gap-2">
                      <div className="grid">
                        <strong className="text-slate-100">{currentStarterStage.title}</strong>
                        <small className="text-slate-400">{currentStarterStage.subtitle}</small>
                      </div>
                      <small className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                        Etapa {starterStep} de 3
                      </small>
                    </div>
                    <div className="grid gap-3">
                      {currentStarterStage.choices.map((species) => {
                        const isSelected = currentStarterStageSelection.trim().toLowerCase() === species.name.trim().toLowerCase();
                        return (
                          <button
                            key={species.id}
                            type="button"
                            className={`relative grid min-h-[150px] overflow-hidden rounded-xl border text-left transition ${
                              isSelected
                                ? "border-cyan-300/70 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
                                : "border-slate-700/70 bg-slate-900/80"
                            }`}
                            onClick={() => HandleStarterPick(currentStarterStage.stageKey, species.name)}
                          >
                            {species.imageUrl ? (
                              <div className="absolute inset-0 grid place-items-center p-3">
                                <img src={species.imageUrl} alt={species.name} className="h-20 w-20 max-w-full object-contain opacity-85 drop-shadow-[0_8px_20px_rgba(2,6,23,0.55)]" />
                              </div>
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/20 to-slate-950/90" />
                            <div className="relative z-10 mt-auto grid gap-1 p-3">
                              <span className="inline-flex w-fit rounded-full bg-slate-900/90 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                                {species.typePrimary}
                              </span>
                              <strong className="capitalize text-slate-100">{species.name}</strong>
                              <small className={isSelected ? "text-cyan-200" : "text-slate-300"}>
                                {isSelected ? "Selecionado" : "Toque para escolher"}
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:hidden">
              {starterStep > 1 && !starterChoicesQuery.isLoading && !starterChoicesQuery.isError ? (
                <button type="button" className={PrimaryButtonClass} onClick={() => setStarterStep((starterStep - 1) as 1 | 2 | 3)}>
                  Voltar
                </button>
              ) : null}
              {starterStep < 3 && !starterChoicesQuery.isLoading && !starterChoicesQuery.isError ? (
                <button
                  type="button"
                  className={PrimaryButtonClass}
                  disabled={!canAdvanceStarterStep || starterChoicesQuery.isLoading || starterChoicesQuery.isError}
                  onClick={() => setStarterStep((starterStep + 1) as 1 | 2 | 3)}
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  className={`${PrimaryButtonClass} h-11`}
                  onClick={HandleStarterBundleClaim}
                  disabled={!canConfirmStarterBundle || claimStarterBundleMutation.isPending || starterChoicesQuery.isLoading || starterChoicesQuery.isError}
                >
                  {claimStarterBundleMutation.isPending ? "Confirmando time..." : "Confirmar time inicial"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {isStarterRewardModalOpen ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/70 p-4">
          <div className="grid w-full max-w-md gap-4 rounded-2xl bg-slate-900 p-5 ring-1 ring-inset ring-slate-700/80">
            <h3 className="text-xl font-semibold text-slate-100">Parabens, Treinador</h3>
            <p className="text-sm text-slate-300">Voce ganhou 1000 coins para gastar com caixas.</p>
            <button
              type="button"
              className={PrimaryButtonClass}
              onClick={() => {
                setIsStarterRewardModalOpen(false);
                router.push("/boxes");
              }}
            >
              Confirmar e ir para Caixas
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
