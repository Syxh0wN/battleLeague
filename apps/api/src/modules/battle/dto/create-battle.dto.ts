import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateBattleDto {
  @IsString()
  @IsNotEmpty()
  opponentUserId!: string;

  @IsString()
  @IsNotEmpty()
  challengerPokemonId!: string;

  @IsString()
  @IsNotEmpty()
  opponentPokemonId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  scheduleInMinutes?: number;
}
