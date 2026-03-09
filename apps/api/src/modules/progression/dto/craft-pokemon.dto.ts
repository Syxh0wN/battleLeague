import { IsNotEmpty, IsString, Length } from "class-validator";

export class CraftPokemonDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  speciesName!: string;
}
