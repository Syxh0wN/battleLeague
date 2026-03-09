import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth-user.decorator";
import { AdminUserGuard } from "../../common/admin-user.guard";
import { AuthUser } from "../../common/auth-user.type";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Throttle } from "@nestjs/throttler";
import { IngestionService } from "./ingestion.service";

class SyncCatalogDto {
  @IsInt()
  @Min(1)
  @Max(1025)
  limit = 1025;
}

@Controller("ingestion")
@UseGuards(JwtAuthGuard, AdminUserGuard)
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post("syncCatalog")
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  async syncCatalog(@CurrentUser() user: AuthUser, @Body() dto: SyncCatalogDto) {
    return this.ingestionService.syncCatalog(user.userId, dto.limit);
  }
}
