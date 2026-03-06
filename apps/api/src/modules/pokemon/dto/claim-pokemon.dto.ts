import { IsNotEmpty, IsString } from "class-validator";

export class ClaimPokemonDto {
  @IsString()
  @IsNotEmpty()
  speciesName!: string;
}
