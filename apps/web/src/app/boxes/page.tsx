"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type LootEconomyResponse = {
  user: {
    coins: number;
    pokemonFragments: number;
  };
  dailyShopLimit: number;
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
};

const NavLinkClass =
  "inline-flex h-10 w-auto items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";

export default function BoxesPage() {
  const router = useRouter();
  const lootEconomyQuery = useQuery({
    queryKey: ["loot-economy"],
    queryFn: () => ApiFetch<LootEconomyResponse>("/progression/loot/economy")
  });

  const groupedBoxes = useMemo(() => {
    return (lootEconomyQuery.data?.lootBoxCatalog ?? []).reduce<Record<string, LootEconomyResponse["lootBoxCatalog"]>>((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [lootEconomyQuery.data]);

  const stateByBoxType = useMemo(() => {
    return new Map((lootEconomyQuery.data?.lootBoxStates ?? []).map((item) => [item.boxType, item]));
  }, [lootEconomyQuery.data]);

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-4 lg:px-6">
      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-100">Caixas</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100">
              Coins {lootEconomyQuery.data?.user.coins ?? 0}
            </span>
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-100">
              Fragmentos {lootEconomyQuery.data?.user.pokemonFragments ?? 0}
            </span>
          </div>
        </div>
        <nav className="TopNavScroll">
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
        </nav>
      </section>

      <section className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-[0_16px_50px_rgba(2,6,23,0.45)]">
        <div className="grid gap-4">
          {Object.entries(groupedBoxes).map(([category, boxes]) => (
            <section key={category} className="grid gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-200">
                {category === "holo" ? "Caixas Premium" : "Caixas Iniciais"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {boxes.map((box) => {
                  const state = stateByBoxType.get(box.boxType);
                  return (
                    <button
                      key={box.boxType}
                      type="button"
                      onClick={() => router.push(`/boxes/${box.boxType}`)}
                      className="relative grid min-h-[148px] overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/70 text-left transition hover:border-cyan-300/70 hover:bg-slate-800/90 hover:shadow-[0_0_18px_rgba(34,211,238,0.2)] lg:min-h-[188px]"
                    >
                      <img src={box.imageUrl} alt={box.displayName} className="absolute inset-0 h-full w-full object-cover opacity-40" />
                      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 to-slate-950/90" />
                      <div className="relative z-10 mt-auto grid gap-1 p-2.5 lg:p-3.5">
                        <strong className="text-sm uppercase text-slate-100 lg:text-base">{box.displayName}</strong>
                        <small className="text-xs font-semibold text-cyan-200 lg:text-sm">{box.priceCoins} coins</small>
                        <small className="text-[11px] text-slate-300 lg:text-xs">
                          Pity {state?.pityCounter ?? 0} | Limite {state?.dailyShopPurchases ?? 0}/{lootEconomyQuery.data?.dailyShopLimit ?? 5}
                        </small>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
