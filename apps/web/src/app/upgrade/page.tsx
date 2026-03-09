"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";
import { useToast } from "../../providers/toast-provider";

type UserPokemon = {
  id: string;
  level: number;
  isLegacy?: boolean;
  species: {
    id: string;
    name: string;
    imageUrl?: string | null;
    dropRarity?: string | null;
    pokeApiId?: number | null;
    baseHp: number;
    baseAtk: number;
    baseDef: number;
    baseSpeed: number;
  };
};

type Species = {
  id: string;
  name: string;
  imageUrl?: string | null;
  dropRarity?: string | null;
  pokeApiId?: number | null;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
};

type UpgradeResponse = {
  success: boolean;
  chancePercent: number;
  rollPercent: number;
  sourceCount: number;
  sources: Array<{
    id: string;
    name: string;
    rarity: string;
    level: number;
  }>;
  target: {
    id: string;
    name: string;
    rarity: string;
  };
  targetPool?: string[];
  reward: {
    id: string;
    level: number;
    species: {
      name: string;
    };
  } | null;
};

const NavLinkClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const PanelClass = "rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-[0_14px_40px_rgba(2,6,23,0.45)]";
const SourcesPerPage = 15;
const TargetsPerPage = 15;
const MultiplierOptions = [1.5, 2, 5, 10];
const MinSelectedSources = 2;
const MaxSelectedSources = 15;
const TargetRarityOptions = ["all", "common", "uncommon", "rare", "epic", "legendary"] as const;
const TargetRarityUiMap: Record<(typeof TargetRarityOptions)[number], { label: string; barColor: string }> = {
  all: { label: "Todas", barColor: "transparent" },
  common: { label: "Comum", barColor: "rgb(163, 163, 163)" },
  uncommon: { label: "Incomum", barColor: "rgb(153, 170, 255)" },
  rare: { label: "Raro", barColor: "rgb(75, 105, 255)" },
  epic: { label: "Epico", barColor: "rgb(129, 72, 234)" },
  legendary: { label: "Lendario", barColor: "rgb(255, 203, 119)" }
};

type RollStatusTone = {
  pointerClass: string;
  outerRingClass: string;
  innerRingClass: string;
  centerClass: string;
  valueClass: string;
  statusClass: string;
  baseStroke: string;
  activeStroke: string;
};

function BuildRequestId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function NormalizeRarity(dropRarity?: string | null, pokeApiId?: number | null) {
  const safeValue = (dropRarity ?? "").trim().toLowerCase();
  const explicitRarity =
    safeValue === "legendary" || safeValue === "epic" || safeValue === "rare" || safeValue === "uncommon" || safeValue === "common"
      ? safeValue
      : "common";
  let derivedRarity = "common";
  if (typeof pokeApiId === "number" && Number.isFinite(pokeApiId)) {
    if (pokeApiId >= 821) derivedRarity = "legendary";
    else if (pokeApiId >= 616) derivedRarity = "epic";
    else if (pokeApiId >= 411) derivedRarity = "rare";
    else if (pokeApiId >= 206) derivedRarity = "uncommon";
  }
  return GetRarityScore(derivedRarity) > GetRarityScore(explicitRarity) ? derivedRarity : explicitRarity;
}

function GetRarityScore(rarity: string) {
  if (rarity === "legendary") return 5;
  if (rarity === "epic") return 4;
  if (rarity === "rare") return 3;
  if (rarity === "uncommon") return 2;
  return 1;
}

function BuildRarityToneClass(rarity: string) {
  if (rarity === "legendary") {
    return "border-amber-300/60 bg-amber-500/15 text-amber-100";
  }
  if (rarity === "epic") {
    return "border-fuchsia-300/60 bg-fuchsia-500/15 text-fuchsia-100";
  }
  if (rarity === "rare") {
    return "border-cyan-300/60 bg-cyan-500/15 text-cyan-100";
  }
  if (rarity === "uncommon") {
    return "border-emerald-300/60 bg-emerald-500/15 text-emerald-100";
  }
  return "border-slate-500/60 bg-slate-700/60 text-slate-100";
}

function BuildPowerAtLevel(
  rarity: string,
  level: number,
  stats: { baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }
) {
  return stats.baseHp + stats.baseAtk + stats.baseDef + stats.baseSpeed + level * 4 + GetRarityScore(rarity) * 60;
}

function BuildUpgradeChancePercent(
  sources: Array<{ rarity: string; level: number; baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }>,
  target: { rarity: string; level: number; baseHp: number; baseAtk: number; baseDef: number; baseSpeed: number }
) {
  if (sources.length === 0) {
    return 5;
  }
  const sourceComputed = sources.map((source) => {
    const rarityScore = GetRarityScore(source.rarity);
    const powerScore = BuildPowerAtLevel(source.rarity, source.level, {
      baseHp: source.baseHp,
      baseAtk: source.baseAtk,
      baseDef: source.baseDef,
      baseSpeed: source.baseSpeed
    });
    return { ...source, rarityScore, powerScore };
  });
  const targetRarityScore = GetRarityScore(target.rarity);
  const targetPower = BuildPowerAtLevel(target.rarity, target.level, {
    baseHp: target.baseHp,
    baseAtk: target.baseAtk,
    baseDef: target.baseDef,
    baseSpeed: target.baseSpeed
  });
  const EvaluateChanceForGroup = (group: typeof sourceComputed) => {
    const sourcePowerAverage = group.reduce((sum, source) => sum + source.powerScore, 0) / Math.max(1, group.length);
    const sourceRarityAverage = group.reduce((sum, source) => sum + source.rarityScore, 0) / Math.max(1, group.length);
    const sourceLevelAverage = group.reduce((sum, source) => sum + source.level, 0) / Math.max(1, group.length);
    const powerRatio = sourcePowerAverage / Math.max(1, targetPower);
    const powerScore = powerRatio * 45;
    const rarityDelta = targetRarityScore - sourceRarityAverage;
    const rarityPenalty = rarityDelta > 0 ? rarityDelta * 14 : rarityDelta * 6;
    const levelBonus = Math.min(8, Math.max(0, sourceLevelAverage / 6));
    const quantityBonus = Math.min(12, Math.max(0, (group.length - 2) * 2));
    const nearTierCount = group.filter((source) => source.rarityScore >= targetRarityScore - 1).length;
    const synergyBonus = Math.min(10, nearTierCount * 1.5);
    const epicToLegendBoost = targetRarityScore >= 5 && sourceRarityAverage >= 3.5 ? 6 : 0;
    const downgradeBonus = rarityDelta < 0 ? Math.min(10, Math.abs(rarityDelta) * 4) : 0;
    let rawChance = 4 + powerScore - Math.max(0, rarityPenalty) + levelBonus + quantityBonus + synergyBonus + epicToLegendBoost + downgradeBonus;
    if (rarityDelta >= 3) {
      rawChance = Math.min(rawChance, 18);
    } else if (rarityDelta >= 2) {
      rawChance = Math.min(rawChance, 35);
    } else if (rarityDelta >= 1) {
      rawChance = Math.min(rawChance, 48);
    }
    if (targetRarityScore >= 5 && sourceRarityAverage < 3) {
      rawChance = Math.min(rawChance, 30);
    }
    return Math.max(1, Math.min(85, rawChance));
  };

  const sortedByStrength = [...sourceComputed].sort((left, right) => right.powerScore - left.powerScore);
  let bestChance = EvaluateChanceForGroup(sortedByStrength.slice(0, Math.min(2, sortedByStrength.length)));
  for (let index = 2; index <= sortedByStrength.length; index += 1) {
    const candidateChance = EvaluateChanceForGroup(sortedByStrength.slice(0, index));
    if (candidateChance > bestChance) {
      bestChance = candidateChance;
    }
  }
  return bestChance;
}

function BuildRollStatusTone(status: string, rolling: boolean): RollStatusTone {
  if (status === "SUCESSO") {
    return {
      pointerClass: "border-b-emerald-300",
      outerRingClass: "border-emerald-300/45 shadow-[0_0_26px_rgba(16,185,129,0.2)]",
      innerRingClass: "border-emerald-300/30",
      centerClass: "border-emerald-300/55 bg-emerald-950/35",
      valueClass: "text-emerald-100",
      statusClass: "text-emerald-200",
      baseStroke: "rgba(52,211,153,0.22)",
      activeStroke: "rgba(52,211,153,0.84)"
    };
  }
  if (status === "PERDEU" || status === "ERRO") {
    return {
      pointerClass: "border-b-rose-300",
      outerRingClass: "border-rose-300/45 shadow-[0_0_26px_rgba(244,63,94,0.2)]",
      innerRingClass: "border-rose-300/30",
      centerClass: "border-rose-300/55 bg-rose-950/35",
      valueClass: "text-rose-100",
      statusClass: "text-rose-200",
      baseStroke: "rgba(251,113,133,0.24)",
      activeStroke: "rgba(251,113,133,0.85)"
    };
  }
  if (rolling || status === "ROLANDO") {
    return {
      pointerClass: "border-b-amber-300",
      outerRingClass: "border-amber-300/45 shadow-[0_0_28px_rgba(251,191,36,0.26)]",
      innerRingClass: "border-cyan-300/35",
      centerClass: "border-amber-300/55 bg-slate-950/80",
      valueClass: "text-amber-100",
      statusClass: "text-amber-200",
      baseStroke: "rgba(125,211,252,0.24)",
      activeStroke: "rgba(251,191,36,0.88)"
    };
  }
  return {
    pointerClass: "border-b-cyan-300",
    outerRingClass: "border-cyan-300/40 shadow-[0_0_24px_rgba(56,189,248,0.18)]",
    innerRingClass: "border-slate-500/45",
    centerClass: "border-cyan-300/45 bg-slate-950/80",
    valueClass: "text-cyan-100",
    statusClass: "text-cyan-200",
    baseStroke: "rgba(148,163,184,0.3)",
    activeStroke: "rgba(56,189,248,0.8)"
  };
}

function BuildRollStatusBadgeClass(status: string) {
  if (status === "SUCESSO") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-300/35";
  }
  if (status === "PERDEU" || status === "ERRO") {
    return "bg-rose-500/15 text-rose-200 ring-rose-300/35";
  }
  if (status === "ROLANDO") {
    return "bg-amber-500/15 text-amber-200 ring-amber-300/35";
  }
  return "bg-cyan-500/15 text-cyan-200 ring-cyan-300/35";
}

export default function UpgradePage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedSourcePokemonIds, setSelectedSourcePokemonIds] = useState<string[]>([]);
  const [selectedTargetSpeciesNames, setSelectedTargetSpeciesNames] = useState<string[]>([]);
  const [sourceSearchTerm, setSourceSearchTerm] = useState("");
  const [targetSearchTerm, setTargetSearchTerm] = useState("");
  const [sourcePage, setSourcePage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);
  const [selectedMultiplier, setSelectedMultiplier] = useState(2);
  const [targetShowSelectedOnly, setTargetShowSelectedOnly] = useState(false);
  const [targetMinimumPower, setTargetMinimumPower] = useState(0);
  const [targetRarityFilter, setTargetRarityFilter] = useState<(typeof TargetRarityOptions)[number]>("all");
  const [targetSortByPowerDesc, setTargetSortByPowerDesc] = useState(false);
  const [targetRarityMenuOpen, setTargetRarityMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fxEnabled, setFxEnabled] = useState(true);
  const [isRolling, setIsRolling] = useState(false);
  const [ringRotationDeg, setRingRotationDeg] = useState(0);
  const [rollingChancePercent, setRollingChancePercent] = useState(0);
  const [rollStatusLabel, setRollStatusLabel] = useState("AGUARDANDO");
  const [lastResult, setLastResult] = useState<UpgradeResponse | null>(null);
  const spinIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceGridRef = useRef<HTMLDivElement | null>(null);
  const targetGridRef = useRef<HTMLDivElement | null>(null);
  const targetRarityMenuRef = useRef<HTMLDivElement | null>(null);
  const myPokemonsQuery = useQuery({
    queryKey: ["myPokemonsForUpgrade"],
    queryFn: () => ApiFetch<UserPokemon[]>("/pokemon/my")
  });
  const speciesQuery = useQuery({
    queryKey: ["speciesForUpgrade"],
    queryFn: () => ApiFetch<Species[]>("/pokemon/species")
  });
  const upgradeMutation = useMutation({
    mutationFn: (payload: { sourcePokemonIds: string[]; targetSpeciesNames: string[]; requestId: string }) =>
      ApiFetch<UpgradeResponse>("/progression/upgrade", {
        method: "POST",
        body: JSON.stringify(payload)
      })
  });

  const StopSpinLoop = () => {
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  };

  const GetAudioContext = () => {
    if (!soundEnabled || typeof window === "undefined") {
      return null;
    }
    const ContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextClass) {
      return null;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new ContextClass();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const PlayTickSound = () => {
    const audioContext = GetAudioContext();
    if (!audioContext) {
      return;
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(820, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.055);
  };

  const PlaySuccessSound = () => {
    const audioContext = GetAudioContext();
    if (!audioContext) {
      return;
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(430, now);
    oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.26);
  };

  const PlayFailSound = () => {
    const audioContext = GetAudioContext();
    if (!audioContext) {
      return;
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.26);
  };

  useEffect(() => {
    return () => {
      StopSpinLoop();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!targetRarityMenuRef.current) {
        return;
      }
      if (targetRarityMenuRef.current.contains(event.target as Node)) {
        return;
      }
      setTargetRarityMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const activePokemons = useMemo(() => (myPokemonsQuery.data ?? []).filter((pokemon) => !pokemon.isLegacy), [myPokemonsQuery.data]);
  const duplicateCountBySpeciesId = useMemo(() => {
    const map = new Map<string, number>();
    for (const pokemon of activePokemons) {
      map.set(pokemon.species.id, (map.get(pokemon.species.id) ?? 0) + 1);
    }
    return map;
  }, [activePokemons]);

  const sourceCandidates = useMemo(() => {
    const normalizedSearch = sourceSearchTerm.trim().toLowerCase();
    return [...activePokemons]
      .filter((pokemon) => (normalizedSearch ? pokemon.species.name.toLowerCase().includes(normalizedSearch) : true))
      .sort((left, right) => {
        const leftDuplicates = duplicateCountBySpeciesId.get(left.species.id) ?? 0;
        const rightDuplicates = duplicateCountBySpeciesId.get(right.species.id) ?? 0;
        if (rightDuplicates !== leftDuplicates) {
          return rightDuplicates - leftDuplicates;
        }
        if (right.level !== left.level) {
          return right.level - left.level;
        }
        return left.species.name.localeCompare(right.species.name);
      });
  }, [activePokemons, duplicateCountBySpeciesId, sourceSearchTerm]);

  const sourceTotalPages = Math.max(1, Math.ceil(sourceCandidates.length / SourcesPerPage));
  const paginatedSource = useMemo(() => {
    const startIndex = (sourcePage - 1) * SourcesPerPage;
    return sourceCandidates.slice(startIndex, startIndex + SourcesPerPage);
  }, [sourceCandidates, sourcePage]);

  const sourcePokemonById = useMemo(() => {
    const map = new Map<string, UserPokemon>();
    for (const pokemon of sourceCandidates) {
      map.set(pokemon.id, pokemon);
    }
    return map;
  }, [sourceCandidates]);

  const selectedSourcePokemons = useMemo(
    () => selectedSourcePokemonIds.map((pokemonId) => sourcePokemonById.get(pokemonId)).filter((pokemon): pokemon is UserPokemon => Boolean(pokemon)),
    [selectedSourcePokemonIds, sourcePokemonById]
  );

  const selectedSourceSpeciesIds = useMemo(() => new Set(selectedSourcePokemons.map((pokemon) => pokemon.species.id)), [selectedSourcePokemons]);
  const canRoll = selectedSourcePokemons.length >= MinSelectedSources && selectedSourcePokemons.length <= MaxSelectedSources;
  const rollStatusTone = useMemo(() => BuildRollStatusTone(rollStatusLabel, isRolling), [rollStatusLabel, isRolling]);
  const rollStatusBadgeClass = useMemo(() => BuildRollStatusBadgeClass(rollStatusLabel), [rollStatusLabel]);

  const targetCandidatesBase = useMemo(() => {
    const normalizedSearch = targetSearchTerm.trim().toLowerCase();
    const minimumPower = Number.isFinite(targetMinimumPower) ? Math.max(0, targetMinimumPower) : 0;
    const selectedNameSet = new Set(selectedTargetSpeciesNames);
    return (speciesQuery.data ?? [])
      .filter((species) => (normalizedSearch ? species.name.toLowerCase().includes(normalizedSearch) : true))
      .filter((species) => {
        if (targetRarityFilter === "all") {
          return true;
        }
        const rarity = NormalizeRarity(species.dropRarity, species.pokeApiId);
        return rarity === targetRarityFilter;
      })
      .filter((species) => species.baseHp + species.baseAtk + species.baseDef + species.baseSpeed >= minimumPower)
      .filter((species) => (targetShowSelectedOnly ? selectedNameSet.has(species.name) : true));
  }, [speciesQuery.data, targetSearchTerm, targetRarityFilter, targetMinimumPower, targetShowSelectedOnly, selectedTargetSpeciesNames]);

  const targetCandidates = useMemo(() => {
    return [...targetCandidatesBase].sort((left, right) => {
      if (targetSortByPowerDesc) {
        const leftPowerRaw = left.baseHp + left.baseAtk + left.baseDef + left.baseSpeed;
        const rightPowerRaw = right.baseHp + right.baseAtk + right.baseDef + right.baseSpeed;
        if (rightPowerRaw !== leftPowerRaw) {
          return rightPowerRaw - leftPowerRaw;
        }
      }
      return left.name.localeCompare(right.name);
    });
  }, [targetCandidatesBase, targetSortByPowerDesc]);

  const targetTotalPages = Math.max(1, Math.ceil(targetCandidates.length / TargetsPerPage));
  const paginatedTargets = useMemo(() => {
    const startIndex = (targetPage - 1) * TargetsPerPage;
    return targetCandidates.slice(startIndex, startIndex + TargetsPerPage);
  }, [targetCandidates, targetPage]);

  const targetSpeciesByName = useMemo(() => {
    const map = new Map<string, Species>();
    for (const species of speciesQuery.data ?? []) {
      map.set(species.name, species);
    }
    return map;
  }, [speciesQuery.data]);
  const selectedTargetSpecies = useMemo(
    () =>
      selectedTargetSpeciesNames
        .map((name) => targetSpeciesByName.get(name))
        .filter((species): species is Species => Boolean(species)),
    [selectedTargetSpeciesNames, targetSpeciesByName]
  );
  const sourceLevelAverageForDisplay = useMemo(() => {
    if (selectedSourcePokemons.length === 0) {
      return 1;
    }
    return Math.max(1, Math.round(selectedSourcePokemons.reduce((sum, pokemon) => sum + pokemon.level, 0) / selectedSourcePokemons.length));
  }, [selectedSourcePokemons]);
  const sourcePowerTotal = useMemo(() => {
    return selectedSourcePokemons.reduce((sum, pokemon) => {
      const rarity = NormalizeRarity(pokemon.species.dropRarity, pokemon.species.pokeApiId);
      return (
        sum +
        BuildPowerAtLevel(rarity, pokemon.level, {
          baseHp: pokemon.species.baseHp,
          baseAtk: pokemon.species.baseAtk,
          baseDef: pokemon.species.baseDef,
          baseSpeed: pokemon.species.baseSpeed
        })
      );
    }, 0);
  }, [selectedSourcePokemons]);
  const targetPowerTotal = useMemo(() => {
    return selectedTargetSpecies.reduce((sum, species) => {
      const rarity = NormalizeRarity(species.dropRarity, species.pokeApiId);
      return (
        sum +
        BuildPowerAtLevel(rarity, sourceLevelAverageForDisplay, {
          baseHp: species.baseHp,
          baseAtk: species.baseAtk,
          baseDef: species.baseDef,
          baseSpeed: species.baseSpeed
        })
      );
    }, 0);
  }, [selectedTargetSpecies, sourceLevelAverageForDisplay]);
  const targetMultiplierDisplay = sourcePowerTotal > 0 ? targetPowerTotal / sourcePowerTotal : 0;
  const chanceStrokeOffset = useMemo(() => {
    const safeChance = Math.max(0, Math.min(100, rollingChancePercent));
    const circumference = 313.7;
    return circumference - (safeChance / 100) * circumference;
  }, [rollingChancePercent]);

  const predictedChancePercent = useMemo(() => {
    if (selectedSourcePokemons.length < MinSelectedSources || selectedTargetSpecies.length === 0) {
      return 0;
    }
    const sourceLevelAverage = Math.max(
      1,
      Math.round(selectedSourcePokemons.reduce((sum, pokemon) => sum + pokemon.level, 0) / selectedSourcePokemons.length)
    );
    const sourceStats = selectedSourcePokemons.map((pokemon) => ({
      rarity: NormalizeRarity(pokemon.species.dropRarity, pokemon.species.pokeApiId),
      level: pokemon.level,
      baseHp: pokemon.species.baseHp,
      baseAtk: pokemon.species.baseAtk,
      baseDef: pokemon.species.baseDef,
      baseSpeed: pokemon.species.baseSpeed
    }));
    const avgChance =
      selectedTargetSpecies.reduce((sum, target) => {
        const targetRarity = NormalizeRarity(target.dropRarity, target.pokeApiId);
        return (
          sum +
          BuildUpgradeChancePercent(sourceStats, {
            rarity: targetRarity,
            level: sourceLevelAverage,
            baseHp: target.baseHp,
            baseAtk: target.baseAtk,
            baseDef: target.baseDef,
            baseSpeed: target.baseSpeed
          })
        );
      }, 0) / Math.max(1, selectedTargetSpecies.length);
    return avgChance;
  }, [selectedSourcePokemons, selectedTargetSpecies]);

  useEffect(() => {
    setSelectedSourcePokemonIds((currentIds) => {
      const nextIds = currentIds.filter((pokemonId) => sourcePokemonById.has(pokemonId)).slice(0, MaxSelectedSources);
      if (nextIds.length === currentIds.length && nextIds.every((pokemonId, index) => pokemonId === currentIds[index])) {
        return currentIds;
      }
      return nextIds;
    });
  }, [sourcePokemonById]);

  useEffect(() => {
    setSelectedTargetSpeciesNames((currentNames) => {
      const nextNames = currentNames.filter((name) => targetSpeciesByName.has(name)).slice(0, MaxSelectedSources);
      if (nextNames.length === currentNames.length && nextNames.every((name, index) => name === currentNames[index])) {
        return currentNames;
      }
      return nextNames;
    });
  }, [targetSpeciesByName]);

  useEffect(() => {
    setSourcePage((currentPage) => Math.min(currentPage, sourceTotalPages));
  }, [sourceTotalPages]);

  useEffect(() => {
    setTargetPage((currentPage) => Math.min(currentPage, targetTotalPages));
  }, [targetTotalPages]);

  useEffect(() => {
    setSourcePage(1);
  }, [sourceSearchTerm]);

  useEffect(() => {
    setTargetPage(1);
  }, [
    targetSearchTerm,
    selectedTargetSpeciesNames,
    targetRarityFilter,
    targetMinimumPower,
    targetShowSelectedOnly,
    targetSortByPowerDesc
  ]);

  useEffect(() => {
    if (sourceGridRef.current) {
      sourceGridRef.current.scrollTo({ top: 0 });
    }
  }, [sourcePage]);

  useEffect(() => {
    if (targetGridRef.current) {
      targetGridRef.current.scrollTo({ top: 0 });
    }
  }, [targetPage]);

  useEffect(() => {
    setRollingChancePercent(predictedChancePercent);
  }, [predictedChancePercent]);

  const HandleUpgradeRoll = async () => {
    if (!canRoll || selectedTargetSpecies.length === 0 || isRolling) {
      return;
    }
    setIsRolling(true);
    setLastResult(null);
    setRollStatusLabel("ROLANDO");
    const startedAt = Date.now();
    StopSpinLoop();
    spinIntervalRef.current = window.setInterval(() => {
      setRingRotationDeg((currentValue) => currentValue + 19);
      setRollingChancePercent((previousValue) => {
        const base = Math.max(1, predictedChancePercent);
        const next = base + (Math.random() - 0.5) * 9;
        return Math.max(1, Math.min(99, next || previousValue));
      });
      if (fxEnabled) {
        PlayTickSound();
      }
    }, 90);
    try {
      const payload = await upgradeMutation.mutateAsync({
        sourcePokemonIds: selectedSourcePokemons.map((pokemon) => pokemon.id),
        targetSpeciesNames: selectedTargetSpecies.map((species) => species.name),
        requestId: BuildRequestId()
      });
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, 2600 - elapsedMs);
      if (remainingMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remainingMs));
      }
      StopSpinLoop();
      setIsRolling(false);
      setLastResult(payload);
      setRollingChancePercent(payload.chancePercent);
      setRingRotationDeg((currentValue) => currentValue + 220);
      if (payload.success) {
        setRollStatusLabel("SUCESSO");
        if (fxEnabled) {
          PlaySuccessSound();
        }
        addToast({
          title: "Melhoramento concluido",
          message: `${payload.sources.map((item) => item.name).join(" + ")} virou ${payload.target.name}.`,
          tone: "success"
        });
      } else {
        setRollStatusLabel("PERDEU");
        if (fxEnabled) {
          PlayFailSound();
        }
        addToast({
          title: "Melhoramento falhou",
          message: `Roll ${payload.rollPercent.toFixed(2)}% nao passou.`,
          tone: "error"
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["myPokemonsForUpgrade"] });
      void queryClient.invalidateQueries({ queryKey: ["myPokemons"] });
      void queryClient.invalidateQueries({ queryKey: ["myPokemonsForDashboardNotifications"] });
      void queryClient.invalidateQueries({ queryKey: ["myChampions"] });
      void queryClient.invalidateQueries({ queryKey: ["myChampionsForPool"] });
    } catch (error) {
      StopSpinLoop();
      setIsRolling(false);
      setRollStatusLabel("ERRO");
      if (fxEnabled) {
        PlayFailSound();
      }
      addToast({
        title: "Falha no melhoramento",
        message: error instanceof Error ? error.message : "Erro inesperado.",
        tone: "error"
      });
    }
  };

  return (
    <>
      <main className="relative z-[19] mx-auto grid min-h-screen w-full max-w-7xl gap-3 px-3 py-3 sm:px-4">
        <section className={`${PanelClass} overflow-hidden`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-bold uppercase tracking-wide text-slate-100">Melhoramento</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset transition ${
                  soundEnabled
                    ? "bg-slate-800/95 text-slate-100 ring-cyan-300/40 hover:bg-slate-700/95"
                    : "bg-slate-900/85 text-slate-400 ring-slate-600/70 hover:bg-slate-800/95"
                }`}
                onClick={() => setSoundEnabled((currentValue) => !currentValue)}
              >
                <svg className="h-5 w-5" viewBox="0 0 16 12" fill="none">
                  <path
                    d="M3.9 8.66H1.33A.67.67 0 0 1 .66 8V4c0-.37.3-.67.67-.67H3.9L7.45.45A.66.66 0 0 1 8 .7v10.6a.67.67 0 0 1-.55.66.65.65 0 0 1-.54-.12L3.92 8.67Z"
                    fill="currentColor"
                  />
                  <path d="M10.4 9.06 9.46 8.1A2.7 2.7 0 0 0 10.67 6c0-.95-.5-1.8-1.25-2.26l.96-.96A4 4 0 0 1 12 6a4 4 0 0 1-1.6 3.06Z" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset transition ${
                  fxEnabled
                    ? "bg-slate-800/95 text-slate-100 ring-amber-300/40 hover:bg-slate-700/95"
                    : "bg-slate-900/85 text-slate-400 ring-slate-600/70 hover:bg-slate-800/95"
                }`}
                onClick={() => setFxEnabled((currentValue) => !currentValue)}
              >
                <svg className="h-5 w-5" viewBox="0 0 12 16" fill="none">
                  <path d="M6.67 6.66h4.66L5.33 15.33V9.33H.67L6.67.67v6Z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
          <nav className="TopNavScroll min-w-0 max-w-full">
            <Link className={NavLinkClass} href="/dashboard">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5.5 9.5V20h13V9.5" />
                  <path d="M10 20v-5h4v5" />
                </svg>
              </span>
              Dashboard
            </Link>
            <Link className={NavLinkClass} href="/pokemon">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                  <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z" />
                  <path d="M3 12h18" />
                  <circle cx="12" cy="12" r="2.2" />
                </svg>
              </span>
              Pokemons
            </Link>
            <Link className={NavLinkClass} href="/boxes">
              <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
                  <path d="M4 8l8-4 8 4-8 4-8-4z" />
                  <path d="M4 8v8l8 4 8-4V8" />
                </svg>
              </span>
              Caixas
            </Link>
          </nav>
        </section>

        <section className={`${PanelClass} grid min-w-0 gap-3 lg:grid-cols-[1fr_300px_1fr]`}>
          <article className="grid min-w-0 gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
            <small className="text-[11px] font-semibold uppercase text-slate-400">Origem</small>
            {selectedSourcePokemons.length > 0 ? (
              <>
                <div
                  className="grid h-[116px] w-full items-center justify-center gap-1 rounded-lg bg-slate-950/35 p-2"
                  style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, selectedSourcePokemons.length))}, minmax(0, 1fr))` }}
                >
                  {selectedSourcePokemons.map((pokemon) => (
                    <button
                      key={pokemon.id}
                      type="button"
                      onClick={() => {
                        setSelectedSourcePokemonIds((currentIds) => currentIds.filter((currentId) => currentId !== pokemon.id));
                      }}
                      aria-label={`Remover ${pokemon.species.name} da origem`}
                      className="relative h-full w-full rounded-md bg-slate-900/70 transition hover:ring-1 hover:ring-rose-300/60"
                    >
                      {pokemon.species.imageUrl ? (
                        <img
                          src={pokemon.species.imageUrl}
                          alt={pokemon.species.name}
                          className="absolute left-0 top-0 block h-full w-full object-contain transition-all duration-150"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-[10px] font-bold text-slate-400">PK</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2 text-center md:flex-row md:text-left">
                  <div className="pr-1">
                    <p className="text-sm font-bold leading-tight text-white md:text-base lg:text-lg">{selectedSourcePokemons.length} Itens</p>
                    <p className="text-xs font-medium leading-tight text-slate-400 sm:text-sm">que deseja melhorar</p>
                  </div>
                  <div className="rounded-lg bg-slate-900 px-4 py-2 text-center md:ml-auto md:text-right">
                    <div className="text-xs font-bold leading-none text-white sm:text-sm">PWR {sourcePowerTotal.toLocaleString("pt-BR")}</div>
                    <div className="text-[11px] font-bold leading-none text-amber-300">+{predictedChancePercent.toFixed(2)}%</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-600 p-2 text-xs text-slate-300">Selecione de 2 ate 15 pokemons para melhorar.</div>
            )}
          </article>

          <article className="grid min-w-0 content-start gap-3 rounded-xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-700/70">
            <div id="upgraderResult" className="z-10 mx-auto flex w-full max-w-[280px] select-none flex-col items-center rounded-xl bg-slate-900/90 p-3 ring-1 ring-inset ring-slate-700/70">
              <div className="relative grid h-56 w-56 shrink-0 place-items-center">
                <div className={`pointer-events-none absolute inset-0 rounded-full ${isRolling ? "upgradeCasinoHaloSpinning" : "upgradeCasinoHaloIdle"}`} />
                <div className={`absolute left-1/2 top-1 z-10 h-0 w-0 -translate-x-1/2 border-x-[8px] border-b-[13px] border-x-transparent ${rollStatusTone.pointerClass}`} />
                <div className="absolute inset-1 rounded-full border border-slate-700/80" />
                <div className="absolute inset-5 rounded-full border border-slate-700/70" />
                <svg
                  viewBox="0 0 100 100"
                  className={`absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-full transition-transform duration-700 ${isRolling ? "upgradeRingSpinning" : ""}`}
                  style={{ transform: `rotate(${ringRotationDeg - 450}deg)` }}
                >
                  <circle cx="50" cy="50" r="49" fill="none" strokeWidth="2.8" stroke="rgba(148,163,184,0.25)" />
                  <circle cx="50" cy="50" r="49" fill="none" strokeWidth="4" strokeDasharray="313.7 313.7" strokeDashoffset={chanceStrokeOffset} stroke="#CCA25F" />
                </svg>
                <div
                  className={`relative grid h-36 w-36 place-items-center rounded-full border text-center ${rollStatusTone.centerClass} ${
                    fxEnabled && lastResult?.success ? "upgradeSuccessPulse" : ""
                  } ${fxEnabled && lastResult && !lastResult.success ? "upgradeFailPulse" : ""}`}
                >
                  <div className="grid gap-1 px-2">
                    <div className="text-3xl font-bold leading-none text-white">{rollingChancePercent.toFixed(2)}%</div>
                    <div className="text-[11px] font-medium leading-none text-slate-400">Chance de melhoramento</div>
                    <span className={`mx-auto inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${rollStatusBadgeClass}`}>
                      {rollStatusLabel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid w-full grid-cols-3 gap-1.5 text-center text-[10px]">
                <div className="rounded-md bg-slate-950/65 p-1.5 ring-1 ring-inset ring-slate-700/80">
                  <div className="font-semibold text-slate-400">Origem</div>
                  <div className="font-bold text-white">{selectedSourcePokemons.length}</div>
                </div>
                <div className="rounded-md bg-slate-950/65 p-1.5 ring-1 ring-inset ring-slate-700/80">
                  <div className="font-semibold text-slate-400">Alvo</div>
                  <div className="font-bold text-white">{selectedTargetSpecies.length}</div>
                </div>
                <div className="rounded-md bg-slate-950/65 p-1.5 ring-1 ring-inset ring-slate-700/80">
                  <div className="font-semibold text-slate-400">PWR</div>
                  <div className="font-bold text-amber-200">{sourcePowerTotal.toLocaleString("pt-BR")}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${rollStatusBadgeClass}`}>
                Media {predictedChancePercent.toFixed(2)}% | Mult {targetMultiplierDisplay.toFixed(2)}x
              </span>
            </div>
          </article>

          <article className="grid min-w-0 gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
            <small className="text-[11px] font-semibold uppercase text-slate-400">Alvo</small>
            {selectedTargetSpecies.length > 0 ? (
              <>
                <div
                  className="grid h-[116px] w-full items-center justify-center gap-1 rounded-lg bg-slate-950/35 p-2"
                  style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(1, selectedTargetSpecies.length))}, minmax(0, 1fr))` }}
                >
                  {selectedTargetSpecies.map((species) => (
                    <button
                      key={species.id}
                      type="button"
                      onClick={() => {
                        setSelectedTargetSpeciesNames((currentNames) => currentNames.filter((currentName) => currentName !== species.name));
                      }}
                      aria-label={`Remover ${species.name} do alvo`}
                      className="relative h-full w-full rounded-md bg-slate-900/70 transition hover:ring-1 hover:ring-rose-300/60"
                    >
                      {species.imageUrl ? (
                        <img
                          src={species.imageUrl}
                          alt={species.name}
                          className="absolute left-0 top-0 block h-full w-full object-contain transition-all duration-150"
                        />
                      ) : (
                        <span className="grid h-full place-items-center text-[10px] font-bold text-slate-400">PK</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col items-center gap-2 text-center md:flex-row md:text-right">
                  <div className="order-2 rounded-lg bg-slate-900 px-4 py-2 text-center md:order-1 md:mr-auto md:text-left">
                    <div className="text-xs font-bold leading-none text-white sm:text-sm">PWR {targetPowerTotal.toLocaleString("pt-BR")}</div>
                    <div className="text-[11px] font-bold leading-none text-amber-300">{targetMultiplierDisplay.toFixed(2)}x</div>
                  </div>
                  <div className="order-1 pl-1 md:order-2">
                    <p className="text-sm font-bold leading-tight text-white md:text-base lg:text-lg">{selectedTargetSpecies.length} Itens</p>
                    <p className="text-xs font-medium leading-tight text-slate-400 sm:text-sm">que deseja receber</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-600 p-2 text-xs text-slate-300">Selecione uma especie alvo.</div>
            )}
          </article>
        </section>

        <section className={`${PanelClass} grid gap-3`}>
          <div className="grid gap-2 sm:grid-cols-4">
            {MultiplierOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelectedMultiplier(option)}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition ${
                  selectedMultiplier === option
                    ? "border-amber-300/60 bg-amber-500/15 text-amber-100"
                    : "border-slate-600/70 bg-slate-900/70 text-slate-300 hover:border-slate-500/70"
                }`}
              >
                {option.toFixed(1)}x
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!canRoll || selectedTargetSpecies.length === 0 || isRolling || upgradeMutation.isPending}
            onClick={HandleUpgradeRoll}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-600/70 bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 transition hover:-translate-y-px hover:border-slate-400 hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
          >
            {isRolling ? "Rolando..." : "Atualizar"}
          </button>
          <small className="text-[11px] text-slate-300">Use de 2 ate 15 pokemons na origem e ate 15 no alvo.</small>
          {lastResult ? (
            <div
              className={`grid gap-1 rounded-xl p-2 text-xs ring-1 ring-inset ${
                lastResult.success ? "bg-emerald-500/10 text-emerald-100 ring-emerald-300/35" : "bg-rose-500/10 text-rose-100 ring-rose-300/35"
              }`}
            >
              <strong>{lastResult.success ? "SUCESSO" : "PERDEU"}</strong>
              <span>Chance {lastResult.chancePercent.toFixed(2)}% | Roll {lastResult.rollPercent.toFixed(2)}%</span>
              <span>{lastResult.success ? `Premio ${lastResult.reward?.species.name ?? lastResult.target.name}` : `${lastResult.sourceCount} pokemons foram consumidos`}</span>
            </div>
          ) : null}
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <article className={PanelClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-sm text-slate-100">Seus itens</strong>
              <small className="text-xs text-slate-300">{sourceCandidates.length}</small>
            </div>
            <input
              type="text"
              value={sourceSearchTerm}
              onChange={(event) => setSourceSearchTerm(event.target.value)}
              placeholder="Buscar pokemon"
              className="mb-2 h-9 w-full rounded-lg border border-slate-600/70 bg-slate-900/70 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-400 focus:border-slate-400"
            />
            <div ref={sourceGridRef} className="grid max-h-[390px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-5">
              {paginatedSource.map((pokemon) => {
                const selectedIndex = selectedSourcePokemonIds.indexOf(pokemon.id);
                const selected = selectedIndex >= 0;
                const rarity = NormalizeRarity(pokemon.species.dropRarity, pokemon.species.pokeApiId);
                const duplicates = duplicateCountBySpeciesId.get(pokemon.species.id) ?? 0;
                return (
                  <button
                    key={pokemon.id}
                    type="button"
                    onClick={() => {
                      setSelectedSourcePokemonIds((currentIds) => {
                        const alreadySelectedIndex = currentIds.indexOf(pokemon.id);
                        if (alreadySelectedIndex >= 0) {
                          return currentIds.filter((currentId) => currentId !== pokemon.id);
                        }
                        const nextIds = [...currentIds, pokemon.id];
                        if (nextIds.length <= MaxSelectedSources) {
                          return nextIds;
                        }
                        return nextIds.slice(1);
                      });
                    }}
                    className={`group relative flex min-h-[146px] w-full select-none flex-col items-center justify-between overflow-hidden rounded-[6px] border px-1.5 pb-1.5 pt-1 text-left transition ${
                      selected
                        ? "border-cyan-300/70 bg-slate-800/92 ring-1 ring-cyan-300/35"
                        : "border-slate-700/80 bg-slate-900/78 hover:border-slate-500/80 hover:bg-slate-800/80"
                    }`}
                  >
                    <div
                      className={`pointer-events-none absolute -top-px left-0 h-5 w-full rounded-lg border-t ${
                        selected ? "border-cyan-300/80" : "border-slate-500/80"
                      }`}
                    />
                    <div className="relative z-10 flex min-h-[22px] w-full items-center">
                      <div className="ml-1 rounded-md bg-slate-900/90 px-1.5 py-1 text-[9px] font-bold uppercase text-slate-100">Lv {pokemon.level}</div>
                      <div className="ml-auto mr-1 rounded-md bg-slate-900/90 px-1.5 py-1 text-[9px] font-bold text-amber-200">
                        {selected ? `#${selectedIndex + 1}` : `x${duplicates}`}
                      </div>
                    </div>
                    <div className="relative grid h-[56px] w-full flex-none place-content-center justify-items-center sm:h-[64px]">
                      {pokemon.species.imageUrl ? (
                        <img
                          src={pokemon.species.imageUrl}
                          alt={pokemon.species.name}
                          className="pointer-events-none absolute inset-0 m-auto h-full w-auto max-w-full transform object-contain transition-all duration-500 ease-out group-hover:scale-75 group-hover:opacity-25"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">PK</span>
                      )}
                      {selected ? (
                        <div className="absolute flex h-8 w-8 scale-110 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.45)]">
                          <svg viewBox="0 0 7.1 7.1" width="24" height="24" fill="currentColor" className="h-5 w-5 text-white">
                            <path d="M3.54 0a3.55 3.55 0 10.01 7.1 3.55 3.55 0 000-7.1zm1.99 2.61L3.26 4.86a.35.35 0 01-.49.01l-1.2-1.1a.36.36 0 01-.03-.5.35.35 0 01.5-.01l.96.88L5.02 2.1a.36.36 0 01.5.5z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute flex h-8 w-8 scale-90 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100">
                          +
                        </div>
                      )}
                    </div>
                    <p className="w-full truncate px-1 text-center text-[11px] font-semibold uppercase leading-tight text-white" title={pokemon.species.name}>
                      {pokemon.species.name}
                    </p>
                    <div className="mb-1 flex w-full items-center justify-center">
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${BuildRarityToneClass(rarity)}`}>{rarity}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {sourceTotalPages > 1 ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSourcePage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={sourcePage === 1}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-800/85 px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <small className="text-[11px] font-semibold text-slate-300">
                  {sourcePage}/{sourceTotalPages}
                </small>
                <button
                  type="button"
                  onClick={() => setSourcePage((currentPage) => Math.min(sourceTotalPages, currentPage + 1))}
                  disabled={sourcePage === sourceTotalPages}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-800/85 px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            ) : null}
          </article>

          <article className={PanelClass}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-sm text-slate-100">Alvos</strong>
              <small className="text-xs text-slate-300">{targetCandidates.length}</small>
            </div>
            <div className="-ml-1 -mt-1 mb-2 flex flex-wrap justify-between sm:ml-auto sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => setTargetShowSelectedOnly((value) => !value)}
                className={`order-2 mt-1 flex h-9 items-center justify-center rounded-lg border px-3 text-center text-xs font-semibold transition sm:order-none sm:ml-2 ${
                  targetShowSelectedOnly
                    ? "border-cyan-300/70 bg-cyan-500/10 text-cyan-100"
                    : "border-slate-600/80 bg-transparent text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                Selecionadas
              </button>
              <div className="order-1 mt-1 flex h-9 w-full items-center gap-2 rounded-lg border border-slate-600/80 bg-transparent px-3 sm:order-none sm:ml-2 sm:w-[170px]">
                <svg className="h-4 w-4 flex-shrink-0 text-slate-300" viewBox="0 0 21.28 21.28" fill="none">
                  <g fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" transform="translate(-565.25 -229.25)">
                    <circle cx="8.75" cy="8.75" r="8.75" transform="translate(566 230)" />
                    <path d="M586 250l-5-5" />
                  </g>
                </svg>
                <input
                  type="text"
                  value={targetSearchTerm}
                  onChange={(event) => setTargetSearchTerm(event.target.value)}
                  placeholder="Encontrar pokemon"
                  className="w-full border-none bg-transparent p-0 text-xs font-normal text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <label className="order-3 mt-1 flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-600/80 bg-transparent px-3 text-center text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white sm:order-none sm:ml-2">
                PWR &gt;
                <input
                  type="number"
                  min={0}
                  value={targetMinimumPower}
                  onChange={(event) => setTargetMinimumPower(Math.max(0, Number(event.target.value) || 0))}
                  className="UpgradeNumberInput ml-1 h-7 w-20 rounded-lg border border-slate-600/80 bg-gradient-to-b from-slate-900 to-slate-950 px-2 text-right text-xs font-extrabold tracking-wide tabular-nums text-slate-100 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.65)] outline-none transition hover:border-slate-500 focus:border-cyan-300/70 focus:shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_12px_rgba(34,211,238,0.16)]"
                />
              </label>
              <div ref={targetRarityMenuRef} className="relative order-4 mt-1 sm:order-none sm:ml-2">
                <button
                  type="button"
                  onClick={() => setTargetRarityMenuOpen((value) => !value)}
                  className="flex h-9 items-center justify-center rounded-lg border border-slate-600/80 bg-transparent px-3 text-center text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Raridade
                </button>
                <ul
                  className={`will-change absolute right-0 z-30 mt-1 origin-top-right whitespace-nowrap rounded-lg border border-slate-600/90 bg-slate-800 py-2 text-left text-slate-200 transition-all duration-700 ease-out sm:left-0 sm:right-auto sm:origin-top-left ${
                    targetRarityMenuOpen ? "visible scale-100 opacity-100" : "invisible scale-90 opacity-0"
                  }`}
                >
                  {TargetRarityOptions.map((rarityOption) => (
                    <li key={rarityOption}>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetRarityFilter(rarityOption);
                          setTargetRarityMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-4 py-2 text-left text-[11px] uppercase leading-none transition duration-300 hover:bg-slate-700 hover:text-white ${
                          targetRarityFilter === rarityOption ? "bg-slate-700 font-bold text-white" : ""
                        }`}
                      >
                        <div
                          className="mr-2 h-3 w-0.5 flex-shrink-0"
                          style={{ backgroundColor: TargetRarityUiMap[rarityOption].barColor }}
                        />
                        {TargetRarityUiMap[rarityOption].label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => setTargetSortByPowerDesc((value) => !value)}
                className="order-5 mt-1 flex h-9 items-center justify-center rounded-lg border border-slate-600/80 bg-transparent px-3 text-center text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white sm:order-none sm:ml-2"
              >
                Poder
                <svg viewBox="0 0 7 9" width="24" height="24" fill="currentColor" className={`ml-2 h-[10px] w-[8px] transition-transform duration-300 ${targetSortByPowerDesc ? "rotate-180" : ""}`}>
                  <path d="M6.35 5.35L4.21 7.5l.14.15L4 8l-.35.35-.15-.14-.15.14-.7-.7.14-.15L.65 5.35l.7-.7L3 6.29V0h1v6.3l1.65-1.65.7.7z" />
                </svg>
              </button>
            </div>
            <div ref={targetGridRef} className="grid max-h-[390px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-5">
              {paginatedTargets.map((species) => {
                const selectedIndex = selectedTargetSpeciesNames.indexOf(species.name);
                const selected = selectedIndex >= 0;
                const rarity = NormalizeRarity(species.dropRarity, species.pokeApiId);
                const powerBase = species.baseHp + species.baseAtk + species.baseDef + species.baseSpeed;
                return (
                  <button
                    key={species.id}
                    type="button"
                    onClick={() => {
                      setSelectedTargetSpeciesNames((currentNames) => {
                        const alreadySelectedIndex = currentNames.indexOf(species.name);
                        if (alreadySelectedIndex >= 0) {
                          return currentNames.filter((name) => name !== species.name);
                        }
                        const nextNames = [...currentNames, species.name];
                        if (nextNames.length <= MaxSelectedSources) {
                          return nextNames;
                        }
                        return nextNames.slice(1);
                      });
                    }}
                    className={`group relative flex min-h-[146px] w-full select-none flex-col items-center justify-between overflow-hidden rounded-[6px] border px-1.5 pb-1.5 pt-1 text-left transition ${
                      selected
                        ? "border-cyan-300/70 bg-slate-800/92 ring-1 ring-cyan-300/35"
                        : "border-slate-700/80 bg-slate-900/78 hover:border-slate-500/80 hover:bg-slate-800/80"
                    }`}
                  >
                    <div
                      className={`pointer-events-none absolute -top-px left-0 h-5 w-full rounded-lg border-t ${
                        selected ? "border-cyan-300/80" : "border-slate-500/80"
                      }`}
                    />
                    <div className="relative z-10 flex min-h-[22px] w-full items-center">
                      <div className={`ml-1 rounded-md px-1.5 py-1 text-[9px] font-bold uppercase ${BuildRarityToneClass(rarity)}`}>{rarity}</div>
                      <div className="ml-auto mr-1 rounded-md bg-slate-900/90 px-1.5 py-1 text-[9px] font-bold text-amber-200">
                        {selected ? `#${selectedIndex + 1}` : `PWR ${powerBase}`}
                      </div>
                    </div>
                    <div className="relative grid h-[56px] w-full flex-none place-content-center justify-items-center sm:h-[64px]">
                      {species.imageUrl ? (
                        <img
                          src={species.imageUrl}
                          alt={species.name}
                          className="pointer-events-none absolute inset-0 m-auto h-full w-auto max-w-full transform object-contain transition-all duration-500 ease-out group-hover:scale-75 group-hover:opacity-25"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-400">PK</span>
                      )}
                      {selected ? (
                        <div className="absolute flex h-8 w-8 scale-110 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_14px_rgba(16,185,129,0.45)]">
                          <svg viewBox="0 0 7.1 7.1" width="24" height="24" fill="currentColor" className="h-5 w-5 text-white">
                            <path d="M3.54 0a3.55 3.55 0 10.01 7.1 3.55 3.55 0 000-7.1zm1.99 2.61L3.26 4.86a.35.35 0 01-.49.01l-1.2-1.1a.36.36 0 01-.03-.5.35.35 0 01.5-.01l.96.88L5.02 2.1a.36.36 0 01.5.5z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="absolute flex h-8 w-8 scale-90 items-center justify-center rounded-full bg-amber-500 text-base font-bold text-white opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100">
                          +
                        </div>
                      )}
                    </div>
                    <p className="w-full truncate px-1 text-center text-[11px] font-semibold uppercase leading-tight text-white" title={species.name}>
                      {species.name}
                    </p>
                    <p className="mb-1 w-full truncate px-0.5 text-center text-[10px] font-semibold uppercase leading-tight text-slate-400">ALVO</p>
                  </button>
                );
              })}
            </div>
            {targetTotalPages > 1 ? (
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setTargetPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={targetPage === 1}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-800/85 px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>
                <small className="text-[11px] font-semibold text-slate-300">
                  {targetPage}/{targetTotalPages}
                </small>
                <button
                  type="button"
                  onClick={() => setTargetPage((currentPage) => Math.min(targetTotalPages, currentPage + 1))}
                  disabled={targetPage === targetTotalPages}
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-slate-800/85 px-2.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-700/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            ) : null}
          </article>
        </section>
      </main>
      <style jsx global>{`
        @keyframes upgradeCasinoHaloPulse {
          0% {
            opacity: 0.38;
            transform: scale(0.985);
            box-shadow: 0 0 14px rgba(34, 211, 238, 0.2), 0 0 28px rgba(251, 191, 36, 0.15);
          }
          50% {
            opacity: 0.75;
            transform: scale(1);
            box-shadow: 0 0 24px rgba(34, 211, 238, 0.36), 0 0 44px rgba(251, 191, 36, 0.25);
          }
          100% {
            opacity: 0.38;
            transform: scale(0.985);
            box-shadow: 0 0 14px rgba(34, 211, 238, 0.2), 0 0 28px rgba(251, 191, 36, 0.15);
          }
        }
        @keyframes upgradeCasinoHaloSpin {
          0% {
            transform: rotate(0deg) scale(0.99);
            opacity: 0.5;
          }
          50% {
            transform: rotate(180deg) scale(1);
            opacity: 0.95;
          }
          100% {
            transform: rotate(360deg) scale(0.99);
            opacity: 0.5;
          }
        }
        @keyframes upgradeCasinoGradientSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes upgradeCenterShimmer {
          0% {
            opacity: 0.18;
          }
          50% {
            opacity: 0.42;
          }
          100% {
            opacity: 0.18;
          }
        }
        .upgradeCasinoHaloIdle {
          background: radial-gradient(circle, rgba(15, 23, 42, 0) 56%, rgba(34, 211, 238, 0.16) 74%, rgba(251, 191, 36, 0.22) 100%);
          animation: upgradeCasinoHaloPulse 1.7s ease-in-out infinite;
        }
        .upgradeCasinoHaloSpinning {
          background: conic-gradient(from 0deg, rgba(251, 191, 36, 0.1), rgba(34, 211, 238, 0.3), rgba(251, 191, 36, 0.1));
          animation: upgradeCasinoHaloSpin 1.4s linear infinite;
          filter: blur(1.5px);
        }
        .upgradeCasinoGradientIdle {
          border: 1px solid rgba(251, 191, 36, 0.24);
          background: conic-gradient(
            from 0deg,
            rgba(251, 191, 36, 0.2) 0deg 52deg,
            rgba(34, 211, 238, 0.16) 52deg 108deg,
            rgba(251, 191, 36, 0.28) 108deg 164deg,
            rgba(14, 165, 233, 0.18) 164deg 220deg,
            rgba(251, 191, 36, 0.22) 220deg 282deg,
            rgba(34, 211, 238, 0.14) 282deg 360deg
          );
          opacity: 0.55;
        }
        .upgradeCasinoGradientSpinning {
          border: 1px solid rgba(251, 191, 36, 0.34);
          background: conic-gradient(
            from 0deg,
            rgba(251, 191, 36, 0.32) 0deg 48deg,
            rgba(34, 211, 238, 0.3) 48deg 100deg,
            rgba(251, 191, 36, 0.42) 100deg 152deg,
            rgba(14, 165, 233, 0.24) 152deg 204deg,
            rgba(251, 191, 36, 0.38) 204deg 264deg,
            rgba(34, 211, 238, 0.28) 264deg 328deg,
            rgba(251, 191, 36, 0.34) 328deg 360deg
          );
          animation: upgradeCasinoGradientSpin 0.85s linear infinite;
          opacity: 0.88;
        }
        .upgradeCenterShimmerIdle {
          background: radial-gradient(circle at 50% 34%, rgba(34, 211, 238, 0.08), rgba(15, 23, 42, 0) 58%);
          animation: upgradeCenterShimmer 2.2s ease-in-out infinite;
        }
        .upgradeCenterShimmerSpinning {
          background: radial-gradient(circle at 50% 34%, rgba(251, 191, 36, 0.24), rgba(15, 23, 42, 0) 64%);
          animation: upgradeCenterShimmer 0.9s ease-in-out infinite;
        }
        @keyframes upgradeRingSpinning {
          0% {
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.32));
          }
          100% {
            filter: drop-shadow(0 0 0 rgba(251, 191, 36, 0));
          }
        }
        .upgradeRingSpinning {
          animation: upgradeRingSpinning 0.7s ease-in-out infinite;
        }
        @keyframes upgradeSuccessPulse {
          0% {
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
          40% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.28);
          }
          100% {
            box-shadow: 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .upgradeSuccessPulse {
          animation: upgradeSuccessPulse 0.8s ease-out 2;
        }
        @keyframes upgradeFailPulse {
          0% {
            box-shadow: 0 0 0 rgba(244, 63, 94, 0);
          }
          40% {
            box-shadow: 0 0 20px rgba(244, 63, 94, 0.28);
          }
          100% {
            box-shadow: 0 0 0 rgba(244, 63, 94, 0);
          }
        }
        .upgradeFailPulse {
          animation: upgradeFailPulse 0.8s ease-out 2;
        }
      `}</style>
    </>
  );
}
