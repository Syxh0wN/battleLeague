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
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Social</h1>
      <form onSubmit={HandleSend} style={{ display: "flex", gap: 8 }}>
        <input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="TargetUserId" />
        <button type="submit">AddFriend</button>
      </form>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Pending</h2>
        {pendingQuery.data?.map((pending) => (
          <article key={pending.id} style={{ background: "var(--SurfaceDark)", padding: 10, borderRadius: 8 }}>
            <span>{pending.sender.displayName}</span>
            <button style={{ marginLeft: 10 }} onClick={() => acceptMutation.mutate(pending.id)}>
              Accept
            </button>
          </article>
        ))}
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Friends</h2>
        {friendsQuery.data?.map((friend) => (
          <article key={friend.id} style={{ background: "var(--SurfaceDark)", padding: 10, borderRadius: 8 }}>
            {friend.displayName} Level {friend.level}
          </article>
        ))}
      </section>
    </main>
  );
}
