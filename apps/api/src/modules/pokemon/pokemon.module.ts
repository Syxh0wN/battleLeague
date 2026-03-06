import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PokemonController } from "./pokemon.controller";
import { PokemonService } from "./pokemon.service";

@Module({
  imports: [AuthModule],
  controllers: [PokemonController],
  providers: [PokemonService],
  exports: [PokemonService]
})
export class PokemonModule {}
