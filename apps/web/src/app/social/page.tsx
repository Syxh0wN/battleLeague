"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type Friend = {
  id: string;
  displayName: string;
  level: number;
};

type Pending = {
  id: string;
  sender: Friend;
};

export default function SocialPage() {
  const queryClient = useQueryClient();
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
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingFriends"] });
    }
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) =>
      ApiFetch("/social/friends/accept", {
        method: "POST",
        body: JSON.stringify({ friendshipId })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
      void queryClient.invalidateQueries({ queryKey: ["pendingFriends"] });
    }
  });

  function HandleSend(event: FormEvent) {
    event.preventDefault();
    requestMutation.mutate();
  }

  return (
    <main className="grid min-h-screen gap-4 p-3 sm:p-4 lg:p-6">
      <h1 className="m-0 text-3xl font-bold">Social</h1>
      <form onSubmit={HandleSend} className="flex flex-wrap gap-2">
        <input
          value={targetUserId}
          onChange={(event) => setTargetUserId(event.target.value)}
          placeholder="Id do treinador"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-blue-400/40 focus:ring"
        />
        <button type="submit" className="rounded-xl border border-blue-400/70 bg-blue-500/25 px-4 py-2 text-sm font-semibold">
          Adicionar amigo
        </button>
      </form>

      <section className="grid gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4">
        <h2 className="m-0 text-xl font-semibold">Solicitacoes pendentes</h2>
        {pendingQuery.data?.map((pending) => (
          <article key={pending.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/80 p-3">
            <span>{pending.sender.displayName}</span>
            <button className="rounded-lg border border-emerald-400/70 bg-emerald-500/20 px-3 py-1 text-xs font-semibold" onClick={() => acceptMutation.mutate(pending.id)}>
              Aceitar
            </button>
          </article>
        ))}
      </section>

      <section className="grid gap-2 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-3 sm:p-4">
        <h2 className="m-0 text-xl font-semibold">Amigos</h2>
        {friendsQuery.data?.map((friend) => (
          <article key={friend.id} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
            {friend.displayName} Nivel {friend.level}
          </article>
        ))}
      </section>
    </main>
  );
}
