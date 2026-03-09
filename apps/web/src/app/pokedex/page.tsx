"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type SpeciesItem = {
  id: string;
  pokeApiId: number;
  name: string;
  typePrimary: string;
  typeSecondary: string | null;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  baseSpeed: number;
  evolutionTarget: string | null;
  evolutionLevel: number | null;
  imageUrl: string | null;
};

const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const NavLinkClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const FeedBatchSize = 12;

function NormalizeName(value: string) {
  return value.trim().toLowerCase();
}

export default function PokedexPage() {
  const [selectedName, setSelectedName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [evolutionFilter, setEvolutionFilter] = useState("all");
  const [minBaseStat, setMinBaseStat] = useState(0);
  const [maxBaseStat, setMaxBaseStat] = useState(255);
  const [sortBy, setSortBy] = useState("numberAsc");
  const [onlyDualType, setOnlyDualType] = useState(false);
  const [visibleCount, setVisibleCount] = useState(FeedBatchSize);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const speciesQuery = useQuery({
    queryKey: ["pokedexSpecies"],
    queryFn: () => ApiFetch<SpeciesItem[]>("/pokemon/species")
  });

  const speciesList = speciesQuery.data ?? [];
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const species of speciesList) {
      types.add(species.typePrimary.toLowerCase());
      if (species.typeSecondary) {
        types.add(species.typeSecondary.toLowerCase());
      }
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [speciesList]);
  const filteredSpecies = useMemo(() => {
    const normalizedSearch = NormalizeName(searchTerm);
    const baseFiltered = speciesList.filter((species) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        NormalizeName(species.name).includes(normalizedSearch) ||
        String(species.pokeApiId).includes(normalizedSearch);
      const normalizedPrimaryType = species.typePrimary.toLowerCase();
      const normalizedSecondaryType = species.typeSecondary?.toLowerCase() ?? "";
      const matchesType =
        typeFilter === "all" ||
        normalizedPrimaryType === typeFilter ||
        normalizedSecondaryType === typeFilter;
      const hasEvolutionTarget = !!species.evolutionTarget;
      const isSpecialEvolution = hasEvolutionTarget && !species.evolutionLevel;
      const isLevelEvolution = hasEvolutionTarget && !!species.evolutionLevel;
      const matchesEvolution =
        evolutionFilter === "all" ||
        (evolutionFilter === "final" && !hasEvolutionTarget) ||
        (evolutionFilter === "level" && isLevelEvolution) ||
        (evolutionFilter === "special" && isSpecialEvolution);
      const highestBaseStat = Math.max(species.baseHp, species.baseAtk, species.baseDef, species.baseSpeed);
      const matchesStats = highestBaseStat >= minBaseStat && highestBaseStat <= maxBaseStat;
      const matchesDualTyping = !onlyDualType || !!species.typeSecondary;
      return matchesSearch && matchesType && matchesEvolution && matchesStats && matchesDualTyping;
    });
    const sorted = baseFiltered.slice().sort((first, second) => {
      if (sortBy === "nameAsc") {
        return first.name.localeCompare(second.name);
      }
      if (sortBy === "nameDesc") {
        return second.name.localeCompare(first.name);
      }
      if (sortBy === "numberDesc") {
        return second.pokeApiId - first.pokeApiId;
      }
      if (sortBy === "maxStatDesc") {
        const firstMax = Math.max(first.baseHp, first.baseAtk, first.baseDef, first.baseSpeed);
        const secondMax = Math.max(second.baseHp, second.baseAtk, second.baseDef, second.baseSpeed);
        if (secondMax !== firstMax) {
          return secondMax - firstMax;
        }
        return first.pokeApiId - second.pokeApiId;
      }
      if (sortBy === "typeAsc") {
        const firstType = `${first.typePrimary}/${first.typeSecondary ?? ""}`;
        const secondType = `${second.typePrimary}/${second.typeSecondary ?? ""}`;
        return firstType.localeCompare(secondType);
      }
      return first.pokeApiId - second.pokeApiId;
    });
    return sorted;
  }, [speciesList, searchTerm, typeFilter, evolutionFilter, minBaseStat, maxBaseStat, sortBy, onlyDualType]);

  const visibleSpecies = useMemo(() => filteredSpecies.slice(0, visibleCount), [filteredSpecies, visibleCount]);
  const hasMoreSpecies = visibleCount < filteredSpecies.length;

  useEffect(() => {
    setVisibleCount(FeedBatchSize);
  }, [searchTerm, typeFilter, evolutionFilter, minBaseStat, maxBaseStat, sortBy, onlyDualType]);

  useEffect(() => {
    if (!hasMoreSpecies) {
      return;
    }
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(filteredSpecies.length, current + FeedBatchSize));
        }
      },
      { root: null, rootMargin: "220px 0px" }
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreSpecies, filteredSpecies.length]);

  useEffect(() => {
    if (!isDetailsModalOpen) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isDetailsModalOpen]);

  useEffect(() => {
    if (!isDetailsModalOpen) {
      return;
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [isDetailsModalOpen]);

  useEffect(() => {
    if (filteredSpecies.length === 0) {
      return;
    }
    const selectedStillVisible = filteredSpecies.some((species) => NormalizeName(species.name) === NormalizeName(selectedName));
    if (!selectedName || !selectedStillVisible) {
      setSelectedName(filteredSpecies[0].name);
    }
  }, [filteredSpecies, selectedName]);

  const speciesByName = useMemo(() => {
    const byName = new Map<string, SpeciesItem>();
    for (const species of speciesList) {
      byName.set(NormalizeName(species.name), species);
    }
    return byName;
  }, [speciesList]);

  const selectedSpecies = useMemo(() => {
    if (!selectedName) {
      return null;
    }
    return speciesByName.get(NormalizeName(selectedName)) ?? null;
  }, [selectedName, speciesByName]);

  const transformationChain = useMemo(() => {
    if (!selectedSpecies) {
      return [] as SpeciesItem[];
    }
    const seenNames = new Set<string>();
    const chain: SpeciesItem[] = [selectedSpecies];
    seenNames.add(NormalizeName(selectedSpecies.name));

    let currentHead = selectedSpecies;
    while (true) {
      const previous = speciesList.find((item) => item.evolutionTarget && NormalizeName(item.evolutionTarget) === NormalizeName(currentHead.name));
      if (!previous) {
        break;
      }
      const previousName = NormalizeName(previous.name);
      if (seenNames.has(previousName)) {
        break;
      }
      chain.unshift(previous);
      seenNames.add(previousName);
      currentHead = previous;
    }

    let currentTail = selectedSpecies;
    while (currentTail.evolutionTarget) {
      const next = speciesByName.get(NormalizeName(currentTail.evolutionTarget));
      if (!next) {
        break;
      }
      const nextName = NormalizeName(next.name);
      if (seenNames.has(nextName)) {
        break;
      }
      chain.push(next);
      seenNames.add(nextName);
      currentTail = next;
    }

    return chain;
  }, [selectedSpecies, speciesList, speciesByName]);

  if (speciesQuery.isLoading) {
    return <main className="min-h-screen p-3 sm:p-4 lg:p-6">Carregando pokedex...</main>;
  }

  if (speciesQuery.error) {
    return <main className="min-h-screen p-3 sm:p-4 lg:p-6">Falha ao carregar pokedex.</main>;
  }

  return (
    <main className="min-h-screen grid gap-4 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll">
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
              <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z" />
              <path d="M3 12h18" />
              <circle cx="12" cy="12" r="2.2" />
            </svg>
          </span>
          Ir para Pokemon
        </Link>
      </nav>

      <section className={SectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Pokedex completa</h2>
          <small className="text-slate-300">
            {visibleSpecies.length}/{filteredSpecies.length} exibidas ({speciesList.length} total)
          </small>
        </div>
        <div className="mb-3 grid gap-2 rounded-xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs text-slate-300">
            <span>Busca</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Nome ou numero"
              className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-300">
            <span>Tipo</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
            >
              <option value="all">Todos</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-300">
            <span>Evolucao</span>
            <select
              value={evolutionFilter}
              onChange={(event) => setEvolutionFilter(event.target.value)}
              className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
            >
              <option value="all">Todas</option>
              <option value="final">Forma final</option>
              <option value="level">Evolucao por nivel</option>
              <option value="special">Evolucao especial</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs text-slate-300">
            <span>Ordenacao</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
            >
              <option value="numberAsc">Numero crescente</option>
              <option value="numberDesc">Numero decrescente</option>
              <option value="nameAsc">Nome A-Z</option>
              <option value="nameDesc">Nome Z-A</option>
              <option value="maxStatDesc">Maior stat primeiro</option>
              <option value="typeAsc">Tipo A-Z</option>
            </select>
          </label>
          <div className="grid gap-1 text-xs text-slate-300">
            <span>Faixa de stats base</span>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="number"
                min={0}
                max={255}
                value={minBaseStat}
                onChange={(event) => setMinBaseStat(Math.max(0, Math.min(255, Number(event.target.value) || 0)))}
                className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
              />
              <span className="text-slate-400">a</span>
              <input
                type="number"
                min={0}
                max={255}
                value={maxBaseStat}
                onChange={(event) => setMaxBaseStat(Math.max(0, Math.min(255, Number(event.target.value) || 255)))}
                className="h-9 rounded-lg bg-slate-800/80 px-3 text-sm text-slate-100 ring-1 ring-inset ring-slate-600/70 outline-none transition focus:ring-slate-400"
              />
            </div>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyDualType((current) => !current)}
            className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold ring-1 ring-inset transition ${
              onlyDualType
                ? "bg-cyan-500/15 text-cyan-100 ring-cyan-400/45"
                : "bg-slate-800/70 text-slate-200 ring-slate-600/70 hover:ring-slate-400/70"
            }`}
          >
            Somente dupla tipagem {onlyDualType ? "Ativo" : "Inativo"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSpecies.map((species) => {
            const isSelected = NormalizeName(species.name) === NormalizeName(selectedName);
            const highestBaseStat = Math.max(species.baseHp, species.baseAtk, species.baseDef, species.baseSpeed);
            return (
              <button
                key={species.id}
                type="button"
                onClick={() => {
                  setSelectedName(species.name);
                  setIsDetailsModalOpen(true);
                }}
                className={`grid gap-2 rounded-2xl bg-slate-900/70 p-3 text-left ring-1 ring-inset transition ${
                  isSelected ? "ring-cyan-300/75 bg-slate-800/90" : "ring-slate-700/70 hover:-translate-y-px hover:ring-slate-500/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-slate-800/85 ring-1 ring-inset ring-slate-600/70">
                    {species.imageUrl ? (
                      <img loading="lazy" decoding="async" src={species.imageUrl} alt={species.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-[10px] font-bold text-slate-300">PK</div>
                    )}
                  </div>
                  <div className="grid min-w-0 gap-0.5">
                    <strong className="truncate capitalize text-sm text-slate-100">{species.name}</strong>
                    <small className="text-[11px] text-slate-300">Pokedex #{species.pokeApiId}</small>
                  </div>
                  <span className="ml-auto rounded-full bg-slate-800/85 px-2 py-0.5 text-[10px] font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70">
                    #{species.pokeApiId}
                  </span>
                </div>
                <div className="relative grid h-44 place-items-center overflow-hidden rounded-xl bg-slate-800/70">
                  {species.imageUrl ? (
                    <img loading="lazy" decoding="async" src={species.imageUrl} alt={species.name} className="h-36 w-36 object-contain" />
                  ) : (
                    <div className="text-xs font-bold text-slate-400">PK</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                    {species.typePrimary}
                  </span>
                  {species.typeSecondary ? (
                    <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                      {species.typeSecondary}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold text-slate-100 ring-1 ring-inset ring-slate-600/70">
                    MaxStat {highestBaseStat}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold text-slate-200">
                  <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-inset ring-slate-600/70">HP {species.baseHp}</span>
                  <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-inset ring-slate-600/70">ATK {species.baseAtk}</span>
                  <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-inset ring-slate-600/70">DEF {species.baseDef}</span>
                  <span className="rounded-lg bg-slate-800/80 px-2 py-1 ring-1 ring-inset ring-slate-600/70">SPD {species.baseSpeed}</span>
                </div>
              </button>
            );
          })}
        </div>
        {hasMoreSpecies ? <div ref={loadMoreSentinelRef} className="mt-3 h-1 w-full" aria-hidden /> : null}
        {filteredSpecies.length === 0 ? (
          <div className="mt-3 rounded-xl bg-slate-900/70 p-3 text-sm text-slate-300 ring-1 ring-inset ring-slate-700/70">
            Nenhuma especie encontrada com os filtros atuais.
          </div>
        ) : null}
      </section>

      {selectedSpecies && isDetailsModalOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-3 backdrop-blur-sm"
          onClick={() => setIsDetailsModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${selectedSpecies.name}`}
        >
          <section
            className="grid max-h-[92vh] w-full max-w-4xl gap-4 overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900/95 p-3 sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="grid min-w-0 gap-0.5">
                <h2 className="truncate capitalize">{selectedSpecies.name}</h2>
                <small className="text-slate-300">#{selectedSpecies.pokeApiId}</small>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/85 text-slate-100 ring-1 ring-inset ring-slate-600/70 transition hover:bg-slate-700/90"
                aria-label="Fechar detalhes"
              >
                x
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="grid h-fit gap-2 rounded-2xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="grid h-36 place-items-center rounded-xl bg-slate-800/70">
                  {selectedSpecies.imageUrl ? (
                    <img loading="lazy" decoding="async" src={selectedSpecies.imageUrl} alt={selectedSpecies.name} className="h-28 w-28 object-contain" />
                  ) : (
                    <div className="text-xs font-bold text-slate-400">PK</div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                    {selectedSpecies.typePrimary}
                  </span>
                  {selectedSpecies.typeSecondary ? (
                    <span className="rounded-full bg-slate-800/85 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-100 ring-1 ring-inset ring-slate-600/70">
                      {selectedSpecies.typeSecondary}
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-200">
                  <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">HP {selectedSpecies.baseHp}</span>
                  <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">ATK {selectedSpecies.baseAtk}</span>
                  <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">DEF {selectedSpecies.baseDef}</span>
                  <span className="rounded-lg bg-slate-800/85 px-2 py-1 ring-1 ring-inset ring-slate-600/70">SPD {selectedSpecies.baseSpeed}</span>
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl bg-slate-900/70 p-3 ring-1 ring-inset ring-slate-700/70">
                <strong>Transformacoes</strong>
                {transformationChain.length <= 1 ? (
                  <small className="rounded-lg bg-slate-900/65 px-2 py-1 text-[11px] text-slate-300 ring-1 ring-inset ring-slate-700/70">
                    Sem transformacao registrada para essa especie.
                  </small>
                ) : (
                  <div className="grid gap-2">
                    {transformationChain.map((species, index) => {
                      const nextSpecies = transformationChain[index + 1] ?? null;
                      const isSelectedStep = NormalizeName(species.name) === NormalizeName(selectedSpecies.name);
                      return (
                        <div key={species.id} className="grid gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedName(species.name)}
                            className={`grid w-full grid-cols-[56px_1fr] items-center gap-2 rounded-xl p-2 text-left ring-1 ring-inset transition ${
                              isSelectedStep
                                ? "bg-cyan-500/12 ring-cyan-300/60 shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                                : "bg-slate-900/65 ring-slate-700/70 hover:bg-slate-800/80 hover:ring-slate-500/75"
                            }`}
                          >
                            <div
                              className={`grid h-14 w-14 place-items-center rounded-lg ${
                                isSelectedStep ? "bg-cyan-500/15 ring-1 ring-inset ring-cyan-300/55" : "bg-slate-800/70"
                              }`}
                            >
                              {species.imageUrl ? (
                                <img loading="lazy" decoding="async" src={species.imageUrl} alt={species.name} className="h-12 w-12 object-contain" />
                              ) : (
                                <div className="text-[10px] font-bold text-slate-400">PK</div>
                              )}
                            </div>
                            <div className="grid gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <strong className="capitalize text-sm">{species.name}</strong>
                                {isSelectedStep ? (
                                  <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-100 ring-1 ring-inset ring-cyan-300/55">
                                    selecionado
                                  </span>
                                ) : null}
                              </div>
                              <small className="text-xs text-slate-300">
                                {species.typePrimary}
                                {species.typeSecondary ? ` / ${species.typeSecondary}` : ""}
                              </small>
                            </div>
                          </button>
                          {nextSpecies ? (
                            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300">
                              <span className="inline-flex h-px flex-1 bg-slate-700" />
                              <span>{species.evolutionLevel ? `Evolui no nivel ${species.evolutionLevel}` : "Evolucao especial"}</span>
                              <span className="inline-flex h-px flex-1 bg-slate-700" />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
