import { IsNotEmpty, IsString, Length, Matches } from "class-validator";

export class FriendActionDto {
  @IsString()
  @IsNotEmpty()
  @Length(8, 64)
  @Matches(/^[a-z0-9]+$/i)
  friendshipId!: string;
}
