import { IsNotEmpty, IsString } from "class-validator";

export class CompleteQuestDto {
  @IsString()
  @IsNotEmpty()
  questCode!: string;
}
