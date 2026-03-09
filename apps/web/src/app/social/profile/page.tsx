"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../../lib/api";
import { useToast } from "../../../providers/toast-provider";

type MeProfile = {
  id: string;
  displayName: string;
  accountTag?: string | null;
  avatarUrl?: string | null;
  gender?: "male" | "female";
};

const NavLinkClass =
  "inline-flex h-10 w-auto items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const PrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-50";
const PresetAvatarUrls: string[] = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar01",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar02",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar03",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar04",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar05",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar06",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar07",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar08",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar09",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar10",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar11",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=BattleLeagueAvatar12"
];

export default function SocialProfilePage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAccountTag, setProfileAccountTag] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>(PresetAvatarUrls[0]);
  const [profileGender, setProfileGender] = useState<"male" | "female">("male");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeProfile>("/users/me")
  });

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      ApiFetch("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profileDisplayName,
          accountTag: profileAccountTag,
          avatarUrl: profileAvatarUrl,
          gender: profileGender
        })
      }),
    onSuccess: () => {
      addToast({
        title: "Perfil atualizado",
        message: "Nome, @conta, avatar e sexo foram salvos.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingFriends"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Falha ao salvar perfil";
      addToast({
        title: "Falha ao salvar",
        message,
        tone: "error"
      });
    }
  });

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setProfileDisplayName(meQuery.data.displayName ?? "");
    setProfileAccountTag(meQuery.data.accountTag ?? "");
    if (meQuery.data.avatarUrl && PresetAvatarUrls.includes(meQuery.data.avatarUrl)) {
      setProfileAvatarUrl(meQuery.data.avatarUrl);
    } else {
      setProfileAvatarUrl(PresetAvatarUrls[0]);
    }
    setProfileGender(meQuery.data.gender === "female" ? "female" : "male");
  }, [meQuery.data]);

  function HandleSaveProfile(event: FormEvent) {
    event.preventDefault();
    if (profileDisplayName.trim().length < 3) {
      addToast({
        title: "Nome invalido",
        message: "Use pelo menos 3 caracteres no nome.",
        tone: "error"
      });
      return;
    }
    const normalizedTag = profileAccountTag.trim().replace(/^@+/, "");
    if (normalizedTag.length < 3) {
      addToast({
        title: "Conta invalida",
        message: "Use pelo menos 3 caracteres no @ da conta.",
        tone: "error"
      });
      return;
    }
    saveProfileMutation.mutate();
  }

  return (
    <main className="min-h-screen content-start grid gap-3 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll mt-2 mb-2">
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
        <Link className={NavLinkClass} href="/social">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M5 7h14" />
              <path d="M5 12h14" />
              <path d="M5 17h14" />
            </svg>
          </span>
          Voltar para Social
        </Link>
      </nav>

      <section className={SectionCardClass}>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Editar perfil</h1>
          <small className="text-slate-300">Altere seu nome, @conta e avatar.</small>
        </div>
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Dados da conta</h2>
          <small className="text-slate-300">{meQuery.data?.accountTag ? `@${meQuery.data.accountTag}` : "@semConta"}</small>
        </div>
        <form onSubmit={HandleSaveProfile} className="grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <small className="text-slate-300">Escolha um avatar</small>
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-slate-600 bg-slate-800">
                <img src={profileAvatarUrl} alt="Avatar selecionado" className="h-full w-full object-cover" />
              </div>
              <small className="text-xs text-slate-400">Avatar atual selecionado</small>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {PresetAvatarUrls.map((avatarUrl) => (
                <button
                  key={avatarUrl}
                  type="button"
                  onClick={() => setProfileAvatarUrl(avatarUrl)}
                  className={`grid h-12 w-12 place-items-center overflow-hidden rounded-full border transition ${
                    profileAvatarUrl === avatarUrl
                      ? "border-cyan-300 bg-slate-800/85 ring-2 ring-cyan-300/45"
                      : "border-slate-600 bg-slate-800/70 hover:border-slate-400"
                  }`}
                >
                  <img src={avatarUrl} alt="Avatar opcao" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2 grid gap-2 rounded-xl border border-slate-700 bg-slate-900/50 p-3">
            <small className="text-slate-300">Sexo do perfil</small>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setProfileGender("male")}
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ring-1 ring-inset transition ${
                  profileGender === "male"
                    ? "bg-cyan-500/20 text-cyan-100 ring-cyan-300/55"
                    : "bg-slate-800/70 text-slate-200 ring-slate-600/70 hover:ring-slate-400"
                }`}
              >
                Homem
              </button>
              <button
                type="button"
                onClick={() => setProfileGender("female")}
                className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold ring-1 ring-inset transition ${
                  profileGender === "female"
                    ? "bg-fuchsia-500/20 text-fuchsia-100 ring-fuchsia-300/55"
                    : "bg-slate-800/70 text-slate-200 ring-slate-600/70 hover:ring-slate-400"
                }`}
              >
                Mulher
              </button>
            </div>
          </div>
          <input
            value={profileDisplayName}
            onChange={(event) => setProfileDisplayName(event.target.value)}
            placeholder="Nome do perfil"
            className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none ring-blue-400/40 transition focus:ring"
          />
          <input
            value={profileAccountTag}
            onChange={(event) => setProfileAccountTag(event.target.value)}
            placeholder="@minhaConta"
            className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none ring-blue-400/40 transition focus:ring"
          />
          <button
            type="submit"
            className={`${PrimaryButtonClass} sm:col-span-2`}
            disabled={saveProfileMutation.isPending || meQuery.isLoading}
          >
            {saveProfileMutation.isPending ? "Salvando perfil..." : "Salvar perfil"}
          </button>
        </form>
      </section>
    </main>
  );
}
