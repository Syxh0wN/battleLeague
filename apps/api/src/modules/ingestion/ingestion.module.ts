import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IngestionController } from "./ingestion.controller";
import { IngestionService } from "./ingestion.service";

@Module({
  imports: [AuthModule],
  controllers: [IngestionController],
  providers: [IngestionService]
})
export class IngestionModule {}
