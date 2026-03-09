import { IsOptional, IsString, MaxLength } from "class-validator";

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  refreshToken?: string;
}
