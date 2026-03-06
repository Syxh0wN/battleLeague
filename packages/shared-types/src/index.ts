export type BattleStatus = "pending" | "active" | "finished" | "expired";

export type UserStats = {
  totalWins: number;
  totalLosses: number;
  totalBattles: number;
  winRate: number;
};

export type PokemonStats = {
  hp: number;
  atk: number;
  def: number;
  speed: number;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};
