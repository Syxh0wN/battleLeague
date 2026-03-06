"use client";

import { useMemo } from "react";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiFetch } from "../../lib/api";

type CreateBattleResponse = {
  id: string;
  status: string;
};

type FriendItem = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
};

type MyPokemonItem = {
  id: string;
  level: number;
  wins: number;
  losses: number;
  species: {
    name: string;
    typePrimary: string;
    imageUrl: string | null;
  };
};

type OpponentProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  totalWins: number;
  totalLosses: number;
  champions: Array<{
    id: string;
    level: number;
    wins: number;
    losses: number;
    species: {
      name: string;
      typePrimary: string;
      imageUrl: string | null;
    };
  }>;
};

type AiOpponent = {
  id: "easy" | "normal" | "hard";
  name: string;
  difficulty: "easy" | "normal" | "hard";
  strategy: string;
};

export default function BattlesPage() {
  const [opponentUserId, setOpponentUserId] = useState("");
  const [challengerPokemonId, setChallengerPokemonId] = useState("");
  const [opponentPokemonId, setOpponentPokemonId] = useState("");
  const [createdBattleId, setCreatedBattleId] = useState("");
  const [isCreatingBattle, setIsCreatingBattle] = useState(false);
  const [battleError, setBattleError] = useState("");
  const [selectedAiDifficulty, setSelectedAiDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [isCreatingAiBattle, setIsCreatingAiBattle] = useState(false);

  const friendsQuery = useQuery({
    queryKey: ["friendsForBattle"],
    queryFn: () => ApiFetch<FriendItem[]>("/social/friends")
  });
  const myPokemonsQuery = useQuery({
    queryKey: ["myPokemonsForBattle"],
    queryFn: () => ApiFetch<MyPokemonItem[]>("/pokemon/my")
  });
  const opponentPreviewQuery = useQuery({
    queryKey: ["battleOpponentPreview", opponentUserId],
    queryFn: () => ApiFetch<OpponentProfile>(`/users/${opponentUserId}`),
    enabled: opponentUserId.trim().length > 0
  });
  const aiOpponentsQuery = useQuery({
    queryKey: ["aiOpponentsForBattle"],
    queryFn: () => ApiFetch<AiOpponent[]>("/battles/ai/opponents")
  });

  const suggestedFriends = useMemo(() => {
    const friends = friendsQuery.data ?? [];
    return [...friends].sort((a, b) => b.level - a.level).slice(0, 4);
  }, [friendsQuery.data]);

  const myPokemons = myPokemonsQuery.data ?? [];
  const opponentPreview = opponentPreviewQuery.data;
  const aiOpponents = aiOpponentsQuery.data ?? [];

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

  const handleCreateAiBattle = async () => {
    if (!challengerPokemonId) {
      setBattleError("Selecione seu pokemon para desafiar a IA.");
      return;
    }
    setBattleError("");
    setIsCreatingAiBattle(true);
    try {
      const response = await ApiFetch<CreateBattleResponse>("/battles/ai", {
        method: "POST",
        body: JSON.stringify({
          challengerPokemonId,
          difficulty: selectedAiDifficulty
        })
      });
      setCreatedBattleId(response.id);
    } catch {
      setBattleError("Nao foi possivel criar duelo com IA.");
    } finally {
      setIsCreatingAiBattle(false);
    }
  };

  const handleChooseFriend = (friendId: string) => {
    setOpponentUserId(friendId);
    setOpponentPokemonId("");
  };

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

        <div className="BattleSuggestWrap">
          <strong>Sugestoes para desafiar</strong>
          <div className="BattleSuggestGrid">
            {suggestedFriends.length === 0 ? (
              <div className="BattleTinyNote">Sem amigos ainda. Adicione em Social para receber sugestoes.</div>
            ) : (
              suggestedFriends.map((friend) => (
                <button
                  key={friend.id}
                  className="BattleSuggestCard"
                  type="button"
                  onClick={() => handleChooseFriend(friend.id)}
                >
                  <span className="BattleSuggestName">{friend.displayName}</span>
                  <small>Level {friend.level}</small>
                </button>
              ))
            )}
          </div>
        </div>

        <form onSubmit={HandleCreateBattle} className="BattleFormGrid">
          <label className="BattleFormField">
            <span>ID do oponente</span>
            <input value={opponentUserId} onChange={(event) => setOpponentUserId(event.target.value)} placeholder="OpponentUserId" />
          </label>

          <div className="BattlePickerSection">
            <span className="BattlePickerTitle">Escolha seu Pokemon</span>
            <div className="BattlePickerGrid">
              {myPokemons.length === 0 ? (
                <div className="BattleTinyNote">Sem pokemon no time.</div>
              ) : (
                myPokemons.map((pokemon) => (
                  <button
                    key={pokemon.id}
                    className={`BattlePokemonPick ${challengerPokemonId === pokemon.id ? "BattlePokemonPickActive" : ""}`}
                    type="button"
                    onClick={() => setChallengerPokemonId(pokemon.id)}
                  >
                    <strong>{pokemon.species.name}</strong>
                    <small>Lv {pokemon.level}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="BattlePreviewWrap">
            <span className="BattlePickerTitle">Preview do jogador</span>
            {!opponentUserId ? (
              <div className="BattleTinyNote">Selecione ou informe um ID para ver preview do jogador.</div>
            ) : opponentPreviewQuery.isLoading ? (
              <div className="BattleTinyNote">Carregando preview...</div>
            ) : opponentPreviewQuery.isError || !opponentPreview ? (
              <div className="BattleTinyNote">Nao foi possivel carregar o preview.</div>
            ) : (
              <article className="BattleOpponentPreviewCard">
                <div className="BattleOpponentHeader">
                  <strong>{opponentPreview.displayName}</strong>
                  <small>
                    Level {opponentPreview.level} | W/L {opponentPreview.totalWins}/{opponentPreview.totalLosses}
                  </small>
                </div>
                <div className="BattleOpponentPokemonList">
                  {opponentPreview.champions.length === 0 ? (
                    <div className="BattleTinyNote">Esse jogador nao possui campeoes publicos.</div>
                  ) : (
                    opponentPreview.champions.map((pokemon) => (
                      <button
                        key={pokemon.id}
                        type="button"
                        className={`BattlePokemonPick ${opponentPokemonId === pokemon.id ? "BattlePokemonPickActive" : ""}`}
                        onClick={() => setOpponentPokemonId(pokemon.id)}
                      >
                        <strong>{pokemon.species.name}</strong>
                        <small>Lv {pokemon.level}</small>
                      </button>
                    ))
                  )}
                </div>
              </article>
            )}
          </div>

          <div className="BattleSelectionSummary">
            <small>Seu Pokemon Selecionado: {challengerPokemonId || "Nao selecionado"}</small>
            <small>Pokemon Oponente Selecionado: {opponentPokemonId || "Nao selecionado"}</small>
          </div>

          <button type="submit" className="BattleCreateButton" disabled={isCreatingBattle}>
            {isCreatingBattle ? "Criando duelo..." : "Criar Batalha"}
          </button>
        </form>

        <div className="BattleAiWrap">
          <div className="BattlesSectionHeader">
            <h2>Desafiar IA</h2>
            <small>Escolha dificuldade e crie duelo automatico.</small>
          </div>
          <div className="BattleAiGrid">
            {aiOpponents.length === 0 ? (
              <div className="BattleTinyNote">Sem perfis de IA disponiveis.</div>
            ) : (
              aiOpponents.map((ai) => (
                <button
                  key={ai.id}
                  type="button"
                  className={`BattleAiCard ${selectedAiDifficulty === ai.difficulty ? "BattleAiCardActive" : ""}`}
                  onClick={() => setSelectedAiDifficulty(ai.difficulty)}
                >
                  <strong>{ai.name}</strong>
                  <small>Dificuldade: {ai.difficulty}</small>
                  <small>{ai.strategy}</small>
                </button>
              ))
            )}
          </div>
          <button type="button" className="BattleCreateButton" disabled={isCreatingAiBattle} onClick={handleCreateAiBattle}>
            {isCreatingAiBattle ? "Criando duelo IA..." : "Criar Batalha com IA"}
          </button>
        </div>

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
