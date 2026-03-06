export type TurnAction = "attack" | "defend" | "skill";

export type EnginePokemon = {
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  level: number;
  typePrimary: string;
  typeSecondary?: string | null;
};

export type TurnResult = {
  damage: number;
  nextAttacker: "challenger" | "opponent";
  challengerHp: number;
  opponentHp: number;
  winner: "challenger" | "opponent" | null;
};

const MIN_DAMAGE = 1;
const CRIT_MULTIPLIER = 1.5;
const SAME_TYPE_ATTACK_BONUS = 1.2;

const typeEffectivenessMap: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water: { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass: {
    water: 2,
    ground: 2,
    rock: 2,
    fire: 0.5,
    grass: 0.5,
    poison: 0.5,
    flying: 0.5,
    bug: 0.5,
    dragon: 0.5,
    steel: 0.5
  },
  ice: { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison: { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground: { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying: { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug: { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost: { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel: { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy: { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 }
};

function getTypeEffectiveness(moveType: string, defender: EnginePokemon): number {
  const normalizedMoveType = moveType.toLowerCase();
  const firstType = defender.typePrimary.toLowerCase();
  const secondType = defender.typeSecondary?.toLowerCase() ?? null;
  const firstMultiplier = typeEffectivenessMap[normalizedMoveType]?.[firstType] ?? 1;
  const secondMultiplier = secondType ? (typeEffectivenessMap[normalizedMoveType]?.[secondType] ?? 1) : 1;
  return firstMultiplier * secondMultiplier;
}

function getMoveType(action: TurnAction, attacker: EnginePokemon): string {
  if (action === "defend") {
    return "normal";
  }
  return attacker.typePrimary;
}

export function resolveTurn(
  challenger: EnginePokemon,
  opponent: EnginePokemon,
  action: TurnAction,
  actor: "challenger" | "opponent"
): TurnResult {
  const attacker = actor === "challenger" ? challenger : opponent;
  const defender = actor === "challenger" ? opponent : challenger;
  const actionPower = action === "defend" ? 25 : action === "skill" ? 85 : 55;
  const moveType = getMoveType(action, attacker);
  const attackerLevel = Math.max(1, attacker.level);
  const defenderDefense = Math.max(1, defender.def);
  const levelComponent = Math.floor((2 * attackerLevel) / 5) + 2;
  const baseDamage = Math.floor((levelComponent * actionPower * attacker.atk) / defenderDefense / 50) + 2;
  const stab = moveType.toLowerCase() === attacker.typePrimary.toLowerCase() ? SAME_TYPE_ATTACK_BONUS : 1;
  const typeEffectiveness = getTypeEffectiveness(moveType, defender);
  const randomFactor = 0.85 + Math.random() * 0.15;
  const criticalChance = Math.min(0.25, 0.04 + attacker.speed / 700);
  const criticalMultiplier = Math.random() < criticalChance ? CRIT_MULTIPLIER : 1;
  const damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * stab * typeEffectiveness * randomFactor * criticalMultiplier));

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  const challengerHp = challenger.currentHp;
  const opponentHp = opponent.currentHp;
  const winner = challengerHp <= 0 ? "opponent" : opponentHp <= 0 ? "challenger" : null;
  const nextAttacker = challenger.speed >= opponent.speed ? "challenger" : "opponent";

  return {
    damage,
    nextAttacker,
    challengerHp,
    opponentHp,
    winner
  };
}
