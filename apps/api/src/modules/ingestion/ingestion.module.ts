import { Module } from "@nestjs/common";
import { AdminUserGuard } from "../../common/admin-user.guard";
import { AuthModule } from "../auth/auth.module";
import { IngestionController } from "./ingestion.controller";
import { IngestionService } from "./ingestion.service";

@Module({
  imports: [AuthModule],
  controllers: [IngestionController],
  providers: [IngestionService, AdminUserGuard]
})
export class IngestionModule {}
