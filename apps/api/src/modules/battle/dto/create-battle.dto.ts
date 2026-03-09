import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class CreateBattleDto {
  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  @Matches(/^[a-z0-9]+$/i)
  opponentUserId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  @Matches(/^[a-z0-9]+$/i)
  challengerPokemonId!: string;
}
