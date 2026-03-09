import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class UpgradePokemonDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Length(8, 80, { each: true })
  sourcePokemonIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Length(2, 80, { each: true })
  targetSpeciesNames!: string[];

  @IsOptional()
  @IsString()
  @Length(8, 80)
  requestId?: string;
}
