import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { IngestionService } from "./ingestion.service";

class SyncCatalogDto {
  @IsInt()
  @Min(1)
  @Max(151)
  limit = 25;
}

@Controller("ingestion")
@UseGuards(JwtAuthGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post("syncCatalog")
  async syncCatalog(@CurrentUser() user: AuthUser, @Body() dto: SyncCatalogDto) {
    return this.ingestionService.syncCatalog(user.userId, dto.limit);
  }
}
