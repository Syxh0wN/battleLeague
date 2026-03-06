import { IsNotEmpty, IsString } from "class-validator";

export class CreateBattleDto {
  @IsString()
  @IsNotEmpty()
  opponentUserId!: string;

  @IsString()
  @IsNotEmpty()
  challengerPokemonId!: string;
}
