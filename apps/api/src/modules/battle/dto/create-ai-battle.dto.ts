import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class CreateAiBattleDto {
  @IsString()
  @IsNotEmpty()
  challengerPokemonId!: string;

  @IsString()
  @IsIn(["easy", "normal", "hard"])
  difficulty!: "easy" | "normal" | "hard";
}
