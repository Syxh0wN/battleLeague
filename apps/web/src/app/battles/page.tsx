"use client";

import { FormEvent, useState } from "react";
import { ApiFetch } from "../../lib/api";

type CreateBattleResponse = {
  id: string;
  status: string;
};

export default function BattlesPage() {
  const [opponentUserId, setOpponentUserId] = useState("");
  const [challengerPokemonId, setChallengerPokemonId] = useState("");
  const [opponentPokemonId, setOpponentPokemonId] = useState("");
  const [createdBattleId, setCreatedBattleId] = useState("");

  async function HandleCreateBattle(event: FormEvent) {
    event.preventDefault();
    const response = await ApiFetch<CreateBattleResponse>("/battles", {
      method: "POST",
      body: JSON.stringify({
        opponentUserId,
        challengerPokemonId,
        opponentPokemonId
      })
    });
    setCreatedBattleId(response.id);
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Battles</h1>
      <form onSubmit={HandleCreateBattle} style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <input value={opponentUserId} onChange={(event) => setOpponentUserId(event.target.value)} placeholder="OpponentUserId" />
        <input
          value={challengerPokemonId}
          onChange={(event) => setChallengerPokemonId(event.target.value)}
          placeholder="YourPokemonId"
        />
        <input
          value={opponentPokemonId}
          onChange={(event) => setOpponentPokemonId(event.target.value)}
          placeholder="OpponentPokemonId"
        />
        <button
          type="submit"
          style={{
            border: "none",
            borderRadius: 8,
            padding: "10px 12px",
            background: "var(--SecondaryPurple)",
            color: "white",
            cursor: "pointer"
          }}
        >
          CreateBattle
        </button>
      </form>
      {createdBattleId ? <div>BattleCreated: {createdBattleId}</div> : null}
    </main>
  );
}
