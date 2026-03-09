import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class FriendRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  @Matches(/^[a-z0-9]+$/i)
  targetUserId!: string;
}
