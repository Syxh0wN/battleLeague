import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  idToken!: string;
}
