import { IsOptional, IsString, Length } from "class-validator";

export class OpenLootBoxDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  boxType?: string;

  @IsOptional()
  @IsString()
  @Length(8, 80)
  requestId?: string;
}
