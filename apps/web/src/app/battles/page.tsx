"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
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
  const [isCreatingBattle, setIsCreatingBattle] = useState(false);
  const [battleError, setBattleError] = useState("");

  async function HandleCreateBattle(event: FormEvent) {
    event.preventDefault();
    setBattleError("");
    setIsCreatingBattle(true);
    try {
      const response = await ApiFetch<CreateBattleResponse>("/battles", {
        method: "POST",
        body: JSON.stringify({
          opponentUserId,
          challengerPokemonId,
          opponentPokemonId
        })
      });
      setCreatedBattleId(response.id);
    } catch {
      setBattleError("Nao foi possivel criar a batalha. Verifique os IDs e tente novamente.");
    } finally {
      setIsCreatingBattle(false);
    }
  }

  return (
    <main className="BattlesRoot">
      <section className="BattlesHero">
        <div className="BattlesHeroTop">
          <span className="BattlesHeroTag">ArenaDeDuelo</span>
          <h1>Battles</h1>
          <p>Crie um desafio, selecione os pokemons do confronto e inicie a partida em poucos passos.</p>
        </div>
        <div className="BattlesHeroPills">
          <span>Turno assincrono</span>
          <span>Historico de batalha</span>
          <span>Controle de cooldown</span>
        </div>
      </section>

      <nav className="PageQuickNav">
        <Link className="PageQuickNavLink" href="/dashboard">
          Voltar para Dashboard
        </Link>
        <Link className="PageQuickNavLink" href="/pokemon">
          Ir para Pokemon
        </Link>
        <Link className="PageQuickNavLink" href="/social">
          Ir para Social
        </Link>
      </nav>

      <section className="BattlesSection">
        <div className="BattlesSectionHeader">
          <h2>Criar novo duelo</h2>
          <small>Preencha os IDs para montar o confronto.</small>
        </div>

        <form onSubmit={HandleCreateBattle} className="BattleFormGrid">
          <label className="BattleFormField">
            <span>ID do oponente</span>
            <input value={opponentUserId} onChange={(event) => setOpponentUserId(event.target.value)} placeholder="OpponentUserId" />
          </label>

          <label className="BattleFormField">
            <span>Seu Pokemon ID</span>
            <input
              value={challengerPokemonId}
              onChange={(event) => setChallengerPokemonId(event.target.value)}
              placeholder="YourPokemonId"
            />
          </label>

          <label className="BattleFormField">
            <span>Pokemon ID do oponente</span>
            <input
              value={opponentPokemonId}
              onChange={(event) => setOpponentPokemonId(event.target.value)}
              placeholder="OpponentPokemonId"
            />
          </label>

          <button type="submit" className="BattleCreateButton" disabled={isCreatingBattle}>
            {isCreatingBattle ? "Criando duelo..." : "Criar Batalha"}
          </button>
        </form>

        {createdBattleId ? (
          <article className="BattleCreatedCard">
            <strong>Batalha criada com sucesso</strong>
            <small>ID: {createdBattleId}</small>
          </article>
        ) : null}

        {battleError ? <div className="BattleErrorBox">{battleError}</div> : null}
      </section>
    </main>
  );
}
