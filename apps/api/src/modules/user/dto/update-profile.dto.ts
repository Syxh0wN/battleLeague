import { IsIn, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(3, 32)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-zA-Z0-9_@]+$/)
  accountTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @IsUrl({ require_protocol: true })
  @Matches(/^https:\/\/api\.dicebear\.com\/9\.x\/adventurer\/svg\?seed=BattleLeagueAvatar\d{2}$/)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(["male", "female"])
  gender?: "male" | "female";
}
