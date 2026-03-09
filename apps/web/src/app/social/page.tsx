"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ApiFetch } from "../../lib/api";
import { useToast } from "../../providers/toast-provider";

type Friend = {
  id: string;
  displayName: string;
  accountTag?: string | null;
  avatarUrl?: string | null;
  level: number;
};

type Pending = {
  id: string;
  sender: Friend;
};

const NavLinkClass =
  "inline-flex h-10 w-auto items-center justify-center whitespace-nowrap rounded-xl bg-slate-900/70 px-4 text-sm font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400";
const SectionCardClass = "rounded-2xl bg-slate-900/80 p-3 sm:p-4";
const PrimaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-xl bg-slate-800/90 px-4 text-sm font-semibold text-slate-100 ring-1 ring-inset ring-slate-500/70 transition hover:-translate-y-px hover:bg-slate-700/90 hover:ring-slate-300/70 disabled:cursor-not-allowed disabled:opacity-50";
const GhostButtonClass =
  "inline-flex h-9 items-center justify-center rounded-xl bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 ring-1 ring-inset ring-slate-600/70 transition hover:-translate-y-px hover:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-45";

export default function SocialPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [targetUserId, setTargetUserId] = useState("");

  const friendsQuery = useQuery({
    queryKey: ["friends"],
    queryFn: () => ApiFetch<Friend[]>("/social/friends")
  });

  const pendingQuery = useQuery({
    queryKey: ["pendingFriends"],
    queryFn: () => ApiFetch<Pending[]>("/social/friends/pending")
  });

  const requestMutation = useMutation({
    mutationFn: () =>
      ApiFetch("/social/friends/request", {
        method: "POST",
        body: JSON.stringify({ targetUserId })
      }),
    onSuccess: () => {
      setTargetUserId("");
      addToast({
        title: "Convite enviado",
        message: "A pessoa recebeu sua solicitacao.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingFriends"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Falha ao enviar solicitacao";
      addToast({
        title: "Falha no convite",
        message,
        tone: "error"
      });
    }
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) =>
      ApiFetch("/social/friends/accept", {
        method: "POST",
        body: JSON.stringify({ friendshipId })
      }),
    onSuccess: () => {
      addToast({
        title: "Solicitacao aceita",
        message: "Amizade confirmada com sucesso.",
        tone: "success"
      });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingFriends"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Falha ao aceitar solicitacao";
      addToast({
        title: "Falha ao aceitar",
        message,
        tone: "error"
      });
    }
  });

  function HandleSend(event: FormEvent) {
    event.preventDefault();
    if (targetUserId.trim().length === 0) {
      addToast({
        title: "Id invalido",
        message: "Digite o @ do perfil para enviar convite.",
        tone: "error"
      });
      return;
    }
    requestMutation.mutate();
  }

  const friends = friendsQuery.data ?? [];
  const pendingFriends = pendingQuery.data ?? [];

  return (
    <main className="min-h-screen content-start grid gap-3 p-3 sm:p-4 lg:p-6">
      <nav className="TopNavScroll mt-2 mb-2 px-1 py-1">
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
        <Link className={NavLinkClass} href="/social/profile">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800/85 text-slate-100">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
              <path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z" />
              <path d="M4 20a8 8 0 0 1 16 0" />
            </svg>
          </span>
          Editar Perfil
        </Link>
      </nav>

      <section className={SectionCardClass}>
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Social</h1>
          <small className="text-slate-300">Gerencie amizades, convites e veja os campeoes dos seus amigos.</small>
        </div>
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2>Adicionar amigo</h2>
          <small className="text-slate-300">Use o @ do perfil do jogador</small>
        </div>
        <form onSubmit={HandleSend} className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            placeholder="@doPerfil"
            className="h-10 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm outline-none ring-blue-400/40 transition focus:ring"
          />
          <button type="submit" className={PrimaryButtonClass} disabled={requestMutation.isPending}>
            {requestMutation.isPending ? "Enviando..." : "Adicionar amigo"}
          </button>
        </form>
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2>Solicitacoes pendentes</h2>
          <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-200">{pendingFriends.length}</small>
        </div>
        {pendingFriends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Nenhuma solicitacao pendente.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {pendingFriends.map((pending) => (
              <article key={pending.id} className="grid gap-2 rounded-xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700">
                    {pending.sender.avatarUrl ? (
                      <img src={pending.sender.avatarUrl} alt={pending.sender.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">FR</span>
                    )}
                  </div>
                  <div className="grid min-w-0">
                    <strong className="truncate text-sm text-slate-100">{pending.sender.displayName}</strong>
                    <small className="text-xs text-slate-300">
                      {pending.sender.accountTag ? `@${pending.sender.accountTag} | ` : ""}
                      Nivel {pending.sender.level}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className={PrimaryButtonClass}
                  onClick={() => acceptMutation.mutate(pending.id)}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? "Confirmando..." : "Aceitar"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={SectionCardClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2>Amigos</h2>
          <small className="rounded-full bg-slate-800/80 px-2 py-0.5 text-xs text-slate-200">{friends.length}</small>
        </div>
        {friends.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-3 text-sm text-slate-300">Voce ainda nao possui amigos adicionados.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {friends.map((friend) => (
              <article key={friend.id} className="grid gap-2 rounded-xl bg-slate-900/75 p-3 ring-1 ring-inset ring-slate-700/70">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.displayName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-slate-300">FR</span>
                    )}
                  </div>
                  <div className="grid min-w-0">
                    <strong className="truncate text-sm text-slate-100">{friend.displayName}</strong>
                    <small className="text-xs text-slate-300">
                      {friend.accountTag ? `@${friend.accountTag} | ` : ""}
                      Nivel {friend.level}
                    </small>
                  </div>
                </div>
                <Link href={`/social/profile/${friend.id}`} className={GhostButtonClass}>
                  Ver perfil
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
