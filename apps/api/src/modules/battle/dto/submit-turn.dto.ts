import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class SubmitTurnDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsString()
  @IsIn(["attack", "defend", "skill"])
  action!: "attack" | "defend" | "skill";
}
