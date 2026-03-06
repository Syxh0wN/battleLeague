export type TurnAction = "attack" | "defend" | "skill";

export type EnginePokemon = {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
};

export type TurnResult = {
  damage: number;
  nextAttacker: "challenger" | "opponent";
  challengerHp: number;
  opponentHp: number;
  winner: "challenger" | "opponent" | null;
};

const MIN_DAMAGE = 1;

export function resolveTurn(
  challenger: EnginePokemon,
  opponent: EnginePokemon,
  action: TurnAction,
  actor: "challenger" | "opponent"
): TurnResult {
  const attacker = actor === "challenger" ? challenger : opponent;
  const defender = actor === "challenger" ? opponent : challenger;

  const actionModifier = action === "defend" ? 0.4 : action === "skill" ? 1.25 : 1;
  const effectiveAttack = Math.max(1, Math.floor(attacker.atk * actionModifier));
  const reducedByDefense = Math.max(MIN_DAMAGE, effectiveAttack - Math.floor(defender.def * 0.65));

  defender.currentHp = Math.max(0, defender.currentHp - reducedByDefense);

  const challengerHp = challenger.currentHp;
  const opponentHp = opponent.currentHp;
  const winner = challengerHp <= 0 ? "opponent" : opponentHp <= 0 ? "challenger" : null;
  const nextAttacker = challenger.speed >= opponent.speed ? "challenger" : "opponent";

  return {
    damage: reducedByDefense,
    nextAttacker,
    challengerHp,
    opponentHp,
    winner
  };
}
