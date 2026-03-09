import { IsNotEmpty, IsOptional, IsString, Length } from "class-validator";

export class ClaimEventRewardDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 40)
  eventCode!: string;

  @IsOptional()
  @IsString()
  @Length(8, 80)
  requestId?: string;
}
