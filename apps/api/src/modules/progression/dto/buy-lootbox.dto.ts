import { IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class BuyLootBoxDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  boxType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;

  @IsOptional()
  @IsString()
  @Length(8, 80)
  requestId?: string;
}
