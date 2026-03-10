import { IsNotEmpty, IsString } from "class-validator";

export class ClaimStarterBundleDto {
  @IsString()
  @IsNotEmpty()
  stageOneSpeciesName!: string;

  @IsString()
  @IsNotEmpty()
  stageTwoSpeciesName!: string;

  @IsString()
  @IsNotEmpty()
  stageThreeSpeciesName!: string;
}
