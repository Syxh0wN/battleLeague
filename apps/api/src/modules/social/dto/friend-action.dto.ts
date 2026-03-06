import { IsNotEmpty, IsString } from "class-validator";

export class FriendActionDto {
  @IsString()
  @IsNotEmpty()
  friendshipId!: string;
}
