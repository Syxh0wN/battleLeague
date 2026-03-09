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

export type TurnMove = {
  action: TurnAction;
  type: string;
  power: number;
  priority?: number;
  category?: "physical" | "special" | "status";
};

const MIN_DAMAGE = 1;
const CRIT_MULTIPLIER = 1.5;
const SAME_TYPE_ATTACK_BONUS = 1.2;
const STATUS_DAMAGE_MULTIPLIER = 0.55;
const STATUS_CONTROL_CHANCE = 0.75;

function getStatusTypeProfile(moveType: string) {
  const normalizedType = moveType.toLowerCase();
  if (normalizedType === "electric") {
    return {
      damageMultiplier: 0.5,
      controlChance: 0.84,
      priorityBonus: 0
    };
  }
  if (normalizedType === "rock") {
    return {
      damageMultiplier: 0.45,
      controlChance: 0.58,
      priorityBonus: 1
    };
  }
  if (normalizedType === "steel") {
    return {
      damageMultiplier: 0.48,
      controlChance: 0.64,
      priorityBonus: 1
    };
  }
  return {
    damageMultiplier: STATUS_DAMAGE_MULTIPLIER,
    controlChance: STATUS_CONTROL_CHANCE,
    priorityBonus: 0
  };
}

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
  actor: "challenger" | "opponent",
  selectedMove?: TurnMove
): TurnResult {
  const attacker = actor === "challenger" ? challenger : opponent;
  const defender = actor === "challenger" ? opponent : challenger;
  const effectiveAction = selectedMove?.action ?? action;
  const actionPower = selectedMove?.power ?? (effectiveAction === "defend" ? 25 : effectiveAction === "skill" ? 85 : 55);
  const actionPriority = selectedMove?.priority ?? 0;
  const actionCategory = selectedMove?.category ?? (effectiveAction === "skill" ? "special" : effectiveAction === "defend" ? "status" : "physical");
  const moveType = selectedMove?.type ?? getMoveType(effectiveAction, attacker);
  const statusProfile = actionCategory === "status" ? getStatusTypeProfile(moveType) : null;
  const attackerLevel = Math.max(1, attacker.level);
  const attackerAttack =
    actionCategory === "special"
      ? Math.max(1, Math.round(attacker.atk * 1.08))
      : actionCategory === "status"
        ? Math.max(1, Math.round(attacker.atk * 0.75))
        : attacker.atk;
  const defenderDefense =
    actionCategory === "special"
      ? Math.max(1, Math.round(defender.def * 0.92))
      : actionCategory === "status"
        ? Math.max(1, Math.round(defender.def * 1.1))
        : Math.max(1, defender.def);
  const levelComponent = Math.floor((2 * attackerLevel) / 5) + 2;
  const categoryMultiplier = actionCategory === "status" ? (statusProfile?.damageMultiplier ?? STATUS_DAMAGE_MULTIPLIER) : 1;
  const baseDamage = Math.floor(((levelComponent * actionPower * attackerAttack) / defenderDefense / 50 + 2) * categoryMultiplier);
  const stab = moveType.toLowerCase() === attacker.typePrimary.toLowerCase() ? SAME_TYPE_ATTACK_BONUS : 1;
  const typeEffectiveness = getTypeEffectiveness(moveType, defender);
  const randomFactor = 0.85 + Math.random() * 0.15;
  const criticalChance =
    actionCategory === "status"
      ? 0.01
      : Math.min(0.3, 0.04 + attacker.speed / 700 + (actionCategory === "special" ? 0.03 : 0));
  const criticalMultiplier = Math.random() < criticalChance ? CRIT_MULTIPLIER : 1;
  const damage = Math.max(MIN_DAMAGE, Math.floor(baseDamage * stab * typeEffectiveness * randomFactor * criticalMultiplier));

  defender.currentHp = Math.max(0, defender.currentHp - damage);

  const challengerHp = challenger.currentHp;
  const opponentHp = opponent.currentHp;
  const winner = challengerHp <= 0 ? "opponent" : opponentHp <= 0 ? "challenger" : null;
  const fallbackBySpeed = challenger.speed >= opponent.speed ? "challenger" : "opponent";
  const effectivePriority = actionCategory === "status" ? actionPriority + (statusProfile?.priorityBonus ?? 0) : actionPriority;
  const priorityNextAttacker =
    effectivePriority >= 2
      ? actor
      : effectivePriority <= -1
        ? actor === "challenger"
          ? "opponent"
          : "challenger"
        : fallbackBySpeed;
  const nextAttacker =
    !winner && actionCategory === "status" && Math.random() < (statusProfile?.controlChance ?? STATUS_CONTROL_CHANCE)
      ? actor
      : priorityNextAttacker;

  return {
    damage,
    nextAttacker,
    challengerHp,
    opponentHp,
    winner
  };
}
