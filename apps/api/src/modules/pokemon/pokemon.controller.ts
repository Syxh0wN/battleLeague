import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClaimPokemonDto } from "./dto/claim-pokemon.dto";
import { PokemonService } from "./pokemon.service";

@Controller("pokemon")
@UseGuards(JwtAuthGuard)
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  @Get("species")
  async listSpecies() {
    return this.pokemonService.listSpecies();
  }

  @Get("my")
  async listMine(@CurrentUser() user: AuthUser) {
    return this.pokemonService.listMyPokemons(user.userId);
  }

  @Post("claimStarter")
  async claimStarter(@CurrentUser() user: AuthUser, @Body() dto: ClaimPokemonDto) {
    return this.pokemonService.claimStarter(user.userId, dto);
  }

  @Post("evolve/:userPokemonId")
  async evolve(@CurrentUser() user: AuthUser, @Param("userPokemonId") userPokemonId: string) {
    return this.pokemonService.evolvePokemon(user.userId, userPokemonId);
  }

  @Post("train/:userPokemonId")
  async train(@CurrentUser() user: AuthUser, @Param("userPokemonId") userPokemonId: string) {
    return this.pokemonService.trainPokemon(user.userId, userPokemonId);
  }
}
